import io
import tempfile
import os

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from classifier import classify_audio

app = FastAPI(
    title="Wildlife Sentinel Audio API",
    description="Acoustic event detection microservice for the Wildlife Sentinel system.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """Liveness check for the audio analysis service."""
    return {"status": "ok", "service": "wildlife-sentinel-audio"}


@app.post("/api/audio/classify")
async def classify_audio_upload(
    audio: UploadFile = File(..., description="WAV audio file to analyze")
):
    """
    Accepts a WAV audio file, extracts acoustic features, and returns
    a risk classification label (NORMAL, VEHICLE_APPROACH, ANIMAL_DISTRESS,
    HUMAN_ACTIVITY, UNKNOWN_ANOMALY).

    Returns:
        label       : Detected sound event type
        risk_level  : LOW | MEDIUM | HIGH
        features    : Raw extracted audio features (rms, dominant_frequency, etc.)
    """
    if not audio.filename.lower().endswith(".wav"):
        raise HTTPException(
            status_code=400,
            detail="Only WAV files are supported. Please upload a .wav file."
        )

    # Save to a temp file so wave module can read it
    audio_bytes = await audio.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        result = classify_audio(tmp_path)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio analysis failed: {str(e)}")
    finally:
        os.remove(tmp_path)

    return {
        "filename": audio.filename,
        "label": result["label"],
        "risk_level": result["risk_level"],
        "features": result["features"]
    }


@app.get("/api/audio/labels")
def get_supported_labels():
    """Returns the list of possible audio classification labels and their risk mappings."""
    return {
        "labels": [
            {"label": "NORMAL",           "risk_level": "LOW",    "description": "Ambient/background sound"},
            {"label": "VEHICLE_APPROACH", "risk_level": "HIGH",   "description": "Low-frequency engine rumble detected"},
            {"label": "ANIMAL_DISTRESS",  "risk_level": "HIGH",   "description": "High-frequency distress calls detected"},
            {"label": "HUMAN_ACTIVITY",   "risk_level": "MEDIUM", "description": "Elevated audio suggesting human presence"},
            {"label": "UNKNOWN_ANOMALY",  "risk_level": "MEDIUM", "description": "Unclassified anomalous sound"},
        ]
    }


if __name__ == "__main__":
    uvicorn.run("audio_api:app", host="0.0.0.0", port=5001, reload=True)
