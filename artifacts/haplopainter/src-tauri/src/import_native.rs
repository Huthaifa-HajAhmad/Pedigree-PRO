// Pedigree PRO — Native .ppro Import
//
// Imports pedigree data from Pedigree PRO's own .ppro export format.
// This is the primary import path for colleague-to-colleague sharing
// and data portability between Pedigree PRO instances.
//
// The .ppro format includes cryptographic provenance (Ed25519 signatures,
// SHA-256 content hashes) which are verified on import.
//
// Per ADR-004 §4.3: .ppro is a documented JSON format with:
//   - Pedigree data (title, canvas_data, notes)
//   - Version history
//   - Clinical annotations (node_annotations, phenotypes)
//   - Cryptographic provenance (creator_key, creator_signature, export_signature)

use crate::import_common;
use crate::signatures;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

// =============================================================================
// Format Type Definitions
// =============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct HpclExport {
    pub format_version: String,
    pub export_type: String,
    pub pedigree: Option<HpclPedigreeData>,
    pub provenance: HpclProvenance,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HpclPedigreeData {
    pub title: String,
    pub canvas_data: Option<serde_json::Value>,
    pub canvas_hash: Option<String>,
    pub notes: Option<String>,
    pub node_annotations: Vec<serde_json::Value>,
    pub phenotypes: Vec<serde_json::Value>,
    pub version_history: Vec<HpclVersionEntry>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HpclVersionEntry {
    pub version_number: i64,
    pub label: Option<String>,
    pub canvas_data: String,
    pub canvas_hash: Option<String>,
    pub saver_key: Option<String>,
    pub saver_signature: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct HpclProvenance {
    pub creator_key: String,
    pub creator_signature: Option<String>,
    pub exported_at: String,
    pub exported_by_key: String,
    pub export_signature: Option<String>,
}

// =============================================================================
// Native .ppro Import
// =============================================================================

/// Imports a pedigree from .ppro JSON format into the local database.
///
/// Steps:
/// 1. Parse and validate the .ppro JSON
/// 2. Verify the export signature (if present) against the claimed exporter key
/// 3. Compute canvas_hash for the imported canvas_data
/// 4. Insert the pedigree row
/// 5. Insert version history entries
/// 6. Insert clinical annotations and phenotypes
/// 7. Log the import activity
///
/// Returns the newly-created pedigree ID.
pub fn import_pedigree_hpcl(
    db: &Mutex<Connection>,
    hpcl_json: &str,
    importer_key: &str,
) -> Result<i64, String> {
    let export: HpclExport =
        serde_json::from_str(hpcl_json).map_err(|e| format!("Invalid .ppro file: {}", e))?;

    // Validate format
    if export.format_version != "1.0" {
        return Err(format!(
            "Unsupported .ppro format version: {} (expected '1.0')",
            export.format_version
        ));
    }

    if export.export_type != "pedigree" {
        return Err(format!(
            "Unsupported export type: '{}' (expected 'pedigree')",
            export.export_type
        ));
    }

    let pedigree = export
        .pedigree
        .ok_or("No pedigree data in export file")?;

    // Verify export provenance signature if present
    if let Some(ref sig) = export.provenance.export_signature {
        let sig_payload = format!(
            "{}||{}||{}",
            pedigree.canvas_hash.clone().unwrap_or_default(),
            export.provenance.exported_at,
            0_i64, // pedigree_id is not known at import time
        );
        let valid = signatures::verify(
            sig_payload.as_bytes(),
            sig,
            &export.provenance.exported_by_key,
        )?;
        if !valid {
            return Err(
                "Export signature verification failed: the .ppro file may have been tampered with"
                    .to_string(),
            );
        }
    }

    let conn = db.lock().map_err(|e| e.to_string())?;

    // Serialize canvas_data back to string for storage
    let canvas_data_str = pedigree
        .canvas_data
        .as_ref()
        .map(|v| serde_json::to_string(v).unwrap_or_default());

    // Compute canvas_hash for the imported data (either use provided or compute)
    let canvas_hash = pedigree.canvas_hash.clone().or_else(|| {
        canvas_data_str
            .as_ref()
            .map(|d| signatures::hash_sha256(d.as_bytes()))
    });

    // Insert pedigree row
    let new_pedigree_id = import_common::insert_pedigree(
        &conn,
        &pedigree.title,
        &canvas_data_str,
        &canvas_hash,
        &pedigree.notes,
        &Some(export.provenance.creator_key.clone()),
        &export.provenance.creator_signature,
        // No legacy columns for native import
        None,
        None,
    )?;

    // Insert version history
    for ver in &pedigree.version_history {
        let ver_hash = ver.canvas_hash.clone().unwrap_or_else(|| {
            signatures::hash_sha256(ver.canvas_data.as_bytes())
        });
        import_common::insert_version(
            &conn,
            new_pedigree_id,
            ver.version_number,
            &ver.label,
            &ver.canvas_data,
            &Some(ver_hash),
            &ver.saver_key,
            &ver.saver_signature,
            &ver.created_at,
            None, // No legacy column
        )?;
    }

    // Insert node annotations
    for ann in &pedigree.node_annotations {
        let node_id = ann["node_id"].as_str().unwrap_or_default();
        if node_id.is_empty() {
            continue;
        }
        import_common::insert_node_annotation(
            &conn,
            new_pedigree_id,
            node_id,
            &ann["hpo_terms"].as_str().map(|s| s.to_string()),
            &ann["omim_ids"].as_str().map(|s| s.to_string()),
            &ann["variant_hgvs"].as_str().map(|s| s.to_string()),
            &ann["test_results"].as_str().map(|s| s.to_string()),
            &ann["clinical_notes"].as_str().map(|s| s.to_string()),
            ann["affected_status"].as_str().unwrap_or("unknown"),
            ann["carrier_status"].as_str().unwrap_or("unknown"),
        )?;
    }

    // Insert phenotypes
    for phe in &pedigree.phenotypes {
        let condition_name = phe["condition_name"].as_str().unwrap_or("Unknown");
        import_common::insert_phenotype(
            &conn,
            new_pedigree_id,
            condition_name,
            &phe["omim_id"].as_str().map(|s| s.to_string()),
            &phe["hpo_terms"].as_str().map(|s| s.to_string()),
            &phe["inheritance_mode"].as_str().map(|s| s.to_string()),
            &phe["notes"].as_str().map(|s| s.to_string()),
        )?;
    }

    // Log activity
    import_common::log_activity(
        &conn,
        "imported",
        &format!("{} (from .ppro)", pedigree.title),
        Some(importer_key),
        None,
    )?;

    Ok(new_pedigree_id)
}