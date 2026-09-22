"""Dynamic Spatial Risk Heatmap Engine for Sanctuary Patrol Allocation.

Computes risk(cell, hour) across geographic grid cells based on:
- Historical incident density and threat severity (CRITICAL/HIGH)
- Diurnal time-of-day weighting
- Reserve zoning tiers (Core vs Buffer vs Trail)
- Recent sensor tampering or infrastructure anomalies
Protects sensitive wildlife by generalizing raw sightings to cell-level statistics.
"""

from dataclasses import dataclass
import math
from typing import TypedDict


class GridCell(TypedDict):
    cell_id: str
    lat_min: float
    lat_max: float
    lon_min: float
    lon_max: float
    center_lat: float
    center_lon: float
    risk_score: float
    incident_count: int
    primary_threat_type: str
    priority_level: str  # "LOW", "MODERATE", "ELEVATED", "CRITICAL"


class RiskHeatmapEngine:
    def __init__(
        self,
        grid_rows: int = 6,
        grid_cols: int = 6,
        lat_bounds: tuple[float, float] = (12.955, 12.985),
        lon_bounds: tuple[float, float] = (79.140, 79.175),
    ):
        self.grid_rows = grid_rows
        self.grid_cols = grid_cols
        self.lat_min, self.lat_max = lat_bounds
        self.lon_min, self.lon_max = lon_bounds
        self.d_lat = (self.lat_max - self.lat_min) / grid_rows
        self.d_lon = (self.lon_max - self.lon_min) / grid_cols

    def compute_heatmap(
        self,
        historical_alerts: list[dict],
        target_hour: int | None = None,
        core_center: tuple[float, float] = (12.9698, 79.1559),
        core_radius_m: float = 800.0,
    ) -> list[GridCell]:
        """Generate grid-level risk scores for sanctuary patrol prioritization."""
        grid: dict[str, dict] = {}

        # Initialize cells
        for r in range(self.grid_rows):
            for c in range(self.grid_cols):
                c_id = f"G_{r}_{c}"
                clat_min = self.lat_min + r * self.d_lat
                clat_max = clat_min + self.d_lat
                clon_min = self.lon_min + c * self.d_lon
                clon_max = clon_min + self.d_lon
                center_lat = (clat_min + clat_max) / 2.0
                center_lon = (clon_min + clon_max) / 2.0

                # Distance to core HQ
                dist_core_m = math.hypot(
                    (center_lat - core_center[0]) * 111000.0,
                    (center_lon - core_center[1]) * 111000.0 * math.cos(math.radians(core_center[0])),
                )
                zone_penalty = 0.20 if dist_core_m <= core_radius_m else 0.05

                grid[c_id] = {
                    "cell_id": c_id,
                    "lat_min": round(clat_min, 5),
                    "lat_max": round(clat_max, 5),
                    "lon_min": round(clon_min, 5),
                    "lon_max": round(clon_max, 5),
                    "center_lat": round(center_lat, 5),
                    "center_lon": round(center_lon, 5),
                    "raw_score": zone_penalty,
                    "incident_count": 0,
                    "threat_counts": {},
                }

        # Accumulate historical alerts into cells
        severity_map = {"CRITICAL": 1.0, "HIGH": 0.65, "MEDIUM": 0.35, "MONITORED": 0.10, "LOW": 0.02}

        for alert in historical_alerts:
            lat = alert.get("latitude")
            lon = alert.get("longitude")
            if lat is None or lon is None:
                continue

            # Locate cell
            r_idx = int((lat - self.lat_min) / self.d_lat)
            c_idx = int((lon - self.lon_min) / self.d_lon)

            if 0 <= r_idx < self.grid_rows and 0 <= c_idx < self.grid_cols:
                c_id = f"G_{r_idx}_{c_idx}"
                threat = alert.get("threat_level", "LOW")
                weight = severity_map.get(threat, 0.10)

                # Diurnal temporal relevance
                time_weight = 1.0
                if target_hour is not None and "created_at" in alert:
                    # e.g., nocturnal weighting
                    is_nocturnal_target = 20 <= target_hour or target_hour < 6
                    if is_nocturnal_target and threat in {"CRITICAL", "HIGH"}:
                        time_weight = 1.30

                grid[c_id]["raw_score"] += weight * time_weight
                grid[c_id]["incident_count"] += 1
                threat_label = alert.get("top_label") or threat
                grid[c_id]["threat_counts"][threat_label] = grid[c_id]["threat_counts"].get(threat_label, 0) + 1

        # Normalize scores to [0, 1] and determine priority
        max_score = max((cell["raw_score"] for cell in grid.values()), default=1.0)
        max_score = max(1.0, max_score)

        cells: list[GridCell] = []
        for cell in grid.values():
            normalized = round(min(1.0, cell["raw_score"] / max_score), 3)

            if normalized >= 0.70:
                priority = "CRITICAL"
            elif normalized >= 0.40:
                priority = "ELEVATED"
            elif normalized >= 0.15:
                priority = "MODERATE"
            else:
                priority = "LOW"

            primary = "None"
            if cell["threat_counts"]:
                primary = max(cell["threat_counts"].items(), key=lambda x: x[1])[0]

            cells.append(
                GridCell(
                    cell_id=cell["cell_id"],
                    lat_min=cell["lat_min"],
                    lat_max=cell["lat_max"],
                    lon_min=cell["lon_min"],
                    lon_max=cell["lon_max"],
                    center_lat=cell["center_lat"],
                    center_lon=cell["center_lon"],
                    risk_score=normalized,
                    incident_count=cell["incident_count"],
                    primary_threat_type=primary,
                    priority_level=priority,
                )
            )

        return cells

