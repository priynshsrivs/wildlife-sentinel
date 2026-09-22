"""Sub-millisecond motion & change detector for edge video filtering.

Avoids expensive neural inference on static scenes.
Uses low-resolution downscaled frame differencing and adaptive background accumulation.
"""

import time
from dataclasses import dataclass
import cv2
import numpy as np


@dataclass
class MotionResult:
    has_motion: bool
    score: float
    duration_ms: float
    global_lighting_change: bool = False


class MotionDetector:
    def __init__(
        self,
        threshold: float = 0.015,
        min_area_ratio: float = 0.001,
        thumbnail_size: tuple[int, int] = (160, 120),
        alpha: float = 0.05,
    ):
        self.threshold = threshold
        self.min_area_ratio = min_area_ratio
        self.thumbnail_size = thumbnail_size
        self.alpha = alpha
        self.background: np.ndarray | None = None
        self.last_frame_time: float = 0.0

    def reset(self):
        """Clear background model."""
        self.background = None

    def evaluate(self, frame_np: np.ndarray) -> MotionResult:
        """Evaluate whether the frame contains significant localized motion.
        
        Takes an RGB or BGR numpy array image, resizes to thumbnail, and performs frame differencing.
        Executes in ~0.5ms - 1.0ms on edge CPU.
        """
        start = time.perf_counter()

        # Handle PIL Image or numpy array
        if hasattr(frame_np, "convert"):
            frame_np = np.array(frame_np)

        if frame_np.ndim == 3:
            gray = cv2.cvtColor(frame_np, cv2.COLOR_RGB2GRAY if frame_np.shape[2] == 3 else cv2.COLOR_BGR2GRAY)
        else:
            gray = frame_np

        small = cv2.resize(gray, self.thumbnail_size, interpolation=cv2.INTER_AREA)
        blurred = cv2.GaussianBlur(small, (5, 5), 0)

        if self.background is None:
            self.background = blurred.astype(np.float32)
            duration_ms = (time.perf_counter() - start) * 1000
            return MotionResult(has_motion=True, score=1.0, duration_ms=duration_ms)

        # Compute absolute difference against moving background
        diff = cv2.absdiff(blurred, cv2.convertScaleAbs(self.background))
        _, thresh = cv2.threshold(diff, 25, 255, cv2.THRESH_BINARY)

        total_pixels = thresh.size
        changed_pixels = int(np.count_nonzero(thresh))
        score = changed_pixels / total_pixels

        # Detect global lighting shift (e.g., sudden sun flare or shadow across entire frame)
        global_lighting = False
        if score > 0.60:
            mean_diff = float(np.mean(diff))
            std_diff = float(np.std(diff))
            if std_diff < 15.0 and mean_diff > 20.0:
                # Uniform shift across the entire sensor frame
                global_lighting = True

        # Slowly update background model with new frame
        cv2.accumulateWeighted(blurred, self.background, self.alpha)

        has_motion = score >= self.threshold and not global_lighting
        duration_ms = (time.perf_counter() - start) * 1000

        return MotionResult(
            has_motion=has_motion,
            score=round(score, 4),
            duration_ms=round(duration_ms, 2),
            global_lighting_change=global_lighting,
        )

