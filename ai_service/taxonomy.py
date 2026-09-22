"""Anti-poaching visual taxonomy, threat hierarchy, and mode separation.

Distinguishes between standard COCO pretrained classes and custom domain classes.
Ordinary wildlife is filtered out in ANTI_POACHING mode to conserve compute and avoid false alerts.
"""

from typing import Literal

# Pretrained COCO classes relevant to anti-poaching detection
COCO_THREAT_CLASSES = {
    "person",
    "car",
    "truck",
    "motorcycle",
    "bus",
    "boat",
}

# Custom anti-poaching target classes (supported via custom fine-tuned models)
CUSTOM_THREAT_CLASSES = {
    "firearm",
    "rifle",
    "chainsaw",
    "hunting_equipment",
    "snare",
    "trap",
    "suspicious_container",
}

ALL_THREAT_CLASSES = COCO_THREAT_CLASSES | CUSTOM_THREAT_CLASSES

# Pretrained COCO wildlife / animal classes
WILDLIFE_CLASSES = {
    "bird",
    "cat",
    "dog",
    "horse",
    "sheep",
    "cow",
    "elephant",
    "bear",
    "zebra",
    "giraffe",
}

# Threat levels for detection events
DetectionLevel = Literal["BENIGN", "SUSPICIOUS", "THREAT"]


def get_active_classes(mode: str = "ANTI_POACHING") -> set[str]:
    """Return the set of target classes based on active vision mode.
    
    In ANTI_POACHING mode, wildlife is deliberately excluded to conserve edge compute.
    In WILDLIFE_MONITORING mode, both wildlife and human activity are tracked.
    """
    if mode == "WILDLIFE_MONITORING":
        return ALL_THREAT_CLASSES | WILDLIFE_CLASSES
    return ALL_THREAT_CLASSES


def filter_detections_by_mode(detections: list[dict], mode: str = "ANTI_POACHING") -> list[dict]:
    """Filter detection dicts based on active target classes for the mode."""
    target_classes = get_active_classes(mode)
    return [d for d in detections if d.get("label") in target_classes]


def classify_detection_level(
    labels: set[str],
    is_night: bool = False,
    in_core_geofence: bool = False,
    in_restricted_roi: bool = False,
    mode: str = "ANTI_POACHING",
) -> tuple[DetectionLevel, str]:
    """Classify visual detection level and assign system risk level.
    
    Does NOT blindly classify every person as a poacher. Evaluates context:
    - Person alone during day in buffer: SUSPICIOUS / MEDIUM
    - Person + vehicle in restricted zone or core: THREAT / HIGH
    - Person + weapon/chainsaw, or night intrusion in core: THREAT / CRITICAL
    - Wildlife only (in monitoring mode): BENIGN / MONITORED
    - No targets: BENIGN / LOW
    """
    threats = labels & ALL_THREAT_CLASSES
    wildlife = labels & WILDLIFE_CLASSES

    if not threats and not wildlife:
        return "BENIGN", "LOW"

    if not threats and wildlife:
        if mode == "WILDLIFE_MONITORING":
            return "BENIGN", "MONITORED"
        return "BENIGN", "LOW"

    has_person = "person" in threats
    has_vehicle = bool(threats & {"car", "truck", "motorcycle", "bus", "boat"})
    has_weapon_or_tool = bool(threats & {"firearm", "rifle", "chainsaw", "hunting_equipment", "snare", "trap"})

    # Escalated Threat Conditions
    if has_weapon_or_tool or (has_person and is_night and in_core_geofence) or (has_person and in_restricted_roi and is_night):
        return "THREAT", "CRITICAL"

    if (has_person and has_vehicle) or (has_person and in_core_geofence) or (has_vehicle and in_restricted_roi):
        return "THREAT", "HIGH"

    if has_person:
        # A person alone during daytime in buffer zone
        risk = "HIGH" if (is_night or in_core_geofence) else "MEDIUM"
        level = "THREAT" if risk == "HIGH" else "SUSPICIOUS"
        return level, risk

    if has_vehicle:
        return "SUSPICIOUS", "HIGH" if (is_night or in_core_geofence) else "MEDIUM"

    return "SUSPICIOUS", "MEDIUM"
