// Orbit: recorder + OS-level macro trainer backend.
//
// Tauri v2 keeps application logic in the library crate (`lib.rs`); `main.rs`
// is a thin shim that calls `run()`. The original spec asked for
// `src-rs/main.rs`, but fighting the framework layout only buys breakage, so
// the backend lives here where `tauri::generate_context!` expects it.

use std::io::Write as _;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use chrono::Local;
use printpdf::{BuiltinFont, Mm, PdfDocument};
use rdev::{listen, Button, EventType};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

/// A single captured interaction. Serialized straight to the frontend event
/// feed, to CSV rows, and to PDF lines.
#[derive(Clone, Serialize)]
struct MacroEvent {
    /// One of: "MouseClick", "KeyPress", "KeyRelease".
    kind: String,
    /// Human label: the button ("Left") or key ("KeyA"). Empty when N/A.
    detail: String,
    /// Cursor position at capture time. `None` for keyboard events.
    x: Option<f64>,
    y: Option<f64>,
    /// Milliseconds since the Unix epoch (local wall clock).
    timestamp_ms: i64,
}

/// Process-wide shared state, held behind an `Arc` so the `rdev` listener
/// thread and the Tauri command handlers see the same data.
struct Shared {
    events: Mutex<Vec<MacroEvent>>,
    tracking: AtomicBool,
    /// The running ffmpeg child, if a recording is in progress.
    recording: Mutex<Option<Child>>,
    /// Last known cursor position, updated on every `MouseMove` so that click
    /// events can be tagged with coordinates (rdev click events carry none).
    cursor: Mutex<(f64, f64)>,
}

impl Shared {
    fn new() -> Self {
        Shared {
            events: Mutex::new(Vec::new()),
            tracking: AtomicBool::new(false),
            recording: Mutex::new(None),
            cursor: Mutex::new((0.0, 0.0)),
        }
    }
}

fn now_ms() -> i64 {
    Local::now().timestamp_millis()
}

/// Default output directory: `<video dir>/Orbit` (falls back to home, then cwd).
fn output_dir() -> PathBuf {
    let base = dirs::video_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("Orbit");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

// ---------------------------------------------------------------------------
// Recording (ffmpeg wrapper)
// ---------------------------------------------------------------------------

/// Build the platform-specific ffmpeg argument list for a full-screen capture.
///
/// `audio_device` is optional; when supplied it is wired in with the OS's
/// native audio input framework. Device names are user-specific (run
/// `ffmpeg -list_devices true -f dshow -i dummy` on Windows) so we never guess.
fn ffmpeg_args(output: &str, audio_device: Option<&str>) -> Vec<String> {
    let mut args: Vec<String> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        args.extend(["-f", "gdigrab", "-framerate", "30", "-i", "desktop"].map(String::from));
        if let Some(dev) = audio_device {
            args.extend(["-f", "dshow", "-i"].map(String::from));
            args.push(format!("audio={dev}"));
        }
    }
    #[cfg(target_os = "macos")]
    {
        // avfoundation: "<screen>:<audio>". Screen index 1 is a common default.
        let spec = match audio_device {
            Some(dev) => format!("1:{dev}"),
            None => "1:none".to_string(),
        };
        args.extend(["-f", "avfoundation", "-framerate", "30", "-i"].map(String::from));
        args.push(spec);
    }
    #[cfg(target_os = "linux")]
    {
        args.extend(
            ["-f", "x11grab", "-framerate", "30", "-i", ":0.0"].map(String::from),
        );
        if let Some(dev) = audio_device {
            args.extend(["-f", "pulse", "-i"].map(String::from));
            args.push(dev.to_string());
        }
    }

    args.extend(
        ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-y"].map(String::from),
    );
    args.push(output.to_string());
    args
}

