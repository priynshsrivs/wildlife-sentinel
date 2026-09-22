"""Ordinal policy, not a probability model. Missing/failed sensors never imply LOW."""

import math
from sentinel_config import FUSION_CONFIDENCE_THRESHOLD

VERSION = "fusion-2"
PRIORITY = {"LOW": 0, "MONITORED": 1, "MEDIUM": 2, "HIGH": 3, "CRITICAL": 4}
ERRORS = {"UNKNOWN", "MODEL_ERROR", "SENSOR_ERROR", "UNAVAILABLE", "INPUT_ERROR"}


def calculate_combined_risk(vision_result, audio_result):
    results = [vision_result or {}, audio_result or {}]
    risks, confidences, effective = [], [], []
    for result in results:
        risk = result.get("risk_level", "UNKNOWN")
        if risk not in PRIORITY and risk not in ERRORS:
            raise ValueError("Invalid risk category")
        confidence = result.get("confidence")
        if confidence is not None and (
            not math.isfinite(confidence) or not 0 <= confidence <= 1
        ):
            raise ValueError("Invalid confidence")
        risks.append(risk)
        confidences.append(confidence)
        effective.append(
            risk
            if (confidence is not None and confidence >= FUSION_CONFIDENCE_THRESHOLD)
            or (risk == "LOW" and result.get("detections") == [])
            else "UNKNOWN"
        )
    known = [risk for risk in effective if risk in PRIORITY]
    highest = max(known, key=PRIORITY.get) if known else "UNKNOWN"
    if highest == "CRITICAL" or sum(r in {"HIGH", "CRITICAL"} for r in effective) == 2:
        combined = "CRITICAL"
    elif highest == "HIGH":
        combined = "HIGH"
    elif len(known) < 2:
        combined = next((risk for risk in risks if risk in ERRORS), "UNKNOWN")
    else:
        combined = highest
    return {
        "vision_detection": results[0].get("label"),
        "audio_detection": results[1].get("label"),
        "vision_risk": risks[0],
        "audio_risk": risks[1],
        "vision_confidence": confidences[0],
        "audio_confidence": confidences[1],
        "max_confidence": max((c for c in confidences if c is not None), default=0),
        "combined_risk": combined,
        "degraded": len(known) < 2,
        "risk_engine_version": VERSION,
    }
