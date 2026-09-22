"""Spatial, time-of-day, and Region-of-Interest (ROI) contextual risk evaluator.

Prevents treating every detection identically. Integrates reserve zoning,
time-of-day constraints, and camera-specific zones into operational risk.
"""

from datetime import datetime, timezone
from typing import Literal

TimeOfDay = Literal["night", "dawn", "day", "dusk"]


def get_time_of_day(dt: datetime | None = None) -> TimeOfDay:
    """Classify datetime into operational diurnal phase."""
    now = dt or datetime.now(timezone.utc)
    hour = now.hour
    if 20 <= hour or hour < 5:
        return "night"
    if 5 <= hour < 7:
        return "dawn"
    if 7 <= hour < 18:
        return "day"
    return "dusk"


def point_in_bbox(point: tuple[float, float], bbox: list[float]) -> bool:
    """Check if (x, y) point is inside [x1, y1, x2, y2]."""
    if len(bbox) < 4:
        return False
    return bbox[0] <= point[0] <= bbox[2] and bbox[1] <= point[1] <= bbox[3]


def evaluate_roi_matches(detections: list[dict], camera_rois: list[dict]) -> list[dict]:
    """Tag each detection with the matching camera regions of interest.
    
    camera_rois: list of dicts like:
    [
      {"name": "Restricted Gate", "type": "restricted", "bbox": [0, 0, 320, 480]},
      {"name": "Access Road", "type": "road", "bbox": [320, 0, 640, 480]}
    ]
    """
    if not camera_rois:
        return detections

    tagged = []
    for det in detections:
        box = det.get("bbox", [])
        if len(box) == 4:
            # Test bottom-center (ground contact point of object)
            bottom_center = ((box[0] + box[2]) / 2.0, box[3])
            matched_rois = [
                roi["name"]
                for roi in camera_rois
                if point_in_bbox(bottom_center, roi.get("bbox", []))
            ]
            det_copy = dict(det)
            det_copy["matched_rois"] = matched_rois
            tagged.append(det_copy)
        else:
            tagged.append(det)
    return tagged


def evaluate_contextual_threat(
    labels: set[str],
    time_of_day: TimeOfDay,
    geofence_status: str = "BUFFER",
    matched_rois: list[str] | None = None,
) -> tuple[str, str]:
    """Calculate contextual threat level and severity.
    
    Returns (detection_level: BENIGN/SUSPICIOUS/THREAT, threat_level: LOW/MONITORED/MEDIUM/HIGH/CRITICAL).
    """
    matched_rois = matched_rois or []
    is_night = time_of_day in {"night", "dawn"}
    in_core = geofence_status == "CORE"
    in_restricted = any("restricted" in r.lower() or "gate" in r.lower() for r in matched_rois)

    threats = labels & {"person", "car", "truck", "motorcycle", "bus", "boat", "firearm", "chainsaw", "snare"}
    if not threats:
        return "BENIGN", "LOW"

    # Extreme threats: weapons or night intrusion in core/restricted zones
    if bool(threats & {"firearm", "chainsaw", "snare"}):
        return "THREAT", "CRITICAL"

    if "person" in threats:
        if is_night and (in_core or in_restricted):
            return "THREAT", "CRITICAL"
        if in_core or in_restricted:
            return "THREAT", "HIGH"
        if bool(threats & {"car", "truck", "motorcycle"}):
            return "THREAT", "HIGH"
        if is_night:
            return "THREAT", "HIGH"
        return "SUSPICIOUS", "MEDIUM"

    if bool(threats & {"car", "truck", "motorcycle"}):
        if is_night or in_core or in_restricted:
            return "THREAT", "HIGH"
        return "SUSPICIOUS", "MEDIUM"

    return "SUSPICIOUS", "MEDIUM"

