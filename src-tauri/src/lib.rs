//! Naplan Throughline — Tauri native shell.
//!
//! The analysis core (`core/`) is filesystem-free: the native layer discovers
//! files and reads their bytes, then hands them to the frontend, which injects
//! them into core. No student data ever leaves the machine.

use std::path::{Path, PathBuf};

use serde::Serialize;

/// One discovered workbook handed to the frontend (then to `core/`).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RawFile {
    /// Base file name, e.g. "SSSR Extract Reading Y9.xlsx".
    name: String,
    /// Path relative to (and including) the chosen folder, e.g.
    /// "Naplan 2026/SSSR Extract Reading.xlsx" — lets core resolve the year of
    /// test from the `Naplan YYYY` folder segment.
    relative_path: String,
    /// Raw workbook bytes (serialised as a number array; SSSR files are small).
    bytes: Vec<u8>,
}

/// App + environment info for the diagnostics export (no student data).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AppInfo {
    version: String,
    os: String,
    arch: String,
}

fn is_xlsx(name: &str) -> bool {
    name.to_lowercase().ends_with(".xlsx") && !name.starts_with("~$")
}

/// Recursively collect `.xlsx` files under `base`, building a relative path that
/// starts with `prefix` (the chosen folder's own name). Depth is bounded to
/// avoid pathological trees.
fn collect_xlsx(base: &Path, prefix: &str, depth: usize, out: &mut Vec<RawFile>) -> Result<(), String> {
    if depth > 6 {
        return Ok(());
    }
    let entries = std::fs::read_dir(base).map_err(|e| format!("{}: {e}", base.display()))?;
    for entry in entries.flatten() {
        let path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();
        if path.is_dir() {
            let child_prefix = format!("{prefix}/{file_name}");
            collect_xlsx(&path, &child_prefix, depth + 1, out)?;
        } else if is_xlsx(&file_name) {
            match std::fs::read(&path) {
                Ok(bytes) => out.push(RawFile {
                    name: file_name.clone(),
                    relative_path: format!("{prefix}/{file_name}"),
                    bytes,
                }),
                // Skip unreadable files rather than failing the whole load.
                Err(e) => log::warn!("skipping {}: {e}", path.display()),
            }
        }
    }
    Ok(())
}

/// Read every `.xlsx` workbook under the chosen folder (recursively) and return
/// their bytes. Filesystem access stays here; `core/` only sees bytes.
#[tauri::command]
fn read_workbook_folder(dir: String) -> Result<Vec<RawFile>, String> {
    let base = PathBuf::from(&dir);
    if !base.is_dir() {
        return Err(format!("not a folder: {dir}"));
    }
    let prefix = base
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "folder".to_string());
    let mut out = Vec::new();
    collect_xlsx(&base, &prefix, 0, &mut out)?;
    Ok(out)
}

/// App version + OS/arch for the diagnostics export.
#[tauri::command]
fn app_info() -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

/// Write a plain-text file (used by "Export diagnostics"). The path comes from a
/// native save dialog; contents must never include student data. Guarded to an
/// absolute `.txt` path so the command can't be repurposed to write elsewhere.
#[tauri::command]
fn save_text_file(path: String, contents: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.is_absolute() || p.extension().and_then(|e| e.to_str()) != Some("txt") {
        return Err("refusing to write: path must be an absolute .txt file".into());
    }
    std::fs::write(&path, contents).map_err(|e| format!("{path}: {e}"))
}

/// Write binary bytes (a generated PDF) to an absolute `.pdf` path chosen via a
/// native save dialog. Guarded so the command can't be repurposed.
#[tauri::command]
fn save_binary_file(path: String, bytes: Vec<u8>) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.is_absolute() || p.extension().and_then(|e| e.to_str()) != Some("pdf") {
        return Err("refusing to write: path must be an absolute .pdf file".into());
    }
    std::fs::write(&path, bytes).map_err(|e| format!("{path}: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let log_plugin = tauri_plugin_log::Builder::new()
        .level(log::LevelFilter::Info)
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::Stdout,
        ))
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::LogDir {
                file_name: Some("naplan-throughline".into()),
            },
        ))
        .max_file_size(1_000_000)
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
        .build();

    let mut builder = tauri::Builder::default()
        .plugin(log_plugin)
        .plugin(tauri_plugin_dialog::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            read_workbook_folder,
            app_info,
            save_text_file,
            save_binary_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
