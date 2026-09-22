import pytest
from ai_service.xai import generate_explainable_alert


def test_explainable_alert_generation():
    detections = [{"label": "person", "confidence": 0.88, "bbox": [10, 10, 50, 50]}]
    audio_event = {"label": "Chainsaw", "confidence": 0.92}

    explanation = generate_explainable_alert(
        detections=detections,
        threat_level="CRITICAL",
        detection_level="THREAT",
        vision_confidence=0.88,
        audio_event=audio_event,
        hits_confirmed=8,
        total_frames_sampled=10,
        is_night=True,
        in_core_geofence=True,
        uncertainty_score=0.15,
    )

    assert "CRITICAL alert declared" in explanation.summary_sentence
    assert explanation.temporal_confirmation_ratio == "8 / 10 frames"
    assert any("Chainsaw" in item["finding"] for item in explanation.evidence_checklist)
    assert any("Core Sanctuary" in item["finding"] for item in explanation.evidence_checklist)
    assert explanation.threshold_audit["core_zone_adjustment"] == -0.10
    assert "IMMEDIATE RANGER DISPATCH" in explanation.operational_action_recommended

