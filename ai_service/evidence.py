"""Multimodal Evidence Accumulation Timeline for Wildlife Sentinel.

Maintains an evolving timeline of sensory cues:
- Visual detections (person, vehicle, firearm, chainsaw)
- Acoustic events (gunshot, chainsaw, vehicle engine)
- Behavioral cues (boundary approach, lingering)
Computes cumulative evidence score E(t) with exponential temporal decay.
"""

from dataclasses import dataclass, field
import math
import time
from typing import Literal

ModalityType = Literal["vision", "audio", "behavior", "spatial"]

# Canonical category weights reflecting anti-poaching severity
CATEGORY_WEIGHTS: dict[str, float] = {
    "firearm": 1.0,
    "rifle": 1.0,
    "chainsaw": 0.95,
    "gunshot": 1.0,
    "snare": 0.90,
    "hunting_equipment": 0.85,
    "person": 0.70,
    "truck": 0.65,
    "car": 0.60,
    "motorcycle": 0.60,
    "boat": 0.65,
    "boundary_approach": 0.75,
    "lingering_vehicle": 0.70,
    "loitering": 0.60,
    "nocturnal_group": 0.80,
    "acoustic_anomaly": 0.50,
}


@dataclass
class EvidenceItem:
    timestamp: float
    sensor_id: str
    modality: ModalityType
    label: str
    confidence: float
    weight: float
    metadata: dict = field(default_factory=dict)

    @property
    def raw_score(self) -> float:
        return self.weight * self.confidence


class EvidenceTimeline:
    def __init__(
        self,
        window_seconds: float = 60.0,
        half_life_seconds: float = 20.0,
        incident_threshold: float = 1.25,
    ):
        self.window_seconds = window_seconds
        self.half_life_seconds = half_life_seconds
        self.incident_threshold = incident_threshold
        self.items: list[EvidenceItem] = []

    def add(
        self,
        sensor_id: str,
        modality: ModalityType,
        label: str,
        confidence: float,
        timestamp: float | None = None,
        weight: float | None = None,
        metadata: dict | None = None,
    ) -> EvidenceItem:
        now = time.monotonic() if timestamp is None else timestamp
        assigned_weight = weight if weight is not None else CATEGORY_WEIGHTS.get(label.lower(), 0.50)

        item = EvidenceItem(
            timestamp=now,
            sensor_id=sensor_id,
            modality=modality,
            label=label,
            confidence=float(confidence),
            weight=assigned_weight,
            metadata=metadata or {},
        )
        self.items.append(item)
        self.prune(now)
        return item

    def prune(self, current_time: float | None = None):
        """Remove observations older than window_seconds."""
        now = time.monotonic() if current_time is None else current_time
        cutoff = now - self.window_seconds
        self.items = [item for item in self.items if item.timestamp >= cutoff]

    def compute_cumulative_score(self, current_time: float | None = None) -> float:
        """Compute E(t) = sum(w_i * c_i * exp(-lambda * delta_t))."""
        now = time.monotonic() if current_time is None else current_time
        self.prune(now)
        decay_constant = math.log(2.0) / max(1.0, self.half_life_seconds)

        total_evidence = 0.0
        for item in self.items:
            delta_t = max(0.0, now - item.timestamp)
            decay = math.exp(-decay_constant * delta_t)
            total_evidence += item.raw_score * decay

        return round(total_evidence, 3)

    def is_incident_ready(self, current_time: float | None = None) -> bool:
        """True if accumulated evidence crosses operational incident threshold."""
        return self.compute_cumulative_score(current_time) >= self.incident_threshold

    def get_summary(self, current_time: float | None = None) -> dict:
        now = time.monotonic() if current_time is None else current_time
        score = self.compute_cumulative_score(now)
        modalities_present = sorted(list({item.modality for item in self.items}))
        labels_present = sorted(list({item.label for item in self.items}))

        timeline_records = [
            {
                "time_offset_s": round(now - item.timestamp, 1),
                "sensor": item.sensor_id,
                "modality": item.modality,
                "label": item.label,
                "confidence": round(item.confidence, 2),
                "weight": round(item.weight, 2),
            }
            for item in sorted(self.items, key=lambda x: x.timestamp)
        ]

        return {
            "cumulative_evidence_score": score,
            "incident_threshold": self.incident_threshold,
            "incident_triggered": score >= self.incident_threshold,
            "modalities": modalities_present,
            "distinct_cues": labels_present,
            "evidence_item_count": len(self.items),
            "timeline": timeline_records,
        }

    def clear(self):
        self.items.clear()

