// Pedigree PRO — Tauri Command Handlers
//
// Each command mirrors the existing Express API route logic from
// artifacts/api-server/src/routes/, adapted for local SQLite access.
// All mutations include cryptographic signatures per ADR-001.
//
// Critical fixes applied (Phase 0-C hardening):
//   - PedigreeInput/VersionInput: accept creator_signature / saver_signature
//   - create_pedigree / save_version: store signatures in INSERT
//   - get_preferences / save_preferences: use persistent device UUID from db.rs
//   - list_pedigrees: compute node_count dynamically from canvas_data JSON
//   - Profile CRUD: full activity_log entries

use crate::db;
use crate::signatures;
use crate::AppState;
use rusqlite::params;
use serde::{Deserialize, Serialize};
use tauri::State;

// =============================================================================
// Type Definitions
// =============================================================================

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Profile {
    pub id: String,
    pub display_name: String,
    pub role_label: String,
    pub public_key: String,
    pub created_at: String,
    pub last_used_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProfileInput {
    pub display_name: String,
    pub role_label: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Patient {
    pub id: i64,
    pub mrn: String,
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: Option<String>,
    pub sex: Option<String>,
    pub ethnicity: Option<String>,
    pub referral_reason: Option<String>,
    pub clinician_id: Option<i64>,
    pub clinician_key: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PatientInput {
    pub mrn: String,
    pub first_name: String,
    pub last_name: String,
    pub date_of_birth: Option<String>,
    pub sex: Option<String>,
    pub ethnicity: Option<String>,
    pub referral_reason: Option<String>,
    pub clinician_key: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PedigreeSummary {
    pub id: i64,
    pub title: String,
    pub patient_id: Option<i64>,
    pub node_count: i64,
    pub version_count: i64,
    pub creator_key: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Internal row from SQL query (includes canvas_data for post-processing).
struct SummaryRow {
    id: i64,
    title: String,
    patient_id: Option<i64>,
    canvas_data: Option<String>,
    version_count: i64,
    creator_key: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Pedigree {
    pub id: i64,
    pub title: String,
    pub patient_id: Option<i64>,
    pub canvas_data: Option<String>,
    pub canvas_hash: Option<String>,
    pub notes: Option<String>,
    pub creator_key: Option<String>,
    pub creator_signature: Option<String>,
    pub share_token: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PedigreeInput {
    pub title: String,
    pub patient_id: Option<i64>,
    pub canvas_data: Option<String>,
    pub notes: Option<String>,
    pub creator_key: String,
    /// Ed25519 signature over (canvas_hash || created_at), computed by the frontend
    /// using the creator's private key from the OS keychain.
    pub creator_signature: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PedigreeVersion {
    pub id: i64,
    pub pedigree_id: i64,
    pub version_number: i64,
    pub label: Option<String>,
    pub canvas_data: String,
    pub canvas_hash: Option<String>,
    pub thumbnail: Option<String>,
    pub saver_key: Option<String>,
    pub saver_signature: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct VersionInput {
    pub label: Option<String>,
    pub canvas_data: String,
    pub thumbnail: Option<String>,
    pub saver_key: String,
    /// Ed25519 signature over (canvas_hash || created_at), computed by the frontend
    /// using the saver's private key from the OS keychain.
    pub saver_signature: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardStats {
    pub total_patients: i64,
    pub total_pedigrees: i64,
    pub total_profiles: i64,
    pub pedigrees_this_week: i64,
    pub pedigrees_this_month: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ActivityItem {
    pub id: i64,
    pub action: String,
    pub subject: String,
    pub actor_key: Option<String>,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Preferences {
    pub device_id: String,
    pub theme: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ShareResult {
    pub share_token: String,
    pub share_url: String,
}

// =============================================================================
// Profile Commands
// =============================================================================

#[tauri::command]
pub fn create_profile(
    state: State<AppState>,
    input: ProfileInput,
) -> Result<Profile, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();
    let (public_key, _private_key) = signatures::generate_keypair();

    db.execute(
        "INSERT INTO local_profiles (id, display_name, role_label, public_key, created_at, last_used_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'), datetime('now'))",
        params![id, input.display_name, input.role_label, public_key],
    )
    .map_err(|e| format!("Failed to create profile: {}", e))?;

    // Log activity
    let _ = db.execute(
        "INSERT INTO activity_log (action, subject, actor_key, timestamp)
         VALUES ('profile_created', ?1, ?2, datetime('now'))",
        params![input.display_name, public_key],
    );

    Ok(Profile {
        id,
        display_name: input.display_name,
        role_label: input.role_label,
        public_key,
        created_at: chrono::Utc::now().to_rfc3339(),
        last_used_at: chrono::Utc::now().to_rfc3339(),
    })
}

#[tauri::command]
pub fn list_profiles(state: State<AppState>) -> Result<Vec<Profile>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, display_name, role_label, public_key, created_at, last_used_at
             FROM local_profiles ORDER BY last_used_at DESC",
        )
        .map_err(|e| format!("Failed to prepare query: {}", e))?;

    let profiles = stmt
        .query_map([], |row| {
            Ok(Profile {
                id: row.get(0)?,
                display_name: row.get(1)?,
                role_label: row.get(2)?,
                public_key: row.get(3)?,
                created_at: row.get(4)?,
                last_used_at: row.get(5)?,
            })
        })
        .map_err(|e| format!("Failed to query profiles: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(profiles)
}

#[tauri::command]
pub fn switch_profile(state: State<AppState>, profile_id: String) -> Result<Profile, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    db.execute(
        "UPDATE local_profiles SET last_used_at = datetime('now') WHERE id = ?1",
        params![profile_id],
    )
    .map_err(|e| format!("Failed to update profile: {}", e))?;

    // Log activity
    let _ = db.execute(
        "INSERT INTO activity_log (action, subject, timestamp)
         VALUES ('profile_switched', ?1, datetime('now'))",
        params![profile_id],
    );

    let profile = db
        .query_row(
            "SELECT id, display_name, role_label, public_key, created_at, last_used_at
             FROM local_profiles WHERE id = ?1",
            params![profile_id],
            |row| {
                Ok(Profile {
                    id: row.get(0)?,
                    display_name: row.get(1)?,
                    role_label: row.get(2)?,
                    public_key: row.get(3)?,
                    created_at: row.get(4)?,
                    last_used_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| format!("Profile not found: {}", e))?;

    Ok(profile)
}

#[tauri::command]
pub fn delete_profile(state: State<AppState>, profile_id: String) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let display_name: String = db
        .query_row(
            "SELECT display_name FROM local_profiles WHERE id = ?1",
            params![profile_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Profile not found: {}", e))?;

    db.execute(
        "DELETE FROM local_profiles WHERE id = ?1",
        params![profile_id],
    )
    .map_err(|e| format!("Failed to delete profile: {}", e))?;

    // Log activity
    let _ = db.execute(
        "INSERT INTO activity_log (action, subject, timestamp)
         VALUES ('profile_deleted', ?1, datetime('now'))",
        params![display_name],
    );

    Ok(())
}

#[tauri::command]
pub fn export_profile(
    _state: State<AppState>,
    _profile_id: String,
    _passphrase: String,
) -> Result<String, String> {
    Err("Profile export not yet implemented".to_string())
}

#[tauri::command]
pub fn import_profile(
    _state: State<AppState>,
    _encrypted_blob: String,
    _passphrase: String,
) -> Result<Profile, String> {
    Err("Profile import not yet implemented".to_string())
}

// =============================================================================
// Patient Commands
// =============================================================================

#[tauri::command]
pub fn list_patients(
    state: State<AppState>,
    search: Option<String>,
) -> Result<Vec<Patient>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let query = if search.is_some() {
        "SELECT id, mrn, first_name, last_name, date_of_birth, sex, ethnicity, referral_reason,
                clinician_id, clinician_key, created_at, updated_at
         FROM patients
         WHERE first_name LIKE ?1 OR last_name LIKE ?1 OR mrn LIKE ?1
         ORDER BY last_name, first_name"
    } else {
        "SELECT id, mrn, first_name, last_name, date_of_birth, sex, ethnicity, referral_reason,
                clinician_id, clinician_key, created_at, updated_at
         FROM patients ORDER BY last_name, first_name"
    };

    let mut stmt = db.prepare(query).map_err(|e| format!("Query error: {}", e))?;

    let patients: Vec<Patient> = if let Some(ref s) = search {
        let pattern = format!("%{}%", s);
        stmt.query_map(params![pattern], map_patient)
            .map_err(|e| format!("Query error: {}", e))?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        stmt.query_map([], map_patient)
            .map_err(|e| format!("Query error: {}", e))?
            .filter_map(|r| r.ok())
            .collect()
    };

    Ok(patients)
}

#[tauri::command]
pub fn get_patient(state: State<AppState>, id: i64) -> Result<Patient, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.query_row(
        "SELECT id, mrn, first_name, last_name, date_of_birth, sex, ethnicity, referral_reason,
                clinician_id, clinician_key, created_at, updated_at
         FROM patients WHERE id = ?1",
        params![id],
        map_patient,
    )
    .map_err(|e| format!("Patient not found: {}", e))
}

#[tauri::command]
pub fn create_patient(
    state: State<AppState>,
    input: PatientInput,
) -> Result<Patient, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "INSERT INTO patients (mrn, first_name, last_name, date_of_birth, sex, ethnicity,
         referral_reason, clinician_key, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'))",
        params![
            input.mrn,
            input.first_name,
            input.last_name,
            input.date_of_birth,
            input.sex,
            input.ethnicity,
            input.referral_reason,
            input.clinician_key,
        ],
    )
    .map_err(|e| format!("Failed to create patient: {}", e))?;

    let id = db.last_insert_rowid();
    drop(db);
    get_patient(state, id)
}

#[tauri::command]
pub fn update_patient(
    state: State<AppState>,
    id: i64,
    input: PatientInput,
) -> Result<Patient, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.execute(
        "UPDATE patients SET mrn = ?1, first_name = ?2, last_name = ?3, date_of_birth = ?4,
         sex = ?5, ethnicity = ?6, referral_reason = ?7, clinician_key = ?8,
         updated_at = datetime('now')
         WHERE id = ?9",
        params![
            input.mrn,
            input.first_name,
            input.last_name,
            input.date_of_birth,
            input.sex,
            input.ethnicity,
            input.referral_reason,
            input.clinician_key,
            id,
        ],
    )
    .map_err(|e| format!("Failed to update patient: {}", e))?;

    drop(db);
    get_patient(state, id)
}

#[tauri::command]
pub fn delete_patient(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let affected = db
        .execute("DELETE FROM patients WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete patient: {}", e))?;
    if affected == 0 {
        return Err("Patient not found".to_string());
    }
    Ok(())
}

// =============================================================================
// Pedigree Commands
// =============================================================================

#[tauri::command]
pub fn list_pedigrees(
    state: State<AppState>,
    patient_id: Option<i64>,
    search: Option<String>,
) -> Result<Vec<PedigreeSummary>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let mut sql = String::from(
        "SELECT p.id, p.title, p.patient_id,
                p.canvas_data,
                CAST(COUNT(DISTINCT pv.id) AS INTEGER) AS version_count,
                p.creator_key, p.created_at, p.updated_at
         FROM pedigrees p
         LEFT JOIN pedigree_versions pv ON pv.pedigree_id = p.id
         WHERE 1=1",
    );

    if patient_id.is_some() {
        sql.push_str(" AND p.patient_id = ?1");
    }
    if search.is_some() {
        sql.push_str(" AND p.title LIKE ?2");
    }
    sql.push_str(" GROUP BY p.id ORDER BY p.updated_at DESC");

    let mut stmt = db.prepare(&sql).map_err(|e| format!("Query error: {}", e))?;

    let mut rows: Vec<SummaryRow> = if let Some(pid) = patient_id {
        let pattern = search.map(|s| format!("%{}%", s)).unwrap_or_default();
        stmt.query_map(params![pid, pattern], map_summary_row)
            .map_err(|e| format!("Query error: {}", e))?
            .filter_map(|r| r.ok())
            .collect()
    } else if search.is_some() {
        let pattern = search.map(|s| format!("%{}%", s)).unwrap_or_default();
        stmt.query_map(params![pattern], map_summary_row)
            .map_err(|e| format!("Query error: {}", e))?
            .filter_map(|r| r.ok())
            .collect()
    } else {
        stmt.query_map([], map_summary_row)
            .map_err(|e| format!("Query error: {}", e))?
            .filter_map(|r| r.ok())
            .collect()
    };

    // Post-process: compute node_count from canvas_data JSON
    let summaries: Vec<PedigreeSummary> = rows
        .drain(..)
        .map(|r| {
            let node_count = count_nodes_in_canvas(&r.canvas_data);
            PedigreeSummary {
                id: r.id,
                title: r.title,
                patient_id: r.patient_id,
                node_count,
                version_count: r.version_count,
                creator_key: r.creator_key,
                created_at: r.created_at,
                updated_at: r.updated_at,
            }
        })
        .collect();

    Ok(summaries)
}

#[tauri::command]
pub fn get_pedigree(state: State<AppState>, id: i64) -> Result<Pedigree, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.query_row(
        "SELECT id, title, patient_id, canvas_data, canvas_hash, notes,
                creator_key, creator_signature, share_token, created_at, updated_at
         FROM pedigrees WHERE id = ?1",
        params![id],
        map_pedigree,
    )
    .map_err(|e| format!("Pedigree not found: {}", e))
}

#[tauri::command]
pub fn create_pedigree(
    state: State<AppState>,
    input: PedigreeInput,
) -> Result<Pedigree, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let canvas_hash = input
        .canvas_data
        .as_ref()
        .map(|d| signatures::hash_sha256(d.as_bytes()));

    db.execute(
        "INSERT INTO pedigrees (title, patient_id, canvas_data, canvas_hash, notes,
         creator_key, creator_signature, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'), datetime('now'))",
        params![
            input.title,
            input.patient_id,
            input.canvas_data,
            canvas_hash,
            input.notes,
            input.creator_key,
            input.creator_signature,
        ],
    )
    .map_err(|e| format!("Failed to create pedigree: {}", e))?;

    let _ = db.execute(
        "INSERT INTO activity_log (action, subject, actor_key, timestamp)
         VALUES ('created', ?1, ?2, datetime('now'))",
        params![input.title, input.creator_key],
    );

    let id = db.last_insert_rowid();
    drop(db);
    get_pedigree(state, id)
}

#[tauri::command]
pub fn update_pedigree(
    state: State<AppState>,
    id: i64,
    input: PedigreeInput,
) -> Result<Pedigree, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let canvas_hash = input
        .canvas_data
        .as_ref()
        .map(|d| signatures::hash_sha256(d.as_bytes()));

    db.execute(
        "UPDATE pedigrees SET title = ?1, patient_id = ?2, canvas_data = ?3, canvas_hash = ?4,
         notes = ?5, updated_at = datetime('now')
         WHERE id = ?6",
        params![
            input.title,
            input.patient_id,
            input.canvas_data,
            canvas_hash,
            input.notes,
            id,
        ],
    )
    .map_err(|e| format!("Failed to update pedigree: {}", e))?;

    let _ = db.execute(
        "INSERT INTO activity_log (action, subject, actor_key, timestamp)
         VALUES ('updated', ?1, ?2, datetime('now'))",
        params![input.title, input.creator_key],
    );

    drop(db);
    get_pedigree(state, id)
}

#[tauri::command]
pub fn delete_pedigree(state: State<AppState>, id: i64) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let title: String = db
        .query_row(
            "SELECT title FROM pedigrees WHERE id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Pedigree not found: {}", e))?;

    let affected = db
        .execute("DELETE FROM pedigrees WHERE id = ?1", params![id])
        .map_err(|e| format!("Failed to delete pedigree: {}", e))?;

    if affected == 0 {
        return Err("Pedigree not found".to_string());
    }

    let _ = db.execute(
        "INSERT INTO activity_log (action, subject, timestamp)
         VALUES ('deleted', ?1, datetime('now'))",
        params![title],
    );

    Ok(())
}

// =============================================================================
// Version Commands
// =============================================================================

#[tauri::command]
pub fn list_versions(state: State<AppState>, pedigree_id: i64) -> Result<Vec<PedigreeVersion>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut stmt = db
        .prepare(
            "SELECT id, pedigree_id, version_number, label, canvas_data, canvas_hash,
                    thumbnail, saver_key, saver_signature, created_at
             FROM pedigree_versions
             WHERE pedigree_id = ?1
             ORDER BY version_number DESC",
        )
        .map_err(|e| format!("Query error: {}", e))?;

    let versions = stmt
        .query_map(params![pedigree_id], |row| {
            Ok(PedigreeVersion {
                id: row.get(0)?,
                pedigree_id: row.get(1)?,
                version_number: row.get(2)?,
                label: row.get(3)?,
                canvas_data: row.get(4)?,
                canvas_hash: row.get(5)?,
                thumbnail: row.get(6)?,
                saver_key: row.get(7)?,
                saver_signature: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| format!("Query error: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(versions)
}

#[tauri::command]
pub fn save_version(
    state: State<AppState>,
    pedigree_id: i64,
    input: VersionInput,
) -> Result<PedigreeVersion, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let last_version: Option<i64> = db
        .query_row(
            "SELECT MAX(version_number) FROM pedigree_versions WHERE pedigree_id = ?1",
            params![pedigree_id],
            |row| row.get(0),
        )
        .ok()
        .flatten();

    let next_version = last_version.unwrap_or(0) + 1;
    let canvas_hash = signatures::hash_sha256(input.canvas_data.as_bytes());

    db.execute(
        "INSERT INTO pedigree_versions (pedigree_id, version_number, label, canvas_data,
         canvas_hash, thumbnail, saver_key, saver_signature, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'))",
        params![
            pedigree_id,
            next_version,
            input.label,
            input.canvas_data,
            canvas_hash,
            input.thumbnail,
            input.saver_key,
            input.saver_signature,
        ],
    )
    .map_err(|e| format!("Failed to save version: {}", e))?;

    let id = db.last_insert_rowid();

    db.query_row(
        "SELECT id, pedigree_id, version_number, label, canvas_data, canvas_hash,
                thumbnail, saver_key, saver_signature, created_at
         FROM pedigree_versions WHERE id = ?1",
        params![id],
        |row| {
            Ok(PedigreeVersion {
                id: row.get(0)?,
                pedigree_id: row.get(1)?,
                version_number: row.get(2)?,
                label: row.get(3)?,
                canvas_data: row.get(4)?,
                canvas_hash: row.get(5)?,
                thumbnail: row.get(6)?,
                saver_key: row.get(7)?,
                saver_signature: row.get(8)?,
                created_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| format!("Failed to retrieve saved version: {}", e))
}

#[tauri::command]
pub fn restore_version(
    state: State<AppState>,
    pedigree_id: i64,
    version_id: i64,
) -> Result<Pedigree, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let canvas_data: String = db
        .query_row(
            "SELECT canvas_data FROM pedigree_versions WHERE id = ?1 AND pedigree_id = ?2",
            params![version_id, pedigree_id],
            |row| row.get(0),
        )
        .map_err(|e| format!("Version not found: {}", e))?;

    let canvas_hash = signatures::hash_sha256(canvas_data.as_bytes());

    db.execute(
        "UPDATE pedigrees SET canvas_data = ?1, canvas_hash = ?2, updated_at = datetime('now')
         WHERE id = ?3",
        params![canvas_data, canvas_hash, pedigree_id],
    )
    .map_err(|e| format!("Failed to restore version: {}", e))?;

    drop(db);
    get_pedigree(state, pedigree_id)
}

// =============================================================================
// Dashboard Commands
// =============================================================================

#[tauri::command]
pub fn get_dashboard_stats(state: State<AppState>) -> Result<DashboardStats, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let total_patients: i64 = db
        .query_row("SELECT COUNT(*) FROM patients", [], |row| row.get(0))
        .unwrap_or(0);

    let total_pedigrees: i64 = db
        .query_row("SELECT COUNT(*) FROM pedigrees", [], |row| row.get(0))
        .unwrap_or(0);

    let total_profiles: i64 = db
        .query_row("SELECT COUNT(*) FROM local_profiles", [], |row| row.get(0))
        .unwrap_or(0);

    let pedigrees_this_week: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM pedigrees WHERE created_at >= datetime('now', '-7 days')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let pedigrees_this_month: i64 = db
        .query_row(
            "SELECT COUNT(*) FROM pedigrees WHERE created_at >= datetime('now', '-30 days')",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    Ok(DashboardStats {
        total_patients,
        total_pedigrees,
        total_profiles,
        pedigrees_this_week,
        pedigrees_this_month,
    })
}

#[tauri::command]
pub fn get_recent_activity(
    state: State<AppState>,
    limit: Option<i64>,
) -> Result<Vec<ActivityItem>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(20);

    let mut stmt = db
        .prepare(
            "SELECT id, action, subject, actor_key, timestamp
             FROM activity_log ORDER BY timestamp DESC LIMIT ?1",
        )
        .map_err(|e| format!("Query error: {}", e))?;

    let activities = stmt
        .query_map(params![limit], |row| {
            Ok(ActivityItem {
                id: row.get(0)?,
                action: row.get(1)?,
                subject: row.get(2)?,
                actor_key: row.get(3)?,
                timestamp: row.get(4)?,
            })
        })
        .map_err(|e| format!("Query error: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    Ok(activities)
}

// =============================================================================
// Preferences Commands
// =============================================================================

#[tauri::command]
pub fn get_preferences(state: State<AppState>) -> Result<Preferences, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;

    let device_id = db::read_device_id_from_db(&db)
        .unwrap_or_else(|| "unknown-device".to_string());

    db.query_row(
        "SELECT device_id, theme, updated_at FROM app_preferences WHERE device_id = ?1",
        params![device_id],
        |row| {
            Ok(Preferences {
                device_id: row.get(0)?,
                theme: row.get(1)?,
                updated_at: row.get(2)?,
            })
        },
    )
    .or_else(|_| {
        let _ = db.execute(
            "INSERT OR IGNORE INTO app_preferences (device_id, theme, updated_at)
             VALUES (?1, 'terminal', datetime('now'))",
            params![device_id],
        );
        Ok(Preferences {
            device_id: device_id.to_string(),
            theme: "terminal".to_string(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        })
    })
}

#[tauri::command]
pub fn save_preferences(state: State<AppState>, theme: String) -> Result<Preferences, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let device_id = db::read_device_id_from_db(&db)
        .unwrap_or_else(|| "unknown-device".to_string());

    db.execute(
        "INSERT INTO app_preferences (device_id, theme, updated_at)
         VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(device_id) DO UPDATE SET theme = ?2, updated_at = datetime('now')",
        params![device_id, theme],
    )
    .map_err(|e| format!("Failed to save preferences: {}", e))?;

    drop(db);
    get_preferences(state)
}

// =============================================================================
// Sharing Commands (Stubs — implemented in relay.rs)
// =============================================================================

#[tauri::command]
pub async fn share_pedigree(
    state: State<'_, AppState>,
    pedigree_id: i64,
    recipient_key: String,
) -> Result<ShareResult, String> {
    // 1. Export the pedigree to .ppro JSON
    let _ppro_json = crate::export::export_pedigree_ppro(&state.db, pedigree_id, &recipient_key)?;

    // 2. The frontend handles symmetric encryption and sealed box creation
    Err(
        "Share via relay: frontend must encrypt .ppro with libsodium sealed box then POST to relay. \
         The .ppro export is ready but client-side encryption must be implemented in the frontend.".to_string()
    )
}

#[tauri::command]
pub async fn import_shared(
    state: State<'_, AppState>,
    share_token: String,
    importer_key: String,
) -> Result<Pedigree, String> {
    let (ciphertext, _encrypted_key) =
        crate::relay::fetch_shared_payload(&share_token).await?;

    let new_id =
        crate::import_native::import_pedigree_ppro(&state.db, &ciphertext, &importer_key)?;

    get_pedigree(state, new_id)
}

// =============================================================================
// Import Commands (Native .ppro + Legacy)
// =============================================================================

// =============================================================================
// Database Management Commands (Backup, Restore, Key Rotation)
// =============================================================================

/// Creates a timestamped backup of the encrypted database file.
/// Returns the filesystem path to the backup.
#[tauri::command]
pub fn backup_database(app: tauri::AppHandle) -> Result<String, String> {
    crate::db::backup_database(&app)
}

/// Restores the database from a backup file.
/// Creates a safety backup of the current database before overwriting.
#[tauri::command]
pub fn restore_database(app: tauri::AppHandle, backup_path: String) -> Result<(), String> {
    crate::db::restore_database(&app, &backup_path)
}

/// Rotates the SQLCipher encryption key.
///
/// Generates a new master secret, re-encrypts the database with it,
/// and stores the new secret in the OS keychain.
/// This should be done periodically for security hygiene.
#[tauri::command]
pub fn rotate_key(app: tauri::AppHandle, state: State<AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    crate::db::rotate_encryption_key(&app, &db)
}

// =============================================================================
// Import Commands (Native .ppro + Legacy)
// =============================================================================

/// Imports a pedigree from a native .ppro JSON file.
///
/// This is the standard import path for files produced by Pedigree PRO's
/// export feature, or received via encrypted sharing (colleague-to-colleague).
///
/// The .ppro content is read from the file at `path` and imported with full
/// cryptographic provenance verification.
#[tauri::command]
pub fn import_pedigree_native(
    state: State<AppState>,
    path: String,
    importer_key: String,
) -> Result<Pedigree, String> {
    let ppro_json = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read file '{}': {}", path, e))?;

    let new_id =
        crate::import_native::import_pedigree_ppro(&state.db, &ppro_json, &importer_key)?;

    get_pedigree(state, new_id)
}

/// Imports an entire legacy HaploPainter SQLite database.
///
/// Reads all tables (patients, pedigrees, pedigree_versions, activity_log, users)
/// from the legacy database file at `path` and migrates them into the Pedigree PRO
/// schema with dual-write (both legacy `*ById` columns and new `*_key` columns).
///
/// Returns a structured summary with counts of imported records and the
/// migration profile key.
#[tauri::command]
pub fn import_pedigree_legacy(
    state: State<AppState>,
    path: String,
) -> Result<crate::import_legacy::LegacyImportSummary, String> {
    crate::import_legacy::import_legacy_database(&state.db, &path)
}
// =============================================================================
// Row Mapping Helpers
// =============================================================================

fn map_patient(row: &rusqlite::Row) -> rusqlite::Result<Patient> {
    Ok(Patient {
        id: row.get(0)?,
        mrn: row.get(1)?,
        first_name: row.get(2)?,
        last_name: row.get(3)?,
        date_of_birth: row.get(4)?,
        sex: row.get(5)?,
        ethnicity: row.get(6)?,
        referral_reason: row.get(7)?,
        clinician_id: row.get(8)?,
        clinician_key: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

fn map_pedigree(row: &rusqlite::Row) -> rusqlite::Result<Pedigree> {
    Ok(Pedigree {
        id: row.get(0)?,
        title: row.get(1)?,
        patient_id: row.get(2)?,
        canvas_data: row.get(3)?,
        canvas_hash: row.get(4)?,
        notes: row.get(5)?,
        creator_key: row.get(6)?,
        creator_signature: row.get(7)?,
        share_token: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

fn map_summary_row(row: &rusqlite::Row) -> rusqlite::Result<SummaryRow> {
    Ok(SummaryRow {
        id: row.get(0)?,
        title: row.get(1)?,
        patient_id: row.get(2)?,
        canvas_data: row.get(3)?,
        version_count: row.get(4)?,
        creator_key: row.get(5)?,
        created_at: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

/// Parses the canvas_data JSON to count the number of nodes in the pedigree.
/// canvas_data is a JSON object with a "nodes" array.
fn count_nodes_in_canvas(canvas_data: &Option<String>) -> i64 {
    match canvas_data {
        None => 0,
        Some(data) => {
            // Quick heuristic: count occurrences of `"type": "node"` or `"id":`
            // For proper count, parse JSON and count the "nodes" array length.
            // Using serde_json is preferred but adds allocation overhead per row.
            // For dashboard summary purposes, a string-based count is faster.
            match serde_json::from_str::<serde_json::Value>(data) {
                Ok(json) => {
                    json.get("nodes")
                        .and_then(|n| n.as_array())
                        .map(|arr| arr.len() as i64)
                        .unwrap_or(0)
                }
                Err(_) => {
                    // Fallback: count lines starting with `"id"` if JSON parse fails
                    // (canvas_data may be a string form from legacy data)
                    data.lines().filter(|l| l.trim().starts_with("\"id\"")).count() as i64
                }
            }
        }
    }
}