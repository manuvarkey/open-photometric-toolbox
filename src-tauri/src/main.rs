#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod desktop_typography;

use tauri::Manager;
use std::sync::OnceLock;

static FONT_FAMILIES: OnceLock<Result<Vec<String>, String>> = OnceLock::new();

#[tauri::command]
async fn list_system_font_families() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(|| {
        FONT_FAMILIES.get_or_init(|| {
            let mut families = font_kit::source::SystemSource::new().all_families()
                .map_err(|error| format!("Could not list system fonts: {error}"))?;
            families.retain(|family| !family.trim().is_empty());
            families.sort_by_key(|family| family.to_lowercase());
            families.dedup_by(|a, b| a.eq_ignore_ascii_case(b));
            Ok(families)
        }).clone()
    }).await.map_err(|error| format!("Font discovery failed: {error}"))?
}

#[tauri::command]
fn read_photometric_file(path: String) -> Result<String, String> {
    let bytes = std::fs::read(&path).map_err(|error| format!("Failed to read file: {error}"))?;
    match String::from_utf8(bytes) {
        Ok(text) => Ok(text),
        Err(error) => {
            let bytes = error.into_bytes();
            let (text, _, invalid) = encoding_rs::WINDOWS_1252.decode(&bytes);
            if invalid { return Err("The photometric file contains invalid text encoding.".into()); }
            Ok(text.into_owned())
        }
    }
}

#[tauri::command]
fn save_photometric_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("Failed to write file: {}", e))
}

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Suppress upstream GTK3 Wayland harmless assertion when configuring CSD before window realization
        gtk::glib::log_set_handler(
            Some("Gdk"),
            gtk::glib::LogLevels::LEVEL_CRITICAL | gtk::glib::LogLevels::LEVEL_WARNING,
            false,
            false,
            |_domain, level, message: &str| {
                if message.contains("gdk_wayland_window_set_dbus_properties_libgtk_only") {
                    return;
                }
                gtk::glib::log_default_handler(Some("Gdk"), level, Some(message));
            },
        );
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            desktop_typography::install(app);
            #[cfg(target_os = "linux")]
            {
                use gtk::prelude::*;
                // Undecorated GTK windows get no compositor shadow or resize border.
                // Keep client-side decorations with an empty titlebar widget instead:
                // GTK draws the shadow while the web titlebar stays the only title bar.
                // Must run before the window is first shown (it starts hidden).
                if let Some(window) = app.get_webview_window("main") {
                    if let Ok(gtk_window) = window.gtk_window() {
                        let titlebar = gtk::Box::new(gtk::Orientation::Horizontal, 0);
                        titlebar.set_no_show_all(true);
                        gtk_window.set_titlebar(Some(&titlebar));
                        gtk_window.set_decorated(true);
                    }
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            #[cfg(not(target_os = "linux"))]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_photometric_file,
            save_photometric_file,
            list_system_font_families,
            desktop_typography::desktop_font
        ])
        .run(tauri::generate_context!())
        .expect("error while running Open Photometric Toolbox");
}
