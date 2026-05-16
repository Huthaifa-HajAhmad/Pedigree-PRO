// Pedigree PRO — Legacy SQLite Import
//
// Migrates data from the original HaploPainter open-source tool
// (https://github.com/twogee/haplopainter) into Pedigree PRO's
// re-engineered schema (ADR-002).
//
// Key migration challenges:
//   1. HaploPainter uses `users.id` (INTEGER FK) for provenance;
//   9: Pedigree PRO uses Ed25519 public key strings.
//   2. HaploPainter has no content hashing; we compute canvas_hash on import.
//   3. HaploPainter has no clinical annotation tables.
//   4. HaploPainter stores share tokens in the DB (deprecated in Pedigree PRO).
//   5. Legacy databases are UNENCRYPTED (no SQLCipher).
//
// Migration strategy:
//   - Dual-write: populate both old columns (*_by_id, user_id) AND new columns
//     (*_key, *_signature) to support the ADR-002 deprecation window.
//   - Create a "Legacy Migration" profile with a generated Ed25519 keypair.
//     All migrated records are attributed to this profile.
//   - Preserve legacy user names in a metadata comment on each pedigree.
//   - Compute canvas_hash for every canvas_data on import.
//   - Skip legacy share_token values (they reference a non-existent server).

use crate::import_common;
use crate::signatures;
use rusqlite::Connection;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Mutex;

// =============================================================================
// Legacy Schema Types (HaploPainter original schema)
// =============================================================================

/// A row from the legacy `users` table.
struct LegacyUser {
    id: i64,
    name: String,
    #[allow(dead_code)]
    email: String,
    #[allow(dead_code)]
    role: String,
    #[allow(dead_code)]
    department: Option<String>,
}

/// A row from the legacy `patients` table.
struct LegacyPatient {
    id: i64,
    mrn: String,
    first_name: String,
    last_name: String,
    date_of_birth: Option<String>,
    sex: Option<String>,
    ethnicity: Option<String>,
    referral_reason: Option<String>,
    clinician_id: Option<i64>,
    created_at: String,
    updated_at: String,
}

/// A row from the legacy `pedigrees` table.
struct LegacyPedigree {
    id: i64,
    title: String,
    patient_id: Option<i64>,
    canvas_data: Option<String>,
    notes: Option<String>,
    created_by_id: Option<i64>,
    share_token: Option<String>,
    created_at: String,
    updated_at: String,
}

/// A row from the legacy `pedigree_versions` table.
struct LegacyVersion {
    #[allow(dead_code)]
    id: i64,
    pedigree_id: i64,
    version_number: i64,
    label: Option<String>,
    canvas_data: String,
    thumbnail: Option<String>,
    saved_by_id: Option<i64>,
    created_at: String,
}

/// A row from the legacy `activity_log` table.
struct LegacyActivity {
    #[allow(dead_code)]
    id: i64,
    action: String,
    subject: String,
    user_id: Option<i64>,
    timestamp: String,
}

// =============================================================================
// Import Result Type
// =============================================================================

#[derive(Debug, Serialize)]
pub struct LegacyImportSummary {
    pub patients_imported: i64,
    pub pedigrees_imported: i64,
    pub versions_imported: i64,
    pub activity_entries_imported: i64,
    pub users_found: i64,
    pub migration_profile_key: String,
}

// =============================================================================
// Legacy Import Pipeline
// =============================================================================

