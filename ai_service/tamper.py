"""Sensor Security & Physical Camera Tampering Detector.

Detects unauthorized physical interference with edge camera infrastructure:
- Lens Occlusion / Spray Painting (flat sensor, near-zero variance)
- Sudden Camera Deflection / Disorientation (camera knocked down or pointed at ground/sky)
- Blinding / Glare Attack (saturation across sensor)
- Frozen Frame / Video Replay Attack (repeated identical frame bytes)
"""

from dataclasses import dataclass
import hashlib
import cv2
import numpy as np
from PIL import Image


@dataclass
class TamperAlert:
    is_tampered: bool
    tamper_type: str  # "NONE", "LENS_OCCLUSION", "CAMERA_DEFLECTION", "SENSOR_BLINDING", "REPLAY_FROZEN"
    confidence: float
    details: str


class SensorTamperDetector:
    def __init__(
        self,
        min_variance: float = 2.5,
        occlusion_max_mean: float = 8.0,
        blinding_min_mean: float = 248.0,
        max_repeated_frames: int = 5,
    ):
        self.min_variance = min_variance
        self.occlusion_max_mean = occlusion_max_mean
        self.blinding_min_mean = blinding_min_mean
        self.max_repeated_frames = max_repeated_frames
        self.recent_frame_hashes: list[str] = []
        self.previous_thumbnail: np.ndarray | None = None

    def evaluate(self, image: Image.Image | np.ndarray) -> TamperAlert:
        """Evaluate raw camera frame for physical or stream tampering."""
        if isinstance(image, Image.Image):
            frame = np.array(image.convert("RGB"))
        else:
            frame = image

        if frame.ndim == 3:
            gray = cv2.cvtColor(frame, cv2.COLOR_RGB2GRAY if frame.shape[2] == 3 else cv2.COLOR_BGR2GRAY)
        else:
            gray = frame

        small = cv2.resize(gray, (160, 120), interpolation=cv2.INTER_AREA)

        # 1. Frame Replay / Frozen Stream Detection
        frame_hash = hashlib.sha1(small.tobytes()).hexdigest()
        self.recent_frame_hashes.append(frame_hash)
        if len(self.recent_frame_hashes) > self.max_repeated_frames:
            self.recent_frame_hashes.pop(0)

        if len(self.recent_frame_hashes) == self.max_repeated_frames and len(set(self.recent_frame_hashes)) == 1:
            return TamperAlert(
                is_tampered=True,
                tamper_type="REPLAY_FROZEN",
                confidence=0.98,
                details=f"Camera stream frozen: identical frame hash repeated across {self.max_repeated_frames} consecutive reads",
            )

        # 2. Lens Occlusion (Covered, spray painted, or completely obscured)
        mean_val = float(np.mean(small))
        variance_val = float(np.var(small))

        if mean_val <= self.occlusion_max_mean and variance_val <= self.min_variance:
            return TamperAlert(
                is_tampered=True,
                tamper_type="LENS_OCCLUSION",
                confidence=0.95,
                details=f"Lens covered or blacked out: mean luminance {mean_val:.1f}, variance {variance_val:.1f}",
            )

        # 3. Sensor Blinding / High Intensity Flare
        if mean_val >= self.blinding_min_mean and variance_val <= 10.0:
            return TamperAlert(
                is_tampered=True,
                tamper_type="SENSOR_BLINDING",
                confidence=0.92,
                details=f"Sensor blinded by direct spotlight or flare: mean luminance {mean_val:.1f}",
            )

        # 4. Camera Deflection / Reorientation (Pointed at ground or sky)
        # Uniform sky or uniform ground has very low edge energy
        laplacian_var = cv2.Laplacian(small, cv2.CV_64F).var()
        if laplacian_var < 1.0 and variance_val < 5.0:
            return TamperAlert(
                is_tampered=True,
                tamper_type="CAMERA_DEFLECTION",
                confidence=0.85,
                details=f"Camera reoriented away from scene (deflected focus/flat texture, laplacian: {laplacian_var:.2f})",
            )

        self.previous_thumbnail = small
        return TamperAlert(is_tampered=False, tamper_type="NONE", confidence=0.0, details="Sensor operating nominally")

