import os
import sys
import tempfile

import requests
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Allow imports from the parent ai_service/ directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from classifier import predict_audio_threat   # updated by teammate — returns (label, confidence, threat_level)
from risk_engine import calculate_combined_risk

# ─────────────────────────────────────────
# App Setup
# ─────────────────────────────────────────
app = FastAPI(
    title="Wildlife Sentinel Audio API",
    description=(
        "Acoustic event detection microservice.\n\n"
        "• POST /api/audio/classify  — audio-only (WAV, MP3, OGG, M4A)\n"
        "• POST /api/audio/pipeline  — full fused pipeline (image + audio → risk engine → backend alert)"
    ),
    version="3.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

BACKEND_DETECT_URL    = "http://localhost:5000/api/detect"
BACKEND_TELEMETRY_URL = "http://localhost:5000/api/edge/telemetry"
RISK_PRIORITY = {"LOW": 0, "MONITORED": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}

SUPPORTED_AUDIO_EXTS = {".wav", ".mp3", ".ogg", ".m4a", ".flac", ".aac", ".webm"}


def _save_audio_temp(audio_bytes: bytes, filename: str) -> str:
    """Saves uploaded audio bytes to a temp file with correct extension for librosa."""
    ext = os.path.splitext(filename.lower())[1] or ".wav"
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
        tmp.write(audio_bytes)
        return tmp.name


# ─────────────────────────────────────────
# Health Check
# ─────────────────────────────────────────
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "wildlife-sentinel-audio", "version": "3.0.0"}


# ─────────────────────────────────────────
# Route 1 — Audio-only Classification
# Accepts WAV, MP3, OGG, WebM (librosa handles all)
# ─────────────────────────────────────────
@app.post("/api/audio/classify")
async def classify_audio_upload(
    audio: UploadFile = File(..., description="Audio file (WAV, MP3, OGG, WebM, FLAC)")
):
    """
    Classifies a single audio file using acoustic feature extraction (librosa).

    Returns:
        label       : Detected sound event description
        confidence  : Model confidence 0–1
        risk_level  : LOW | MONITORED | MEDIUM | HIGH | CRITICAL
    """
    audio_bytes = await audio.read()
    tmp_path = _save_audio_temp(audio_bytes, audio.filename or "audio.wav")

    try:
        label, confidence, threat_level = predict_audio_threat(tmp_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio classification failed: {str(e)}")
    finally:
        try:
            os.remove(tmp_path)
        except Exception:
            pass

    return {
        "filename":   audio.filename,
        "label":      label,
        "confidence": round(float(confidence), 3),
        "risk_level": threat_level
    }


# ─────────────────────────────────────────
# Route 2 — Full Fused Pipeline
# IMAGE + AUDIO → RISK ENGINE → BACKEND → FRONTEND ALERT
# ─────────────────────────────────────────
@app.post("/api/audio/pipeline")
async def run_full_pipeline(
    image:     UploadFile = File(..., description="Camera trap image (JPG/PNG)"),
    audio:     UploadFile = File(..., description="Audio file (WAV/MP3/OGG)"),
    camera_id: str   = Form("CAM_AI_PIPELINE"),
    latitude:  float = Form(12.9698),
    longitude: float = Form(79.1559),
):
    """
    Orchestrates the complete fused AI pipeline:
        1. Audio  → librosa feature extraction → acoustic threat label
        2. Image  → YOLO backend               → vision detections
        3. Both   → risk engine                → combined risk score
        4. If HIGH/CRITICAL → telemetry POST   → WebSocket → frontend alert card
    """

    # ── STEP 1 : AUDIO ──────────────────────────────────────────────────────
    audio_bytes = await audio.read()
    tmp_audio   = _save_audio_temp(audio_bytes, audio.filename or "audio.wav")

    try:
        a_label, a_conf, a_risk = predict_audio_threat(tmp_audio)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Audio classification failed: {str(e)}")
    finally:
        try:
            os.remove(tmp_audio)
        except Exception:
            pass

    audio_result = {"label": a_label, "risk_level": a_risk}

    # ── STEP 2 : VISION (YOLO backend) ──────────────────────────────────────
    image_bytes = await image.read()

    try:
        vision_resp = requests.post(
            BACKEND_DETECT_URL,
            files={"image": (image.filename, image_bytes, "image/jpeg")},
            data={"camera_id": camera_id, "latitude": str(latitude), "longitude": str(longitude)},
            timeout=30
        )
        vision_resp.raise_for_status()
        vision_data = vision_resp.json()
    except requests.exceptions.ConnectionError:
        raise HTTPException(status_code=503, detail="YOLO backend is offline (port 5000).")
    except requests.exceptions.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Backend error: {str(e)}")

    detections    = vision_data.get("detections", [])
    vision_risk   = vision_data.get("threat_level", "LOW")
    vision_label  = detections[0].get("label", "UNKNOWN") if detections else "NO_DETECTION"
    annotated_img = vision_data.get("annotated_image")

    vision_result = {"label": vision_label, "risk_level": vision_risk}

    # ── STEP 3 : RISK ENGINE ────────────────────────────────────────────────
    combined      = calculate_combined_risk(vision_result, audio_result)
    combined_risk = combined["combined_risk"]

    # ── STEP 4 : DISPATCH (if serious) ──────────────────────────────────────
    alert_id = None
    if RISK_PRIORITY.get(combined_risk, 0) >= RISK_PRIORITY["HIGH"]:
        telemetry = {
            "camera_id":        camera_id,
            "latitude":         latitude,
            "longitude":        longitude,
            "threat_level":     combined_risk,
            "detected_classes": [d["label"] for d in detections] or [a_label],
            "max_confidence":   max((d["confidence"] for d in detections), default=float(a_conf))
        }
        try:
            tel = requests.post(BACKEND_TELEMETRY_URL, json=telemetry, timeout=10)
            tel.raise_for_status()
            alert_id = tel.json().get("alert_id")
        except Exception as e:
            print(f"[WARN] Telemetry dispatch failed: {e}")

    # ── RETURN ───────────────────────────────────────────────────────────────
    return {
        "pipeline":  "FULL_FUSION",
        "camera_id": camera_id,
        "location":  {"lat": latitude, "lng": longitude},
        "vision": {
            "label":          vision_label,
            "risk_level":     vision_risk,
            "detections":     detections,
            "annotated_image": annotated_img
        },
        "audio": {
            "label":      a_label,
            "confidence": round(float(a_conf), 3),
            "risk_level": a_risk
        },
        "combined_risk":      combined_risk,
        "risk_breakdown":     combined,
        "alert_dispatched":   alert_id is not None,
        "alert_id":           alert_id,
        "frontend_notified":  alert_id is not None
    }


# ─────────────────────────────────────────
# Route 3 — Label Reference
# ─────────────────────────────────────────
@app.get("/api/audio/labels")
def get_supported_labels():
    return {
        "labels": [
            {"label": "Gunshot / Explosive Discharge",      "risk_level": "CRITICAL"},
            {"label": "Chainsaw / Illegal Logging Engine",   "risk_level": "HIGH"},
            {"label": "Elephant Vocalization / Herd Movement", "risk_level": "MONITORED"},
            {"label": "Ambient Reserve Noise",              "risk_level": "LOW"},
            {"label": "Unclassified Acoustic Event",        "risk_level": "LOW"},
        ]
    }


if __name__ == "__main__":
    uvicorn.run("audio_api:app", host="0.0.0.0", port=5001, reload=True)
