import os
import sys
import tempfile

import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Allow imports from the parent ai_service/ directory (risk_engine lives there)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from classifier import classify_audio          # same folder: ai_service/audio/
from risk_engine import calculate_combined_risk  # parent folder: ai_service/

# ─────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────
app = FastAPI(
    title="Wildlife Sentinel Audio API",
    description=(
        "Acoustic event detection microservice for the Wildlife Sentinel system.\n\n"
        "Exposes two modes:\n"
        "  • `/api/audio/classify`  — audio-only classification\n"
        "  • `/api/audio/pipeline`  — full fused pipeline (image + audio → risk engine → backend alert)"
    ),
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Backend URLs — ai_service calls the main backend
BACKEND_DETECT_URL  = "http://localhost:5000/api/detect"
BACKEND_TELEMETRY_URL = "http://localhost:5000/api/edge/telemetry"

# Risk level → numeric for display
RISK_PRIORITY = {"LOW": 0, "MONITORED": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}


# ─────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────
@app.get("/health")
def health_check():
    """Liveness check for the audio analysis microservice."""
    return {"status": "ok", "service": "wildlife-sentinel-audio", "version": "2.0.0"}


# ─────────────────────────────────────────
# Route 1 — Audio-only classification
# ─────────────────────────────────────────
@app.post("/api/audio/classify")
async def classify_audio_upload(
    audio: UploadFile = File(..., description="WAV audio file to analyze")
):
    """
    Accepts a WAV file, extracts acoustic features, and returns a
    risk classification.

    Returns:
        label       : Detected sound event
        risk_level  : LOW | MEDIUM | HIGH
        features    : Extracted audio features
    """
    if not audio.filename.lower().endswith(".wav"):
        raise HTTPException(
            status_code=400,
            detail="Only WAV files are supported. Please upload a .wav file."
        )

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
        "label":      result["label"],
        "risk_level": result["risk_level"],
        "features":   result["features"]
    }


# ─────────────────────────────────────────
# Route 2 — FULL FUSED PIPELINE
# IMAGE + AUDIO → RISK ENGINE → BACKEND → FRONTEND ALERT
# ─────────────────────────────────────────
@app.post("/api/audio/pipeline")
async def run_full_pipeline(
    image: UploadFile = File(..., description="Camera trap image (JPG/PNG)"),
    audio: UploadFile = File(..., description="WAV audio captured at the same location"),
    camera_id: str  = Form("CAM_AI_PIPELINE"),
    latitude:  float = Form(12.9698),
    longitude: float = Form(79.1559),
):
    """
    The core fused pipeline endpoint.

    Flow:
        1. Audio  → acoustic classifier  → audio_result
        2. Image  → YOLO backend         → vision_result
        3. Both   → risk engine          → combined_risk
        4. If HIGH/CRITICAL              → POST telemetry to backend (triggers WebSocket → Frontend Alert)

    Returns the full combined risk report.
    """

    # ── STEP 1 : AUDIO ANALYSIS ──────────────────────────────────────────────
    if not audio.filename.lower().endswith(".wav"):
        raise HTTPException(status_code=400, detail="Audio must be a .wav file.")

    audio_bytes = await audio.read()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_audio:
        tmp_audio.write(audio_bytes)
        tmp_audio_path = tmp_audio.name

    try:
        audio_result = classify_audio(tmp_audio_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio classification failed: {str(e)}")
    finally:
        os.remove(tmp_audio_path)

    # ── STEP 2 : VISION — call the YOLO backend ───────────────────────────────
    image_bytes = await image.read()

    try:
        vision_response = requests.post(
            BACKEND_DETECT_URL,
            files={"image": (image.filename, image_bytes, "image/jpeg")},
            data={
                "camera_id": camera_id,
                "latitude":  str(latitude),
                "longitude": str(longitude),
            },
            timeout=30
        )
        vision_response.raise_for_status()
        vision_data = vision_response.json()
    except requests.exceptions.ConnectionError:
        raise HTTPException(
            status_code=503,
            detail="YOLO backend is not reachable. Make sure backend/main.py is running on port 5000."
        )
    except requests.exceptions.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Backend YOLO error: {str(e)}")

    # Parse vision result for the risk engine
    detections    = vision_data.get("detections", [])
    vision_risk   = vision_data.get("threat_level", "LOW")
    vision_label  = detections[0].get("label", "UNKNOWN") if detections else "NO_DETECTION"
    annotated_img = vision_data.get("annotated_image")

    vision_result = {
        "label":      vision_label,
        "risk_level": vision_risk
    }

    # ── STEP 3 : RISK ENGINE — fuse audio + vision ────────────────────────────
    combined = calculate_combined_risk(vision_result, audio_result)
    combined_risk = combined["combined_risk"]

    # ── STEP 4 : DISPATCH — if serious, push telemetry to backend ─────────────
    # The backend's /api/edge/telemetry will:
    #   • persist to SQLite
    #   • broadcast via WebSocket → frontend alert card appears in real-time
    alert_id = None
    if RISK_PRIORITY.get(combined_risk, 0) >= RISK_PRIORITY["HIGH"]:
        telemetry_payload = {
            "camera_id":        camera_id,
            "latitude":         latitude,
            "longitude":        longitude,
            "threat_level":     combined_risk,
            "detected_classes": [d["label"] for d in detections] or [audio_result["label"]],
            "max_confidence":   max((d["confidence"] for d in detections), default=0.0)
        }
        try:
            tel_res = requests.post(
                BACKEND_TELEMETRY_URL,
                json=telemetry_payload,
                timeout=10
            )
            tel_res.raise_for_status()
            alert_id = tel_res.json().get("alert_id")
        except Exception as e:
            # Non-fatal — log the failure but still return the pipeline result
            print(f"[WARN] Telemetry dispatch failed: {e}")

    # ── RETURN FULL PIPELINE REPORT ───────────────────────────────────────────
    return {
        "pipeline": "FULL_FUSION",
        "camera_id": camera_id,
        "location": {"lat": latitude, "lng": longitude},

        # Vision result
        "vision": {
            "label":      vision_label,
            "risk_level": vision_risk,
            "detections": detections,
            "annotated_image": annotated_img
        },

        # Audio result
        "audio": {
            "label":      audio_result["label"],
            "risk_level": audio_result["risk_level"],
            "features":   audio_result["features"]
        },

        # Risk engine output
        "combined_risk":   combined_risk,
        "risk_breakdown":  combined,

        # Dispatch outcome
        "alert_dispatched": alert_id is not None,
        "alert_id":         alert_id,
        "frontend_notified": alert_id is not None
    }


# ─────────────────────────────────────────
# Route 3 — Label reference
# ─────────────────────────────────────────
@app.get("/api/audio/labels")
def get_supported_labels():
    """Returns the list of possible audio classification labels and their risk mappings."""
    return {
        "labels": [
            {"label": "NORMAL",           "risk_level": "LOW",    "description": "Ambient / background sound"},
            {"label": "VEHICLE_APPROACH", "risk_level": "HIGH",   "description": "Low-frequency engine rumble detected"},
            {"label": "ANIMAL_DISTRESS",  "risk_level": "HIGH",   "description": "High-frequency distress calls detected"},
            {"label": "HUMAN_ACTIVITY",   "risk_level": "MEDIUM", "description": "Elevated audio suggesting human presence"},
            {"label": "UNKNOWN_ANOMALY",  "risk_level": "MEDIUM", "description": "Unclassified anomalous sound"},
        ]
    }


if __name__ == "__main__":
    uvicorn.run("audio_api:app", host="0.0.0.0", port=5001, reload=True)