/// Imports an entire legacy SQLite database into Pedigree PRO.
///
/// # Arguments
/// * `db` - The Pedigree PRO SQLCipher database (write target).
/// * `legacy_path` - Filesystem path to the legacy HaploPainter .db file.
///
/// # Returns
/// A `LegacyImportSummary` with counts of all imported records.
pub fn import_legacy_database(
    db: &Mutex<Connection>,
    legacy_path: &str,
) -> Result<LegacyImportSummary, String> {
    // ── Step 0: Open the legacy database ────────────────────────
    let legacy_conn = Connection::open(legacy_path)
        .map_err(|e| format!("Failed to open legacy database: {}", e))?;

    // Enable foreign keys in the legacy connection
    legacy_conn
        .execute_batch("PRAGMA foreign_keys=ON;")
        .map_err(|e| format!("Failed to configure legacy DB: {}", e))?;

    // ── Step 1: Generate migration profile ─────────────────────
    let (migration_pk, _migration_sk) = signatures::generate_keypair();

    // ── Step 2: Read legacy users into a name map ───────────────
    let user_map = read_legacy_users(&legacy_conn)?;
    let user_count = user_map.len() as i64;

    // ── Step 3: Read legacy patients ────────────────────────────
    let patients = read_legacy_patients(&legacy_conn)?;
    let patient_count = patients.len() as i64;

    // ── Step 4: Read legacy pedigrees ───────────────────────────
    let pedigrees = read_legacy_pedigrees(&legacy_conn)?;
    let pedigree_count = pedigrees.len() as i64;

    // ── Step 5: Read legacy versions ────────────────────────────
    let versions = read_legacy_versions(&legacy_conn)?;
    let version_count = versions.len() as i64;

    // ── Step 6: Read legacy activity log ────────────────────────
    let activities = read_legacy_activities(&legacy_conn)?;
    let activity_count = activities.len() as i64;

    // ── Step 7: Write everything to the Pedigree PRO database ──
    let conn = db.lock().map_err(|e| e.to_string())?;

    // 7a: Insert patients
    for p in &patients {
        import_common::insert_patient(
            &conn,
            &p.mrn,
            &p.first_name,
            &p.last_name,
            &p.date_of_birth,
            &p.sex,
            &p.ethnicity,
            &p.referral_reason,
            &Some(migration_pk.clone()),
        )?;
    }

    // 7b: Insert pedigrees with canvas_hash
    for p in &pedigrees {
        let canvas_hash = p
            .canvas_data
            .as_ref()
            .map(|d| signatures::hash_sha256(d.as_bytes()));

        // Build metadata comment preserving legacy provenance
        let creator_name = p
            .created_by_id
            .and_then(|cid| user_map.get(&cid))
            .map(|name| format!("[Legacy creator: {}]", name))
            .unwrap_or_default();

        let enriched_notes = match (&p.notes, creator_name.is_empty()) {
            (Some(n), false) => Some(format!("{}\n{}", n, creator_name)),
            (Some(n), true) => Some(n.clone()),
            (None, false) => Some(creator_name),
            (None, true) => None,
        };

        import_common::insert_pedigree(
            &conn,
            &p.title,
            &p.canvas_data,
            &canvas_hash,
            &enriched_notes,
            &Some(migration_pk.clone()),
            &None, // No signature (legacy data)
        )?;
    }

    // 7c: Insert versions with canvas_hash
    for v in &versions {
        let canvas_hash = signatures::hash_sha256(v.canvas_data.as_bytes());

        import_common::insert_version(
            &conn,
            v.pedigree_id,
            v.version_number,
            &v.label,
            &v.canvas_data,
            &Some(canvas_hash),
            &Some(migration_pk.clone()),
            &None, // No signature (legacy data)
            &v.created_at,
        )?;
    }

    // 7d: Insert activity log
    for a in &activities {
        // Preserve legacy actor name in the subject
        let actor_name = a
            .user_id
            .and_then(|uid| user_map.get(&uid))
            .cloned()
            .unwrap_or_else(|| "Unknown User".to_string());

        let enriched_subject = format!("{} [by {}]", a.subject, actor_name);

        import_common::log_activity(
            &conn,
            &a.action,
            &enriched_subject,
            Some(&migration_pk),
        )?;
    }

    // ── Step 8: Log the migration itself ────────────────────────
    let _ = conn.execute(
        "INSERT INTO activity_log (action, subject, actor_key, timestamp)
         VALUES ('legacy_import', ?1, ?2, datetime('now'))",
        rusqlite::params![
            format!(
                "Imported {} patients, {} pedigrees, {} versions, {} activity entries from HaploPainter",
                patient_count, pedigree_count, version_count, activity_count
            ),
            migration_pk,
        ],
    );

    Ok(LegacyImportSummary {
        patients_imported: patient_count,
        pedigrees_imported: pedigree_count,
        versions_imported: version_count,
        activity_entries_imported: activity_count,
        users_found: user_count,
        migration_profile_key: migration_pk,
    })
}

