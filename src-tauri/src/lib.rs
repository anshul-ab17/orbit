// Orbit — local screen recorder + macro trainer backend.
//
// Tauri v2 keeps application logic in the library crate (`lib.rs`); `main.rs`
// is a thin shim that calls `run()`.

use std::io::Write as _;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use chrono::Local;
use printpdf::{BuiltinFont, Mm, PdfDocument};
use rdev::{listen, Button, EventType};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A single captured interaction (macro log entry).
#[derive(Clone, Serialize)]
struct MacroEvent {
    kind: String, // "MouseClick" | "KeyPress" | "KeyRelease"
    detail: String,
    x: Option<f64>,
    y: Option<f64>,
    timestamp_ms: i64,
}

#[derive(Clone, Deserialize)]
struct Region {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

#[derive(Clone, Deserialize)]
struct Resolution {
    width: i32,
    height: i32,
}

/// Everything the UI settings panel can control for a capture.
#[derive(Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct RecordConfig {
    #[serde(default = "default_fps")]
    fps: u32,
    region: Option<Region>,               // None = full desktop
    resolution: Option<Resolution>,       // None = native, else scale output
    mic_device: Option<String>,           // dshow audio device
    system_audio_device: Option<String>,  // loopback device (e.g. Stereo Mix)
    webcam_device: Option<String>,        // dshow video device -> overlaid
}

fn default_fps() -> u32 {
    30
}

/// Metadata for a recording in the local library.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordingInfo {
    path: String,
    name: String,
    size_bytes: u64,
    modified_ms: i64,
}

/// Live recording session. Supports pause/resume by recording into numbered
/// segments and concatenating them on stop.
#[derive(Default)]
struct RecState {
    child: Option<Child>,
    config: RecordConfig,
    segments: Vec<PathBuf>,
    final_path: Option<PathBuf>,
}

/// Process-wide shared state.
struct Shared {
    events: Mutex<Vec<MacroEvent>>,
    tracking: AtomicBool,
    rec: Mutex<RecState>,
    cursor: Mutex<(f64, f64)>,
}

impl Shared {
    fn new() -> Self {
        Shared {
            events: Mutex::new(Vec::new()),
            tracking: AtomicBool::new(false),
            rec: Mutex::new(RecState::default()),
            cursor: Mutex::new((0.0, 0.0)),
        }
    }
}

fn now_ms() -> i64 {
    Local::now().timestamp_millis()
}

/// Output directory: `<video dir>/Orbit` (falls back to home, then cwd).
fn output_dir() -> PathBuf {
    let base = dirs::video_dir()
        .or_else(dirs::home_dir)
        .unwrap_or_else(|| PathBuf::from("."));
    let dir = base.join("Orbit");
    let _ = std::fs::create_dir_all(&dir);
    dir
}

// ---------------------------------------------------------------------------
// ffmpeg argument construction
// ---------------------------------------------------------------------------

