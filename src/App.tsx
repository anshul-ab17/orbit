import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

// Mirror of the Rust `MacroEvent` struct.
type MacroEvent = {
  kind: "MouseClick" | "KeyPress" | "KeyRelease";
  detail: string;
  x: number | null;
  y: number | null;
  timestamp_ms: number;
};

const MAX_FEED = 500; // cap the live feed so the DOM stays cheap

export default function App() {
  const [recording, setRecording] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [bubble, setBubble] = useState(false);
  const [audioDevice, setAudioDevice] = useState("");
  const [events, setEvents] = useState<MacroEvent[]>([]);
  const [status, setStatus] = useState<string>("Ready.");
  const feedRef = useRef<HTMLDivElement>(null);

  // Subscribe once to the backend event stream.
  useEffect(() => {
    const unlisten = listen<MacroEvent>("macro-event", (e) => {
      setEvents((prev) => {
        const next = [...prev, e.payload];
        return next.length > MAX_FEED ? next.slice(next.length - MAX_FEED) : next;
      });
    });
    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  // Auto-scroll the feed to the newest entry.
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [events]);

  async function toggleRecording() {
    try {
      if (!recording) {
        const path = await invoke<string>("start_recording", {
          audioDevice: audioDevice.trim() || null,
        });
        setRecording(true);
        setStatus(`Recording → ${path}`);
      } else {
        await invoke("stop_recording");
        setRecording(false);
        setStatus("Recording saved.");
      }
    } catch (e) {
      setStatus(String(e));
    }
  }

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

  async function toggleBubble() {
    const next = !bubble;
    try {
      await invoke("toggle_webcam_bubble", { show: next });
      setBubble(next);
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
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-indigo-500" />
          <h1 className="text-lg font-semibold tracking-tight">Orbit Studio</h1>
          <span className="text-xs text-slate-500">recorder + macro trainer</span>
        </div>
        <span className="text-xs text-slate-400">{status}</span>
      </header>

      <div className="grid flex-1 grid-cols-[320px_1fr] overflow-hidden">
        {/* Controls */}
        <aside className="flex flex-col gap-4 border-r border-slate-800 p-6">
          <Toggle
            label="Record Screen"
            active={recording}
            onClick={toggleRecording}
            activeClass="bg-red-600 hover:bg-red-500"
          />
          <Toggle
            label="Track Macro Actions"
            active={tracking}
            onClick={toggleTracking}
            activeClass="bg-emerald-600 hover:bg-emerald-500"
          />
          <Toggle
            label="Webcam Bubble"
            active={bubble}
            onClick={toggleBubble}
            activeClass="bg-indigo-600 hover:bg-indigo-500"
          />

          <label className="mt-2 flex flex-col gap-1 text-xs text-slate-400">
            Audio device (optional)
            <input
              value={audioDevice}
              onChange={(e) => setAudioDevice(e.target.value)}
              placeholder="e.g. Microphone (Realtek)"
              className="rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-indigo-500"
            />
          </label>

          <div className="mt-auto flex flex-col gap-2">
            <div className="text-xs uppercase tracking-wide text-slate-500">Export</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => doExport("csv")}
                className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
              >
                CSV
              </button>
              <button
                onClick={() => doExport("pdf")}
                className="rounded-md bg-slate-800 px-3 py-2 text-sm hover:bg-slate-700"
              >
                PDF
              </button>
            </div>
            <button
              onClick={clearFeed}
              className="rounded-md border border-slate-700 px-3 py-2 text-sm text-slate-300 hover:bg-slate-800"
            >
              Clear Log
            </button>
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
    </div>
  );
}

function Toggle(props: {
  label: string;
  active: boolean;
  onClick: () => void;
  activeClass: string;
}) {
  return (
    <button
      onClick={props.onClick}
      className={`flex items-center justify-between rounded-lg px-4 py-3 text-sm font-medium transition ${
        props.active ? props.activeClass : "bg-slate-800 hover:bg-slate-700"
      }`}
    >
      {props.label}
      <span
        className={`h-2.5 w-2.5 rounded-full ${props.active ? "bg-white" : "bg-slate-600"}`}
      />
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
