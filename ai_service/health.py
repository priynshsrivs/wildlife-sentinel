"""Quantitative Camera Health Evaluator for Edge Nodes.

Calculates sensor health score H in [0, 1] from:
- Frame delivery rate & FPS stability
- Dropped frame proportion
- Network / inference latency
- Sensor luminance variance (detects black/frozen frames)
"""

from dataclasses import dataclass
import math
from typing import Literal

HealthStatus = Literal["HEALTHY", "DEGRADED", "CRITICAL", "OFFLINE"]


@dataclass
class CameraHealthReport:
    camera_id: str
    score: float
    status: HealthStatus
    fps_score: float
    drop_score: float
    latency_score: float
    luminance_variance_score: float
    factors: dict[str, float]
    sensor_warning: bool
    rationale: str


class CameraHealthEvaluator:
    def __init__(
        self,
        w_fps: float = 0.35,
        w_drop: float = 0.30,
        w_lat: float = 0.20,
        w_var: float = 0.15,
        healthy_threshold: float = 0.75,
        degraded_threshold: float = 0.40,
    ):
        self.w_fps = w_fps
        self.w_drop = w_drop
        self.w_lat = w_lat
        self.w_var = w_var
        self.healthy_threshold = healthy_threshold
        self.degraded_threshold = degraded_threshold

    def evaluate(
        self,
        camera_id: str,
        actual_fps: float,
        target_fps: float = 5.0,
        dropped_frames: int = 0,
        total_frames: int = 100,
        latency_ms: float = 40.0,
        luminance_variance: float = 25.0,
    ) -> CameraHealthReport:
        """Calculate comprehensive health score for camera edge node."""
        # 1. FPS stability score
        effective_target = max(1.0, target_fps)
        fps_score = min(1.0, max(0.0, actual_fps / effective_target))

        # 2. Frame drop score
        tot = max(1, total_frames)
        drop_ratio = min(1.0, max(0.0, dropped_frames / tot))
        drop_score = 1.0 - drop_ratio

        # 3. Latency score (exponential penalty above 150ms)
        latency_score = float(math.exp(-max(0.0, latency_ms) / 200.0))

        # 4. Sensor variance score (variance < 2.0 indicates stuck or covered black frame)
        var_score = 1.0 if luminance_variance >= 10.0 else max(0.0, luminance_variance / 10.0)

        # Weighted composite score
        composite = (
            self.w_fps * fps_score
            + self.w_drop * drop_score
            + self.w_lat * latency_score
            + self.w_var * var_score
        )
        score = round(float(math.fsum([composite])), 3)
        score = min(1.0, max(0.0, score))

        if score >= self.healthy_threshold:
            status: HealthStatus = "HEALTHY"
        elif score >= self.degraded_threshold:
            status = "DEGRADED"
        else:
            status = "CRITICAL"

        warning = status in {"DEGRADED", "CRITICAL"}
        issues = []
        if fps_score < 0.6:
            issues.append(f"FPS deficit ({actual_fps:.1f}/{effective_target:.1f})")
        if drop_ratio > 0.15:
            issues.append(f"high drops ({drop_ratio*100:.1f}%)")
        if latency_ms > 150.0:
            issues.append(f"high latency ({latency_ms:.0f}ms)")
        if var_score < 0.5:
            issues.append("flat sensor variance (possible occlusion)")

        rationale = f"{status} (Score: {score:.2f})"
        if issues:
            rationale += f" - Issues: {', '.join(issues)}"

        return CameraHealthReport(
            camera_id=camera_id,
            score=score,
            status=status,
            fps_score=round(fps_score, 3),
            drop_score=round(drop_score, 3),
            latency_score=round(latency_score, 3),
            luminance_variance_score=round(var_score, 3),
            factors={
                "fps": round(fps_score, 3),
                "drop": round(drop_score, 3),
                "latency": round(latency_score, 3),
                "variance": round(var_score, 3),
            },
            sensor_warning=warning,
            rationale=rationale,
        )

