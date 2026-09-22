"""Temporal verification engine.

Prevents transient single-frame glitches from generating alerts.
Requires multi-frame persistence within a configurable sliding window before declaring an incident.
"""

from typing import Literal
from ai_service.tracker import Track

ConfirmationStatus = Literal["UNCONFIRMED", "CANDIDATE", "CONFIRMED"]


class TemporalVerifier:
    def __init__(
        self,
        min_frames: int = 3,
        window_seconds: float = 5.0,
        min_avg_confidence: float = 0.40,
        immediate_override_confidence: float = 0.92,
    ):
        self.min_frames = min_frames
        self.window_seconds = window_seconds
        self.min_avg_confidence = min_avg_confidence
        self.immediate_override_confidence = immediate_override_confidence

    def evaluate_track(self, track: Track) -> ConfirmationStatus:
        """Evaluate a track's temporal persistence."""
        # Immediate confirmation for high-confidence dangerous sightings
        if track.peak_confidence >= self.immediate_override_confidence:
            return "CONFIRMED"

        # Check persistence within the time window
        if track.hits >= self.min_frames and track.duration_seconds <= self.window_seconds:
            if track.average_confidence >= self.min_avg_confidence:
                return "CONFIRMED"

        if track.hits >= 1:
            return "CANDIDATE"

        return "UNCONFIRMED"

    def filter_confirmed_detections(self, tracks: list[Track]) -> list[dict]:
        """Convert confirmed tracks back to standard detection dicts."""
        confirmed_detections = []
        for track in tracks:
            status = self.evaluate_track(track)
            if status == "CONFIRMED":
                confirmed_detections.append(
                    {
                        "label": track.label,
                        "confidence": round(track.peak_confidence, 4),
                        "bbox": track.current_bbox,
                        "kind": track.kind,
                        "track_id": track.track_id,
                        "hits": track.hits,
                    }
                )
        return confirmed_detections

