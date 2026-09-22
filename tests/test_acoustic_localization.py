import pytest
from ai_service.acoustic_localization import (
    AcousticSensorNode,
    AcousticTriangulationSolver,
    estimate_single_array_doa_deg,
)


def test_single_array_doa():
    # Sound arriving directly from right (+90 deg) with baseline 0.15m:
    # delta_t = 0.15 / 343 ~ 0.000437s
    delta_t = 0.15 / 343.0
    deg = estimate_single_array_doa_deg(delta_t, baseline_distance_m=0.15)
    assert 85.0 <= deg <= 90.0

    # Sound arriving from center (0 deg)
    assert estimate_single_array_doa_deg(0.0, baseline_distance_m=0.15) == 0.0


def test_multi_sensor_triangulation():
    nodes = [
        AcousticSensorNode("N1", 12.9680, 79.1540),
        AcousticSensorNode("N2", 12.9710, 79.1540),
        AcousticSensorNode("N3", 12.9698, 79.1580),
    ]
    solver = AcousticTriangulationSolver(nodes)

    # Simulated event near center (12.9698, 79.1559)
    # Target arrival times roughly synchronized with slight offsets
    arrival_times = {
        "N1": 100.000,
        "N2": 100.002,
        "N3": 100.001,
    }

    result = solver.triangulate(arrival_times, origin_ref=(12.9698, 79.1559))
    assert result is not None
    assert 12.965 <= result.estimated_latitude <= 12.975
    assert 79.150 <= result.estimated_longitude <= 79.160
    assert result.method == "TDOA_HYPERBOLIC_MULTILATERATION"
    assert len(result.participating_nodes) == 3

