import pytest
from ai_service.multi_camera import MultiCameraCorrelator, haversine_m


def test_haversine_m():
    # Distance between two known coordinates (~111m per 0.001 deg lat)
    d = haversine_m(12.9698, 79.1559, 12.9708, 79.1559)
    assert 105.0 <= d <= 115.0


def test_multi_camera_correlation_incident():
    correlator = MultiCameraCorrelator(max_correlation_window_s=300.0)

    # Sighting at CAM_01 at t=100s
    inc1 = correlator.record_sighting(
        camera_id="CAM_01",
        latitude=12.9698,
        longitude=79.1559,
        label="truck",
        confidence=0.85,
        threat_level="HIGH",
        timestamp=100.0,
    )
    assert inc1 is None  # Single sighting does not produce a multi-camera incident

    # Sighting at CAM_02 at t=130s (~300m away, speed ~36 km/h)
    inc2 = correlator.record_sighting(
        camera_id="CAM_02",
        latitude=12.9725,
        longitude=79.1559,
        label="truck",
        confidence=0.88,
        threat_level="HIGH",
        timestamp=130.0,
    )
    assert inc2 is not None
    assert inc2.cameras == ["CAM_01", "CAM_02"]
    assert inc2.transit_duration_s == 30.0
    assert 20.0 <= inc2.estimated_speed_kmh <= 45.0
    assert "Correlated transit" in inc2.summary

