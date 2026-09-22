import numpy as np
import pytest
from PIL import Image
from ai_service.privacy import PrivacyEngine


def test_privacy_should_store_media():
    eng_metadata_only = PrivacyEngine(retention_policy="METADATA_ONLY")
    assert not eng_metadata_only.should_store_media(threat_level="CRITICAL", is_confirmed=True)

    eng_confirmed = PrivacyEngine(retention_policy="CONFIRMED_INCIDENTS_ONLY")
    assert not eng_confirmed.should_store_media(threat_level="CRITICAL", is_confirmed=False)
    assert eng_confirmed.should_store_media(threat_level="CRITICAL", is_confirmed=True)


def test_privacy_redact_person_faces():
    engine = PrivacyEngine(redact_faces=True, head_height_ratio=0.25)
    # Synthetic frame with distinct gradient/texture pattern
    img_arr = np.zeros((200, 200, 3), dtype=np.uint8)
    for i in range(200):
        img_arr[i, :, :] = i % 256

    detections = [{"label": "person", "bbox": [40, 40, 100, 160]}]
    redacted = engine.redact_person_faces(img_arr, detections)
    redacted_np = np.array(redacted)

    # Face region (40 to 40 + 30 = 70) should have been modified by blur
    assert not np.array_equal(img_arr[40:70, 40:100], redacted_np[40:70, 40:100])
