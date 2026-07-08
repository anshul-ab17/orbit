import { useEffect, useRef, useState } from "react";
import { invoke, convertFileSrc } from "@tauri-apps/api/core";

type Recording = {
  path: string;
  name: string;
  sizeBytes: number;
  modifiedMs: number;
};

function fmtSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 ** 2).toFixed(1)} MB`;
}

export default function Library({ onStatus }: { onStatus: (s: string) => void }) {
  const [items, setItems] = useState<Recording[]>([]);
  const [selected, setSelected] = useState<Recording | null>(null);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function refresh() {
    try {
      const list = await invoke<Recording[]>("list_recordings");
      setItems(list);
      if (selected && !list.find((r) => r.path === selected.path)) setSelected(null);
    } catch (e) {
      onStatus(String(e));
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function open(rec: Recording) {
    setSelected(rec);
    setStart(0);
    setEnd(0);
  }

  async function remove(rec: Recording) {
    try {
      await invoke("delete_recording", { path: rec.path });
      onStatus(`Deleted ${rec.name}`);
      await refresh();
    } catch (e) {
      onStatus(String(e));
    }
  }

  async function trim() {
    if (!selected) return;
    if (end <= start) return onStatus("Set an end time after the start.");
    try {
      const out = await invoke<string>("trim_recording", {
        path: selected.path,
        startSec: start,
        endSec: end,
      });
      onStatus(`Trimmed → ${out}`);
      await refresh();
    } catch (e) {
      onStatus(String(e));
    }
  }

  return (
    <div className="grid h-full grid-cols-[320px_1fr] overflow-hidden">
      <aside className="flex flex-col overflow-hidden border-r border-slate-800">
        <div className="flex items-center justify-between px-5 py-3">
          <h2 className="text-sm font-medium text-slate-300">Library</h2>
          <button onClick={refresh} className="text-xs text-slate-400 hover:text-slate-200">
            Refresh
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {items.length === 0 ? (
            <p className="px-2 text-xs text-slate-600">No recordings yet.</p>
          ) : (
            items.map((rec) => (
              <button
                key={rec.path}
                onClick={() => open(rec)}
                className={`mb-1 w-full rounded-md px-3 py-2 text-left text-xs ${
                  selected?.path === rec.path ? "bg-indigo-600/30" : "hover:bg-slate-800"
                }`}
              >
                <div className="truncate text-slate-200">{rec.name}</div>
                <div className="text-slate-500">
                  {fmtSize(rec.sizeBytes)} · {new Date(rec.modifiedMs).toLocaleString()}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      <main className="flex flex-col overflow-y-auto p-6">
        {!selected ? (
          <p className="text-sm text-slate-600">Select a recording to preview, trim, or delete.</p>
        ) : (
          <>
            <video
              ref={videoRef}
              key={selected.path}
              src={convertFileSrc(selected.path)}
              controls
              className="mb-4 max-h-[55vh] w-full rounded-lg bg-black"
            />
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Trim start (s)
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={start}
                    onChange={(e) => setStart(Number(e.target.value))}
                    className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => setStart(videoRef.current?.currentTime ?? 0)}
                    className="rounded-md border border-slate-700 px-2 text-xs hover:bg-slate-800"
                  >
                    ⇐ playhead
                  </button>
                </div>
              </label>
              <label className="flex flex-col gap-1 text-xs text-slate-400">
                Trim end (s)
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    value={end}
                    onChange={(e) => setEnd(Number(e.target.value))}
                    className="w-24 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-sm"
                  />
                  <button
                    onClick={() => setEnd(videoRef.current?.currentTime ?? 0)}
                    className="rounded-md border border-slate-700 px-2 text-xs hover:bg-slate-800"
                  >
                    ⇐ playhead
                  </button>
                </div>
              </label>
              <button
                onClick={trim}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500"
              >
                Trim → new clip
              </button>
              <button
                onClick={() => remove(selected)}
                className="rounded-md border border-red-800 px-4 py-2 text-sm text-red-300 hover:bg-red-950"
              >
                Delete
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
