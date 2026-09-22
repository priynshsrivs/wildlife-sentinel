"""Threat Behavior Recognition and Human + Vehicle Correlation.

Infers operational threat behaviors from track kinematics and spatial interactions:
- Approaching restricted boundary
- Vehicle stopping / lingering in restricted zone
- Nocturnal multi-person group movement
- Human + Vehicle spatial-temporal correlation
- Loitering (high dwell time with low net displacement)
Does not claim to determine criminal intent; characterizes measurable physical movement.
"""

from dataclasses import dataclass
import math
import numpy as np


@dataclass
class BehaviorPattern:
    pattern_type: str
    confidence: float
    threat_boost: str  # "LOW", "MEDIUM", "HIGH", "CRITICAL"
    track_ids: list[str]
    description: str


class BehaviorAnalyzer:
    def __init__(
        self,
        loiter_min_duration_s: float = 6.0,
        loiter_max_displacement_px: float = 50.0,
        vehicle_linger_min_s: float = 5.0,
        correlation_max_distance_px: float = 180.0,
    ):
        self.loiter_min_duration_s = loiter_min_duration_s
        self.loiter_max_displacement_px = loiter_max_displacement_px
        self.vehicle_linger_min_s = vehicle_linger_min_s
        self.correlation_max_distance_px = correlation_max_distance_px

    def analyze(
        self,
        active_tracks: list,
        geofence_status: str = "BUFFER",
        matched_rois: list[str] | None = None,
        is_night: bool = False,
    ) -> list[BehaviorPattern]:
        """Analyze active tracks for suspicious physical behavioral patterns."""
        patterns: list[BehaviorPattern] = []
        matched_rois = matched_rois or []
        in_restricted = (geofence_status == "CORE") or any("restricted" in r.lower() or "gate" in r.lower() for r in matched_rois)

        people = [t for t in active_tracks if getattr(t, "label", "") == "person"]
        vehicles = [t for t in active_tracks if getattr(t, "label", "") in {"car", "truck", "motorcycle", "boat"}]

        # 1. Nocturnal Group Movement (Multiple people moving concurrently at night)
        if is_night and len(people) >= 2:
            patterns.append(
                BehaviorPattern(
                    pattern_type="nocturnal_group",
                    confidence=min(1.0, 0.70 + 0.10 * len(people)),
                    threat_boost="CRITICAL" if in_restricted else "HIGH",
                    track_ids=[p.track_id for p in people],
                    description=f"Group of {len(people)} persons detected moving concurrently at night",
                )
            )

        # 2. Human + Vehicle Spatial Correlation
        for p in people:
            p_box = getattr(p, "current_bbox", [])
            if len(p_box) < 4:
                continue
            p_center = ((p_box[0] + p_box[2]) / 2.0, (p_box[1] + p_box[3]) / 2.0)

            for v in vehicles:
                v_box = getattr(v, "current_bbox", [])
                if len(v_box) < 4:
                    continue
                v_center = ((v_box[0] + v_box[2]) / 2.0, (v_box[1] + v_box[3]) / 2.0)
                dist = math.hypot(p_center[0] - v_center[0], p_center[1] - v_center[1])

                if dist <= self.correlation_max_distance_px:
                    boost = "CRITICAL" if in_restricted or is_night else "HIGH"
                    patterns.append(
                        BehaviorPattern(
                            pattern_type="human_vehicle_correlation",
                            confidence=0.88,
                            threat_boost=boost,
                            track_ids=[p.track_id, v.track_id],
                            description=f"Person ({p.track_id}) co-located with {v.label} ({v.track_id}) within {int(dist)}px",
                        )
                    )

        # 3. Vehicle Stopping / Lingering in Restricted Zone
        if in_restricted:
            for v in vehicles:
                duration = getattr(v, "duration_seconds", 0.0)
                boxes = getattr(v, "bbox_history", [])
                if duration >= self.vehicle_linger_min_s and len(boxes) >= 3:
                    # Calculate net displacement
                    start_c = ((boxes[0][0] + boxes[0][2]) / 2.0, (boxes[0][1] + boxes[0][3]) / 2.0)
                    end_c = ((boxes[-1][0] + boxes[-1][2]) / 2.0, (boxes[-1][1] + boxes[-1][3]) / 2.0)
                    disp = math.hypot(end_c[0] - start_c[0], end_c[1] - start_c[1])

                    if disp < 40.0:  # Vehicle has remained stationary in restricted zone
                        patterns.append(
                            BehaviorPattern(
                                pattern_type="lingering_vehicle",
                                confidence=0.90,
                                threat_boost="HIGH",
                                track_ids=[v.track_id],
                                description=f"Stationary {v.label} lingering in restricted zone for {duration:.1f}s",
                            )
                        )

        # 4. Loitering Detection (Person remaining in local area over extended duration)
        for p in people:
            duration = getattr(p, "duration_seconds", 0.0)
            boxes = getattr(p, "bbox_history", [])
            if duration >= self.loiter_min_duration_s and len(boxes) >= 5:
                # Bounding box centers
                c_x = [(b[0] + b[2]) / 2.0 for b in boxes]
                c_y = [(b[1] + b[3]) / 2.0 for b in boxes]
                # Bounding radius of movement
                radius = max(np.ptp(c_x), np.ptp(c_y))
                if radius < self.loiter_max_displacement_px:
                    boost = "HIGH" if (in_restricted or is_night) else "MEDIUM"
                    patterns.append(
                        BehaviorPattern(
                            pattern_type="loitering",
                            confidence=0.82,
                            threat_boost=boost,
                            track_ids=[p.track_id],
                            description=f"Person loitering in area for {duration:.1f}s (movement radius {radius:.0f}px)",
                        )
                    )

        return patterns

