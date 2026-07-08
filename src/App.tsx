import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import Library from "./Library";

type MacroEvent = {
  kind: "MouseClick" | "KeyPress" | "KeyRelease";
  detail: string;
  x: number | null;
  y: number | null;
  timestamp_ms: number;
};

type Device = { id: string; label: string };
type RecPhase = "idle" | "recording" | "paused";
const MAX_FEED = 500;

// Passed straight to the Rust `RecordConfig` (camelCase).
type RecordConfig = {
  fps: number;
  region: { x: number; y: number; width: number; height: number } | null;
  resolution: { width: number; height: number } | null;
  micDevice: string | null;
  systemAudioDevice: string | null;
  webcamDevice: string | null;
};

export default function App() {
  const [tab, setTab] = useState<"record" | "library">("record");
  const [phase, setPhase] = useState<RecPhase>("idle");
  const [tracking, setTracking] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [ripple, setRipple] = useState(false);
  const [events, setEvents] = useState<MacroEvent[]>([]);
  const [status, setStatus] = useState("Ready.");
  const [countdown, setCountdown] = useState(0);
  const feedRef = useRef<HTMLDivElement>(null);

  // Settings
  const [fps, setFps] = useState(30);
  const [resolution, setResolution] = useState("native");
  const [region, setRegion] = useState({ enabled: false, x: 0, y: 0, width: 1280, height: 720 });
  const [cams, setCams] = useState<Device[]>([]);
  const [mics, setMics] = useState<Device[]>([]);
  const [camDevice, setCamDevice] = useState("");
  const [micDevice, setMicDevice] = useState("");
  const [sysAudio, setSysAudio] = useState("");

  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  // Live macro feed.
  useEffect(() => {
    const un = listen<MacroEvent>("macro-event", (e) => {
      setEvents((prev) => {
        const next = [...prev, e.payload];
        return next.length > MAX_FEED ? next.slice(next.length - MAX_FEED) : next;
      });
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [events]);

  // Enumerate cameras/mics for the pickers.
  useEffect(() => {
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((ds) => {
        const cam = ds.filter((d) => d.kind === "videoinput").map((d) => ({ id: d.deviceId, label: d.label || "Camera" }));
        const mic = ds.filter((d) => d.kind === "audioinput").map((d) => ({ id: d.deviceId, label: d.label || "Microphone" }));
        setCams(cam);
        setMics(mic);
      })
      .catch(() => {});
  }, []);

  function buildConfig(): RecordConfig {
    const [rw, rh] = resolution === "native" ? [0, 0] : resolution.split("x").map(Number);
    return {
      fps,
      region: region.enabled
        ? { x: region.x, y: region.y, width: region.width, height: region.height }
        : null,
      resolution: resolution === "native" ? null : { width: rw, height: rh },
      micDevice: micDevice || null,
      systemAudioDevice: sysAudio || null,
      webcamDevice: camDevice || null,
    };
  }

  const startRecording = useCallback(async () => {
    // Countdown 3..1 then start.
    for (let i = 3; i > 0; i--) {
      setCountdown(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    setCountdown(0);
    try {
      const path = await invoke<string>("start_recording", { config: buildConfig() });
      setPhase("recording");
      setStatus(`Recording → ${path}`);
    } catch (e) {
      setStatus(String(e));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fps, resolution, region, micDevice, sysAudio, camDevice]);

  async function stopRecording() {
    try {
      const path = await invoke<string>("stop_recording");
      setPhase("idle");
      setStatus(`Saved → ${path}`);
    } catch (e) {
      setStatus(String(e));
    }
  }

  async function pauseResume() {
    try {
      if (phase === "recording") {
        await invoke("pause_recording");
        setPhase("paused");
        setStatus("Paused.");
      } else if (phase === "paused") {
        await invoke("resume_recording");
        setPhase("recording");
        setStatus("Recording…");
      }
    } catch (e) {
      setStatus(String(e));
    }
  }

  // Global hotkey (Ctrl+Shift+R) toggles start/stop.
  useEffect(() => {
    const un = listen("hotkey-toggle-record", () => {
      if (phaseRef.current === "idle") startRecording();
      else stopRecording();
    });
    return () => {
      un.then((f) => f());
    };
  }, [startRecording]);

  async function toggleTracking() {
    const next = !tracking;
    try {
      await invoke("set_tracking", { enabled: next });
      setTracking(next);
      setStatus(next ? "Tracking macro actions…" : "Tracking paused.");
    } catch (e) {
      setStatus(String(e));
    }
  }

  async function toggleWindow(label: "webcam" | "ripple", cur: boolean, set: (b: boolean) => void) {
    try {
      await invoke("toggle_window", { label, show: !cur });
      set(!cur);
    } catch (e) {
      setStatus(String(e));
    }
  }

  async function doExport(kind: "csv" | "pdf") {
    try {
      const path = await invoke<string>(kind === "csv" ? "export_csv" : "export_pdf");
      setStatus(`Exported ${kind.toUpperCase()} → ${path}`);
    } catch (e) {
      setStatus(String(e));
    }
  }

  async function clearFeed() {
    await invoke("clear_events");
    setEvents([]);
    setStatus("Cleared log.");
  }

  return (
    <div className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-indigo-500" />
            <h1 className="text-lg font-semibold tracking-tight">Orbit Studio</h1>
          </div>
          <nav className="flex gap-1 text-sm">
            {(["record", "library"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`rounded-md px-3 py-1 capitalize ${
                  tab === t ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>
        <span className="max-w-[46ch] truncate text-xs text-slate-400">{status}</span>
      </header>

      {tab === "library" ? (
        <Library onStatus={setStatus} />
      ) : (
        <div className="grid flex-1 grid-cols-[360px_1fr] overflow-hidden">
          {/* Controls + settings */}
          <aside className="flex flex-col gap-4 overflow-y-auto border-r border-slate-800 p-5">
            <div className="flex gap-2">
              {phase === "idle" ? (
                <button
                  onClick={startRecording}
                  className="flex-1 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium hover:bg-red-500"
                >
                  ● Record Screen
                </button>
              ) : (
                <>
                  <button
                    onClick={stopRecording}
                    className="flex-1 rounded-lg bg-slate-700 px-4 py-3 text-sm font-medium hover:bg-slate-600"
                  >
                    ■ Stop
                  </button>
                  <button
                    onClick={pauseResume}
                    className="rounded-lg bg-slate-800 px-4 py-3 text-sm font-medium hover:bg-slate-700"
                  >
                    {phase === "recording" ? "❚❚ Pause" : "▶ Resume"}
                  </button>
                </>
              )}
            </div>
            <p className="-mt-2 text-[11px] text-slate-500">Hotkey: Ctrl+Shift+R</p>

            <Section title="Capture settings">
              <Field label="Frame rate">
                <select value={fps} onChange={(e) => setFps(Number(e.target.value))} className={inputCls}>
                  {[15, 24, 30, 60].map((f) => (
                    <option key={f} value={f}>{f} fps</option>
                  ))}
                </select>
              </Field>
              <Field label="Resolution">
                <select value={resolution} onChange={(e) => setResolution(e.target.value)} className={inputCls}>
                  <option value="native">Native</option>
                  <option value="1920x1080">1080p</option>
                  <option value="1280x720">720p</option>
                  <option value="854x480">480p</option>
                </select>
              </Field>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={region.enabled}
                  onChange={(e) => setRegion({ ...region, enabled: e.target.checked })}
                />
                Custom region
              </label>
              {region.enabled && (
                <div className="grid grid-cols-4 gap-2">
                  {(["x", "y", "width", "height"] as const).map((k) => (
                    <label key={k} className="flex flex-col gap-0.5 text-[10px] text-slate-500">
                      {k}
                      <input
                        type="number"
                        value={region[k]}
                        onChange={(e) => setRegion({ ...region, [k]: Number(e.target.value) })}
                        className="rounded border border-slate-700 bg-slate-900 px-1 py-1 text-xs"
                      />
                    </label>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Audio & camera">
              <Field label="Microphone">
                <select value={micDevice} onChange={(e) => setMicDevice(e.target.value)} className={inputCls}>
                  <option value="">None</option>
                  {mics.map((m) => (
                    <option key={m.id} value={m.label}>{m.label}</option>
                  ))}
                </select>
              </Field>
              <Field label="System audio (loopback device)">
                <input
                  value={sysAudio}
                  onChange={(e) => setSysAudio(e.target.value)}
                  placeholder="e.g. Stereo Mix / virtual-audio-capturer"
                  className={inputCls}
                />
              </Field>
              <Field label="Webcam (composited into video)">
                <select value={camDevice} onChange={(e) => setCamDevice(e.target.value)} className={inputCls}>
                  <option value="">None</option>
                  {cams.map((c) => (
                    <option key={c.id} value={c.label}>{c.label}</option>
                  ))}
                </select>
              </Field>
            </Section>

            <Section title="Overlays & tracking">
              <ToggleRow label="Track Macro Actions" active={tracking} onClick={toggleTracking} />
              <ToggleRow
                label="Webcam Bubble"
                active={bubble}
                onClick={() => toggleWindow("webcam", bubble, setBubble)}
              />
              <ToggleRow
                label="Click Ripple Overlay"
                active={ripple}
                onClick={() => toggleWindow("ripple", ripple, setRipple)}
              />
            </Section>

            <div className="mt-auto flex flex-col gap-2">
              <div className="text-[11px] uppercase tracking-wide text-slate-500">Export macro log</div>
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => doExport("csv")} className={btnCls}>CSV</button>
                <button onClick={() => doExport("pdf")} className={btnCls}>PDF</button>
                <button onClick={clearFeed} className={btnCls}>Clear</button>
              </div>
            </div>
          </aside>

          {/* Live feed */}
          <main className="flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800 px-6 py-3">
              <h2 className="text-sm font-medium text-slate-300">Live Activity Feed</h2>
              <span className="text-xs text-slate-500">{events.length} events</span>
            </div>
            <div ref={feedRef} className="flex-1 overflow-y-auto px-6 py-3 font-mono text-xs">
              {events.length === 0 ? (
                <p className="text-slate-600">
                  No events yet. Enable “Track Macro Actions” and interact with your machine.
                </p>
              ) : (
                events.map((ev, i) => <FeedRow key={i} index={i} ev={ev} />)
              )}
            </div>
          </main>
        </div>
      )}

      {countdown > 0 && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/70 text-8xl font-bold text-white">
          {countdown}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500";
const btnCls = "rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-slate-800 p-3">
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{title}</div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-slate-400">
      {label}
      {children}
    </label>
  );
}

function ToggleRow({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-md px-3 py-2 text-sm ${
        active ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-800 hover:bg-slate-700"
      }`}
    >
      {label}
      <span className={`h-2.5 w-2.5 rounded-full ${active ? "bg-white" : "bg-slate-600"}`} />
    </button>
  );
}

function FeedRow({ index, ev }: { index: number; ev: MacroEvent }) {
  const color =
    ev.kind === "MouseClick"
      ? "text-amber-400"
      : ev.kind === "KeyPress"
        ? "text-emerald-400"
        : "text-slate-500";
  const time = new Date(ev.timestamp_ms).toLocaleTimeString();
  const coords =
    ev.x != null && ev.y != null ? ` (${Math.round(ev.x)}, ${Math.round(ev.y)})` : "";
  return (
    <div className="flex gap-3 border-b border-slate-900 py-1">
      <span className="w-10 shrink-0 text-slate-600">{index + 1}</span>
      <span className="w-24 shrink-0 text-slate-500">{time}</span>
      <span className={`w-24 shrink-0 ${color}`}>{ev.kind}</span>
      <span className="text-slate-300">
        {ev.detail}
        {coords}
      </span>
    </div>
  );
}
