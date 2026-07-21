# TuneScribe

AI piano/vocal to MIDI and sheet music — **fully offline on your phone**.

Record piano or vocal audio, transcribe on-device with Basic Pitch (ONNX), and view or share MIDI, MusicXML, and chord progressions locally. No server, no account, no cloud upload.

## What offline v1 includes

| Feature | Supported |
|---------|-----------|
| Record piano (polyphonic) or vocal (monophonic) | Yes |
| Output: sheet music, chords, or both | Yes |
| Transcription tuning sliders | Yes |
| Projects list, playback, export | Yes |
| Transpose MusicXML / MXL files | Yes |
| PDF/photo sheet import, PDF export, backend processing | Not in v1 |

## Project structure

```text
TuneScribe/
  backend/     Optional self-hosted FastAPI (not required for offline v1)
  mobile/      Expo React Native app with on-device Basic Pitch
  docs/        Documentation
```

## Quick start (offline v1)

### 1. Install the app

See [docs/IOS_DEV_CLIENT.md](docs/IOS_DEV_CLIENT.md) for EAS dev client setup.

**One-time dev build:**

```bash
cd mobile
eas build --profile development --platform ios
```

**Production / TestFlight build (standalone, no Metro required):**

```bash
cd mobile
eas build --profile production --platform ios
```

No `EXPO_PUBLIC_API_URL` is needed for offline v1.

### 2. Daily development

```bash
cd mobile
npm run start:dev
```

Open the **TuneScribe dev app** on your phone (not Expo Go) and scan the QR code.

### 3. Verify offline

Enable **airplane mode** on your iPhone, then:

1. Record a 15–30 second piano clip → transcribe → open project
2. Export MIDI or MusicXML from the project screen
3. Transpose a `.musicxml` or `.mxl` file on the Transpose tab

## Offline pipeline

```text
Record WAV → Basic Pitch ONNX (on-device) → MIDI cleanup → MusicXML / chords → SQLite + local files
```

## Future: self-hosted backend

The `backend/` folder contains an optional FastAPI server (Basic Pitch, OMR, MuseScore PDF export) for a future hybrid release. It is **not required** for offline v1.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

When running the hybrid branch, set `EXPO_PUBLIC_API_URL` in `mobile/.env` — see `mobile/env.example`.
