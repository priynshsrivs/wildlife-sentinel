"""
Wildlife Sentinel — CLI Pipeline Runner

Sends a paired (image + audio) request to the Audio API's /api/audio/pipeline
endpoint, which orchestrates:
    IMAGE → YOLO → vision_result
    WAV   → audio classifier → audio_result
    → risk_engine → combined_risk
    → backend telemetry (if HIGH/CRITICAL) → WebSocket → frontend alert
"""

import json
import requests

PIPELINE_URL = "http://localhost:5001/api/audio/pipeline"

IMAGE_FILE = "ai_service/test_samples/wildlife/elephant.jpg"
AUDIO_FILE = "ai_service/audio/test.wav"


def run_pipeline(
    image_path: str = IMAGE_FILE,
    audio_path: str = AUDIO_FILE,
    camera_id:  str = "CAM_NORTH_01",
    latitude:  float = 12.9716,
    longitude: float = 79.1585
):
    print("\n" + "=" * 50)
    print("   WILDLIFE SENTINEL — FULL AI PIPELINE")
    print("=" * 50)
    print(f"  Image  : {image_path}")
    print(f"  Audio  : {audio_path}")
    print(f"  Camera : {camera_id}  ({latitude}, {longitude})")
    print("=" * 50)

    try:
        with open(image_path, "rb") as img_f, open(audio_path, "rb") as aud_f:
            response = requests.post(
                PIPELINE_URL,
                files={
                    "image": (image_path.split("/")[-1], img_f, "image/jpeg"),
                    "audio": (audio_path.split("/")[-1], aud_f, "audio/wav"),
                },
                data={
                    "camera_id": camera_id,
                    "latitude":  str(latitude),
                    "longitude": str(longitude),
                },
                timeout=60
            )
    except FileNotFoundError as e:
        print(f"[ERROR] File not found: {e}")
        return
    except requests.exceptions.ConnectionError:
        print("[ERROR] Audio API is not running.")
        print("        Start it with:  cd ai_service/audio && python audio_api.py")
        return

    if response.status_code != 200:
        print(f"[ERROR] Pipeline returned HTTP {response.status_code}")
        print(response.text)
        return

    result = response.json()

    # ── Print Vision Result ────────────────────────────────────
    print("\n[1] VISION (YOLO)")
    print(f"    Detection  : {result['vision']['label']}")
    print(f"    Risk Level : {result['vision']['risk_level']}")
    if result["vision"]["detections"]:
        for det in result["vision"]["detections"]:
            print(f"    └─ {det['label'].upper()} ({int(det['confidence'] * 100)}%)")

    # ── Print Audio Result ─────────────────────────────────────
    print("\n[2] AUDIO (Acoustic Classifier)")
    print(f"    Detection  : {result['audio']['label']}")
    print(f"    Risk Level : {result['audio']['risk_level']}")

    # ── Print Combined Risk ────────────────────────────────────
    combined = result["combined_risk"]
    print("\n[3] RISK ENGINE — COMBINED RESULT")
    print("=" * 50)
    if combined == "CRITICAL":
        print("    🚨 CRITICAL — Immediate ranger dispatch required!")
    elif combined == "HIGH":
        print("    ⚠️  HIGH RISK — Threat detected")
    elif combined == "MEDIUM":
        print("    ⚠️  MEDIUM — Suspicious activity")
    elif combined == "MONITORED":
        print("    👁  MONITORED — Wildlife activity logged")
    else:
        print("    ✓  LOW — Normal environment")

    print(f"\n    Combined Risk : {combined}")
    print(f"    Vision Risk   : {result['risk_breakdown']['vision_risk']}")
    print(f"    Audio Risk    : {result['risk_breakdown']['audio_risk']}")

    # ── Dispatch Status ────────────────────────────────────────
    print("\n[4] DISPATCH")
    if result["alert_dispatched"]:
        print(f"    ✅ Alert sent to backend → WebSocket → Frontend")
        print(f"    Alert ID : {result['alert_id']}")
    else:
        print(f"    ℹ  No dispatch (risk below HIGH threshold)")

    print("=" * 50 + "\n")
    return result


if __name__ == "__main__":
    run_pipeline()