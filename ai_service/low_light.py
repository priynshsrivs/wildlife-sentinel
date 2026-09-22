"""Selective low-light analyzer and adaptive contrast enhancement (CLAHE).

Only enhances frames when ambient illumination falls below threshold,
avoiding unnecessary processing overhead on daytime frames.
"""

import cv2
import numpy as np
from PIL import Image


def analyze_and_enhance_low_light(
    image: Image.Image | np.ndarray,
    luminance_threshold: float = 45.0,
    clip_limit: float = 2.5,
    tile_grid_size: tuple[int, int] = (8, 8),
) -> tuple[Image.Image, bool, float]:
    """Detect low-light conditions and apply CLAHE if needed.
    
    Returns: (output_image: Image.Image, enhanced: bool, mean_luminance: float)
    """
    if isinstance(image, Image.Image):
        im_np = np.array(image.convert("RGB"))
    else:
        im_np = image

    # Fast luminance estimation on a downscaled 160x120 thumbnail
    thumb = cv2.resize(im_np, (160, 120), interpolation=cv2.INTER_AREA)
    gray_thumb = cv2.cvtColor(thumb, cv2.COLOR_RGB2GRAY if thumb.ndim == 3 else cv2.COLOR_BGR2GRAY)
    mean_luminance = float(np.mean(gray_thumb))

    if mean_luminance >= luminance_threshold:
        # Daytime / sufficient ambient light: return unchanged with zero overhead
        return (image if isinstance(image, Image.Image) else Image.fromarray(im_np)), False, round(mean_luminance, 1)

    # Low-light detected: apply CLAHE to L-channel in LAB color space
    lab = cv2.cvtColor(im_np, cv2.COLOR_RGB2LAB)
    l, a, b = cv2.split(lab)

    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=tile_grid_size)
    cl = clahe.apply(l)

    enhanced_lab = cv2.merge((cl, a, b))
    enhanced_rgb = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2RGB)

    return Image.fromarray(enhanced_rgb), True, round(mean_luminance, 1)

