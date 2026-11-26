use serde::Serialize;
use std::sync::Mutex;
use tauri::Manager;

#[derive(Clone, Default, Serialize)]
pub struct DesktopFont {
    family: Option<String>,
    size: Option<String>,
}

#[derive(Default)]
pub struct DesktopTypography(Mutex<DesktopFont>);

#[tauri::command]
pub fn desktop_font(state: tauri::State<'_, DesktopTypography>) -> Result<DesktopFont, String> {
    state
        .0
        .lock()
        .map(|font| font.clone())
        .map_err(|error| error.to_string())
}

/// Read GTK/Pango font settings; other WebViews use the system UI font.
pub fn install(app: &tauri::App) {
    app.manage(DesktopTypography::default());
    #[cfg(target_os = "linux")]
    {
        use gtk::prelude::*;
        use tauri::Emitter;
        fn metrics(settings: &gtk::Settings) -> DesktopFont {
            let description = gtk::pango::FontDescription::from_string(
                &settings.gtk_font_name().unwrap_or_else(|| "Sans 11".into()),
            );
            let size = f64::from(description.size()) / f64::from(gtk::pango::SCALE);
            DesktopFont {
                family: description.family().map(|name| name.to_string()),
                size: (size > 0.0).then(|| {
                    format!(
                        "{}{}",
                        size,
                        if description.is_size_absolute() {
                            "px"
                        } else {
                            "pt"
                        }
                    )
                }),
            }
        }
        if let Some(settings) = gtk::Settings::default() {
            if let Ok(mut current) = app.state::<DesktopTypography>().0.lock() {
                *current = metrics(&settings);
            }
            let handle = app.handle().clone();
            settings.connect_gtk_font_name_notify(move |settings| {
                let font = metrics(settings);
                if let Ok(mut current) = handle.state::<DesktopTypography>().0.lock() {
                    *current = font.clone();
                }
                let _ = handle.emit("desktop-font", font);
            });
        }
    }
}
