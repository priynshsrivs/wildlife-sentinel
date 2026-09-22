import math
import itertools
import pytest
from pydantic import ValidationError
from ai_service.risk_engine import calculate_combined_risk, PRIORITY
from backend.dispatch import (
    calculate_distance_km,
    evaluate_geofence,
    estimate_response_minutes,
)
from backend.schemas import Telemetry, SensorInput


@pytest.mark.parametrize("vision,audio", list(itertools.product(PRIORITY, repeat=2)))
def test_risk_matrix(vision, audio):
    result = calculate_combined_risk(
        {"risk_level": vision, "confidence": 0.9},
        {"risk_level": audio, "confidence": 0.8},
    )
    expected = (
        "CRITICAL"
        if PRIORITY[vision] >= 3 and PRIORITY[audio] >= 3
        else max((vision, audio), key=PRIORITY.get)
    )
    assert result["combined_risk"] == expected
    assert result["vision_confidence"] == 0.9
    assert result["audio_confidence"] == 0.8
    assert result["max_confidence"] == 0.9


@pytest.mark.parametrize(
    "failure", ["UNKNOWN", "MODEL_ERROR", "SENSOR_ERROR", "UNAVAILABLE", "INPUT_ERROR"]
)
def test_failure_never_low(failure):
    assert (
        calculate_combined_risk(
            {"risk_level": failure}, {"risk_level": "LOW", "confidence": 0.9}
        )["combined_risk"]
        == failure
    )
    assert (
        calculate_combined_risk(
            {"risk_level": failure}, {"risk_level": "HIGH", "confidence": 0.9}
        )["combined_risk"]
        == "HIGH"
    )


def test_missing_low_confidence_invalid():
    assert calculate_combined_risk(None, None)["combined_risk"] == "UNKNOWN"
    assert (
        calculate_combined_risk(
            {"risk_level": "HIGH", "confidence": 0.1},
            {"risk_level": "LOW", "confidence": 0.9},
        )["combined_risk"]
        == "UNKNOWN"
    )
    with pytest.raises(ValueError):
        calculate_combined_risk({"risk_level": "FAKE"}, {})
    for confidence in (float("nan"), float("inf"), -0.1, 1.1):
        with pytest.raises(ValueError):
            calculate_combined_risk({"confidence": confidence}, {})


def test_geofence_boundary():
    settings = {"ranger_hq": {"lat": 0, "lng": 0}, "geofence_core_radius_m": 800}
    boundary = math.degrees(0.8 / 6371.0088)
    for lat in (0, boundary / 2, boundary):
        assert evaluate_geofence(lat, 0, settings) == "CORE"
    assert evaluate_geofence(boundary + 0.000001, 0, settings) == "BUFFER"
    settings["geofence_core_radius_m"] = 0
    with pytest.raises(ValueError):
        evaluate_geofence(0, 0, settings)


@pytest.mark.parametrize(
    "coords",
    [(91, 0), (-91, 0), (0, 181), (0, -181), (float("nan"), 0), (0, float("inf"))],
)
def test_invalid_gps(coords):
    with pytest.raises(ValidationError):
        SensorInput(latitude=coords[0], longitude=coords[1])
    with pytest.raises(ValidationError):
        calculate_distance_km(*coords, 0, 0)


def test_distance_eta():
    assert calculate_distance_km(0, 0, 0, 1) == pytest.approx(111.195, abs=0.001)
    assert estimate_response_minutes(0, 25) == 0
    assert estimate_response_minutes(25, 25) == 60
    assert estimate_response_minutes(0.1, 25) == 1
    for distance, speed in ((-1, 25), (2, 0), (float("nan"), 10)):
        with pytest.raises(ValueError):
            estimate_response_minutes(distance, speed)


def test_confidence_max_audio_not_ignored():
    value = Telemetry(threat_level="LOW", vision_confidence=0.4, audio_confidence=0.9)
    assert value.max_confidence == 0.9
    with pytest.raises(ValidationError):
        Telemetry(
            threat_level="LOW",
            vision_confidence=0.4,
            audio_confidence=0.9,
            max_confidence=0.4,
        )
