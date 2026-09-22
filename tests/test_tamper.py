import numpy as np
import pytest
from PIL import Image
from ai_service.tamper import SensorTamperDetector


def test_tamper_lens_occlusion():
    detector = SensorTamperDetector(min_variance=2.0, occlusion_max_mean=5.0)
    # Solid black frame (covered lens)
    black_frame = np.zeros((480, 640, 3), dtype=np.uint8)

    alert = detector.evaluate(black_frame)
    assert alert.is_tampered is True
    assert alert.tamper_type == "LENS_OCCLUSION"
    assert "Lens covered" in alert.details


def test_tamper_blinding_flare():
    detector = SensorTamperDetector(blinding_min_mean=240.0)
    # Blinding flashlight/spotlight
    bright_frame = np.ones((480, 640, 3), dtype=np.uint8) * 250

    alert = detector.evaluate(bright_frame)
    assert alert.is_tampered is True
    assert alert.tamper_type == "SENSOR_BLINDING"


def test_tamper_replay_frozen():
    detector = SensorTamperDetector(max_repeated_frames=3)
    frame = np.random.randint(50, 200, (240, 320, 3), dtype=np.uint8)

    # Replay exact same frame 3 times
    alert1 = detector.evaluate(frame)
    assert not alert1.is_tampered

    alert2 = detector.evaluate(frame)
    assert not alert2.is_tampered

    alert3 = detector.evaluate(frame)
    assert alert3.is_tampered is True
    assert alert3.tamper_type == "REPLAY_FROZEN"

