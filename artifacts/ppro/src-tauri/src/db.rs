// Pedigree PRO — Database Initialization (SQLCipher)
use rusqlite::Connection;
use sha2::Sha256;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;

use pbkdf2::pbkdf2_hmac;
use sha2::Sha512;

use tauri::Manager;
use base64::Engine;
use sha2::Digest;

/// PBKDF2 iteration count per ADR-003 §3.2.1.
const PBKDF2_ITERATIONS: u32 = 256_000;
const KEY_LEN: usize = 32;
const KEY_FILE: &str = "data.key";

pub fn init_db(app: &AppHandle) -> Result<Connection, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    fs::create_dir_all(&app_dir)
        .map_err(|e| format!("Failed to create app data dir: {}", e))?;

    let db_path = app_dir.join("data.db");
    let key_path = app_dir.join(KEY_FILE);
    let db_exists = db_path.exists();

    // Get or generate master secret (stored in data.key file)
    let master_secret = get_or_create_master_secret(&key_path)?;
    let device_id = get_or_create_device_id(&db_path, db_exists)?;

    let mut derived_key = vec![0u8; KEY_LEN];
    pbkdf2_hmac::<Sha512>(
        &master_secret,
        device_id.as_bytes(),
        PBKDF2_ITERATIONS,
        &mut derived_key,
    );
    let key_hex = hex::encode(&derived_key);

    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    conn.execute_batch(&format!("PRAGMA key = \"x'{}'\";", key_hex))
        .map_err(|e| format!("Failed to set SQLCipher key: {}", e))?;

    let integrity_ok = conn.execute_batch("SELECT count(*) FROM sqlite_master;").is_ok();

    if !integrity_ok {
        if db_exists {
            let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
            let quarantine_dir = app_dir.join("quarantine").join(format!("corrupt_{}", timestamp));
            let _ = fs::create_dir_all(&quarantine_dir);
            eprintln!(
                "WARNING: Database at {} failed integrity check (key mismatch or corruption). Quarantining to {}.",
                db_path.display(),
                quarantine_dir.display()
            );
            drop(conn);
            let _ = fs::rename(&db_path, quarantine_dir.join("data.db"));
            let wal_path = db_path.with_extension("db-wal");
            if wal_path.exists() {
                let _ = fs::rename(&wal_path, quarantine_dir.join("data.db-wal"));
            }
            let shm_path = db_path.with_extension("db-shm");
            if shm_path.exists() {
                let _ = fs::rename(&shm_path, quarantine_dir.join("data.db-shm"));
            }
            if key_path.exists() {
                let _ = fs::copy(&key_path, quarantine_dir.join(KEY_FILE));
            }
            return Err(format!(
                "Database failed integrity check (possible key mismatch or corruption). Existing files have been safely quarantined to {}. Please restore from backup or contact support.",
                quarantine_dir.display()
            ));
        }
        return Err(format!(
            "Database failed to open or initialize at {}.",
            db_path.display()
        ));
    }

    run_migrations(&conn)?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("Failed to set WAL mode: {}", e))?;

    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

    persist_device_id(&conn, &device_id)?;

    Ok(conn)
}

fn get_or_create_master_secret(key_path: &PathBuf) -> Result<Vec<u8>, String> {
    use keyring::Entry;

    let service = "org.pedigreepro.app";
    let username = "db_master_secret";

    // 1. Try to read from OS keychain
    if let Ok(entry) = Entry::new(service, username) {
        if let Ok(secret_b64) = entry.get_password() {
            if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(secret_b64.trim()) {
                return Ok(decoded);
            }
        }
    }

    // 2. Fall back: check if legacy key file exists on disk
    if key_path.exists() {
        if let Ok(secret_b64) = fs::read_to_string(key_path) {
            if let Ok(decoded) = base64::engine::general_purpose::STANDARD.decode(secret_b64.trim()) {
                // Try to migrate to keyring for future launches
                if let Ok(entry) = Entry::new(service, username) {
                    let _ = entry.set_password(secret_b64.trim());
                }
                return Ok(decoded);
            }
        }
    }

    // 3. Generate a new secret
    let mut secret = vec![0u8; 32];
    {
        use rand::RngCore;
        rand::rngs::OsRng.fill_bytes(&mut secret);
    }
    let secret_b64 = base64::engine::general_purpose::STANDARD.encode(&secret);

    // 4. Try to write to OS keychain
    let mut keychain_saved = false;
    if let Ok(entry) = Entry::new(service, username) {
        if entry.set_password(&secret_b64).is_ok() {
            keychain_saved = true;
        }
    }

    // 5. Fallback: If OS keychain fails, write to the file-based storage
    if !keychain_saved {
        eprintln!("WARNING: Failed to write master secret to OS keychain. Falling back to file storage.");
        fs::write(key_path, &secret_b64)
            .map_err(|e| format!("Failed to write key file: {}", e))?;
    }

    Ok(secret)
}

