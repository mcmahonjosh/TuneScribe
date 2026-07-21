# TuneScribe App Store release guide

Offline v1 · iOS · bundle ID `com.tunescribe.app`

This checklist covers GitHub Pages (privacy/support), EAS production build, TestFlight, and App Store Connect.

---

## 0. Prerequisites

- [ ] Apple Developer Program enrolled ($99/year)
- [ ] App Store Connect app created with bundle ID **com.tunescribe.app**
- [ ] Expo account logged in (`eas login`) with access to project `65481381-34ca-4b69-85cb-197823bf7b57` (owner `wizard10fun`)
- [ ] Privacy + Support URLs live (see §1)

---

## 1. Publish privacy & support (GitHub Pages)

Templates live in this repo:

| Page | Source |
|------|--------|
| Privacy | [`docs/legal/privacy.md`](legal/privacy.md) |
| Support | [`docs/legal/support.md`](legal/support.md) |

### Steps

1. Replace `support@tunescribe.app` in both files with your real contact email.
2. Push the repo to GitHub (e.g. `mcmahonjosh/TuneScribe`). Prefer branch `main` (or merge `offline_mode` first).
3. **Settings → Pages**
   - Source: **Deploy from a branch**
   - Branch: `main` (or your default), folder: **`/docs`**
4. Optional: add [`docs/_config.yml`](_config.yml) so Markdown renders as pages (included in repo).
5. Confirm live URLs (adjust username/repo if different):

   - Privacy: https://mcmahonjosh.github.io/TuneScribe/legal/privacy  
   - Support: https://mcmahonjosh.github.io/TuneScribe/legal/support  

6. In **App Store Connect → Your App → App Information**, paste:
   - Privacy Policy URL
   - Support URL

---

## 2. Production config (already in repo)

Verified for App Store builds when `EAS_BUILD_PROFILE=production` (set in `mobile/eas.json`):

- No `NSAllowsArbitraryLoads` / cleartext traffic
- No `withIosDevHttp` plugin
- No `expo-dev-client` plugin in the generated config
- `ITSAppUsesNonExemptEncryption: false`
- Mic usage string kept
- Models bundled via `assets/models/**`
- Version `1.0.0`; iOS build number via EAS remote (`appVersionSource: "remote"`, `autoIncrement: true`)

Dev profile still allows LAN HTTP for Metro / hotspot testing.

---

## 3. EAS build & submit

### From Windows PowerShell (recommended if WSL cannot reach Expo)

```powershell
# Prefer a native Windows clone of the repo if UNC paths misbehave:
#   cd C:\dev\TuneScribe\mobile
pushd \\wsl.localhost\Ubuntu\home\jhm359\TuneScribe\mobile

eas build --profile production --platform ios
eas submit --platform ios --latest
```

### From macOS / Linux (when network to Expo works)

```bash
cd mobile
eas build --profile production --platform ios
eas submit --platform ios --latest
```

### After first App Store Connect app exists

Edit `mobile/eas.json` → `submit.production.ios` and set:

```json
"ios": {
  "ascAppId": "YOUR_NUMERIC_APP_STORE_CONNECT_APP_ID"
}
```

Find **Apple ID (App)** under App Store Connect → App Information (numeric, not the bundle ID).  
You can also pass Apple credentials interactively on first `eas submit`.

### TestFlight

1. Wait for processing in App Store Connect → TestFlight.
2. Add internal testers; install build on device.
3. **Release test matrix** (airplane mode after install):

| Area | Checks |
|------|--------|
| Record | Piano + vocal; sheet / chords / both; short clip completes |
| Sheet | Grand staff (treble+bass); measures not crushed |
| Preview | Play Notes / sheet Play works after new transcription |
| Projects | New recording does not overwrite previous; list/delete |
| Transpose | Pick exported `.musicxml` from Files; transpose; preview + grand staff |
| Offline | Airplane mode after **production** build (not Metro) |
| Permissions | Mic prompt copy accurate; deny path shows alert |

---

## 4. App Store Connect listing

### Screenshots (you capture)

Typical requirements:

- **iPhone 6.7"** (e.g. 1290×2796) — 3–5 screens  
- **iPhone 6.1"** often also requested  

Suggested shots: Projects list, Record, Processing, Project sheet (grand staff), Transpose.

### Copy draft

| Field | Text |
|-------|------|
| **Name** | TuneScribe |
| **Subtitle** | On-device piano & vocal to sheet |
| **Keywords** | piano, transcription, sheet music, midi, musicxml, offline |
| **Description** | See below |
| **Promotional text** | Record piano or voice. Get sheet music and MIDI on your device—no account, no upload. |

**Description:**

```
TuneScribe turns piano and vocal performances into sheet music and MIDI entirely on your device.

• Record with your microphone
• Transcribe to MusicXML, MIDI, and chord progressions offline
• Preview notes and view grand-staff sheet music
• Transpose MusicXML files to a new key
• No account required — your recordings stay on your phone

Offline v1 focuses on recording and MusicXML transpose. PDF scanning is not included.
```

### Age rating & privacy

- [ ] Complete age rating questionnaire  
- [ ] Privacy nutrition labels: **Microphone**; claim **Data Not Collected** only if still accurate (no analytics in Offline v1)  
- [ ] Review notes for Apple:

```
TuneScribe transcribes piano/vocal audio on-device. Microphone is used only for recording.
There is no login. All processing runs offline after install. Demo: open Record, grant mic,
record a short melody, wait for processing, open the project to view sheet music.
Transpose: export MusicXML from a project, use the Transpose tab to pick the file.
```

---

## 5. Submit for review

1. Select the processed build  
2. Attach screenshots + metadata  
3. Confirm Privacy + Support URLs  
4. Submit for App Review  

---

## 6. Out of scope (this release)

- Google Play Store listing  
- Cloud backend / hybrid mode  
- PDF / OMR  

---

## Quick command cheat sheet

```powershell
cd mobile
eas build --profile production --platform ios
eas submit --platform ios --latest
npx tsc --noEmit
```