#[tauri::command]
fn start_recording(
    state: State<'_, Arc<Shared>>,
    audio_device: Option<String>,
) -> Result<String, String> {
    let mut guard = state.recording.lock().unwrap();
    if guard.is_some() {
        return Err("A recording is already in progress.".into());
    }

    let stamp = Local::now().format("%Y%m%d-%H%M%S");
    let output = output_dir().join(format!("recording-{stamp}.mp4"));
    let output_str = output.to_string_lossy().to_string();

    let args = ffmpeg_args(&output_str, audio_device.as_deref());
    let child = Command::new("ffmpeg")
        .args(&args)
        .stdin(Stdio::piped()) // needed to send "q" for a clean stop
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            format!("Failed to launch ffmpeg ({e}). Ensure ffmpeg is installed and on PATH.")
        })?;

    *guard = Some(child);
    Ok(output_str)
}

#[tauri::command]
fn stop_recording(state: State<'_, Arc<Shared>>) -> Result<(), String> {
    let mut child = state
        .recording
        .lock()
        .unwrap()
        .take()
        .ok_or("No recording is in progress.")?;

    // Ask ffmpeg to finalize the file by writing "q" to its stdin; fall back to
    // kill if it will not stop, otherwise the MP4 moov atom never gets written.
    if let Some(stdin) = child.stdin.as_mut() {
        let _ = stdin.write_all(b"q");
        let _ = stdin.flush();
    }
    match child.wait() {
        Ok(_) => Ok(()),
        Err(_) => {
            let _ = child.kill();
            Ok(())
        }
    }
}

// ---------------------------------------------------------------------------
// Macro tracking
// ---------------------------------------------------------------------------

#[tauri::command]
fn set_tracking(state: State<'_, Arc<Shared>>, enabled: bool) {
    state.tracking.store(enabled, Ordering::SeqCst);
}

#[tauri::command]
fn clear_events(state: State<'_, Arc<Shared>>) {
    state.events.lock().unwrap().clear();
}

/// Start the single global input listener. Runs for the app's lifetime and only
/// records/emits while tracking is enabled, so toggling is a cheap flag flip.
fn spawn_listener(shared: Arc<Shared>, app: AppHandle) {
    std::thread::spawn(move || {
        let callback = move |event: rdev::Event| {
            // Always track the cursor so clicks can be tagged with coordinates.
            if let EventType::MouseMove { x, y } = event.event_type {
                *shared.cursor.lock().unwrap() = (x, y);
                return;
            }

            if !shared.tracking.load(Ordering::SeqCst) {
                return;
            }

            let macro_event = match event.event_type {
                EventType::ButtonPress(button) => {
                    let (x, y) = *shared.cursor.lock().unwrap();
                    Some(MacroEvent {
                        kind: "MouseClick".into(),
                        detail: button_name(button),
                        x: Some(x),
                        y: Some(y),
                        timestamp_ms: now_ms(),
                    })
                }
                EventType::KeyPress(key) => Some(MacroEvent {
                    kind: "KeyPress".into(),
                    detail: format!("{key:?}"),
                    x: None,
                    y: None,
                    timestamp_ms: now_ms(),
                }),
                EventType::KeyRelease(key) => Some(MacroEvent {
                    kind: "KeyRelease".into(),
                    detail: format!("{key:?}"),
                    x: None,
                    y: None,
                    timestamp_ms: now_ms(),
                }),
                _ => None,
            };

            if let Some(ev) = macro_event {
                shared.events.lock().unwrap().push(ev.clone());
                let _ = app.emit("macro-event", ev);
            }
        };

        if let Err(e) = listen(callback) {
            eprintln!("rdev listener stopped: {e:?}");
        }
    });
}

fn button_name(button: Button) -> String {
    match button {
        Button::Left => "Left".into(),
        Button::Right => "Right".into(),
        Button::Middle => "Middle".into(),
        Button::Unknown(code) => format!("Button{code}"),
    }
}

// ---------------------------------------------------------------------------
// Export (CSV + PDF)
// ---------------------------------------------------------------------------