fn get_or_create_device_id(db_path: &PathBuf, _db_exists: bool) -> Result<String, String> {
    let mut hasher = Sha256::new();
    hasher.update(db_path.to_string_lossy().as_bytes());
    let hash = hasher.finalize();
    let id = hex::encode(&hash[..16]);
    Ok(format!("device-{}", &id[..12]))
}

pub fn read_device_id_from_db(conn: &Connection) -> Option<String> {
    conn.query_row(
        "SELECT device_id FROM app_preferences LIMIT 1",
        [],
        |row| row.get(0),
    )
    .ok()
}

pub fn rotate_encryption_key(app: &tauri::AppHandle, conn: &Connection) -> Result<(), String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let key_path = app_dir.join(KEY_FILE);

    let mut new_secret = vec![0u8; 32];
    {
        use rand::RngCore;
        rand::rngs::OsRng.fill_bytes(&mut new_secret);
    }

    let device_id = read_device_id_from_db(conn)
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());

    let mut derived_key = vec![0u8; 32];
    pbkdf2_hmac::<Sha512>(
        &new_secret,
        device_id.as_bytes(),
        PBKDF2_ITERATIONS,
        &mut derived_key,
    );
    let new_key_hex = hex::encode(&derived_key);

    conn.execute_batch(&format!("PRAGMA rekey = \"x'{}'\";", new_key_hex))
        .map_err(|e| format!("Failed to rekey database: {}", e))?;

    let new_secret_b64 = base64::engine::general_purpose::STANDARD.encode(&new_secret);

    // 1. Synchronize OS keychain first
    let service = "org.pedigreepro.app";
    let username = "db_master_secret";
    let mut keychain_saved = false;
    if let Ok(entry) = keyring::Entry::new(service, username) {
        if entry.set_password(&new_secret_b64).is_ok() {
            keychain_saved = true;
        } else {
            eprintln!("WARNING: Failed to update master secret in OS keychain.");
        }
    }

    // 2. Fallback: only write key file if OS keychain failed
    if !keychain_saved {
        eprintln!("WARNING: Falling back to file storage for master secret.");
        fs::write(&key_path, &new_secret_b64)
            .map_err(|e| format!("Failed to write key file: {}", e))?;
    } else if key_path.exists() {
        // If keychain succeeded and a legacy file exists, delete it for security
        let _ = fs::remove_file(&key_path);
    }

    Ok(())
}

pub fn backup_database(app: &tauri::AppHandle) -> Result<String, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let db_path = app_dir.join("data.db");
    if !db_path.exists() {
        return Err("No database found to back up".to_string());
    }

    let backups_dir = app_dir.join("backups");
    fs::create_dir_all(&backups_dir)
        .map_err(|e| format!("Failed to create backups directory: {}", e))?;

    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let backup_name = format!("data_backup_{}.db", timestamp);
    let backup_path = backups_dir.join(&backup_name);

    fs::copy(&db_path, &backup_path)
        .map_err(|e| format!("Failed to copy database: {}", e))?;

    // Rolling retention: keep the 10 most recent backups
    if let Ok(entries) = fs::read_dir(&backups_dir) {
        let mut backup_files: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| {
                let name = e.file_name().to_string_lossy().to_string();
                name.starts_with("data_backup_") && name.ends_with(".db")
            })
            .collect();
        backup_files.sort_by_key(|e| std::cmp::Reverse(e.file_name()));
        if backup_files.len() > 10 {
            for old_file in &backup_files[10..] {
                let _ = fs::remove_file(old_file.path());
            }
        }
    }

    Ok(backup_path.to_string_lossy().to_string())
}

