from types import SimpleNamespace
import pytest
from ai_service.behavior import BehaviorAnalyzer


def test_nocturnal_group_detection():
    analyzer = BehaviorAnalyzer()
    # 2 persons at night
    p1 = SimpleNamespace(track_id="t1", label="person", current_bbox=[10, 10, 50, 50])
    p2 = SimpleNamespace(track_id="t2", label="person", current_bbox=[60, 60, 100, 100])

    patterns = analyzer.analyze([p1, p2], is_night=True, geofence_status="BUFFER")
    types = [p.pattern_type for p in patterns]
    assert "nocturnal_group" in types
    group_pat = next(p for p in patterns if p.pattern_type == "nocturnal_group")
    assert group_pat.threat_boost == "HIGH"


def test_human_vehicle_correlation():
    analyzer = BehaviorAnalyzer(correlation_max_distance_px=200.0)
    person = SimpleNamespace(track_id="t1", label="person", current_bbox=[100, 100, 140, 180])
    truck = SimpleNamespace(track_id="t2", label="truck", current_bbox=[150, 120, 250, 200])

    patterns = analyzer.analyze([person, truck], is_night=False, geofence_status="CORE")
    types = [p.pattern_type for p in patterns]
    assert "human_vehicle_correlation" in types
    corr = next(p for p in patterns if p.pattern_type == "human_vehicle_correlation")
    assert corr.threat_boost == "CRITICAL"  # in CORE zone


def test_lingering_vehicle():
    analyzer = BehaviorAnalyzer(vehicle_linger_min_s=4.0)
    # Stationary truck in restricted zone
    truck = SimpleNamespace(
        track_id="t1",
        label="truck",
        duration_seconds=5.5,
        current_bbox=[100, 100, 200, 200],
        bbox_history=[
            [100, 100, 200, 200],
            [101, 100, 201, 200],
            [100, 102, 200, 202],
        ],
    )
    patterns = analyzer.analyze([truck], geofence_status="CORE")
    types = [p.pattern_type for p in patterns]
    assert "lingering_vehicle" in types