#[tauri::command]
fn export_csv(state: State<'_, Arc<Shared>>) -> Result<String, String> {
    let events = state.events.lock().unwrap();
    let stamp = Local::now().format("%Y%m%d-%H%M%S");
    let path = output_dir().join(format!("macro-log-{stamp}.csv"));

    let mut wtr = csv::Writer::from_path(&path).map_err(|e| e.to_string())?;
    wtr.write_record(["index", "kind", "detail", "x", "y", "timestamp_ms", "time"])
        .map_err(|e| e.to_string())?;
    for (i, ev) in events.iter().enumerate() {
        wtr.write_record([
            (i + 1).to_string(),
            ev.kind.clone(),
            ev.detail.clone(),
            ev.x.map(|v| v.to_string()).unwrap_or_default(),
            ev.y.map(|v| v.to_string()).unwrap_or_default(),
            ev.timestamp_ms.to_string(),
            fmt_time(ev.timestamp_ms),
        ])
        .map_err(|e| e.to_string())?;
    }
    wtr.flush().map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
fn export_pdf(state: State<'_, Arc<Shared>>) -> Result<String, String> {
    let events = state.events.lock().unwrap();
    let stamp = Local::now().format("%Y%m%d-%H%M%S");
    let path = output_dir().join(format!("instruction-manual-{stamp}.pdf"));

    let (doc, page, layer) =
        PdfDocument::new("Orbit Instruction Manual", Mm(210.0), Mm(297.0), "Layer 1");
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| e.to_string())?;

    let mut current = doc.get_page(page).get_layer(layer);
    let mut y = 277.0_f32; // top margin, mm from bottom

    current.use_text("Orbit — Recorded Interaction Manual", 18.0, Mm(15.0), Mm(y), &font_bold);
    y -= 10.0;
    current.use_text(
        format!("Generated {}  •  {} steps", fmt_time(now_ms()), events.len()),
        10.0,
        Mm(15.0),
        Mm(y),
        &font,
    );
    y -= 12.0;

    for (i, ev) in events.iter().enumerate() {
        if y < 20.0 {
            // New page when we run out of vertical room.
            let (p, l) = doc.add_page(Mm(210.0), Mm(297.0), "Layer");
            current = doc.get_page(p).get_layer(l);
            y = 277.0;
        }
        let line = match (ev.x, ev.y) {
            (Some(x), Some(y2)) => format!(
                "{}. [{}] {} at ({:.0}, {:.0})  —  {}",
                i + 1,
                ev.kind,
                ev.detail,
                x,
                y2,
                fmt_time(ev.timestamp_ms)
            ),
            _ => format!(
                "{}. [{}] {}  —  {}",
                i + 1,
                ev.kind,
                ev.detail,
                fmt_time(ev.timestamp_ms)
            ),
        };
        current.use_text(line, 11.0, Mm(15.0), Mm(y), &font);
        y -= 7.0;
    }

    let file = std::fs::File::create(&path).map_err(|e| e.to_string())?;
    doc.save(&mut std::io::BufWriter::new(file))
        .map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

fn fmt_time(ms: i64) -> String {
    chrono::DateTime::from_timestamp_millis(ms)
        .map(|dt| dt.with_timezone(&Local).format("%Y-%m-%d %H:%M:%S%.3f").to_string())
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Webcam bubble window
// ---------------------------------------------------------------------------

#[tauri::command]
fn toggle_webcam_bubble(app: AppHandle, show: bool) -> Result<(), String> {
    let win = app
        .get_webview_window("webcam")
        .ok_or("Webcam window not found.")?;
    if show {
        win.show().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
    } else {
        win.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// App entry
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let shared = Arc::new(Shared::new());

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(shared.clone())
        .setup(move |app| {
            spawn_listener(shared.clone(), app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_recording,
            stop_recording,
            set_tracking,
            clear_events,
            export_csv,
            export_pdf,
            toggle_webcam_bubble,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// ponytail: one self-check for the non-trivial pure logic (arg building).
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ffmpeg_args_include_output_and_video_codec() {
        let args = ffmpeg_args("out.mp4", None);
        assert!(args.last().unwrap() == "out.mp4");
        assert!(args.iter().any(|a| a == "libx264"));
    }

    #[test]
    fn ffmpeg_args_wire_audio_when_device_given() {
        let args = ffmpeg_args("out.mp4", Some("Microphone"));
        assert!(args.iter().any(|a| a.contains("Microphone")));
    }
}
