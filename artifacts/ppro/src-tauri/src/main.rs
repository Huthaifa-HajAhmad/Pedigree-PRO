// Pedigree PRO — Tauri Desktop Application Entry Point
// Prevents additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    pedigree_pro_lib::run()
}