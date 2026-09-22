"""AI Compute Governor for Wildlife Sentinel.

Closed-loop policy engine dynamically deciding edge computation:
- Target Vision FPS (2, 5, 10, 15)
- Active Model Tier (SKIP, NANO, ESCALATION)
- Input Resolution (320, 480, 640)
- Tracking & Verification Cadence
- Audio AI Polling Rate
Based on battery level, CPU utilization, camera health, scene motion, and threat status.
"""

from dataclasses import dataclass
from typing import Literal

CadenceMode = Literal["IDLE", "MOTION", "SUSPICIOUS", "THREAT", "TAMPERED"]
ModelTier = Literal["SKIP", "NANO", "ESCALATION"]
PowerProfile = Literal["NORMAL", "BALANCED", "LOW_POWER", "CRITICAL_BATTERY"]


@dataclass
class GovernorDecision:
    cadence_mode: CadenceMode
    target_fps: float
    model_tier: ModelTier
    input_resolution: int
    tracking_enabled: bool
    audio_poll_seconds: float
    clahe_enabled: bool
    rationale: str


class AIComputeGovernor:
    def __init__(
        self,
        idle_fps: float = 2.0,
        motion_fps: float = 5.0,
        suspicious_fps: float = 10.0,
        threat_fps: float = 15.0,
    ):
        self.idle_fps = idle_fps
        self.motion_fps = motion_fps
        self.suspicious_fps = suspicious_fps
        self.threat_fps = threat_fps

    def decide(
        self,
        has_motion: bool = False,
        active_tracks_count: int = 0,
        current_threat_level: str = "LOW",
        uncertainty_score: float = 0.0,
        battery_pct: float | None = None,
        cpu_utilization_pct: float | None = None,
        camera_health_score: float = 1.0,
        is_night: bool = False,
        is_tampered: bool = False,
    ) -> GovernorDecision:
        """Compute optimal edge inference policy based on live system telemetry."""

        # 1. Hardware Tampering Override
        if is_tampered:
            return GovernorDecision(
                cadence_mode="TAMPERED",
                target_fps=self.motion_fps,
                model_tier="SKIP",
                input_resolution=320,
                tracking_enabled=False,
                audio_poll_seconds=5.0,
                clahe_enabled=False,
                rationale="Sensor tampering detected: halting neural inference to preserve bandwidth and logs.",
            )

        # 2. Battery & Power Throttling
        power_profile: PowerProfile = "NORMAL"
        if battery_pct is not None:
            if battery_pct <= 15.0:
                power_profile = "CRITICAL_BATTERY"
            elif battery_pct <= 40.0:
                power_profile = "LOW_POWER"
            elif battery_pct <= 70.0:
                power_profile = "BALANCED"

        # 3. Assess Scene Operational Cadence
        if current_threat_level in {"HIGH", "CRITICAL"}:
            cadence: CadenceMode = "THREAT"
        elif active_tracks_count > 0 or current_threat_level == "MEDIUM" or uncertainty_score > 0.40:
            cadence = "SUSPICIOUS"
        elif has_motion:
            cadence = "MOTION"
        else:
            cadence = "IDLE"

        # 4. Resolve Base FPS & Resolution per Cadence
        if cadence == "THREAT":
            base_fps = self.threat_fps
            model_tier: ModelTier = "ESCALATION"
            resolution = 640
            tracking = True
            audio_poll = 1.0
        elif cadence == "SUSPICIOUS":
            base_fps = self.suspicious_fps
            model_tier = "ESCALATION" if uncertainty_score >= 0.35 else "NANO"
            resolution = 640 if is_night else 480
            tracking = True
            audio_poll = 2.0
        elif cadence == "MOTION":
            base_fps = self.motion_fps
            model_tier = "NANO"
            resolution = 480
            tracking = True
            audio_poll = 5.0
        else:  # IDLE
            base_fps = self.idle_fps
            model_tier = "SKIP"
            resolution = 320
            tracking = False
            audio_poll = 10.0

        # 5. Apply Power Profile Constraints (Governor Throttling)
        rationale_notes = [f"Cadence: {cadence}"]
        if power_profile == "CRITICAL_BATTERY":
            base_fps = min(base_fps, 2.0)
            resolution = 320
            model_tier = "NANO" if model_tier != "SKIP" else "SKIP"
            audio_poll = max(audio_poll, 15.0)
            rationale_notes.append("Critical battery throttling (<15%): capped at 2 FPS / 320px")
        elif power_profile == "LOW_POWER":
            base_fps = min(base_fps, 5.0)
            resolution = min(resolution, 480)
            audio_poll = max(audio_poll, 5.0)
            rationale_notes.append("Low power mode (15-40%): capped at 5 FPS / 480px")
        elif power_profile == "BALANCED":
            base_fps = min(base_fps, 10.0)
            rationale_notes.append("Balanced power mode (40-70%)")

        # 6. High CPU Load Relief
        if cpu_utilization_pct is not None and cpu_utilization_pct > 85.0:
            base_fps = max(2.0, base_fps * 0.6)
            resolution = min(resolution, 480)
            rationale_notes.append("CPU thermal relief (>85% load): down-scaled FPS")

        # 7. Low Camera Health Discount
        if camera_health_score < 0.50:
            model_tier = "NANO"
            rationale_notes.append(f"Degraded sensor health ({camera_health_score:.2f}): suppressing heavy escalation")

        return GovernorDecision(
            cadence_mode=cadence,
            target_fps=round(base_fps, 1),
            model_tier=model_tier,
            input_resolution=resolution,
            tracking_enabled=tracking,
            audio_poll_seconds=audio_poll,
            clahe_enabled=is_night,
            rationale=" | ".join(rationale_notes),
        )

