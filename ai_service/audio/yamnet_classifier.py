"""One YAMNet interface; no heuristic fallback or implicit network downloads."""

import csv
import logging
import threading
from dataclasses import asdict, dataclass
from pathlib import Path
import numpy as np
from fastapi import HTTPException
from sentinel_config import YAMNET_MODEL_PATH, FUSION_CONFIDENCE_THRESHOLD

log = logging.getLogger(__name__)
LABEL_RISKS = {
    "Gunshot, gunfire": "CRITICAL",
    "Explosion": "CRITICAL",
    "Chainsaw": "HIGH",
    "Sawing": "HIGH",
    "Vehicle": "HIGH",
    "Engine": "HIGH",
    "Speech": "MEDIUM",
    "Animal": "MONITORED",
    "Bird": "MONITORED",
    "Wild animals": "MONITORED",
    "Wind": "LOW",
    "Rain": "LOW",
    "Rustling leaves": "LOW",
    "Silence": "LOW",
}


@dataclass(frozen=True)
class AudioPrediction:
    label: str
    confidence: float
    risk_level: str
    model_version: str

    def to_dict(self):
        return asdict(self)


class AudioClassifier:
    def __init__(self):
        self.model = None
        self.names = []
        self.version = "unavailable"
        self.lock = threading.Lock()

    def initialize(self):
        try:
            if (
                not YAMNET_MODEL_PATH
                or not Path(YAMNET_MODEL_PATH, "saved_model.pb").is_file()
            ):
                raise FileNotFoundError("Configure an extracted YAMNET_MODEL_PATH")
            import tensorflow as tf
            import hashlib

            self.model = tf.saved_model.load(YAMNET_MODEL_PATH)
            path = self.model.class_map_path().numpy().decode("utf-8")
            with open(path, encoding="utf-8") as f:
                self.names = [row["display_name"] for row in csv.DictReader(f)]
            with open(Path(YAMNET_MODEL_PATH, "saved_model.pb"), "rb") as f:
                self.version = (
                    "yamnet-" + hashlib.file_digest(f, "sha256").hexdigest()[:16]
                )
            log.info("audio_model_ready model=%s", self.version)
        except Exception:
            self.model = None
            log.exception("audio_initialization_failed")

    def predict(self, waveform):
        if self.model is None:
            raise HTTPException(503, "MODEL_ERROR: audio model unavailable")
        try:
            with self.lock:
                scores, _, _ = self.model(waveform)
                values = np.max(scores.numpy(), axis=0)
            if (
                values.shape != (len(self.names),)
                or not np.isfinite(values).all()
                or np.min(values) < 0
                or np.max(values) > 1
            ):
                raise ValueError("Invalid model output")
            from ai_service.risk_engine import PRIORITY

            candidates = [
                (name, float(values[i]), LABEL_RISKS[name])
                for i, name in enumerate(self.names)
                if name in LABEL_RISKS and values[i] >= FUSION_CONFIDENCE_THRESHOLD
            ]
            if candidates:
                label, confidence, risk = max(
                    candidates, key=lambda p: (PRIORITY[p[2]], p[1])
                )
            else:
                index = int(np.argmax(values))
                label, confidence, risk = (
                    self.names[index],
                    float(values[index]),
                    "UNKNOWN",
                )
            return AudioPrediction(label, confidence, risk, self.version)
        except Exception:
            log.exception("audio_inference_failed model=%s", self.version)
            raise HTTPException(503, "MODEL_ERROR: audio inference failed") from None


classifier = AudioClassifier()


def predict_yamnet_threat(audio_path):
    from backend.media import decode_audio

    result = classifier.predict(decode_audio(Path(audio_path).read_bytes()))
    return result.label, result.confidence, result.risk_level
