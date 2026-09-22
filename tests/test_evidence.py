import pytest
from ai_service.evidence import EvidenceTimeline


def test_evidence_timeline_accumulation():
    timeline = EvidenceTimeline(window_seconds=30.0, half_life_seconds=10.0, incident_threshold=1.0)

    # Add single visual observation
    timeline.add("CAM_01", "vision", "person", confidence=0.8, timestamp=100.0)
    score1 = timeline.compute_cumulative_score(current_time=100.0)
    assert 0.50 <= score1 <= 0.60
    assert not timeline.is_incident_ready(current_time=100.0)

    # Add acoustic observation 2 seconds later
    timeline.add("AUDIO_01", "audio", "chainsaw", confidence=0.9, timestamp=102.0)
    score2 = timeline.compute_cumulative_score(current_time=102.0)
    # Combined person + chainsaw crosses 1.0 threshold
    assert score2 >= 1.0
    assert timeline.is_incident_ready(current_time=102.0)


def test_evidence_decay_over_time():
    timeline = EvidenceTimeline(window_seconds=60.0, half_life_seconds=10.0)
    timeline.add("CAM_01", "vision", "person", confidence=0.8, timestamp=100.0)

    score_fresh = timeline.compute_cumulative_score(current_time=100.0)
    score_after_half_life = timeline.compute_cumulative_score(current_time=110.0)

    # After 10s half-life, evidence score should be approx half
    assert score_after_half_life == pytest.approx(score_fresh / 2.0, rel=0.10)


def test_evidence_summary():
    timeline = EvidenceTimeline()
    timeline.add("CAM_01", "vision", "person", confidence=0.85, timestamp=100.0)
    summary = timeline.get_summary(current_time=105.0)

    assert "vision" in summary["modalities"]
    assert "person" in summary["distinct_cues"]
    assert summary["evidence_item_count"] == 1
    assert len(summary["timeline"]) == 1

