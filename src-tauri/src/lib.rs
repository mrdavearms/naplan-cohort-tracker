//! NAPLAN Cohort Tracker — Tauri native shell.
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

/// Read a set of individually-picked `.xlsx` files (from a multi-select native
/// file dialog). Unlike the folder command, there is no containing `Naplan YYYY`
/// folder, so `relative_path` is just the file name — the user assigns the year
/// of test on the import screen. Non-`.xlsx` / unreadable picks are skipped.
#[tauri::command]
fn read_workbook_files(paths: Vec<String>) -> Result<Vec<RawFile>, String> {
    let mut out = Vec::new();
    for path in paths {
        let p = PathBuf::from(&path);
        let file_name = p
            .file_name()
            .map(|n| n.to_string_lossy().to_string())
            .unwrap_or_default();
        if !is_xlsx(&file_name) {
            continue;
        }
        match std::fs::read(&p) {
            Ok(bytes) => out.push(RawFile {
                name: file_name.clone(),
                relative_path: file_name,
                bytes,
            }),
            Err(e) => log::warn!("skipping {}: {e}", p.display()),
        }
    }
    Ok(out)
}

/// App version + OS/arch for the diagnostics export. The version is the app's
/// own (from `tauri.conf.json`, which drives the bundle + auto-updater) so the
/// diagnostics file can't drift from the real version the way `CARGO_PKG_VERSION`
/// did (the crate version was never bumped in lockstep with the app version).
#[tauri::command]
fn app_info(app: tauri::AppHandle) -> AppInfo {
    AppInfo {
        version: app.package_info().version.to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
    }
}

/// Write a plain-text file (diagnostics export, CSV table export). The path
/// comes from a native save dialog. Guarded to an absolute `.txt` or `.csv` path
/// so the command can't be repurposed to write elsewhere. CSV exports carry
/// Local Student IDs only — never names.
#[tauri::command]
fn save_text_file(path: String, contents: String) -> Result<(), String> {
    let p = Path::new(&path);
    let ext = p.extension().and_then(|e| e.to_str());
    if !p.is_absolute() || !matches!(ext, Some("txt") | Some("csv")) {
        return Err("refusing to write: path must be an absolute .txt or .csv file".into());
    }
    std::fs::write(&path, contents).map_err(|e| format!("{path}: {e}"))
}

/// Write a generated PDF (base64-encoded by the frontend) to an absolute `.pdf`
/// path chosen via a native save dialog. Base64 keeps the IPC payload a compact
/// string rather than a multi-MB JSON number array. Guarded so the command
/// can't be repurposed.
#[tauri::command]
fn save_binary_file(path: String, b64: String) -> Result<(), String> {
    use base64::{engine::general_purpose::STANDARD, Engine as _};
    let p = Path::new(&path);
    if !p.is_absolute() || p.extension().and_then(|e| e.to_str()) != Some("pdf") {
        return Err("refusing to write: path must be an absolute .pdf file".into());
    }
    let bytes = STANDARD.decode(&b64).map_err(|e| format!("invalid PDF data: {e}"))?;
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
                file_name: Some("naplan-cohort-tracker".into()),
            },
        ))
        .max_file_size(1_000_000)
        .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
        .build();

    let mut builder = tauri::Builder::default()
        .plugin(log_plugin)
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .invoke_handler(tauri::generate_handler![
            read_workbook_folder,
            read_workbook_files,
            app_info,
            save_text_file,
            save_binary_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
