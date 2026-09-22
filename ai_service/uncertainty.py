"""Multi-Factor Uncertainty Engine for Edge AI Escalation.

Quantifies uncertainty from:
1. Model confidence margin (1.0 - confidence)
2. Temporal variance of track velocity and bounding boxes
3. Label / Model disagreement
4. Sensor health degradation
"""

from dataclasses import dataclass
import numpy as np


@dataclass
class UncertaintyReport:
    score: float
    should_escalate: bool
    confidence_margin: float
    temporal_variance: float
    disagreement_penalty: float
    health_discount: float
    factors: dict[str, float]
    rationale: str


class UncertaintyEngine:
    def __init__(
        self,
        escalation_threshold: float = 0.40,
        w_confidence: float = 0.45,
        w_temporal: float = 0.20,
        w_disagreement: float = 0.20,
        w_health: float = 0.15,
    ):
        self.escalation_threshold = escalation_threshold
        self.w_confidence = w_confidence
        self.w_temporal = w_temporal
        self.w_disagreement = w_disagreement
        self.w_health = w_health

    def evaluate(
        self,
        detection_confidence: float,
        detection_label: str,
        track_confidence_history: list[float] | None = None,
        track_bbox_history: list[list[float]] | None = None,
        previous_label: str | None = None,
        camera_health: float = 1.0,
        is_threat_class: bool = False,
    ) -> UncertaintyReport:
        """Calculate quantitative uncertainty score for a candidate detection."""
        # 1. Confidence Margin
        c = float(np.clip(detection_confidence, 0.0, 1.0))
        margin = 1.0 - c

        # 2. Temporal Jitter / Variance
        temporal_var = 0.0
        if track_confidence_history and len(track_confidence_history) >= 2:
            conf_var = float(np.var(track_confidence_history[-5:]))
            temporal_var += min(1.0, conf_var * 4.0)

        if track_bbox_history and len(track_bbox_history) >= 2:
            # Measure centroid displacement jitter
            centroids = [
                ((b[0] + b[2]) / 2.0, (b[1] + b[3]) / 2.0)
                for b in track_bbox_history[-5:]
                if len(b) >= 4
            ]
            if len(centroids) >= 2:
                dists = [
                    np.hypot(centroids[i][0] - centroids[i - 1][0], centroids[i][1] - centroids[i - 1][1])
                    for i in range(1, len(centroids))
                ]
                # High erratic jumps between frames increase uncertainty
                motion_jitter = float(np.std(dists)) if len(dists) >= 2 else 0.0
                temporal_var = min(1.0, (temporal_var + min(1.0, motion_jitter / 50.0)) / 2.0)

        # 3. Class / Model Disagreement
        disagreement = 0.0
        if previous_label and previous_label != detection_label:
            disagreement = 1.0

        # 4. Sensor Health Discount (Degraded cameras introduce sensor uncertainty)
        health_penalty = max(0.0, 1.0 - camera_health)

        # Total Weighted Uncertainty Score
        total_score = (
            self.w_confidence * margin
            + self.w_temporal * temporal_var
            + self.w_disagreement * disagreement
            + self.w_health * health_penalty
        )
        total_score = float(np.clip(total_score, 0.0, 1.0))

        # Decision rule: High uncertainty warrants escalation to stronger model
        # Or if it is a suspected weapon/threat class with moderate uncertainty
        should_esc = (total_score >= self.escalation_threshold) or (is_threat_class and total_score >= 0.25)

        reasons = []
        if margin > 0.40:
            reasons.append(f"low nano confidence ({c:.2f})")
        if temporal_var > 0.30:
            reasons.append(f"temporal track jitter ({temporal_var:.2f})")
        if disagreement > 0.0:
            reasons.append(f"class flip from '{previous_label}' to '{detection_label}'")
        if health_penalty > 0.40:
            reasons.append(f"camera sensor health degraded ({camera_health:.2f})")

        rationale_str = f"U={total_score:.2f} ({', '.join(reasons) if reasons else 'stable candidate'})"

        return UncertaintyReport(
            score=round(total_score, 3),
            should_escalate=should_esc,
            confidence_margin=round(margin, 3),
            temporal_variance=round(temporal_var, 3),
            disagreement_penalty=round(disagreement, 3),
            health_discount=round(health_penalty, 3),
            factors={
                "margin": round(margin, 3),
                "temporal": round(temporal_var, 3),
                "disagreement": round(disagreement, 3),
                "health": round(health_penalty, 3),
            },
            rationale=rationale_str,
        )