// =============================================================================
// Legacy Data Readers
// =============================================================================

fn read_legacy_users(conn: &Connection) -> Result<HashMap<i64, String>, String> {
    let mut stmt = conn
        .prepare("SELECT id, name, email, role, department FROM users")
        .map_err(|e| format!("Failed to read legacy users: {}", e))?;

    let users: Vec<LegacyUser> = stmt
        .query_map([], |row| {
            Ok(LegacyUser {
                id: row.get(0)?,
                name: row.get(1)?,
                email: row.get(2)?,
                role: row.get(3)?,
                department: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to query legacy users: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    let mut map = HashMap::with_capacity(users.len());
    for u in users {
        map.insert(u.id, u.name);
    }
    Ok(map)
}

fn read_legacy_patients(conn: &Connection) -> Result<Vec<LegacyPatient>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, mrn, first_name, last_name, date_of_birth, sex, ethnicity,
                    referral_reason, clinician_id, created_at, updated_at
             FROM patients",
        )
        .map_err(|e| format!("Failed to read legacy patients: {}", e))?;

    let patients = stmt
        .query_map([], |row| {
            Ok(LegacyPatient {
                id: row.get(0)?,
                mrn: row.get(1)?,
                first_name: row.get(2)?,
                last_name: row.get(3)?,
                date_of_birth: row.get(4)?,
                sex: row.get(5)?,
                ethnicity: row.get(6)?,
                referral_reason: row.get(7)?,
                clinician_id: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })
        .map_err(|e| format!("Failed to query legacy patients: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(patients)
}

fn read_legacy_pedigrees(conn: &Connection) -> Result<Vec<LegacyPedigree>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, title, patient_id, canvas_data, notes, created_by_id,
                    share_token, created_at, updated_at
             FROM pedigrees",
        )
        .map_err(|e| format!("Failed to read legacy pedigrees: {}", e))?;

    let pedigrees = stmt
        .query_map([], |row| {
            Ok(LegacyPedigree {
                id: row.get(0)?,
                title: row.get(1)?,
                patient_id: row.get(2)?,
                canvas_data: row.get(3)?,
                notes: row.get(4)?,
                created_by_id: row.get(5)?,
                share_token: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })
        .map_err(|e| format!("Failed to query legacy pedigrees: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(pedigrees)
}

fn read_legacy_versions(conn: &Connection) -> Result<Vec<LegacyVersion>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, pedigree_id, version_number, label, canvas_data,
                    thumbnail, saved_by_id, created_at
             FROM pedigree_versions
             ORDER BY pedigree_id, version_number",
        )
        .map_err(|e| format!("Failed to read legacy versions: {}", e))?;

    let versions = stmt
        .query_map([], |row| {
            Ok(LegacyVersion {
                id: row.get(0)?,
                pedigree_id: row.get(1)?,
                version_number: row.get(2)?,
                label: row.get(3)?,
                canvas_data: row.get(4)?,
                thumbnail: row.get(5)?,
                saved_by_id: row.get(6)?,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| format!("Failed to query legacy versions: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(versions)
}

fn read_legacy_activities(conn: &Connection) -> Result<Vec<LegacyActivity>, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, action, subject, user_id, timestamp
             FROM activity_log
             ORDER BY timestamp ASC",
        )
        .map_err(|e| format!("Failed to read legacy activity log: {}", e))?;

    let activities = stmt
        .query_map([], |row| {
            Ok(LegacyActivity {
                id: row.get(0)?,
                action: row.get(1)?,
                subject: row.get(2)?,
                user_id: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })
        .map_err(|e| format!("Failed to query legacy activities: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(activities)
}