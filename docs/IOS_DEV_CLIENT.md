# iOS development build (TestFlight / EAS)

TuneScribe uses a **custom dev client** on iPhone — the same workflow as Language Partner. Do **not** open the project in store **Expo Go** after scanning the QR code.

## One-time: build and install on iPhone

From WSL (no Mac required), use **EAS Build**:

```bash
npm install -g eas-cli
eas login

cd /home/jhm359/TuneScribe/mobile
eas init
eas build --profile development --platform ios
```

- Choose **internal distribution** when prompted.
- Register your iPhone UDID if EAS asks (profile install link in Safari).
- When the build finishes, open the **install link** on your iPhone and install **TuneScribe Dev** (not the store TuneScribe app, and not Expo Go). The two apps can sit side by side.

Android (optional):

```bash
eas build --profile development --platform android
```

Install the `.apk` from the EAS dashboard link.

## Daily workflow

1. **Backend** (separate terminal):

```bash
cd /home/jhm359/TuneScribe/backend
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

2. **Set API URL** in `mobile/.env` to your PC’s LAN IP (not `localhost`):

```env
EXPO_PUBLIC_API_URL=http://192.168.1.42:8000
```

3. **Start Metro for the dev client**:

```bash
cd /home/jhm359/TuneScribe/mobile
npm run start:dev
```

4. Open **TuneScribe Dev** on your phone (not the store TuneScribe app, and not Expo Go).
5. Scan the QR code (tunnel is default; same habit as Language Partner).

## Scripts

| Command | Use |
|---------|-----|
| `npm run start:dev` | Dev client + tunnel + clear cache |
| `npm run start:dev:lan` | Dev client + LAN (same Wi‑Fi, no tunnel) |
| `npm start` | Dev client + tunnel (no cache clear) |
| `npm run start:expo-go` | Store Expo Go only (SDK must match) |

## Rebuild the dev client when

- You add a native module (new Expo plugin with native code).
- You change `app.json` / `app.config.js` native settings (permissions, bundle ID, etc.).
- You upgrade Expo SDK.
- You enable **Local mode** for the first time (bundles `onnxruntime-react-native` and the Basic Pitch ONNX model in `assets/models/nmp.onnx`).

JS-only changes do **not** require a rebuild — scan QR as usual.

## Local processing mode

The header toggle switches between **Backend** (default) and **Local**:

| Feature | Backend mode | Local mode |
|---------|--------------|------------|
| Record → transcription | Server | On-device (Basic Pitch ONNX) |
| Transpose MusicXML/MXL | Server | On-device |
| Transpose PDF/photo (OMR) | Server | Server (hybrid) |
| PDF export (MuseScore) | Server | Server |

After pulling Local mode changes, rebuild:

```bash
cd /home/jhm359/TuneScribe/mobile
eas build --profile development --platform ios
```

### Manual test matrix

1. **Backend mode** — Record (piano/vocal, sheet/chords/both) and Transpose (MusicXML, PDF) unchanged.
2. **Local mode Record** — piano/vocal with sheet, chords, and both output formats; confirm `modelUsed` is `basic-pitch-local`.
3. **Local mode Transpose** — MusicXML transposes on device; PDF/photo shows server OMR banner and requires backend.
4. **Offline** — Local Record and MusicXML Transpose work without backend; PDF/photo shows clear error if backend is down.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Opens in Expo Go or the store TuneScribe app | Install **TuneScribe Dev** from the EAS development-profile link (`com.tunescribe.app.dev`) |
| SDK incompatible | Rebuild dev client after SDK upgrade |
| Transcription fails | Set `EXPO_PUBLIC_API_URL` to LAN IP; backend on `0.0.0.0:8000` |
| Tunnel timeout | Use `npm run start:dev` (includes `--tunnel`) |
| Mic denied | Settings → TuneScribe → Microphone → Allow |

See also [DEV_NETWORKING.md](./DEV_NETWORKING.md).
