import pytest
from ai_service.health import CameraHealthEvaluator


def test_camera_health_perfect():
    evaluator = CameraHealthEvaluator()
    report = evaluator.evaluate(
        camera_id="CAM_01",
        actual_fps=5.0,
        target_fps=5.0,
        dropped_frames=0,
        total_frames=100,
        latency_ms=30.0,
        luminance_variance=40.0,
    )
    assert report.score >= 0.85
    assert report.status == "HEALTHY"
    assert not report.sensor_warning


def test_camera_health_degraded():
    evaluator = CameraHealthEvaluator()
    report = evaluator.evaluate(
        camera_id="CAM_02",
        actual_fps=1.5,
        target_fps=5.0,
        dropped_frames=30,
        total_frames=100,
        latency_ms=250.0,
        luminance_variance=25.0,
    )
    assert report.score < 0.65
    assert report.status in {"DEGRADED", "CRITICAL"}
    assert report.sensor_warning is True

