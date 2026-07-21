# iOS development build (TestFlight / EAS)

TuneScribe uses a **custom dev client** on iPhone — the same workflow as Language Partner. Do **not** open the project in store **Expo Go** after scanning the QR code.

## Offline v1

The current release runs **entirely on-device** — Basic Pitch ONNX is bundled in the app. No backend server or `EXPO_PUBLIC_API_URL` is required.

- **Development:** dev client + Metro (JS hot reload)
- **Production / TestFlight:** `eas build --profile production --platform ios` bundles JS + ONNX into a standalone app

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
- When the build finishes, open the **install link** on your iPhone and install the app (TuneScribe icon, not Expo Go).

For a standalone offline release (no Metro):

```bash
eas build --profile production --platform ios
```

Android (optional):

```bash
eas build --profile development --platform android
```

Install the `.apk` from the EAS dashboard link.

## Daily workflow (development)

1. **Start Metro for the dev client**:

```bash
cd /home/jhm359/TuneScribe/mobile
npm run start:dev
```

2. Open the **TuneScribe dev app** on your phone (not Expo Go).
3. Scan the QR code (tunnel is default; same habit as Language Partner).

No backend is required for offline v1.

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
- You change ONNX model assets or `onnxruntime-react-native` plugin config.

JS-only changes do **not** require a rebuild — scan QR as usual.

## Manual test matrix (offline v1)

1. **Record — piano, sheet music:** 15–30s clip → project shows sheet + MIDI + preview playback.
2. **Record — piano, chords / both:** chord view and playback work.
3. **Record — vocal:** monophonic sheet output.
4. **Projects:** list, open, delete.
5. **Export:** share MIDI, MusicXML, chords JSON.
6. **Transpose:** `.musicxml` or `.mxl` → transposed sheet in project.
7. **Airplane mode:** all of the above work with Wi‑Fi off.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Opens in Expo Go | Use the **TuneScribe dev app** from EAS install link |
| SDK incompatible | Rebuild dev client after SDK upgrade |
| Transcription hangs | Keep app in foreground; rebuild dev client if ONNX plugin missing |
| Tunnel timeout | Use `npm run start:dev` (includes `--tunnel`) |
| Mic denied | Settings → TuneScribe → Microphone → Allow |

See also [DEV_NETWORKING.md](./DEV_NETWORKING.md).
