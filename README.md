# Orbit

Orbit is a desktop screen recorder and OS-level macro trainer built with
[Tauri](https://tauri.app), React, and TypeScript. It records your screen while
capturing every input event, then turns that session into a shareable
instruction manual.

## Features

- **Screen recording** — start/stop capture from the app.
- **Input tracking** — records OS-level mouse and keyboard events alongside the video.
- **Webcam bubble** — borderless, always-on-top circular camera overlay.
- **Exports**
  - CSV of the raw recorded events.
  - PDF "Instruction Manual" reconstructed from the interaction log.
- Recordings are saved to `<video dir>/Orbit` (falls back to home, then the
  current directory).

## Stack

- Frontend: React 19 + Vite + Tailwind CSS
- Backend: Rust (Tauri 2) — `rdev` for input capture, `printpdf` for manuals

## Development

```bash
npm install
npm run tauri dev
```

## Build

```bash
npm run tauri build
```
