from datetime import datetime, timezone
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sentinel_config import CAMERA_IDS

Risk = Literal[
    "LOW",
    "MONITORED",
    "MEDIUM",
    "HIGH",
    "CRITICAL",
    "UNKNOWN",
    "MODEL_ERROR",
    "SENSOR_ERROR",
    "UNAVAILABLE",
    "INPUT_ERROR",
]
Confidence = Annotated[float, Field(ge=0, le=1, allow_inf_nan=False)]
Latitude = Annotated[float, Field(ge=-90, le=90, allow_inf_nan=False)]
Longitude = Annotated[float, Field(ge=-180, le=180, allow_inf_nan=False)]


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class Location(StrictModel):
    lat: Latitude
    lng: Longitude


class SensorInput(StrictModel):
    camera_id: str = "CAM_MANUAL_FEED"
    latitude: Latitude = 12.9698
    longitude: Longitude = 79.1559

    @field_validator("camera_id")
    @classmethod
    def registered_camera(cls, value):
        if value not in CAMERA_IDS:
            raise ValueError("Camera is not registered")
        return value


class Detection(StrictModel):
    label: str = Field(min_length=1, max_length=100)
    confidence: Confidence
    bbox: list[float] | None = Field(default=None, min_length=4, max_length=4)
    kind: Literal["species", "object", "audio"] = "object"

    @field_validator("bbox")
    @classmethod
    def valid_box(cls, value):
        if value is not None and (
            min(value) < 0 or value[2] <= value[0] or value[3] <= value[1]
        ):
            raise ValueError("Invalid bounding box")
        return value


class Telemetry(SensorInput):
    threat_level: Risk
    detections: list[Detection] = Field(default_factory=list, max_length=100)
    modality: Literal["Vision", "Audio", "Video", "Fused"] = "Vision"
    vision_confidence: Confidence | None = None
    audio_confidence: Confidence | None = None
    max_confidence: Confidence | None = None
    model_versions: dict[str, str] = Field(default_factory=dict, max_length=3)
    observed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    @field_validator("observed_at")
    @classmethod
    def aware_time(cls, value):
        if value.tzinfo is None:
            raise ValueError("Timestamp must include timezone")
        return value.astimezone(timezone.utc)

    @model_validator(mode="after")
    def confidence_summary(self):
        values = [
            x for x in (self.vision_confidence, self.audio_confidence) if x is not None
        ]
        expected = max(
            values, default=max((d.confidence for d in self.detections), default=0)
        )
        if (
            self.max_confidence is not None
            and abs(self.max_confidence - expected) > 1e-6
        ):
            raise ValueError("max_confidence must be the maximum modality confidence")
        self.max_confidence = expected
        if (
            self.threat_level in {"MONITORED", "MEDIUM", "HIGH", "CRITICAL"}
            and not self.detections
        ):
            raise ValueError("Event risk requires detections")
        return self


class HQ(Location):
    name: str = Field(min_length=1, max_length=100)


class SettingsPayload(StrictModel):
    confidence_threshold: Confidence | None = None
    geofence_core_radius_m: int | None = Field(default=None, gt=0, le=1_000_000)
    response_speed_kmh: float | None = Field(default=None, gt=0, le=150)
    ranger_hq: HQ | None = None
    remote_streams: dict[str, bool] | None = None


class RangerFeedbackPayload(StrictModel):
    feedback_type: Literal[
        "TRUE_THREAT",
        "FALSE_POSITIVE",
        "AUTHORIZED_PERSON",
        "AUTHORIZED_VEHICLE",
        "UNCERTAIN",
    ]
    ranger_id: str = Field(default="ranger_default", min_length=1, max_length=100)
    notes: str = Field(default="", max_length=500)

