// Pedigree PRO — Library Root
//
// ─── Tauri Command Registration ───────────────────────────────────
//   db.rs             — SQLCipher Database Engine (libsqlcipher-sys)
//   commands.rs       — Tauri IPC Command Handlers
//   export.rs         — Encrypted Export (Ed25519 + AES-256-GCM)
//   signatures.rs     — Ed25519 Keypair Generation & Signature Verification
//   relay.rs          — Zero-Knowledge Relay Client (libsodium sealed box)
//   import_native.rs  — Native .ppro Import (same format as export)
//   import_legacy.rs  — Legacy SQLite migration

mod commands;
mod db;
mod export;
mod import_common;
mod import_legacy;
mod import_native;
mod relay;
mod signatures;

use std::sync::Mutex;
use tauri::Manager;

/// Shared application state accessible from all Tauri command handlers.
pub struct AppState {
    pub db: Mutex<rusqlite::Connection>,
}

/// Runs the Tauri application.
/// Called from main.rs.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();
            let conn = db::init_db(&handle)?;
            app.manage(AppState {
                db: Mutex::new(conn),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // ─── Profiles ─────────────────────────────────────
            commands::create_profile,
            commands::list_profiles,
            commands::switch_profile,
            commands::delete_profile,
            commands::export_profile,
            commands::import_profile,
            // ─── Patients ─────────────────────────────────────
            commands::list_patients,
            commands::get_patient,
            commands::create_patient,
            commands::update_patient,
            commands::delete_patient,
            // ─── Pedigrees ────────────────────────────────────
            commands::list_pedigrees,
            commands::get_pedigree,
            commands::create_pedigree,
            commands::update_pedigree,
            commands::delete_pedigree,
            // ─── Versions ─────────────────────────────────────
            commands::list_versions,
            commands::save_version,
            commands::restore_version,
            commands::delete_version,
            // ─── Import (Native .ppro) ────────────────────────
            commands::import_pedigree_native,
            commands::import_pedigree_from_json,
            // ─── Import (Legacy HaploPainter) ─────────────────
            commands::import_pedigree_legacy,
            // ─── Export ────────────────────────────────────────
            export::export_pedigree_ppro,
            // ─── Database Management ──────────────────────────
            commands::backup_database,
            commands::restore_database,
            commands::rotate_key,
            // ─── Sharing ──────────────────────────────────────
            commands::share_pedigree,
            commands::relay_share,
            commands::relay_receive,
            commands::import_shared,
            // ─── Dashboard ────────────────────────────────────
            commands::get_dashboard_stats,
            commands::get_recent_activity,
            commands::clear_activity_log,
            // ─── Preferences ──────────────────────────────────
            commands::get_preferences,
            commands::save_preferences,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Pedigree PRO");
}