/// Build the ffmpeg argument list for `config`, writing to `output`.
///
/// Advanced inputs (webcam overlay, dual-audio mixing) use dshow and are
/// Windows-only; macOS/Linux get a screen capture plus an optional single audio
/// device. Coordinates/sizes come straight from the settings panel.
fn ffmpeg_args(config: &RecordConfig, output: &str) -> Vec<String> {
    let mut a: Vec<String> = Vec::new();
    let fps = config.fps.to_string();

    // --- screen input (index 0) ---
    #[cfg(target_os = "windows")]
    {
        a.extend(["-f", "gdigrab", "-framerate"].map(String::from));
        a.push(fps.clone());
        if let Some(r) = &config.region {
            a.extend(
                ["-offset_x", &r.x.to_string(), "-offset_y", &r.y.to_string()].map(String::from),
            );
            a.push("-video_size".into());
            a.push(format!("{}x{}", r.width, r.height));
        }
        a.extend(["-i", "desktop"].map(String::from));
    }
    #[cfg(target_os = "macos")]
    {
        a.extend(["-f", "avfoundation", "-framerate"].map(String::from));
        a.push(fps.clone());
        a.push("-i".into());
        a.push("1:none".into()); // screen index 1, audio handled below
    }
    #[cfg(target_os = "linux")]
    {
        a.extend(["-f", "x11grab", "-framerate"].map(String::from));
        a.push(fps.clone());
        if let Some(r) = &config.region {
            a.push("-video_size".into());
            a.push(format!("{}x{}", r.width, r.height));
            a.push("-i".into());
            a.push(format!(":0.0+{},{}", r.x, r.y));
        } else {
            a.extend(["-i", ":0.0"].map(String::from));
        }
    }

    // Track input indices as we add extra inputs.
    #[allow(unused_mut, unused_assignments)]
    let mut next_idx = 1usize;
    #[allow(unused_mut)]
    let mut cam_idx: Option<usize> = None;
    #[allow(unused_mut)]
    let mut audio_idxs: Vec<usize> = Vec::new();

    #[cfg(target_os = "windows")]
    {
        if let Some(cam) = &config.webcam_device {
            a.extend(["-f", "dshow", "-i"].map(String::from));
            a.push(format!("video={cam}"));
            cam_idx = Some(next_idx);
            next_idx += 1;
        }
        for dev in [&config.mic_device, &config.system_audio_device]
            .into_iter()
            .flatten()
        {
            a.extend(["-f", "dshow", "-i"].map(String::from));
            a.push(format!("audio={dev}"));
            audio_idxs.push(next_idx);
            next_idx += 1;
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(dev) = config
            .mic_device
            .as_ref()
            .or(config.system_audio_device.as_ref())
        {
            #[cfg(target_os = "linux")]
            a.extend(["-f", "pulse", "-i"].map(String::from));
            #[cfg(target_os = "macos")]
            a.extend(["-f", "avfoundation", "-i"].map(String::from));
            a.push(dev.clone());
            audio_idxs.push(next_idx);
            next_idx += 1;
        }
    }

    // --- filter graph ---
    let mut filters: Vec<String> = Vec::new();
    let scale = config
        .resolution
        .as_ref()
        .map(|r| format!("scale={}:{}", r.width, r.height));

    let vmap: String = match cam_idx {
        Some(ci) => {
            filters.push(format!("[{ci}:v]scale=240:-1[cam]"));
            match &scale {
                Some(s) => filters.push(format!("[0:v][cam]overlay=W-w-20:H-h-20,{s}[v]")),
                None => filters.push("[0:v][cam]overlay=W-w-20:H-h-20[v]".into()),
            }
            "[v]".into()
        }
        None => match &scale {
            Some(s) => {
                filters.push(format!("[0:v]{s}[v]"));
                "[v]".into()
            }
            None => "0:v".into(),
        },
    };

    let amap: Option<String> = match audio_idxs.len() {
        0 => None,
        1 => Some(format!("{}:a", audio_idxs[0])),
        _ => {
            let inputs: String = audio_idxs.iter().map(|i| format!("[{i}:a]")).collect();
            filters.push(format!(
                "{inputs}amix=inputs={}:duration=longest[a]",
                audio_idxs.len()
            ));
            Some("[a]".into())
        }
    };

    if !filters.is_empty() {
        a.push("-filter_complex".into());
        a.push(filters.join(";"));
    }

    a.push("-map".into());
    a.push(vmap);
    if let Some(am) = &amap {
        a.push("-map".into());
        a.push(am.clone());
    }

    // --- encode ---
    a.extend(["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p"].map(String::from));
    if amap.is_some() {
        a.extend(["-c:a", "aac"].map(String::from));
    }
    a.push("-y".into());
    a.push(output.to_string());
    a
}

fn spawn_ffmpeg(config: &RecordConfig, output: &Path) -> Result<Child, String> {
    let args = ffmpeg_args(config, &output.to_string_lossy());
    Command::new("ffmpeg")
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            format!("Failed to launch ffmpeg ({e}). Ensure ffmpeg is installed and on PATH.")
        })
}

/// Ask ffmpeg to finalize cleanly (write "q"); kill as a fallback.
fn stop_child(mut child: Child) {
    if let Some(stdin) = child.stdin.as_mut() {
        let _ = stdin.write_all(b"q");
        let _ = stdin.flush();
    }
    if child.wait().is_err() {
        let _ = child.kill();
    }
}

// ---------------------------------------------------------------------------
// Recording commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn start_recording(state: State<'_, Arc<Shared>>, config: RecordConfig) -> Result<String, String> {
    let mut rec = state.rec.lock().unwrap();
    if rec.child.is_some() || !rec.segments.is_empty() {
        return Err("A recording is already in progress.".into());
    }
    let stamp = Local::now().format("%Y%m%d-%H%M%S").to_string();
    let final_path = output_dir().join(format!("recording-{stamp}.mp4"));
    let seg = output_dir().join(format!(".orbit-seg-{stamp}-000.mp4"));

    let child = spawn_ffmpeg(&config, &seg)?;
    rec.child = Some(child);
    rec.config = config;
    rec.segments = vec![seg];
    rec.final_path = Some(final_path.clone());
    Ok(final_path.to_string_lossy().to_string())
}

