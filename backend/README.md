# TuneScribe Backend

Local FastAPI server for audio-to-MIDI and sheet music transcription.

## Setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Endpoints

- `GET /health` — health check
- `POST /transcribe` — upload audio, returns MIDI/MusicXML/PDF URLs
- `GET /files/{job_id}/{filename}` — download generated files

## Test with curl

```bash
curl -X POST http://localhost:8000/transcribe \
  -F "file=@/path/to/recording.wav"
```

Optional PDF generation requires MuseScore CLI (`mscore`) on PATH.
