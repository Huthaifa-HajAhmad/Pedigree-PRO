// Pedigree PRO — Shared Import Helpers
//
// Common database insertion functions used by both native .ppro import
// and legacy HaploPainter SQLite migration.
//
// Each helper performs a single INSERT and returns the new row ID.

use rusqlite::{params, Connection};

/// Inserts a pedigree row and returns the new ID.
pub fn insert_pedigree(
    conn: &Connection,
    title: &str,
    canvas_data: &Option<String>,
    canvas_hash: &Option<String>,
    notes: &Option<String>,
    creator_key: &Option<String>,
    creator_signature: &Option<String>,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO pedigrees (title, canvas_data, canvas_hash, notes,
         creator_key, creator_signature, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))",
        params![
            title,
            canvas_data,
            canvas_hash,
            notes,
            creator_key,
            creator_signature,
        ],
    )
    .map_err(|e| format!("Failed to insert pedigree: {}", e))?;

    Ok(conn.last_insert_rowid())
}

/// Inserts a pedigree version row and returns the new ID.
pub fn insert_version(
    conn: &Connection,
    pedigree_id: i64,
    version_number: i64,
    label: &Option<String>,
    canvas_data: &str,
    canvas_hash: &Option<String>,
    saver_key: &Option<String>,
    saver_signature: &Option<String>,
    created_at: &str,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO pedigree_versions (pedigree_id, version_number, label, canvas_data,
         canvas_hash, saver_key, saver_signature, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        params![
            pedigree_id,
            version_number,
            label,
            canvas_data,
            canvas_hash,
            saver_key,
            saver_signature,
            created_at,
        ],
    )
    .map_err(|e| format!("Failed to insert version {}: {}", version_number, e))?;

    Ok(conn.last_insert_rowid())
}

/// Inserts a node annotation row.
pub fn insert_node_annotation(
    conn: &Connection,
    pedigree_id: i64,
    node_id: &str,
    hpo_terms: &Option<String>,
    omim_ids: &Option<String>,
    variant_hgvs: &Option<String>,
    test_results: &Option<String>,
    clinical_notes: &Option<String>,
    affected_status: &str,
    carrier_status: &str,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO pedigree_node_annotations (pedigree_id, node_id, hpo_terms, omim_ids,
         variant_hgvs, test_results, clinical_notes, affected_status, carrier_status,
         created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'), datetime('now'))",
        params![
            pedigree_id,
            node_id,
            hpo_terms,
            omim_ids,
            variant_hgvs,
            test_results,
            clinical_notes,
            affected_status,
            carrier_status,
        ],
    )
    .map_err(|e| format!("Failed to insert annotation for node {}: {}", node_id, e))?;

    Ok(())
}

/// Inserts a phenotype row.
pub fn insert_phenotype(
    conn: &Connection,
    pedigree_id: i64,
    condition_name: &str,
    omim_id: &Option<String>,
    hpo_terms: &Option<String>,
    inheritance_mode: &Option<String>,
    notes: &Option<String>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO pedigree_phenotypes (pedigree_id, condition_name, omim_id, hpo_terms,
         inheritance_mode, notes, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'))",
        params![pedigree_id, condition_name, omim_id, hpo_terms, inheritance_mode, notes],
    )
    .map_err(|e| format!("Failed to insert phenotype '{}': {}", condition_name, e))?;

    Ok(())
}

/// Inserts a patient row and returns the new ID.
pub fn insert_patient(
    conn: &Connection,
    first_name: &str,
    last_name: &str,
    date_of_birth: &Option<String>,
    sex: &Option<String>,
    ethnicity: &Option<String>,
    referral_reason: &Option<String>,
    clinician_key: &Option<String>,
) -> Result<i64, String> {
    conn.execute(
        "INSERT INTO patients (first_name, last_name, date_of_birth, sex, ethnicity,
         referral_reason, clinician_key, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, datetime('now'), datetime('now'))",
        params![
            first_name,
            last_name,
            date_of_birth,
            sex,
            ethnicity,
            referral_reason,
            clinician_key,
        ],
    )
    .map_err(|e| format!("Failed to insert patient: {}", e))?;

    Ok(conn.last_insert_rowid())
}

/// Logs an activity entry.
pub fn log_activity(
    conn: &Connection,
    action: &str,
    subject: &str,
    actor_key: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO activity_log (action, subject, actor_key, timestamp)
         VALUES (?1, ?2, ?3, datetime('now'))",
        params![action, subject, actor_key],
    )
    .map_err(|e| format!("Failed to log activity: {}", e))?;

    Ok(())
}