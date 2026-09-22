"""Lightweight edge multi-target object tracker.

Maintains track state across video frames using spatial IoU and centroid associations.
Prevents repeated Stage 2 escalation for already confirmed targets.
"""

import time
from dataclasses import dataclass, field
from uuid import uuid4


def compute_iou(box_a: list[float], box_b: list[float]) -> float:
    """Compute Intersection over Union between two [x1, y1, x2, y2] bounding boxes."""
    if not box_a or not box_b or len(box_a) < 4 or len(box_b) < 4:
        return 0.0
    x1 = max(box_a[0], box_b[0])
    y1 = max(box_a[1], box_b[1])
    x2 = min(box_a[2], box_b[2])
    y2 = min(box_a[3], box_b[3])

    intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    area_a = max(0.0, box_a[2] - box_a[0]) * max(0.0, box_a[3] - box_a[1])
    area_b = max(0.0, box_b[2] - box_b[0]) * max(0.0, box_b[3] - box_b[1])
    union = area_a + area_b - intersection

    return intersection / union if union > 0 else 0.0


@dataclass
class Track:
    track_id: str
    label: str
    kind: str
    first_seen: float
    last_seen: float
    hits: int = 1
    misses: int = 0
    confirmed: bool = False
    escalated_once: bool = False
    confidence_history: list[float] = field(default_factory=list)
    bbox_history: list[list[float]] = field(default_factory=list)
    current_bbox: list[float] = field(default_factory=list)
    current_confidence: float = 0.0

    @property
    def average_confidence(self) -> float:
        return sum(self.confidence_history) / len(self.confidence_history) if self.confidence_history else 0.0

    @property
    def peak_confidence(self) -> float:
        return max(self.confidence_history) if self.confidence_history else 0.0

    @property
    def duration_seconds(self) -> float:
        return max(0.0, self.last_seen - self.first_seen)


class ObjectTracker:
    def __init__(
        self,
        iou_threshold: float = 0.30,
        max_misses: int = 5,
        confirmation_hits: int = 3,
        window_seconds: float = 5.0,
    ):
        self.iou_threshold = iou_threshold
        self.max_misses = max_misses
        self.confirmation_hits = confirmation_hits
        self.window_seconds = window_seconds
        self.tracks: dict[str, Track] = {}

    def reset(self):
        """Clear all active tracks."""
        self.tracks.clear()

    def update(self, detections: list[dict], timestamp: float | None = None) -> list[Track]:
        """Update active tracks with new frame detections.
        
        detections: list of dicts with keys: 'label', 'confidence', 'bbox', 'kind'
        Returns list of active confirmed tracks.
        """
        now = time.monotonic() if timestamp is None else timestamp
        matched_track_ids = set()
        unmatched_detections = []

        # Association stage: Match detections to existing tracks of same label with highest IoU
        for det in detections:
            bbox = det.get("bbox")
            label = det.get("label", "")
            conf = float(det.get("confidence", 0.0))
            kind = det.get("kind", "object")

            best_iou = 0.0
            best_track_id = None

            for trk_id, trk in self.tracks.items():
                if trk_id in matched_track_ids or trk.label != label:
                    continue
                iou = compute_iou(bbox, trk.current_bbox)
                if iou > self.iou_threshold and iou > best_iou:
                    best_iou = iou
                    best_track_id = trk_id

            if best_track_id is not None:
                matched_track_ids.add(best_track_id)
                trk = self.tracks[best_track_id]
                trk.last_seen = now
                trk.hits += 1
                trk.misses = 0
                trk.current_bbox = bbox
                trk.current_confidence = conf
                trk.confidence_history.append(conf)
                trk.bbox_history.append(bbox)
                if len(trk.confidence_history) > 30:
                    trk.confidence_history.pop(0)
                    trk.bbox_history.pop(0)
                if trk.hits >= self.confirmation_hits:
                    trk.confirmed = True
            else:
                unmatched_detections.append(det)

        # Create new tracks for unmatched detections
        for det in unmatched_detections:
            trk_id = f"trk_{uuid4().hex[:8]}"
            conf = float(det.get("confidence", 0.0))
            bbox = det.get("bbox", [])
            new_trk = Track(
                track_id=trk_id,
                label=det.get("label", "unknown"),
                kind=det.get("kind", "object"),
                first_seen=now,
                last_seen=now,
                hits=1,
                misses=0,
                confirmed=(self.confirmation_hits <= 1),
                confidence_history=[conf],
                bbox_history=[bbox],
                current_bbox=bbox,
                current_confidence=conf,
            )
            self.tracks[trk_id] = new_trk

        # Prune stale tracks
        stale_ids = []
        for trk_id, trk in self.tracks.items():
            if trk_id not in matched_track_ids and trk not in unmatched_detections:
                trk.misses += 1
                if trk.misses > self.max_misses or (now - trk.last_seen > self.window_seconds):
                    stale_ids.append(trk_id)

        for trk_id in stale_ids:
            self.tracks.pop(trk_id, None)

        return list(self.tracks.values())

    def get_active_tracks(self) -> list[Track]:
        return list(self.tracks.values())

    def get_confirmed_tracks(self) -> list[Track]:
        return [t for t in self.tracks.values() if t.confirmed]

    def has_unconfirmed_candidates(self) -> bool:
        """True if there are active candidates not yet confirmed."""
        return any(not t.confirmed and not t.escalated_once for t in self.tracks.values())

