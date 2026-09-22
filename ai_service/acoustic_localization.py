"""Acoustic Direction of Arrival (DOA) & Multi-Sensor Triangulation Architecture.

Provides software abstraction and mathematical solvers for:
1. Single-node microphone array: Time Difference of Arrival (TDOA) estimating azimuth angle
2. Multi-sensor cross-camera triangulation: Multilateration solving event coordinates (x, y)
   from acoustic arrival times across distributed camera nodes.
Does not claim single-mic localization; provides physically grounded multi-channel architecture.
"""

from dataclasses import dataclass
import math
import numpy as np


@dataclass
class AcousticSensorNode:
    node_id: str
    latitude: float
    longitude: float
    elevation_m: float = 0.0


@dataclass
class LocalizationResult:
    estimated_latitude: float
    estimated_longitude: float
    confidence: float
    uncertainty_radius_m: float
    participating_nodes: list[str]
    method: str
    summary: str


SPEED_OF_SOUND_MPS = 343.0  # Speed of sound in ambient air ~20°C


def estimate_single_array_doa_deg(tdoa_seconds: float, baseline_distance_m: float = 0.15) -> float:
    """Estimate azimuth angle theta for a 2-microphone linear array given TDOA.
    
    delta_t = (d * sin(theta)) / c  =>  sin(theta) = (c * delta_t) / d
    """
    if baseline_distance_m <= 0:
        return 0.0
    val = (tdoa_seconds * SPEED_OF_SOUND_MPS) / baseline_distance_m
    val = max(-1.0, min(1.0, val))
    theta_rad = math.asin(val)
    return round(math.degrees(theta_rad), 1)


class AcousticTriangulationSolver:
    def __init__(self, nodes: list[AcousticSensorNode]):
        self.nodes = {n.node_id: n for n in nodes}

    def triangulate(
        self,
        arrival_times: dict[str, float],  # {node_id: timestamp_seconds}
        origin_ref: tuple[float, float] = (12.9698, 79.1559),
    ) -> LocalizationResult | None:
        """Solve 2D acoustic source location using Time Difference of Arrival (TDOA).
        
        Requires >= 3 distinct acoustic sensor nodes with measured arrival timestamps.
        Converts geographic coordinates to local Cartesian (meters) for least-squares optimization.
        """
        valid_nodes = [nid for nid in arrival_times if nid in self.nodes]
        if len(valid_nodes) < 3:
            return None  # Minimum 3 nodes required for unambiguous 2D multilateration

        # Local Cartesian projection (origin at origin_ref)
        ref_lat, ref_lon = origin_ref
        meters_per_deg_lat = 111000.0
        meters_per_deg_lon = 111000.0 * math.cos(math.radians(ref_lat))

        node_coords = []
        times = []
        for nid in valid_nodes:
            n = self.nodes[nid]
            x = (n.longitude - ref_lon) * meters_per_deg_lon
            y = (n.latitude - ref_lat) * meters_per_deg_lat
            node_coords.append([x, y])
            times.append(arrival_times[nid])

        coords = np.array(node_coords, dtype=np.float64)
        t_arr = np.array(times, dtype=np.float64)

        # Baseline reference node (earliest arrival)
        ref_idx = int(np.argmin(t_arr))
        x0, y0 = coords[ref_idx]
        t0 = t_arr[ref_idx]

        # Optimization objective: minimize squared residuals of theoretical vs observed TDOA
        def cost_func(point):
            px, py = point
            r0 = np.hypot(px - x0, py - y0)
            res = 0.0
            for i in range(len(coords)):
                if i == ref_idx:
                    continue
                ri = np.hypot(px - coords[i][0], py - coords[i][1])
                expected_delta_t = (ri - r0) / SPEED_OF_SOUND_MPS
                actual_delta_t = t_arr[i] - t0
                res += (expected_delta_t - actual_delta_t) ** 2
            return res

        # Grid search initialization around the centroid of nodes
        centroid = np.mean(coords, axis=0)
        best_point = centroid
        min_cost = cost_func(centroid)

        # Multi-scale grid search
        for step in [200.0, 50.0, 10.0, 2.0]:
            for dx in np.linspace(-3 * step, 3 * step, 7):
                for dy in np.linspace(-3 * step, 3 * step, 7):
                    candidate = best_point + np.array([dx, dy])
                    c = cost_func(candidate)
                    if c < min_cost:
                        min_cost = c
                        best_point = candidate

        est_x, est_y = best_point
        est_lat = ref_lat + (est_y / meters_per_deg_lat)
        est_lon = ref_lon + (est_x / meters_per_deg_lon)

        unc_radius = max(15.0, math.sqrt(min_cost) * SPEED_OF_SOUND_MPS)

        return LocalizationResult(
            estimated_latitude=round(est_lat, 5),
            estimated_longitude=round(est_lon, 5),
            confidence=round(max(0.30, min(0.95, 1.0 - min_cost)), 2),
            uncertainty_radius_m=round(unc_radius, 1),
            participating_nodes=valid_nodes,
            method="TDOA_HYPERBOLIC_MULTILATERATION",
            summary=(
                f"Acoustic Triangulation: source estimated at ({est_lat:.5f}, {est_lon:.5f}) "
                f"via {len(valid_nodes)} nodes with ±{unc_radius:.1f}m error radius"
            ),
        )

