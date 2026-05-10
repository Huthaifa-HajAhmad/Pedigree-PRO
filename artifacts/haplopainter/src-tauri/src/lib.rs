// HaploClinical — Library Root
//
// Initializes the Tauri application with plugins, database, and command handlers.
// Modules:
//   db.rs             — SQLCipher database initialization and migrations
//   commands.rs       — Tauri command handlers (the API surface)
//   signatures.rs     — Ed25519 signing/verification and SHA-256 hashing
//   export.rs         — .hpcl export (.hpcl format)
//   import_common.rs  — Shared DB insertion helpers
//   import_native.rs  — Native .hpcl import (current program files)
//   import_legacy.rs  — Legacy HaploPainter SQLite migration
//   relay.rs          — Zero-knowledge relay client for encrypted sharing

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
            // ─── Import (Native .hpcl) ────────────────────────
            commands::import_pedigree_native,
            // ─── Import (Legacy HaploPainter) ─────────────────
            commands::import_pedigree_legacy,
            // ─── Database Management ──────────────────────────
            commands::backup_database,
            commands::restore_database,
            commands::rotate_key,
            // ─── Sharing ──────────────────────────────────────
            commands::share_pedigree,
            commands::import_shared,
            // ─── Dashboard ────────────────────────────────────
            commands::get_dashboard_stats,
            commands::get_recent_activity,
            // ─── Preferences ──────────────────────────────────
            commands::get_preferences,
            commands::save_preferences,
        ])
        .run(tauri::generate_context!())
        .expect("error while running HaploClinical");
}