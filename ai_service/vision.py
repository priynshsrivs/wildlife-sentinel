"""Cascaded Edge AI Vision Classifier with Adaptive Escalation and Context.

Stage 1: Nano model (YOLO11n, ~44ms on edge CPU) runs as default.
Stage 2: Escalation model (YOLO11s) invoked only on ambiguous or high-threat visual cues.
Integrates motion filtering, multi-target tracking, temporal confirmation, and diurnal/ROI context.
"""

import hashlib
import logging
import threading
import time
from datetime import datetime, timezone
import numpy as np
from PIL import Image
from fastapi import HTTPException

import sentinel_config as config
from ai_service.context import evaluate_contextual_threat, evaluate_roi_matches, get_time_of_day
from ai_service.low_light import analyze_and_enhance_low_light
from ai_service.motion import MotionDetector
from ai_service.taxonomy import ALL_THREAT_CLASSES, WILDLIFE_CLASSES, get_active_classes
from ai_service.temporal import TemporalVerifier
from ai_service.tracker import ObjectTracker

log = logging.getLogger(__name__)


class CascadedVisionEngine:
    def __init__(self):
        self.nano_model = None
        self.escalation_model = None
        self.nano_version = "unavailable"
        self.escalation_version = "unavailable"
        self.hardware_backend = "CPU"
        self.lock = threading.Lock()

        self.motion_detector = MotionDetector(threshold=config.MOTION_THRESHOLD)
        self.tracker = ObjectTracker(
            confirmation_hits=config.TEMPORAL_CONFIRMATION_FRAMES,
            window_seconds=config.TEMPORAL_CONFIRMATION_WINDOW_SECONDS,
        )
        self.temporal_verifier = TemporalVerifier(
            min_frames=config.TEMPORAL_CONFIRMATION_FRAMES,
            window_seconds=config.TEMPORAL_CONFIRMATION_WINDOW_SECONDS,
        )

        self.last_escalation_time: dict[str, float] = {}
        self.ready = False

    @property
    def model(self):
        """Backward-compatibility alias."""
        return self.nano_model

    @model.setter
    def model(self, value):
        self.nano_model = value
        self.ready = value is not None

    @property
    def version(self):
        """Backward-compatibility alias."""
        return self.nano_version

    @version.setter
    def version(self, value):
        self.nano_version = value

    def initialize(self):
        """Load nano and escalation models once with warmup forward pass."""
        try:
            import torch
            from ultralytics import YOLO

            if torch.cuda.is_available():
                self.hardware_backend = f"CUDA ({torch.cuda.get_device_name(0)})"
            elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
                self.hardware_backend = "Apple MPS"
            else:
                self.hardware_backend = "CPU"

            # Stage 1: Nano Model
            nano_path = config.NANO_MODEL_PATH if config.NANO_MODEL_PATH.is_file() else config.VISION_MODEL_PATH
            if not nano_path.is_file():
                raise FileNotFoundError(f"Nano model not found at {nano_path}")

            self.nano_model = YOLO(str(nano_path))
            with nano_path.open("rb") as f:
                self.nano_version = "yolo-" + hashlib.file_digest(f, "sha256").hexdigest()[:16]

            # Stage 2: Escalation Model
            if config.ESCALATION_MODEL_PATH.is_file():
                self.escalation_model = YOLO(str(config.ESCALATION_MODEL_PATH))
                with config.ESCALATION_MODEL_PATH.open("rb") as f:
                    self.escalation_version = "yolo-" + hashlib.file_digest(f, "sha256").hexdigest()[:16]
            else:
                self.escalation_model = None
                self.escalation_version = "none"

            # Model Warmup: perform dummy inference to eliminate cold-start lag
            dummy = np.zeros((config.INPUT_SIZE, config.INPUT_SIZE, 3), dtype=np.uint8)
            self.nano_model(dummy, verbose=False)
            if self.escalation_model is not None:
                self.escalation_model(dummy, verbose=False)

            self.ready = True
            log.info(
                "vision_engine_initialized backend=%s nano=%s escalation=%s mode=%s",
                self.hardware_backend,
                self.nano_version,
                self.escalation_version,
                config.VISION_MODE,
            )
        except Exception:
            self.nano_model = None
            self.escalation_model = None
            self.ready = False
            log.exception("vision_initialization_failed")

    def predict(
        self,
        image: Image.Image | np.ndarray,
        threshold: float | None = None,
        camera_id: str = "CAM_DEFAULT",
        geofence_status: str = "BUFFER",
        camera_rois: list[dict] | None = None,
        skip_motion_check: bool = False,
        force_escalation: bool = False,
        timestamp: float | None = None,
    ) -> dict:
        """Run cascaded anti-poaching inference on an input frame."""
        if not self.ready or self.nano_model is None:
            raise HTTPException(503, "MODEL_ERROR: vision model unavailable")

        conf_threshold = threshold if threshold is not None else config.DEFAULT_SETTINGS["confidence_threshold"]
        now = time.monotonic() if timestamp is None else timestamp
        timings = {}
        t_start = time.perf_counter()

        # Step 1: Low-Light Analysis & Selective Enhancement
        t0 = time.perf_counter()
        if config.LOW_LIGHT_ENHANCEMENT:
            processed_image, low_light_enhanced, luminance = analyze_and_enhance_low_light(image)
        else:
            processed_image, low_light_enhanced, luminance = image, False, 100.0
        timings["preprocess_ms"] = round((time.perf_counter() - t0) * 1000, 2)

        # Step 2: Motion Detection (Skip compute on static camera scenes)
        t0 = time.perf_counter()
        if config.MOTION_FILTER_ENABLED and not skip_motion_check:
            motion = self.motion_detector.evaluate(processed_image)
            timings["motion_ms"] = motion.duration_ms
            if not motion.has_motion and not self.tracker.get_active_tracks():
                # Static scene with no active tracks: return empty immediately
                total_ms = round((time.perf_counter() - t_start) * 1000, 2)
                timings["total_ms"] = total_ms
                return {
                    "label": "NO_DETECTION",
                    "risk_level": "LOW",
                    "detection_level": "BENIGN",
                    "confidence": 0.0,
                    "detections": [],
                    "model_version": self.nano_version,
                    "stage": "STAGE_0_MOTION_FILTER",
                    "skipped_motion": True,
                    "motion_score": motion.score,
                    "low_light_enhanced": low_light_enhanced,
                    "timings": timings,
                }
        else:
            timings["motion_ms"] = 0.0

        # Step 3: Stage 1 Nano Model Inference
        t0 = time.perf_counter()
        target_classes = get_active_classes(config.VISION_MODE)
        with self.lock:
            nano_res = self.nano_model(
                processed_image,
                conf=config.NANO_CONFIDENCE_LOW,
                imgsz=config.INPUT_SIZE,
                verbose=False,
            )[0]
        timings["nano_ms"] = round((time.perf_counter() - t0) * 1000, 2)

        raw_detections = []
        for box in nano_res.boxes:
            cls_idx = int(box.cls[0].item())
            label = self.nano_model.names[cls_idx]
            conf = float(box.conf[0].item())
            if label not in target_classes:
                continue
            raw_detections.append(
                {
                    "label": label,
                    "confidence": conf,
                    "bbox": [float(v) for v in box.xyxy[0].tolist()],
                    "kind": "species" if label in WILDLIFE_CLASSES else "object",
                }
            )

        # Step 4: Adaptive Escalation Decider
        # Evaluate whether Stage 2 (small/medium) model is needed
        t0 = time.perf_counter()
        escalated = False
        active_model_version = self.nano_version
        stage_name = "STAGE_1_NANO"

        last_esc = self.last_escalation_time.get(camera_id, 0.0)
        cooldown_ok = (now - last_esc) >= config.ESCALATION_COOLDOWN_SECONDS

        should_escalate = force_escalation
        if not should_escalate and self.escalation_model is not None and cooldown_ok:
            for det in raw_detections:
                c = det["confidence"]
                # Ambiguous detection or uncertain threat cue warrants escalation
                if config.NANO_CONFIDENCE_LOW <= c < config.NANO_CONFIDENCE_HIGH and det["kind"] == "object":
                    should_escalate = True
                    break

        if should_escalate and self.escalation_model is not None:
            with self.lock:
                esc_res = self.escalation_model(
                    processed_image,
                    conf=conf_threshold,
                    imgsz=config.INPUT_SIZE,
                    verbose=False,
                )[0]
            timings["escalation_ms"] = round((time.perf_counter() - t0) * 1000, 2)
            escalated = True
            active_model_version = self.escalation_version
            stage_name = "STAGE_2_ESCALATION"
            self.last_escalation_time[camera_id] = now

            # Replace raw detections with higher-capacity Stage 2 detections
            raw_detections = []
            for box in esc_res.boxes:
                cls_idx = int(box.cls[0].item())
                label = self.escalation_model.names[cls_idx]
                conf = float(box.conf[0].item())
                if label not in target_classes or conf < conf_threshold:
                    continue
                raw_detections.append(
                    {
                        "label": label,
                        "confidence": conf,
                        "bbox": [float(v) for v in box.xyxy[0].tolist()],
                        "kind": "species" if label in WILDLIFE_CLASSES else "object",
                    }
                )
        else:
            timings["escalation_ms"] = 0.0
            # Filter nano detections by final confidence threshold
            raw_detections = [d for d in raw_detections if d["confidence"] >= conf_threshold]

        # Step 5: Object Tracking
        t0 = time.perf_counter()
        if config.TRACKING_ENABLED:
            tracks = self.tracker.update(raw_detections, timestamp=now)
            timings["tracking_ms"] = round((time.perf_counter() - t0) * 1000, 2)
            if escalated:
                for t in tracks:
                    t.escalated_once = True
        else:
            timings["tracking_ms"] = 0.0

        # Step 6: Spatial Context, Time-of-Day & ROI Evaluation
        tod = get_time_of_day(datetime.now(timezone.utc))
        rois = camera_rois or config.CAMERA_ROIS.get(camera_id, [])
        contextual_detections = evaluate_roi_matches(raw_detections, rois)

        detected_labels = {d["label"] for d in contextual_detections}
        matched_rois = [roi for d in contextual_detections for roi in d.get("matched_rois", [])]

        detection_level, risk_level = evaluate_contextual_threat(
            detected_labels,
            time_of_day=tod,
            geofence_status=geofence_status,
            matched_rois=matched_rois,
        )

        total_ms = round((time.perf_counter() - t_start) * 1000, 2)
        timings["total_ms"] = total_ms

        peak_conf = max((d["confidence"] for d in contextual_detections), default=0.0)
        label_summary = ", ".join(sorted(detected_labels)) or "NO_DETECTION"

        return {
            "label": label_summary,
            "risk_level": risk_level,
            "detection_level": detection_level,
            "confidence": round(peak_conf, 4),
            "detections": contextual_detections,
            "model_version": active_model_version,
            "stage": stage_name,
            "escalated": escalated,
            "time_of_day": tod,
            "low_light_enhanced": low_light_enhanced,
            "hardware_backend": self.hardware_backend,
            "timings": timings,
        }


vision = CascadedVisionEngine()
