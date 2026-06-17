# TuneScribe

AI piano/vocal to MIDI and sheet music — local MVP.

Record or upload audio on your phone, send it to a local FastAPI backend running Basic Pitch, and get back MIDI + MusicXML files stored locally on the device.

## Project structure

```text
TuneScribe/
  backend/     FastAPI + Basic Pitch + music21
  mobile/      Expo React Native app
  docs/        Documentation
```

## Quick start

### 1. Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Verify: `http://localhost:8000/health`

Test transcription:

```bash
python scripts/generate_test_tone.py
curl -X POST http://localhost:8000/transcribe -F "file=@uploads/test_tone.wav"
```

### 2. Mobile app (iPhone dev client)

See [docs/IOS_DEV_CLIENT.md](docs/IOS_DEV_CLIENT.md) for the full EAS / TestFlight setup (same as Language Partner).

**One-time:** `cd mobile && eas init && eas build --profile development --platform ios`

**Daily:**

```bash
cd mobile
cp env.example .env   # set EXPO_PUBLIC_API_URL to your LAN IP
npm run start:dev
```

Open the **TuneScribe dev app** on your phone (not Expo Go) and scan the QR code.

## MVP pipeline

```text
Record audio → POST /transcribe → Basic Pitch → MIDI → music21 → MusicXML → save locally
```

## Optional PDF export

On WSL/Ubuntu (backend PC):

```bash
bash scripts/install-musescore-wsl.sh
```

This installs MuseScore 3 + `xvfb` (needed for headless PDF export). Then restart the backend and check `GET /transpose/settings` → `musescore_available: true`.

If the script cannot use `sudo`, run manually:

```bash
sudo apt-get update && sudo apt-get install -y musescore3 xvfb libnss3
export MUSESCORE_BIN="$(command -v musescore3)"
```
