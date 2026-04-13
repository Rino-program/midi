# AudioMIDI Bridge Web

A browser-based **Audio → MIDI converter** that runs entirely client-side — no server required. Record from your microphone, capture browser tab audio, or process audio/video files to extract pitch data and export Standard MIDI Files.

## Features

- 🎤 **Microphone input** — real-time pitch detection from mic
- 🔊 **Tab audio capture** — capture audio from any browser tab (Chrome)
- 🎵 **Audio file processing** — MP3, WAV, FLAC, OGG, M4A, AAC
- 🎬 **Video file processing** — MP4, WebM, MOV (audio track extracted)
- 🎹 **Piano roll visualizer** — Canvas 2D rendering of detected notes
- 🎼 **MIDI export** — download Standard MIDI File (SMF format 1)
- 🔌 **Web MIDI output** — route notes to connected MIDI devices in real time
- ⚙️ **Configurable detection** — YIN, Essentia, or Crepe pitch algorithms; confidence threshold; quantize grid
- 📱 **PWA** — installable, works offline

## Tech Stack

| Layer | Library |
|---|---|
| UI | React 18, TypeScript 5, Vite 5 |
| Styling | Tailwind CSS 3, framer-motion 12 |
| State | zustand 4 (with localStorage persistence) |
| Pitch | YIN algorithm in Web Worker |
| MIDI | Web MIDI API + custom SMF builder |
| Rendering | Canvas 2D (piano roll) |
| PWA | vite-plugin-pwa + Workbox |

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Build

```bash
npm run build
```

Output is in `dist/`. Serve with any static file server.

## Usage

1. **Select input source** — choose Microphone, Tab, Audio File, or Video File
2. For file modes — drag & drop a file onto the drop zone or click to browse
3. For live modes — click **▶ Start Recording** (browser will request microphone/tab permission)
4. Watch notes appear on the piano roll in real time
5. Click **⬇ Export MIDI** to download a `.mid` file
6. Adjust **Settings** to tune detection sensitivity and quantization

## Architecture

```
src/
├── audio/          AudioInputManager, FileDecodeEngine
├── pitch/          PitchDetectionWorker (YIN), OnsetDetectionWorker (HFC)
├── midi/           MIDIConverter, SMFBuilder, MIDIOutputManager
├── video/          VideoSyncController
├── visualizer/     PianoRollVisualizer (Canvas 2D)
├── store/          useStore (zustand)
└── components/     App.tsx
```

All audio processing runs in Web Workers; the main thread stays responsive.
