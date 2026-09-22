"""Run once against the common audio service using the included fixture."""

import os
import requests
from sentinel_config import ROOT, AUDIO_API_URL


def run_audio_monitor():
    token = os.getenv("OPERATOR_API_TOKEN") or os.getenv("ADMIN_API_TOKEN", "")
    with (ROOT / "ai_service/audio/test.wav").open("rb") as audio:
        response = requests.post(
            AUDIO_API_URL + "/api/audio/classify",
            headers={"Authorization": "Bearer " + token},
            files={"audio": ("test.wav", audio, "audio/wav")},
            timeout=60,
        )
    response.raise_for_status()
    print(response.json())


if __name__ == "__main__":
    run_audio_monitor()
