import pytest
from ai_service.governor import AIComputeGovernor


def test_governor_idle_state():
    gov = AIComputeGovernor()
    decision = gov.decide(
        has_motion=False,
        active_tracks_count=0,
        current_threat_level="LOW",
        uncertainty_score=0.1,
    )
    assert decision.cadence_mode == "IDLE"
    assert decision.target_fps == 2.0
    assert decision.model_tier == "SKIP"
    assert decision.input_resolution == 320
    assert not decision.tracking_enabled


def test_governor_motion_state():
    gov = AIComputeGovernor()
    decision = gov.decide(
        has_motion=True,
        active_tracks_count=0,
        current_threat_level="LOW",
        uncertainty_score=0.2,
    )
    assert decision.cadence_mode == "MOTION"
    assert decision.target_fps == 5.0
    assert decision.model_tier == "NANO"
    assert decision.input_resolution == 480
    assert decision.tracking_enabled


def test_governor_threat_escalation():
    gov = AIComputeGovernor()
    decision = gov.decide(
        has_motion=True,
        active_tracks_count=2,
        current_threat_level="CRITICAL",
        uncertainty_score=0.1,
    )
    assert decision.cadence_mode == "THREAT"
    assert decision.target_fps == 15.0
    assert decision.model_tier == "ESCALATION"
    assert decision.input_resolution == 640
    assert decision.audio_poll_seconds == 1.0


def test_governor_battery_throttling():
    gov = AIComputeGovernor()
    decision = gov.decide(
        has_motion=True,
        current_threat_level="HIGH",
        battery_pct=10.0,  # Critical battery (<15%)
    )
    # Even during a threat, governor caps FPS to prevent complete shutdown
    assert decision.target_fps <= 2.0
    assert decision.input_resolution == 320
    assert "Critical battery" in decision.rationale


def test_governor_tampered_override():
    gov = AIComputeGovernor()
    decision = gov.decide(is_tampered=True)
    assert decision.cadence_mode == "TAMPERED"
    assert decision.model_tier == "SKIP"
    assert "Sensor tampering detected" in decision.rationale