fn validate_backup_file(app: &tauri::AppHandle, backup_path: &str) -> Result<(), String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;
    let key_path = app_dir.join(KEY_FILE);
    let db_path = app_dir.join("data.db");
    let master_secret = get_or_create_master_secret(&key_path)?;
    let device_id = get_or_create_device_id(&db_path, true)?;

    let mut derived_key = vec![0u8; KEY_LEN];
    pbkdf2_hmac::<Sha512>(
        &master_secret,
        device_id.as_bytes(),
        PBKDF2_ITERATIONS,
        &mut derived_key,
    );
    let key_hex = hex::encode(&derived_key);

    let test_conn = Connection::open(backup_path)
        .map_err(|e| format!("Failed to open backup file: {}", e))?;
    test_conn
        .execute_batch(&format!("PRAGMA key = \"x'{}'\";", key_hex))
        .map_err(|e| format!("Failed to set SQLCipher key on backup: {}", e))?;

    let count: Result<i64, _> = test_conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get(0));
    if count.is_err() {
        return Err("Invalid backup file: failed decryption or integrity check (corrupted or incompatible key)".to_string());
    }

    Ok(())
}

pub fn restore_database(app: &tauri::AppHandle, backup_path: &str) -> Result<(), String> {
    crate::commands::validate_import_path(app, backup_path)?;

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let db_path = app_dir.join("data.db");

    if !std::path::Path::new(backup_path).exists() {
        return Err(format!("Backup file not found: {}", backup_path));
    }

    // Validate SQLCipher encrypted backup by attempting to decrypt/read sqlite_master
    validate_backup_file(app, backup_path)?;

    if db_path.exists() {
        let safety_backup = app_dir.join(format!(
            "data_pre_restore_{}.db",
            chrono::Utc::now().format("%Y%m%d_%H%M%S")
        ));
        let _ = fs::copy(&db_path, &safety_backup);

        // Prune older safety snapshots to keep at most the latest 2
        if let Ok(entries) = fs::read_dir(&app_dir) {
            let mut snapshots: Vec<PathBuf> = entries
                .filter_map(|e| e.ok().map(|d| d.path()))
                .filter(|p| {
                    p.file_name()
                        .and_then(|n| n.to_str())
                        .map(|s| s.starts_with("data_pre_restore_") && s.ends_with(".db"))
                        .unwrap_or(false)
                })
                .collect();
            snapshots.sort();
            while snapshots.len() > 2 {
                let oldest = snapshots.remove(0);
                let _ = fs::remove_file(oldest);
            }
        }
    }

    // Remove old WAL/SHM to avoid state mismatch
    let wal_path = db_path.with_extension("db-wal");
    if wal_path.exists() {
        let _ = fs::remove_file(&wal_path);
    }
    let shm_path = db_path.with_extension("db-shm");
    if shm_path.exists() {
        let _ = fs::remove_file(&shm_path);
    }

    fs::copy(backup_path, &db_path)
        .map_err(|e| format!("Failed to restore database: {}", e))?;

    Ok(())
}

pub fn list_safety_snapshots(app: &tauri::AppHandle) -> Result<Vec<crate::commands::SafetySnapshot>, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let mut snapshots = Vec::new();
    if let Ok(entries) = fs::read_dir(&app_dir) {
        let mut files: Vec<PathBuf> = entries
            .filter_map(|e| e.ok().map(|d| d.path()))
            .filter(|p| {
                p.file_name()
                    .and_then(|n| n.to_str())
                    .map(|s| s.starts_with("data_pre_restore_") && s.ends_with(".db"))
                    .unwrap_or(false)
            })
            .collect();
        files.sort();
        files.reverse(); // Newest first

        for file in files {
            if let Some(name) = file.file_name().and_then(|n| n.to_str()) {
                // Parse timestamp from name like "data_pre_restore_20260821_193000.db"
                let created_at = if let Ok(meta) = fs::metadata(&file) {
                    if let Ok(created) = meta.created().or_else(|_| meta.modified()) {
                        let dt: chrono::DateTime<chrono::Utc> = created.into();
                        dt.to_rfc3339()
                    } else {
                        chrono::Utc::now().to_rfc3339()
                    }
                } else {
                    chrono::Utc::now().to_rfc3339()
                };

                snapshots.push(crate::commands::SafetySnapshot {
                    id: file.to_string_lossy().to_string(),
                    created_at,
                });
            }
        }
    }

    Ok(snapshots)
}

