# Mobile dev networking (WSL2)

**Primary workflow:** custom **dev client** on iPhone (EAS build), not store Expo Go. See [IOS_DEV_CLIENT.md](./IOS_DEV_CLIENT.md).

## Problem

On WSL2, `npm start` often shows:

```text
Metro: exp://172.24.x.x:8081
```

That `172.x` address is **inside WSL**. Your phone is on Wi‑Fi and cannot reach it, so Expo Go times out when you scan the QR code.

## Fix 1: Tunnel + dev client (recommended on WSL)

```bash
cd mobile
npm run start:dev
```

This runs `expo start --dev-client --tunnel -c`. Open the **TuneScribe dev app** (from EAS), not Expo Go, then scan the QR code.

First tunnel run may ask you to log in:

```bash
npx expo login
```

## Fix 2: LAN with Windows Wi‑Fi IP

1. On **Windows**, run `ipconfig` and note your Wi‑Fi **IPv4** (e.g. `192.168.1.42`).
2. Start Expo with that IP:

```bash
REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.42 npm run start:lan
```

3. Phone and PC must be on the **same Wi‑Fi** (not guest/isolated network).

## Backend API on a physical phone

Metro tunnel only serves the **JavaScript bundle**. Transcription also needs the FastAPI backend.

In `mobile/.env`, set your **Windows IP** (not `localhost`). TuneScribe uses **port 8000** with **no `/api` prefix**:

```env
EXPO_PUBLIC_API_URL=http://192.168.1.42:8000
```

**Common mistake:** `http://172.20.10.2:3000/api` is wrong — that's Language Partner's backend. TuneScribe is `http://172.20.10.2:8000`.

### iPhone personal hotspot

When your phone shares hotspot and your PC connects, Windows often gets **`172.20.10.2`**:

```env
EXPO_PUBLIC_API_URL=http://172.20.10.2:8000
```

Verify on Windows: `ipconfig` → look for `172.20.10.x` under the hotspot adapter.

### WSL2: forward port 8000 to your phone

The backend runs in **WSL**, but your phone talks to **Windows**. Run in **Windows PowerShell as Administrator**:

```powershell
cd \\wsl.localhost\Ubuntu\home\jhm359\TuneScribe\scripts
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\windows-wsl-dev-ports.ps1
```

Then test from **iPhone Safari**:

```text
http://172.20.10.2:8000/health
```

You should see `{"status":"ok","service":"tunescribe-backend"}`.

### Safari works but the app says "Backend unreachable"

This is almost always **iOS Local Network permission** (Safari is not subject to the same app restriction).

1. **iPhone Settings → TuneScribe → Local Network → ON**
2. Or **Settings → Privacy & Security → Local Network → TuneScribe → ON**
3. Force-quit TuneScribe and reopen
4. In the app **Record** tab, tap **Test Backend**

If the app shows `Backend: http://localhost:8000`, Metro did not pick up `.env` — run `npm run start:dev` again.

If the URL is correct (`http://172.20.10.2:8000`) but Test Backend still fails, **rebuild the dev client** (ATS/local-network keys are baked into the native app):

```bash
cd mobile
eas build --profile development --platform ios
```

Restart Expo after changing `.env` (`npx expo start --tunnel -c`).

Backend must listen on all interfaces:

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Android emulator (same machine)

```env
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000
```

Use `npm run start:lan` (no tunnel needed).

## Checklist

| Check | |
|-------|---|
| Expo URL is not `172.x` when using phone | Use tunnel or LAN IP |
| Backend health | `curl http://localhost:8000/health` |
| Phone `.env` uses LAN IP | Not `localhost` |
| Same Wi‑Fi | Phone not on cellular-only |
| Open **TuneScribe dev app**, not Expo Go | Install from EAS build link |
