from datetime import datetime, timezone
import numpy as np
import pytest
from PIL import Image

from ai_service.context import (
    evaluate_contextual_threat,
    evaluate_roi_matches,
    get_time_of_day,
    point_in_bbox,
)
from ai_service.low_light import analyze_and_enhance_low_light
from ai_service.motion import MotionDetector
from ai_service.taxonomy import (
    ALL_THREAT_CLASSES,
    WILDLIFE_CLASSES,
    classify_detection_level,
    filter_detections_by_mode,
)
from ai_service.temporal import TemporalVerifier
from ai_service.tracker import ObjectTracker, Track
from ai_service.vision import CascadedVisionEngine


# ==============================================================================
# 1. Motion Detector Tests
# ==============================================================================
def test_motion_detector_static_scene():
    detector = MotionDetector(threshold=0.01)
    frame1 = np.zeros((480, 640, 3), dtype=np.uint8)
    frame2 = np.zeros((480, 640, 3), dtype=np.uint8)

    res1 = detector.evaluate(frame1)
    # First frame initializes background and permits inference on camera boot
    assert res1.has_motion is True

    res2 = detector.evaluate(frame2)
    # Identical second frame should have 0 motion and skip inference
    assert not res2.has_motion
    assert res2.score == 0.0


def test_motion_detector_significant_motion():
    detector = MotionDetector(threshold=0.01)
    frame1 = np.zeros((480, 640, 3), dtype=np.uint8)
    frame2 = np.zeros((480, 640, 3), dtype=np.uint8)
    frame2[100:300, 100:300] = 255

    detector.evaluate(frame1)
    res2 = detector.evaluate(frame2)
    assert res2.has_motion is True
    assert res2.score > 0.01


def test_motion_detector_reset():
    detector = MotionDetector()
    frame = np.ones((200, 200, 3), dtype=np.uint8) * 100
    detector.evaluate(frame)
    assert detector.background is not None

    detector.reset()
    assert detector.background is None


# ==============================================================================
# 2. Taxonomy & Mode Separation Tests
# ==============================================================================
def test_anti_poaching_mode_filters_animals():
    detections = [
        {"label": "person", "confidence": 0.85, "bbox": [10, 10, 50, 50]},
        {"label": "elephant", "confidence": 0.90, "bbox": [100, 100, 200, 200]},
        {"label": "zebra", "confidence": 0.80, "bbox": [50, 50, 80, 80]},
        {"label": "truck", "confidence": 0.75, "bbox": [200, 200, 300, 300]},
    ]

    filtered_ap = filter_detections_by_mode(detections, mode="ANTI_POACHING")
    labels_ap = [d["label"] for d in filtered_ap]
    assert "person" in labels_ap
    assert "truck" in labels_ap
    assert "elephant" not in labels_ap
    assert "zebra" not in labels_ap


def test_wildlife_monitoring_mode_includes_animals():
    detections = [
        {"label": "person", "confidence": 0.85, "bbox": [10, 10, 50, 50]},
        {"label": "elephant", "confidence": 0.90, "bbox": [100, 100, 200, 200]},
    ]

    filtered_wm = filter_detections_by_mode(detections, mode="WILDLIFE_MONITORING")
    labels_wm = [d["label"] for d in filtered_wm]
    assert "person" in labels_wm
    assert "elephant" in labels_wm


def test_classify_detection_levels():
    assert classify_detection_level({"firearm"})[0] == "THREAT"
    assert classify_detection_level({"chainsaw"})[0] == "THREAT"
    assert classify_detection_level({"person"})[0] == "SUSPICIOUS"
    assert classify_detection_level({"car"})[0] == "SUSPICIOUS"
    assert classify_detection_level({"elephant"})[0] == "BENIGN"
    assert classify_detection_level(set())[0] == "BENIGN"
    assert classify_detection_level({"elephant"}, mode="WILDLIFE_MONITORING") == ("BENIGN", "MONITORED")


# ==============================================================================
# 3. Low-Light CLAHE Tests
# ==============================================================================
def test_analyze_and_enhance_low_light():
    # Dark frame
    dark_frame = np.ones((100, 100, 3), dtype=np.uint8) * 20
    enhanced_dark, was_enhanced, lum_dark = analyze_and_enhance_low_light(
        dark_frame, luminance_threshold=45.0
    )
    assert was_enhanced is True
    assert lum_dark < 45.0
    assert np.mean(np.array(enhanced_dark)) >= np.mean(dark_frame)

    # Bright frame
    bright_frame = np.ones((100, 100, 3), dtype=np.uint8) * 150
    enhanced_bright, was_bright_enhanced, lum_bright = analyze_and_enhance_low_light(
        bright_frame, luminance_threshold=45.0
    )
    assert was_bright_enhanced is False
    assert lum_bright >= 45.0


