# Support — TuneScribe

**App:** TuneScribe (Offline v1)  
**Contact:** mcmahon.h.josh@gmail.com  

## What TuneScribe does

TuneScribe turns piano and vocal recordings into sheet music and related files **entirely on your device**:

- **Record** — capture a short performance with the microphone.
- **Transcribe** — produce MIDI, MusicXML, and/or chord progression data locally.
- **Preview** — play a synthesized preview and view grand-staff sheet music.
- **Transpose** — open an exported **MusicXML** file and shift it to a new key.

No account is required. Airplane mode works after install of a production build.

## Requirements

- Microphone permission for recording.
- Enough free storage for models, recordings, and exports.

## Known limits (Offline v1)

- **Transpose accepts MusicXML only** — MIDI and PDF are not supported for transpose in this version.
- **No PDF / OMR** — scanning printed sheet music is out of scope.
- Transcription quality depends on recording conditions (noise, polyphony, mic distance). Short, clear takes work best.
- Preview audio may be unavailable for some older or incomplete projects; record a new take if needed.

## Common questions

### Why does the app need the microphone?

Only to record your performance for on-device transcription. Audio is not uploaded by the App.

### Can I use the app offline?

Yes. After installing a production build from the App Store / TestFlight, Record and Transpose work without a network connection.

### How do I transpose a file?

1. Export MusicXML from a project (or use a MusicXML file you already have).
2. Open the **Transpose** tab and pick the `.musicxml` / `.xml` file from Files.
3. Choose a target key and run transpose.

### How do I delete projects?

Open **Projects**, select a project, and use delete. That removes local project files from the App.

## Report a problem

Email **mcmahon.h.josh@gmail.com** with:

- Device model and iOS version  
- What you were doing (Record / Transpose / Preview)  
- Approx. recording length and instrument (piano / vocal)  
- Screenshots if useful  

We aim to respond within a few business days.

---

*Publish this page via GitHub Pages and paste the live URL into App Store Connect → App Information → Support URL.*
