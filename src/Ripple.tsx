import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";

type MacroEvent = { kind: string; x: number | null; y: number | null; timestamp_ms: number };
type Ping = { id: number; x: number; y: number };

// Fullscreen click-through overlay. On each tracked mouse click it draws an
// expanding ripple at the cursor — burned into the recording via gdigrab.
export default function Ripple() {
  const [pings, setPings] = useState<Ping[]>([]);

  useEffect(() => {
    let id = 0;
    const un = listen<MacroEvent>("macro-event", (e) => {
      const ev = e.payload;
      if (ev.kind !== "MouseClick" || ev.x == null || ev.y == null) return;
      const ping = { id: id++, x: ev.x, y: ev.y };
      setPings((p) => [...p, ping]);
      setTimeout(() => setPings((p) => p.filter((q) => q.id !== ping.id)), 600);
    });
    return () => {
      un.then((f) => f());
    };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0">
      {pings.map((p) => (
        <span
          key={p.id}
          className="absolute h-10 w-10 -translate-x-1/2 -translate-y-1/2 animate-[ripple_0.6s_ease-out] rounded-full border-4 border-indigo-400"
          style={{ left: p.x, top: p.y }}
        />
      ))}
    </div>
  );
}