# ==============================================================================
# 4. Tracker & Temporal Verifier Tests
# ==============================================================================
def test_tracker_multi_target_and_confirmation():
    tracker = ObjectTracker(confirmation_hits=3, window_seconds=2.0)

    # Frame 1: Person at [10, 10, 50, 50]
    det1 = [{"label": "person", "confidence": 0.8, "bbox": [10, 10, 50, 50], "kind": "object"}]
    tracked1 = tracker.update(det1, timestamp=100.0)
    assert len(tracked1) == 1
    assert tracked1[0].confirmed is False
    assert tracked1[0].hits == 1

    # Frame 2: Same person slightly shifted
    det2 = [{"label": "person", "confidence": 0.85, "bbox": [12, 12, 52, 52], "kind": "object"}]
    tracked2 = tracker.update(det2, timestamp=100.5)
    assert tracked2[0].confirmed is False
    assert tracked2[0].hits == 2

    # Frame 3: Same person
    det3 = [{"label": "person", "confidence": 0.88, "bbox": [14, 14, 54, 54], "kind": "object"}]
    tracked3 = tracker.update(det3, timestamp=101.0)
    assert tracked3[0].confirmed is True
    assert tracked3[0].hits == 3


def test_temporal_verifier():
    verifier = TemporalVerifier(min_frames=3, window_seconds=2.0, min_avg_confidence=0.5)

    # Track with 1 hit -> CANDIDATE
    trk1 = Track(
        track_id="t1",
        label="person",
        kind="object",
        first_seen=10.0,
        last_seen=10.0,
        hits=1,
        confidence_history=[0.7],
        current_confidence=0.7,
        current_bbox=[10, 10, 50, 50],
    )
    assert verifier.evaluate_track(trk1) == "CANDIDATE"

    # Track with 3 hits -> CONFIRMED
    trk2 = Track(
        track_id="t2",
        label="person",
        kind="object",
        first_seen=10.0,
        last_seen=11.0,
        hits=3,
        confidence_history=[0.7, 0.75, 0.8],
        current_confidence=0.8,
        current_bbox=[10, 10, 50, 50],
    )
    assert verifier.evaluate_track(trk2) == "CONFIRMED"

    # High confidence immediate override
    trk3 = Track(
        track_id="t3",
        label="firearm",
        kind="object",
        first_seen=10.0,
        last_seen=10.0,
        hits=1,
        confidence_history=[0.95],
        current_confidence=0.95,
        current_bbox=[10, 10, 50, 50],
    )
    assert verifier.evaluate_track(trk3) == "CONFIRMED"


# ==============================================================================
# 5. Context Evaluator Tests
# ==============================================================================
def test_time_of_day_classification():
    dt_night = datetime(2026, 1, 1, 2, 0, tzinfo=timezone.utc)
    dt_dawn = datetime(2026, 1, 1, 6, 0, tzinfo=timezone.utc)
    dt_day = datetime(2026, 1, 1, 12, 0, tzinfo=timezone.utc)
    dt_dusk = datetime(2026, 1, 1, 19, 0, tzinfo=timezone.utc)

    assert get_time_of_day(dt_night) == "night"
    assert get_time_of_day(dt_dawn) == "dawn"
    assert get_time_of_day(dt_day) == "day"
    assert get_time_of_day(dt_dusk) == "dusk"


def test_point_in_bbox():
    bbox = [100, 100, 200, 200]
    assert point_in_bbox((150, 150), bbox) is True
    assert point_in_bbox((50, 50), bbox) is False


def test_roi_matches():
    camera_rois = [
        {"name": "Restricted Gate", "type": "restricted", "bbox": [0, 0, 320, 480]},
        {"name": "Access Road", "type": "road", "bbox": [320, 0, 640, 480]},
    ]
    detections = [
        {"label": "person", "bbox": [50, 50, 100, 150]},
        {"label": "car", "bbox": [400, 200, 500, 300]},
    ]
    tagged = evaluate_roi_matches(detections, camera_rois)
    assert "Restricted Gate" in tagged[0]["matched_rois"]
    assert "Access Road" in tagged[1]["matched_rois"]


def test_contextual_threat_evaluation():
    # Daytime person in BUFFER -> SUSPICIOUS, MEDIUM
    level, threat = evaluate_contextual_threat(
        labels={"person"},
        time_of_day="day",
        geofence_status="BUFFER",
    )
    assert level == "SUSPICIOUS"
    assert threat == "MEDIUM"

    # Night person in CORE -> THREAT, CRITICAL
    level, threat = evaluate_contextual_threat(
        labels={"person"},
        time_of_day="night",
        geofence_status="CORE",
    )
    assert level == "THREAT"
    assert threat == "CRITICAL"

    # Firearm anywhere -> THREAT, CRITICAL
    level, threat = evaluate_contextual_threat(
        labels={"firearm"},
        time_of_day="day",
        geofence_status="BUFFER",
    )
    assert level == "THREAT"
    assert threat == "CRITICAL"


# ==============================================================================
# 6. Cascaded Vision Engine Integration Tests
# ==============================================================================
def test_cascaded_engine_motion_skip():
    engine = CascadedVisionEngine()
    
    class MockResult:
        boxes = []

    # Mock YOLO returning [MockResult]
    engine.nano_model = lambda img, **kwargs: [MockResult()]
    engine.ready = True

    static_frame = Image.new("RGB", (320, 240), color="black")
    # First call sets background
    r1 = engine.predict(static_frame, camera_id="CAM_TEST_1", skip_motion_check=False)
    # Second call on identical static frame should trigger motion skip
    r2 = engine.predict(static_frame, camera_id="CAM_TEST_1", skip_motion_check=False)
    assert r2["stage"] == "STAGE_0_MOTION_FILTER"
    assert r2["skipped_motion"] is True
    assert r2["detections"] == []
