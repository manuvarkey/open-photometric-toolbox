#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;

#[tauri::command]
fn read_photometric_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("Failed to read file: {}", e))
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
            save_photometric_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Open Photometric Toolbox");
}
