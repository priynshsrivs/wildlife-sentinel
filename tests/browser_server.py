"""Isolated browser-test backend. Never run this as a production service."""

import os
from pathlib import Path
import sys
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
# All credentials and persistent data belong exclusively to the test process.
directory = Path(os.environ["SENTINEL_BROWSER_TEST_DIR"])
port = int(os.environ["SENTINEL_BROWSER_TEST_PORT"])
os.environ.update(
    {
        "DATA_DIR": str(directory / "data"),
        "DATABASE_PATH": str(directory / "audit.db"),
        "ADMIN_API_TOKEN": "browser-test-admin",
        "OPERATOR_API_TOKEN": "browser-test-operator",
        "VIEWER_API_TOKEN": "browser-test-viewer",
        "SERVICE_API_TOKEN": "browser-test-service",
        "DISCORD_WEBHOOK_URL": "",
        "CAMERA_ENDPOINTS_JSON": "{}",
        "AUDIO_API_URL": f"http://127.0.0.1:{port}/test-audio",
    }
)
import cv2
import numpy as np
from PIL import Image
from backend import main

Image.new("RGB", (32, 32), "green").save(directory / "sample.jpg")
writer = cv2.VideoWriter(
    str(directory / "sample.avi"), cv2.VideoWriter_fourcc(*"MJPG"), 10, (32, 32)
)
for _ in range(30):
    writer.write(np.zeros((32, 32, 3), dtype=np.uint8))
writer.release()
with wave.open(str(directory / "sample.wav"), "wb") as audio:
    audio.setnchannels(1)
    audio.setsampwidth(2)
    audio.setframerate(16000)
    audio.writeframes(b"\0\0" * 16000)

main.vision.initialize = lambda: None
main.vision.nano_version = "browser-test-fixture"
main.vision.predict = lambda *args, **kwargs: {
    "label": "person",
    "confidence": 0.96,
    "risk_level": "HIGH",
    "model_version": "browser-test-fixture",
    "detections": [
        {
            "label": "person",
            "confidence": 0.96,
            "bbox": [1, 1, 20, 20],
            "kind": "object",
            "matched_rois": ["Restricted Gate"],
        }
    ],
}


@main.app.post("/test-audio/api/audio/classify")
async def audio_fixture():
    return {
        "label": "Chainsaw",
        "risk_level": "HIGH",
        "confidence": 0.9,
        "model_version": "browser-test-audio-fixture",
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        main.app,
        host="127.0.0.1",
        port=port,
        log_level="warning",
        access_log=False,
        ws_max_size=4096,
    )
