"""Shared deployment configuration. Secrets never belong in Vite variables."""

import json
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
load_dotenv(ROOT / ".env")
BACKEND_URL = os.getenv("BACKEND_URL", "http://127.0.0.1:8000").rstrip("/")
AUDIO_API_URL = os.getenv("AUDIO_API_URL", "http://127.0.0.1:5001").rstrip("/")
DATA_DIR = Path(os.getenv("DATA_DIR", str(ROOT / "data"))).resolve()
DATABASE_PATH = Path(
    os.getenv("DATABASE_PATH", str(ROOT / "wildlife_sentinel.db"))
).resolve()
VISION_MODE = os.getenv("VISION_MODE", "ANTI_POACHING").upper()
NANO_MODEL_PATH = Path(
    os.getenv("NANO_MODEL_PATH", str(ROOT / "yolo11n.pt"))
).resolve()
ESCALATION_MODEL_PATH = Path(
    os.getenv("ESCALATION_MODEL_PATH", str(ROOT / "yolo11s.pt"))
).resolve()
VISION_MODEL_PATH = Path(
    os.getenv("VISION_MODEL_PATH", str(NANO_MODEL_PATH if NANO_MODEL_PATH.is_file() else ROOT / "yolov8x.pt"))
).resolve()
NANO_CONFIDENCE_HIGH = float(os.getenv("NANO_CONFIDENCE_HIGH", "0.70"))
NANO_CONFIDENCE_LOW = float(os.getenv("NANO_CONFIDENCE_LOW", "0.30"))
ESCALATION_COOLDOWN_SECONDS = float(os.getenv("ESCALATION_COOLDOWN_SECONDS", "10.0"))
MOTION_FILTER_ENABLED = os.getenv("MOTION_FILTER_ENABLED", "true").lower() == "true"
MOTION_THRESHOLD = float(os.getenv("MOTION_THRESHOLD", "0.015"))
TRACKING_ENABLED = os.getenv("TRACKING_ENABLED", "true").lower() == "true"
TEMPORAL_CONFIRMATION_FRAMES = int(os.getenv("TEMPORAL_CONFIRMATION_FRAMES", "3"))
TEMPORAL_CONFIRMATION_WINDOW_SECONDS = float(
    os.getenv("TEMPORAL_CONFIRMATION_WINDOW_SECONDS", "5.0")
)
INPUT_SIZE = int(os.getenv("INPUT_SIZE", "640"))
LOW_LIGHT_ENHANCEMENT = os.getenv("LOW_LIGHT_ENHANCEMENT", "true").lower() == "true"
DEBUG_TIMING = os.getenv("DEBUG_TIMING", "false").lower() == "true"
CAMERA_ROIS = json.loads(os.getenv("CAMERA_ROIS_JSON", "{}"))
YAMNET_MODEL_PATH = os.getenv("YAMNET_MODEL_PATH", "")
FRONTEND_ORIGINS = os.getenv(
    "FRONTEND_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173"
).split(",")
API_TOKENS = {
    role: os.getenv(f"{role.upper()}_API_TOKEN", "")
    for role in ("viewer", "operator", "admin")
}
SERVICE_TOKEN = os.getenv("SERVICE_API_TOKEN", "")
DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL", "")
INCIDENT_WINDOW_SECONDS = int(os.getenv("INCIDENT_WINDOW_SECONDS", "30"))
INCIDENT_IOU = float(os.getenv("INCIDENT_IOU", "0.3"))
BROADCAST_COOLDOWN_SECONDS = int(os.getenv("BROADCAST_COOLDOWN_SECONDS", "10"))
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 16_000_000
MAX_AUDIO_BYTES = 20 * 1024 * 1024
MAX_AUDIO_SECONDS = 30
MAX_VIDEO_BYTES = 100 * 1024 * 1024
MAX_VIDEO_SECONDS = 120
MAX_VIDEO_FRAMES = 7200
MAX_SAMPLED_FRAMES = 120
FUSION_CONFIDENCE_THRESHOLD = float(os.getenv("FUSION_CONFIDENCE_THRESHOLD", "0.3"))
FUSION_WINDOW_SECONDS = 5
DEFAULT_SETTINGS = {
    "confidence_threshold": 0.45,
    "geofence_core_radius_m": 800,
    "response_speed_kmh": 25.0,
    "ranger_hq": {"name": "Ranger Station", "lat": 12.9700, "lng": 79.1550},
    "remote_streams": {},
}
# Only administrator-provisioned literal-IP camera endpoints are used for capture.
CAMERA_ENDPOINTS = json.loads(os.getenv("CAMERA_ENDPOINTS_JSON", "{}"))
CAMERA_ALLOWED_IPS = set(filter(None, os.getenv("CAMERA_ALLOWED_IPS", "").split(",")))
CAMERAS = json.loads(
    os.getenv(
        "CAMERAS_JSON",
        json.dumps(
            [
                {
                    "id": "COMPUTER_1",
                    "name": "North Outpost",
                    "location": {"lat": 12.9735, "lng": 79.1585},
                },
                {
                    "id": "COMPUTER_2",
                    "name": "South River",
                    "location": {"lat": 12.9642, "lng": 79.1512},
                },
                {
                    "id": "COMPUTER_3",
                    "name": "East Corridor",
                    "location": {"lat": 12.9698, "lng": 79.1660},
                },
                {"id": "LAPTOP_WEBCAM_EDGE", "name": "Browser Camera"},
                {"id": "CAM_MANUAL_FEED", "name": "Image Upload"},
                {"id": "CAM_VIDEO_CCTV", "name": "Video Upload"},
                {"id": "ACOUSTIC_EDGE_SENSOR_01", "name": "Audio Upload"},
            ]
        ),
    )
)
CAMERA_IDS = {camera["id"] for camera in CAMERAS}
