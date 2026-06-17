from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import debug, health, transcribe, transpose

app = FastAPI(
    title="TuneScribe API",
    description="Local audio-to-MIDI and sheet music transcription backend",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(debug.router, tags=["debug"])
app.include_router(transcribe.router, tags=["transcribe"])
app.include_router(transpose.router, tags=["transpose"])
