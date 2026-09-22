import pytest
from ai_service.heatmap import RiskHeatmapEngine


def test_heatmap_empty_alerts():
    engine = RiskHeatmapEngine(grid_rows=4, grid_cols=4)
    cells = engine.compute_heatmap(historical_alerts=[])
    assert len(cells) == 16
    # Empty alerts should only reflect baseline zone penalties
    for cell in cells:
        assert cell["risk_score"] <= 0.25
        assert cell["incident_count"] == 0


def test_heatmap_with_critical_incidents():
    engine = RiskHeatmapEngine(
        grid_rows=4,
        grid_cols=4,
        lat_bounds=(12.960, 12.980),
        lon_bounds=(79.140, 79.160),
    )
    alerts = [
        {"latitude": 12.965, "longitude": 12.965, "threat_level": "CRITICAL", "top_label": "firearm"},
        {"latitude": 12.965, "longitude": 79.145, "threat_level": "CRITICAL", "top_label": "firearm"},
        {"latitude": 12.965, "longitude": 79.145, "threat_level": "HIGH", "top_label": "person"},
    ]
    cells = engine.compute_heatmap(historical_alerts=alerts)
    active_cells = [c for c in cells if c["incident_count"] > 0]
    assert len(active_cells) >= 1
    assert any(c["risk_score"] >= 0.50 for c in active_cells)

