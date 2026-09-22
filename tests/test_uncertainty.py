import pytest
from ai_service.uncertainty import UncertaintyEngine


def test_uncertainty_high_confidence_stable():
    engine = UncertaintyEngine()
    report = engine.evaluate(
        detection_confidence=0.92,
        detection_label="person",
        track_confidence_history=[0.90, 0.91, 0.92],
        track_bbox_history=[[10, 10, 50, 50], [11, 11, 51, 51]],
        previous_label="person",
        camera_health=1.0,
    )
    assert report.score < 0.20
    assert not report.should_escalate


def test_uncertainty_low_confidence_escalation():
    engine = UncertaintyEngine(escalation_threshold=0.45)
    report = engine.evaluate(
        detection_confidence=0.42,
        detection_label="person",
        track_confidence_history=[0.35, 0.42],
        camera_health=1.0,
    )
    # Low confidence -> high margin -> high uncertainty
    assert report.score >= 0.25
    assert report.confidence_margin > 0.50


def test_uncertainty_disagreement_and_jitter():
    engine = UncertaintyEngine()
    report = engine.evaluate(
        detection_confidence=0.60,
        detection_label="person",
        track_confidence_history=[0.40, 0.80, 0.30],
        track_bbox_history=[[10, 10, 50, 50], [100, 100, 150, 150]],  # Sudden jump
        previous_label="animal",  # Class flip
        camera_health=0.6,
    )
    assert report.disagreement_penalty == 1.0
    assert report.should_escalate is True

