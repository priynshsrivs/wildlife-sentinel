"""Privacy-Preserving Storage & Automated Redaction Engine.

Enforces conservation data privacy:
- Redacts human facial / head regions in image snapshots to protect field researchers and tourists
- Configurable retention: Metadata-Only, Confirmed Incidents Only, or Full Retention
- Automated expiration pruning to avoid storing unnecessary edge frames.
"""

from typing import Literal
import cv2
import numpy as np
from PIL import Image

RetentionPolicy = Literal["METADATA_ONLY", "CONFIRMED_INCIDENTS_ONLY", "FULL_RETENTION"]


class PrivacyEngine:
    def __init__(
        self,
        retention_policy: RetentionPolicy = "CONFIRMED_INCIDENTS_ONLY",
        redact_faces: bool = True,
        head_height_ratio: float = 0.25,
    ):
        self.retention_policy = retention_policy
        self.redact_faces = redact_faces
        self.head_height_ratio = head_height_ratio

    def should_store_media(self, threat_level: str, is_confirmed: bool) -> bool:
        """Evaluate whether snapshot image should be persisted according to privacy policy."""
        if self.retention_policy == "METADATA_ONLY":
            return False
        if self.retention_policy == "CONFIRMED_INCIDENTS_ONLY":
            return is_confirmed and (threat_level in {"HIGH", "CRITICAL", "MEDIUM"})
        return True

    def redact_person_faces(
        self,
        image: Image.Image | np.ndarray,
        detections: list[dict],
    ) -> Image.Image:
        """Apply Gaussian blur to the upper region of detected persons."""
        if not self.redact_faces:
            return image if isinstance(image, Image.Image) else Image.fromarray(image)

        if isinstance(image, Image.Image):
            im_np = np.array(image.convert("RGB"))
        else:
            im_np = image.copy()

        h, w = im_np.shape[:2]
        modified = False

        for det in detections:
            if det.get("label") == "person" and det.get("bbox"):
                box = det["bbox"]
                if len(box) >= 4:
                    x1 = max(0, int(box[0]))
                    y1 = max(0, int(box[1]))
                    x2 = min(w, int(box[2]))
                    y2 = min(h, int(box[3]))

                    box_h = y2 - y1
                    box_w = x2 - x1
                    if box_h > 10 and box_w > 10:
                        # Upper fraction corresponding to head/face
                        head_y2 = y1 + int(box_h * self.head_height_ratio)
                        roi = im_np[y1:head_y2, x1:x2]
                        if roi.size > 0:
                            # Apply heavy kernel blur
                            ksize = (max(15, (box_w // 4) * 2 + 1), max(15, (box_w // 4) * 2 + 1))
                            blurred = cv2.GaussianBlur(roi, ksize, 30)
                            im_np[y1:head_y2, x1:x2] = blurred
                            modified = True

        return Image.fromarray(im_np)

