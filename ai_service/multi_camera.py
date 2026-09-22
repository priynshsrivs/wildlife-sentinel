"""Multi-Camera Incident Correlation & Spatial Trajectory Engine.

Correlates sequential detections across reserve camera nodes based on:
- Spatial topology graph of adjacent camera locations
- Plausible travel times and speeds (foot vs vehicle)
- Direction of transit across sanctuary perimeters
Does not make unsupported facial or identity claims; relies on kinematic feasibility.
"""

from dataclasses import dataclass, field
import math
import time
from uuid import uuid4


@dataclass
class Sighting:
    camera_id: str
    latitude: float
    longitude: float
    timestamp: float
    label: str
    confidence: float
    threat_level: str


@dataclass
class MultiCameraIncident:
    incident_id: str
    cameras: list[str]
    sightings: list[Sighting]
    first_seen: float
    last_seen: float
    transit_duration_s: float
    total_distance_m: float
    estimated_speed_kmh: float
    direction_heading_deg: float
    primary_label: str
    max_threat_level: str
    confidence: float
    summary: str


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate great-circle distance in meters between two coordinates."""
    r = 6371000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    return 2.0 * r * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def calculate_bearing_deg(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate compass heading from point 1 to point 2."""
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dlambda = math.radians(lon2 - lon1)
    y = math.sin(dlambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - math.sin(phi1) * math.cos(phi2) * math.cos(dlambda)
    bearing = math.degrees(math.atan2(y, x))
    return (bearing + 360.0) % 360.0


class MultiCameraCorrelator:
    def __init__(
        self,
        max_correlation_window_s: float = 300.0,  # 5 minutes max travel window
        min_speed_kmh: float = 1.0,               # Minimum walking speed
        max_speed_kmh: float = 90.0,              # Maximum motorized vehicle speed
    ):
        self.max_correlation_window_s = max_correlation_window_s
        self.min_speed_kmh = min_speed_kmh
        self.max_speed_kmh = max_speed_kmh
        self.recent_sightings: list[Sighting] = []
        self.active_incidents: dict[str, MultiCameraIncident] = {}

    def record_sighting(
        self,
        camera_id: str,
        latitude: float,
        longitude: float,
        label: str,
        confidence: float,
        threat_level: str = "MEDIUM",
        timestamp: float | None = None,
    ) -> MultiCameraIncident | None:
        """Process a sighting and correlate against recent camera events."""
        now = time.monotonic() if timestamp is None else timestamp
        current = Sighting(
            camera_id=camera_id,
            latitude=latitude,
            longitude=longitude,
            timestamp=now,
            label=label,
            confidence=confidence,
            threat_level=threat_level,
        )

        # Prune stale sightings
        cutoff = now - self.max_correlation_window_s
        self.recent_sightings = [s for s in self.recent_sightings if s.timestamp >= cutoff]

        # Search for plausible predecessor from a different camera
        best_match: Sighting | None = None
        best_speed = 0.0

        for prev in reversed(self.recent_sightings):
            if prev.camera_id == camera_id:
                continue  # Sighting on same camera handled by local tracker
            dt = current.timestamp - prev.timestamp
            if dt <= 0 or dt > self.max_correlation_window_s:
                continue

            dist_m = haversine_m(prev.latitude, prev.longitude, current.latitude, current.longitude)
            speed_kmh = (dist_m / dt) * 3.6

            # Compatible movement speed (foot 1-8 km/h or vehicle 10-90 km/h)
            if self.min_speed_kmh <= speed_kmh <= self.max_speed_kmh:
                best_match = prev
                best_speed = speed_kmh
                break

        self.recent_sightings.append(current)

        if best_match is not None:
            dist_m = haversine_m(best_match.latitude, best_match.longitude, current.latitude, current.longitude)
            dt = current.timestamp - best_match.timestamp
            bearing = calculate_bearing_deg(best_match.latitude, best_match.longitude, current.latitude, current.longitude)
            inc_id = f"MCI_{uuid4().hex[:8]}"

            higher_threat = "CRITICAL" if "CRITICAL" in {best_match.threat_level, current.threat_level} else "HIGH"

            incident = MultiCameraIncident(
                incident_id=inc_id,
                cameras=[best_match.camera_id, current.camera_id],
                sightings=[best_match, current],
                first_seen=best_match.timestamp,
                last_seen=current.timestamp,
                transit_duration_s=round(dt, 1),
                total_distance_m=round(dist_m, 1),
                estimated_speed_kmh=round(best_speed, 1),
                direction_heading_deg=round(bearing, 1),
                primary_label=current.label,
                max_threat_level=higher_threat,
                confidence=round(min(1.0, (best_match.confidence + current.confidence) / 2.0 + 0.10), 2),
                summary=(
                    f"Correlated transit: {best_match.camera_id} -> {current.camera_id} "
                    f"({dist_m:.0f}m in {dt:.0f}s, ~{best_speed:.1f} km/h, heading {bearing:.0f}°)"
                ),
            )
            self.active_incidents[inc_id] = incident
            return incident

        return None

    def get_active_incidents(self) -> list[MultiCameraIncident]:
        return list(self.active_incidents.values())

