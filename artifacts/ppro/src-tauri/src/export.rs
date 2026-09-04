// Pedigree PRO — Encrypted Export Module
//
// Implements the .ppro export format (ADR-004 §4.3) with cryptographic
// provenance. Exports are JSON documents containing pedigree data,
// annotations, phenotypes, version history, and Ed25519 signatures.
//
// IMPORTANT: Pedigree import logic has been split into:
//   - import_native.rs  — Native .ppro import (current program files)
//   - import_legacy.rs  — Legacy HaploPainter SQLite migration

use rusqlite::params;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

use crate::AppState;
use tauri::State;

// =============================================================================
// .ppro Format Type Definitions (ADR-004 §4.3)
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct PproExport {
    pub format_version: String,
    pub export_type: String, // "pedigree" | "patient" | "profile"
    pub pedigree: Option<PproPedigreeData>,
    pub provenance: PproProvenance,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PproPedigreeData {
    pub title: String,
    pub canvas_data: Option<serde_json::Value>,
    pub canvas_hash: Option<String>,
    pub notes: Option<String>,
    pub node_annotations: Vec<serde_json::Value>,
    pub phenotypes: Vec<serde_json::Value>,
    pub version_history: Vec<PproVersionEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PproVersionEntry {
    pub version_number: i64,
    pub label: Option<String>,
    pub canvas_data: String,
    pub canvas_hash: Option<String>,
    pub saver_key: Option<String>,
    pub saver_signature: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PproProvenance {
    pub creator_key: String,
    pub creator_signature: Option<String>,
    pub exported_at: String,
    pub exported_by_key: String,
    pub export_signature: Option<String>,
}

// =============================================================================
// Pedigree Export
// =============================================================================

/// Exports a pedigree to the .ppro JSON format.
///
/// Serializes the pedigree record, its version history, clinical annotations,
/// and phenotypes into a structured JSON document with cryptographic provenance.
/// Core export logic (not a Tauri command — callable from other Rust code).
pub fn export_pedigree_ppro_inner(
    db: &Mutex<rusqlite::Connection>,
    pedigree_id: i64,
    exporter_key: &str,
) -> Result<String, String> {
    let conn = db.lock().map_err(|e| e.to_string())?;

    // Load pedigree core data
    let ped_row = conn
        .query_row(
            "SELECT title, canvas_data, canvas_hash, notes, creator_key, creator_signature
             FROM pedigrees WHERE id = ?1",
            params![pedigree_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<String>>(3)?,
                    row.get::<_, Option<String>>(4)?,
                    row.get::<_, Option<String>>(5)?,
                ))
            },
        )
        .map_err(|e| format!("Pedigree not found: {}", e))?;

    let (title, canvas_data_raw, canvas_hash, notes, creator_key, creator_signature) = ped_row;

    // Parse canvas_data JSON
    let canvas_data: Option<serde_json::Value> = canvas_data_raw
        .as_ref()
        .and_then(|d| serde_json::from_str(d).ok());

    // Load version history
    let mut ver_stmt = conn
        .prepare(
            "SELECT version_number, label, canvas_data, canvas_hash, saver_key, saver_signature, created_at
             FROM pedigree_versions
             WHERE pedigree_id = ?1
             ORDER BY version_number ASC",
        )
        .map_err(|e| format!("Failed to query versions: {}", e))?;

    let version_history: Vec<PproVersionEntry> = ver_stmt
        .query_map(params![pedigree_id], |row| {
            Ok(PproVersionEntry {
                version_number: row.get(0)?,
                label: row.get(1)?,
                canvas_data: row.get(2)?,
                canvas_hash: row.get(3)?,
                saver_key: row.get(4)?,
                saver_signature: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| format!("Failed to read versions: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Load node annotations
    let mut ann_stmt = conn
        .prepare(
            "SELECT node_id, hpo_terms, omim_ids, variant_hgvs, test_results, clinical_notes,
                    affected_status, carrier_status
             FROM pedigree_node_annotations
             WHERE pedigree_id = ?1",
        )
        .map_err(|e| format!("Failed to query annotations: {}", e))?;

    let node_annotations: Vec<serde_json::Value> = ann_stmt
        .query_map(params![pedigree_id], |row| {
            let node_id: String = row.get(0)?;
            let hpo_terms: Option<String> = row.get(1)?;
            let omim_ids: Option<String> = row.get(2)?;
            let variant_hgvs: Option<String> = row.get(3)?;
            let test_results: Option<String> = row.get(4)?;
            let clinical_notes: Option<String> = row.get(5)?;
            let affected_status: String = row.get(6)?;
            let carrier_status: String = row.get(7)?;

            Ok(serde_json::json!({
                "node_id": node_id,
                "hpo_terms": hpo_terms,
                "omim_ids": omim_ids,
                "variant_hgvs": variant_hgvs,
                "test_results": test_results,
                "clinical_notes": clinical_notes,
                "affected_status": affected_status,
                "carrier_status": carrier_status,
            }))
        })
        .map_err(|e| format!("Failed to read annotations: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Load phenotypes
    let mut phe_stmt = conn
        .prepare(
            "SELECT condition_name, omim_id, hpo_terms, inheritance_mode, notes
             FROM pedigree_phenotypes
             WHERE pedigree_id = ?1",
        )
        .map_err(|e| format!("Failed to query phenotypes: {}", e))?;

    let phenotypes: Vec<serde_json::Value> = phe_stmt
        .query_map(params![pedigree_id], |row| {
            let condition_name: String = row.get(0)?;
            let omim_id: Option<String> = row.get(1)?;
            let hpo_terms: Option<String> = row.get(2)?;
            let inheritance_mode: Option<String> = row.get(3)?;
            let notes: Option<String> = row.get(4)?;

            Ok(serde_json::json!({
                "condition_name": condition_name,
                "omim_id": omim_id,
                "hpo_terms": hpo_terms,
                "inheritance_mode": inheritance_mode,
                "notes": notes,
            }))
        })
        .map_err(|e| format!("Failed to read phenotypes: {}", e))?
        .filter_map(|r| r.ok())
        .collect();

    // Build provenance
    let exported_at = chrono::Utc::now().to_rfc3339();

    // Build the export document
    let export = PproExport {
        format_version: "1.0".to_string(),
        export_type: "pedigree".to_string(),
        pedigree: Some(PproPedigreeData {
            title,
            canvas_data,
            canvas_hash,
            notes,
            node_annotations,
            phenotypes,
            version_history,
        }),
        provenance: PproProvenance {
            creator_key: creator_key.unwrap_or_default(),
            creator_signature,
            exported_at,
            exported_by_key: exporter_key.to_string(),
            export_signature: None, // Frontend signs the export before writing to disk
        },
    };

    serde_json::to_string_pretty(&export)
        .map_err(|e| format!("Failed to serialize export: {}", e))
}

/// Tauri command wrapper for export_pedigree_ppro.
#[tauri::command(rename_all = "snake_case")]
pub fn export_pedigree_ppro(
    state: State<AppState>,
    pedigree_id: i64,
    exporter_key: String,
) -> Result<String, String> {
    export_pedigree_ppro_inner(&state.db, pedigree_id, &exporter_key)
}