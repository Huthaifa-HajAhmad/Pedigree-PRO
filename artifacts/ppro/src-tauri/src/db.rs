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

    conn.execute_batch("SELECT count(*) FROM sqlite_master;")
        .map_err(|_| {
            format!(
                "Database appears corrupt or wrong key. Delete {} and restart.",
                db_path.display()
            )
        })?;

    run_migrations(&conn)?;

    conn.execute_batch("PRAGMA journal_mode=WAL;")
        .map_err(|e| format!("Failed to set WAL mode: {}", e))?;

    conn.execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to enable foreign keys: {}", e))?;

    persist_device_id(&conn, &device_id)?;

    Ok(conn)
}

fn get_or_create_master_secret(key_path: &PathBuf) -> Result<Vec<u8>, String> {
    if key_path.exists() {
        let secret_b64 = fs::read_to_string(key_path)
            .map_err(|e| format!("Failed to read key file: {}", e))?;
        return base64::engine::general_purpose::STANDARD
            .decode(secret_b64.trim())
            .map_err(|e| format!("Failed to decode master secret: {}", e));
    }

    let mut secret = vec![0u8; 32];
    {
        use rand::RngCore;
        rand::rngs::OsRng.fill_bytes(&mut secret);
    }

    // SECURITY NOTE: The SQLCipher master secret is written to disk as base64 plaintext.
    // This is an obfuscation-only measure — the file is NOT encrypted at rest.
    // For production, replace this with OS keychain integration (e.g. keyring crate on
    // macOS Keychain, Windows Credential Manager, Linux Secret Service) so the secret
    // never touches the filesystem unencrypted.
    let secret_b64 = base64::engine::general_purpose::STANDARD.encode(&secret);
    fs::write(key_path, &secret_b64)
        .map_err(|e| format!("Failed to write key file: {}", e))?;

    Ok(secret)
}

fn get_or_create_device_id(db_path: &PathBuf, db_exists: bool) -> Result<String, String> {
    if !db_exists {
        return Ok(uuid::Uuid::new_v4().to_string());
    }
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
    fs::write(&key_path, &new_secret_b64)
        .map_err(|e| format!("Failed to write key file: {}", e))?;

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

    // Also copy the key file
    let key_path = app_dir.join(KEY_FILE);
    if key_path.exists() {
        let key_backup = backups_dir.join(format!("data_backup_{}.key", timestamp));
        fs::copy(&key_path, &key_backup).ok();
    }

    Ok(backup_path.to_string_lossy().to_string())
}

pub fn restore_database(app: &tauri::AppHandle, backup_path: &str) -> Result<(), String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Failed to get app data dir: {}", e))?;

    let db_path = app_dir.join("data.db");

    if !std::path::Path::new(backup_path).exists() {
        return Err(format!("Backup file not found: {}", backup_path));
    }

    if db_path.exists() {
        let safety_backup = app_dir.join(format!(
            "data_pre_restore_{}.db",
            chrono::Utc::now().format("%Y%m%d_%H%M%S")
        ));
        fs::copy(&db_path, &safety_backup)
            .map_err(|e| format!("Failed to create safety backup: {}", e))?;
    }

    fs::copy(backup_path, &db_path)
        .map_err(|e| format!("Failed to restore database: {}", e))?;

    Ok(())
}

fn persist_device_id(conn: &Connection, device_id: &str) -> Result<(), String> {
    conn.execute(
        "INSERT INTO app_preferences (device_id, theme, updated_at)
         VALUES (?1, 'terminal', datetime('now'))
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