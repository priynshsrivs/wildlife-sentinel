"""
Wildlife Sentinel — Camera Stream Simulator

Loops over test images and sends each one (paired with the test WAV)
to the full AI pipeline endpoint:

    POST http://localhost:5001/api/audio/pipeline
        image  = test image (rotated across camera nodes)
        audio  = test.wav  (shared acoustic feed)

This triggers the complete flow:
    IMAGE → YOLO → vision_result
    WAV   → acoustic classifier → audio_result
    → risk_engine → combined_risk
    → backend telemetry (if HIGH/CRITICAL) → WebSocket → frontend alert
"""

import os
import time
import glob

import requests

PIPELINE_URL = "http://localhost:5001/api/audio/pipeline"
AUDIO_FILE   = "ai_service/audio/test.wav"

CAMERAS = [
    {"camera_id": "CAM_NORTH_01",      "lat": 12.9716, "lng": 79.1585},
    {"camera_id": "CAM_SOUTH_02",      "lat": 12.9642, "lng": 79.1512},
    {"camera_id": "CAM_EAST_CORRIDOR", "lat": 12.9680, "lng": 79.1620},
]


def run_simulation(interval_seconds: int = 3):
    image_paths = glob.glob("ai_service/test_samples/*/*.*")

    if not image_paths:
        print("[-] No test images found in ai_service/test_samples/")
        print("    Add images to test_samples/wildlife/ or test_samples/poachers/ first.")
        return

    if not os.path.exists(AUDIO_FILE):
        print(f"[-] Audio file not found: {AUDIO_FILE}")
        return

    print("=" * 56)
    print("   WILDLIFE SENTINEL — CAMERA STREAM SIMULATOR")
    print("=" * 56)
    print(f"  Pipeline  : {PIPELINE_URL}")
    print(f"  Images    : {len(image_paths)} frame(s) found")
    print(f"  Audio     : {AUDIO_FILE}")
    print(f"  Interval  : {interval_seconds}s between frames")
    print(f"  Cameras   : {len(CAMERAS)} nodes rotating")
    print("=" * 56 + "\n")

    cam_index = 0

    for img_path in image_paths:
        cam = CAMERAS[cam_index % len(CAMERAS)]
        cam_index += 1

        print(f"[→] Sending  : {img_path}")
        print(f"    Camera   : {cam['camera_id']} ({cam['lat']}, {cam['lng']})")

        try:
            with open(img_path, "rb") as img_f, open(AUDIO_FILE, "rb") as aud_f:
                response = requests.post(
                    PIPELINE_URL,
                    files={
                        "image": (os.path.basename(img_path), img_f, "image/jpeg"),
                        "audio": (os.path.basename(AUDIO_FILE), aud_f, "audio/wav"),
                    },
                    data={
                        "camera_id": cam["camera_id"],
                        "latitude":  str(cam["lat"]),
                        "longitude": str(cam["lng"]),
                    },
                    timeout=60
                )

            if response.status_code == 200:
                res = response.json()
                combined   = res.get("combined_risk", "UNKNOWN")
                vision_lbl = res["vision"]["label"]
                audio_lbl  = res["audio"]["label"]
                dispatched = res.get("alert_dispatched", False)

                status_icon = "🚨" if combined == "CRITICAL" else "⚠️" if combined == "HIGH" else "👁" if combined == "MONITORED" else "✓"
                dispatch_tag = f"→ Alert {res['alert_id']} dispatched to frontend" if dispatched else "→ no dispatch"

                print(f"    {status_icon} Vision: {vision_lbl}  |  Audio: {audio_lbl}  |  Combined: {combined}")
                print(f"       {dispatch_tag}")

            else:
                print(f"    [!] Pipeline error HTTP {response.status_code}: {response.text[:120]}")

        except requests.exceptions.ConnectionError:
            print("    [X] Audio API is offline.")
            print("        Start with:  cd ai_service/audio && python audio_api.py")

        except Exception as e:
            print(f"    [ERROR] {e}")

        print()
        time.sleep(interval_seconds)

    print("=" * 56)
    print("   Simulation complete.")
    print("=" * 56)


if __name__ == "__main__":
    run_simulation()