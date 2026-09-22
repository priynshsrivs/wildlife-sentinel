"""Paired test-fixture runner. Demo requests never persist or dispatch."""

import argparse
import json
import os
from pathlib import Path
import requests
from sentinel_config import AUDIO_API_URL, ROOT


def run_pipeline(
    image_path=ROOT / "ai_service/test_samples/wildlife/elephant.jpg",
    audio_path=ROOT / "ai_service/audio/test.wav",
    camera_id="CAM_MANUAL_FEED",
    latitude=12.9698,
    longitude=79.1559,
    demo=True,
):
    token = os.getenv("OPERATOR_API_TOKEN") or os.getenv("ADMIN_API_TOKEN")
    if not token:
        raise RuntimeError("Configure OPERATOR_API_TOKEN or ADMIN_API_TOKEN")
    with open(image_path, "rb") as image, open(audio_path, "rb") as audio:
        response = requests.post(
            AUDIO_API_URL + "/api/audio/pipeline",
            headers={"Authorization": "Bearer " + token},
            files={
                "image": (Path(image_path).name, image, "image/jpeg"),
                "audio": (Path(audio_path).name, audio, "audio/wav"),
            },
            data={
                "camera_id": camera_id,
                "latitude": latitude,
                "longitude": longitude,
                "demo": str(demo).lower(),
            },
            timeout=120,
        )
    response.raise_for_status()
    result = response.json()
    print(json.dumps(result, indent=2))
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--real",
        action="store_true",
        help="Persist real sensor events; never use for fixtures",
    )
    args = parser.parse_args()
    run_pipeline(demo=not args.real)