#[tauri::command]
fn pause_recording(state: State<'_, Arc<Shared>>) -> Result<(), String> {
    let mut rec = state.rec.lock().unwrap();
    let child = rec.child.take().ok_or("Not recording.")?;
    stop_child(child); // closes the current segment cleanly
    Ok(())
}

#[tauri::command]
fn resume_recording(state: State<'_, Arc<Shared>>) -> Result<(), String> {
    let mut rec = state.rec.lock().unwrap();
    if rec.child.is_some() {
        return Err("Already recording.".into());
    }
    if rec.segments.is_empty() {
        return Err("Nothing to resume.".into());
    }
    let stamp = Local::now().format("%Y%m%d-%H%M%S%3f").to_string();
    let n = rec.segments.len();
    let seg = output_dir().join(format!(".orbit-seg-{stamp}-{n:03}.mp4"));
    let config = rec.config.clone();
    let child = spawn_ffmpeg(&config, &seg)?;
    rec.child = Some(child);
    rec.segments.push(seg);
    Ok(())
}

#[tauri::command]
fn stop_recording(state: State<'_, Arc<Shared>>) -> Result<String, String> {
    let mut rec = state.rec.lock().unwrap();
    if let Some(child) = rec.child.take() {
        stop_child(child);
    }
    let segments = std::mem::take(&mut rec.segments);
    let final_path = rec.final_path.take().ok_or("No recording in progress.")?;
    drop(rec);

    if segments.is_empty() {
        return Err("No recording in progress.".into());
    }
    if segments.len() == 1 {
        std::fs::rename(&segments[0], &final_path).map_err(|e| e.to_string())?;
    } else {
        concat_segments(&segments, &final_path)?;
        for s in &segments {
            let _ = std::fs::remove_file(s);
        }
    }
    Ok(final_path.to_string_lossy().to_string())
}

/// Stream-copy concat via ffmpeg's concat demuxer (no re-encode).
fn concat_segments(segments: &[PathBuf], out: &Path) -> Result<(), String> {
    let list = output_dir().join(".orbit-concat.txt");
    let body: String = segments
        .iter()
        .map(|p| format!("file '{}'\n", p.to_string_lossy().replace('\'', "'\\''")))
        .collect();
    std::fs::write(&list, body).map_err(|e| e.to_string())?;

    let status = Command::new("ffmpeg")
        .args(["-f", "concat", "-safe", "0", "-i"])
        .arg(&list)
        .args(["-c", "copy", "-y"])
        .arg(out)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| format!("ffmpeg concat failed: {e}"))?;
    let _ = std::fs::remove_file(&list);
    if !status.success() {
        return Err("ffmpeg concat returned an error.".into());
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// Library (list / delete / trim)
// ---------------------------------------------------------------------------

#[tauri::command]
fn list_recordings() -> Result<Vec<RecordingInfo>, String> {
    let dir = output_dir();
    let mut out = Vec::new();
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || path.extension().and_then(|e| e.to_str()) != Some("mp4") {
            continue;
        }
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let modified_ms = meta
            .modified()
            .ok()
            .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|d| d.as_millis() as i64)
            .unwrap_or(0);
        out.push(RecordingInfo {
            path: path.to_string_lossy().to_string(),
            name,
            size_bytes: meta.len(),
            modified_ms,
        });
    }
    out.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    Ok(out)
}

#[tauri::command]
fn delete_recording(path: String) -> Result<(), String> {
    guard_in_output_dir(&path)?;
    std::fs::remove_file(&path).map_err(|e| e.to_string())
}

/// Trim `path` to the `[startSec, endSec]` window, writing a new `*-trim.mp4`.
#[tauri::command]
#[allow(non_snake_case)]
fn trim_recording(path: String, startSec: f64, endSec: f64) -> Result<String, String> {
    guard_in_output_dir(&path)?;
    if endSec <= startSec {
        return Err("End must be after start.".into());
    }
    let src = PathBuf::from(&path);
    let stem = src.file_stem().and_then(|s| s.to_str()).unwrap_or("clip");
    let out = output_dir().join(format!("{stem}-trim.mp4"));

    let status = Command::new("ffmpeg")
        .args(["-ss", &startSec.to_string(), "-to", &endSec.to_string(), "-i"])
        .arg(&src)
        .args(["-c", "copy", "-y"])
        .arg(&out)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|e| format!("ffmpeg trim failed: {e}"))?;
    if !status.success() {
        return Err("ffmpeg trim returned an error.".into());
    }
    Ok(out.to_string_lossy().to_string())
}