pub fn wipe_all_database_data(app_dir: &PathBuf) -> Result<(), String> {
    use keyring::Entry;

    // 1. Delete data.db, data.db-wal, data.db-shm
    let db_path = app_dir.join("data.db");
    let _ = fs::remove_file(&db_path);
    let _ = fs::remove_file(db_path.with_extension("db-wal"));
    let _ = fs::remove_file(db_path.with_extension("db-shm"));
    let _ = fs::remove_file(app_dir.join(KEY_FILE));

    // 2. Delete all backups and quarantined databases
    let backups_dir = app_dir.join("backups");
    if backups_dir.exists() {
        let _ = fs::remove_dir_all(&backups_dir);
    }
    let quarantine_dir = app_dir.join("quarantine");
    if quarantine_dir.exists() {
        let _ = fs::remove_dir_all(&quarantine_dir);
    }

    if let Ok(entries) = fs::read_dir(app_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if let Some(file_name) = path.file_name().and_then(|n| n.to_str()) {
                if file_name.starts_with("data_backup_") || file_name.starts_with("data_pre_restore_") {
                    let _ = fs::remove_file(path);
                }
            }
        }
    }

    // 3. Delete master secret from keychain
    if let Ok(entry) = Entry::new("org.pedigreepro.app", "db_master_secret") {
        let _ = entry.delete_password();
    }

    Ok(())
}

fn persist_device_id(conn: &Connection, device_id: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO app_preferences (device_id, theme, updated_at)
         VALUES (?1, 'clinical', datetime('now'))
         ON CONFLICT(device_id) DO UPDATE
         SET device_id = ?1, updated_at = datetime('now')",
        rusqlite::params![device_id],
    )
    .map_err(|e| format!("Failed to persist device_id: {}", e))?;
    Ok(())
}

fn run_migrations(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS _migrations (
            version     INTEGER PRIMARY KEY,
            name        TEXT NOT NULL,
            applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
        );",
    )
    .map_err(|e| format!("Failed to create _migrations table: {}", e))?;

    let migrations: Vec<(i32, &str, &str)> = vec![
        (
            1,
            "001_initial",
            include_str!("../../../../lib/db/migrations/001_initial.sql"),
        ),
        (
            2,
            "002_clinical_annotations",
            include_str!("../../../../lib/db/migrations/002_clinical_annotations.sql"),
        ),
        (
            3,
            "003_drop_deprecated_columns",
            include_str!("../../../../lib/db/migrations/003_drop_deprecated_columns.sql"),
        ),
        (
            4,
            "004_share_log",
            include_str!("../../../../lib/db/migrations/004_share_log.sql"),
        ),
        (
            5,
            "005_share_links",
            include_str!("../../../../lib/db/migrations/005_share_links.sql"),
        ),
        (
            6,
            "006_nodes_couple_counts",
            include_str!("../../../../lib/db/migrations/006_nodes_couple_counts.sql"),
        ),
    ];

    for (version, name, sql) in &migrations {
        let already_applied: bool = conn
            .query_row(
                "SELECT COUNT(*) > 0 FROM _migrations WHERE version = ?1",
                rusqlite::params![version],
                |row| row.get(0),
            )
            .unwrap_or(false);

        if already_applied {
            continue;
        }

        conn.execute_batch(sql)
            .map_err(|e| format!("Migration {} ({}) failed: {}", version, name, e))?;

        conn.execute(
            "INSERT INTO _migrations (version, name) VALUES (?1, ?2)",
            rusqlite::params![version, name],
        )
        .map_err(|e| format!("Failed to record migration {}: {}", version, e))?;
    }

    Ok(())
}