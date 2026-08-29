import os
import requests

from .audio.classifier import classify_audio
from .risk_engine import calculate_combined_risk


BACKEND_URL = "http://localhost:5000/api/detect"

IMAGE_FILE = "ai_service/test_samples/wildlife/test.jpg"
AUDIO_FILE = "ai_service/audio/test.wav"


def run_pipeline():

    print("\n======================================")
    print("     WILDLIFE SENTINEL AI PIPELINE")
    print("======================================")

    if not os.path.exists(IMAGE_FILE):
        print("[ERROR] test.jpg not found")
        return

    if not os.path.exists(AUDIO_FILE):
        print("[ERROR] test.wav not found")
        return

    # AUDIO
    print("\n[1] ANALYZING AUDIO...")

    audio_result = classify_audio(AUDIO_FILE)

    print("Audio detection :", audio_result["label"])
    print("Audio risk      :", audio_result["risk_level"])

    # VISION
    print("\n[2] SENDING IMAGE TO YOLO BACKEND...")

    try:
        with open(IMAGE_FILE, "rb") as image:

            files = {
                "image": (
                    os.path.basename(IMAGE_FILE),
                    image,
                    "image/jpeg"
                )
            }

            data = {
                "camera_id": "CAM_NORTH_01",
                "latitude": 12.9716,
                "longitude": 79.1585
            }

            response = requests.post(
                BACKEND_URL,
                files=files,
                data=data,
                timeout=30
            )

        if response.status_code != 200:
            print("[ERROR] Backend error:", response.status_code)
            print(response.text)
            return

        vision_response = response.json()

    except requests.exceptions.ConnectionError:
        print("[ERROR] Backend is not running.")
        return

    # VISION RESULT
    detections = vision_response.get("detections", [])

    vision_risk = vision_response.get(
        "threat_level",
        "LOW"
    )

    if detections:

        first = detections[0]

        vision_label = first.get(
            "class_name",
            first.get("label", "UNKNOWN")
        )

    else:
        vision_label = "NO_DETECTION"

    vision_result = {
        "label": vision_label,
        "risk_level": vision_risk
    }

    print("Vision detection :", vision_label)
    print("Vision risk      :", vision_risk)

    # COMBINE
    print("\n[3] COMBINING AUDIO + VISION...")

    result = calculate_combined_risk(
        vision_result,
        audio_result
    )

    print("\n======================================")
    print("       FINAL RISK ASSESSMENT")
    print("======================================")

    print(
        "Vision :",
        result["vision_detection"],
        "(" + result["vision_risk"] + ")"
    )

    print(
        "Audio  :",
        result["audio_detection"],
        "(" + result["audio_risk"] + ")"
    )

    print("\nCOMBINED RISK :", result["combined_risk"])

    if result["combined_risk"] == "CRITICAL":
        print("🚨 CRITICAL ALERT")

    elif result["combined_risk"] == "HIGH":
        print("⚠️ HIGH RISK ALERT")

    elif result["combined_risk"] == "MEDIUM":
        print("⚠️ MEDIUM RISK EVENT")

    else:
        print("✓ LOW RISK / NORMAL")


if __name__ == "__main__":
    run_pipeline()
    