/// Refuse to touch anything outside the Orbit output directory.
fn guard_in_output_dir(path: &str) -> Result<(), String> {
    let p = PathBuf::from(path);
    let dir = output_dir();
    let ok = p
        .canonicalize()
        .ok()
        .zip(dir.canonicalize().ok())
        .map(|(f, d)| f.starts_with(d))
        .unwrap_or(false);
    if ok {
        Ok(())
    } else {
        Err("Path is outside the Orbit library.".into())
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

fn spawn_listener(shared: Arc<Shared>, app: AppHandle) {
    std::thread::spawn(move || {
        let callback = move |event: rdev::Event| {
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
    let mut y = 277.0_f32;
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
        .map(|dt| {
            dt.with_timezone(&Local)
                .format("%Y-%m-%d %H:%M:%S%.3f")
                .to_string()
        })
        .unwrap_or_default()
}

// ---------------------------------------------------------------------------
// Windows (webcam bubble + click-ripple overlay)
// ---------------------------------------------------------------------------

#[tauri::command]
fn toggle_window(app: AppHandle, label: String, show: bool) -> Result<(), String> {
    let win = app.get_webview_window(&label).ok_or("Window not found.")?;
    if show {
        win.show().map_err(|e| e.to_string())?;
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
            // Ripple overlay must be click-through so it never steals input.
            if let Some(r) = app.get_webview_window("ripple") {
                let _ = r.set_ignore_cursor_events(true);
            }
            setup_tray(app)?;
            setup_hotkey(app)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            start_recording,
            pause_recording,
            resume_recording,
            stop_recording,
            list_recordings,
            delete_recording,
            trim_recording,
            set_tracking,
            clear_events,
            export_csv,
            export_pdf,
            toggle_window,
        ])
        .run(tauri::generate_context!())
        .expect("error while running orbit");
}

fn setup_tray(app: &tauri::App) -> tauri::Result<()> {
    use tauri::menu::{Menu, MenuItem};
    use tauri::tray::TrayIconBuilder;

    let show = MenuItem::with_id(app, "show", "Show Orbit", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("Orbit")
        .menu(&menu)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

fn setup_hotkey(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

    let toggle = Shortcut::new(Some(Modifiers::CONTROL | Modifiers::SHIFT), Code::KeyR);
    let handle = app.handle().clone();
    app.handle().plugin(
        tauri_plugin_global_shortcut::Builder::new()
            .with_handler(move |_app, _sc, event| {
                if event.state() == ShortcutState::Pressed {
                    // Frontend owns record state; it decides start vs stop.
                    let _ = handle.emit("hotkey-toggle-record", ());
                }
            })
            .build(),
    )?;
    if let Err(e) = app.global_shortcut().register(toggle) {
        eprintln!("Warning: Failed to register global hotkey (Ctrl+Shift+R): {:?}", e);
    }
    Ok(())
}

// ponytail: self-checks for the ffmpeg arg builder — the one piece of real logic
// we can't run live here (no ffmpeg on the dev machine).
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn args_have_output_and_video_codec() {
        let args = ffmpeg_args(&RecordConfig::default(), "out.mp4");
        assert_eq!(args.last().unwrap(), "out.mp4");
        assert!(args.iter().any(|a| a == "libx264"));
    }

    #[test]
    fn resolution_adds_scale_filter() {
        let c = RecordConfig {
            resolution: Some(Resolution { width: 1280, height: 720 }),
            ..Default::default()
        };
        let args = ffmpeg_args(&c, "out.mp4");
        assert!(args.iter().any(|a| a.contains("scale=1280:720")));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn dual_audio_mixes() {
        let c = RecordConfig {
            mic_device: Some("Mic".into()),
            system_audio_device: Some("Stereo Mix".into()),
            ..Default::default()
        };
        let args = ffmpeg_args(&c, "out.mp4");
        assert!(args.iter().any(|a| a.contains("amix=inputs=2")));
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn webcam_adds_overlay() {
        let c = RecordConfig {
            webcam_device: Some("HD Cam".into()),
            ..Default::default()
        };
        let args = ffmpeg_args(&c, "out.mp4");
        assert!(args.iter().any(|a| a.contains("overlay=")));
    }
}
