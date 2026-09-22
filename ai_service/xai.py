"""Explainable AI (XAI) Decision Breakdown & Transparent Threshold Engine.

Deconstructs every high-risk alert into transparent, human-auditable components:
- Specific positive evidence list with confidence and sensor modalities
- Model cascade decision trace (Nano -> Strong escalation with uncertainty score)
- Temporal verification persistence ratio (e.g. 7/9 frames)
- Spatial and diurnal risk adjustments (Base threshold + Context adjustment = Final threshold)
- Ranger-friendly operational explanation without ML jargon.
"""

from dataclasses import dataclass
from typing import TypedDict


class ThresholdAudit(TypedDict):
    base_threshold: float
    night_adjustment: float
    core_zone_adjustment: float
    uncertainty_adjustment: float
    final_operational_threshold: float


@dataclass
class ExplainableAlert:
    summary_sentence: str
    evidence_checklist: list[dict]
    model_cascade_trace: dict
    temporal_confirmation_ratio: str
    threshold_audit: ThresholdAudit
    operational_action_recommended: str


def generate_explainable_alert(
    detections: list[dict],
    threat_level: str,
    detection_level: str,
    vision_confidence: float,
    audio_event: dict | None = None,
    behaviors: list | None = None,
    model_version_trace: dict | None = None,
    hits_confirmed: int = 1,
    total_frames_sampled: int = 1,
    is_night: bool = False,
    in_core_geofence: bool = False,
    matched_rois: list[str] | None = None,
    uncertainty_score: float = 0.0,
    base_threshold: float = 0.50,
) -> ExplainableAlert:
    """Generate structured explainable audit trace for high-risk incident."""
    checklist = []
    matched_rois = matched_rois or []

    # 1. Vision Evidence
    for d in detections:
        label = d.get("label", "unknown")
        conf = d.get("confidence", 0.0)
        checklist.append(
            {
                "modality": "Vision",
                "finding": f"{label.capitalize()} identified ({conf*100:.1f}% confidence)",
                "criticality": "HIGH" if label in {"firearm", "chainsaw", "rifle", "snare"} else "MEDIUM",
            }
        )

    # 2. Audio Evidence
    if audio_event and audio_event.get("label"):
        a_label = audio_event.get("label")
        a_conf = audio_event.get("confidence", 0.0)
        checklist.append(
            {
                "modality": "Acoustic",
                "finding": f"{a_label} detected ({a_conf*100:.1f}% confidence)",
                "criticality": "HIGH" if a_label.lower() in {"chainsaw", "gunshot"} else "MEDIUM",
            }
        )

    # 3. Behavioral Evidence
    if behaviors:
        for b in behaviors:
            checklist.append(
                {
                    "modality": "Behavior",
                    "finding": getattr(b, "description", str(b)),
                    "criticality": getattr(b, "threat_boost", "MEDIUM"),
                }
            )

    # 4. Contextual Factors
    if in_core_geofence:
        checklist.append({"modality": "Spatial", "finding": "Inside Core Sanctuary Protected Zone", "criticality": "HIGH"})
    if matched_rois:
        checklist.append({"modality": "Spatial", "finding": f"Within Camera ROIs: {', '.join(matched_rois)}", "criticality": "HIGH"})
    if is_night:
        checklist.append({"modality": "Temporal", "finding": "Nocturnal activity (heightened poaching risk period)", "criticality": "MEDIUM"})

    # 5. Transparent Threshold Audit
    night_adj = -0.05 if is_night else 0.0
    core_adj = -0.10 if in_core_geofence else 0.0
    unc_adj = -0.05 if uncertainty_score > 0.40 else 0.0
    final_thresh = max(0.20, base_threshold + night_adj + core_adj + unc_adj)

    thresh_audit: ThresholdAudit = {
        "base_threshold": round(base_threshold, 2),
        "night_adjustment": round(night_adj, 2),
        "core_zone_adjustment": round(core_adj, 2),
        "uncertainty_adjustment": round(unc_adj, 2),
        "final_operational_threshold": round(final_thresh, 2),
    }

    # 6. Recommendation
    if threat_level == "CRITICAL":
        rec = "IMMEDIATE RANGER DISPATCH REQUIRED: Priority 1 interception."
    elif threat_level == "HIGH":
        rec = "DISPATCH CONFIRMED: Ranger patrol unit alert queued."
    elif threat_level == "MEDIUM":
        rec = "MONITOR: Logged in operational watch list; verify camera stream."
    else:
        rec = "PASSIVE LOG: Baseline wildlife or ambient sensor recording."

    # 7. Summary Sentence
    top_label = detections[0]["label"] if detections else "Activity"
    summary = (
        f"{threat_level} alert declared: {top_label} verified with {vision_confidence*100:.1f}% confidence "
        f"across {hits_confirmed}/{total_frames_sampled} frames in "
        f"{'Core Sanctuary Zone' if in_core_geofence else 'Buffer Zone'}."
    )

    cascade_trace = model_version_trace or {
        "stage_1_model": "YOLO11n",
        "stage_2_model": "YOLO11s",
        "uncertainty_score": round(uncertainty_score, 2),
        "escalation_triggered": uncertainty_score >= 0.40,
    }

    return ExplainableAlert(
        summary_sentence=summary,
        evidence_checklist=checklist,
        model_cascade_trace=cascade_trace,
        temporal_confirmation_ratio=f"{hits_confirmed} / {total_frames_sampled} frames",
        threshold_audit=thresh_audit,
        operational_action_recommended=rec,
    )

