# Wildlife Sentinel — API Contract

## Services

| Service | Base URL |
|---|---|
| Backend | `http://localhost:5000` |
| Audio AI Service | `http://localhost:5001` |
| WebSocket | `ws://localhost:5000/ws/alerts` |

---

## Backend API (`localhost:5000`)

### `GET /health`
Returns service liveness status.
```json
{ "status": "ok", "service": "wildlife-sentinel-backend", "model": "yolov8x.pt" }
```

---

### `POST /api/detect`
Single image YOLO detection.

**Request** — `multipart/form-data`
| Field | Type | Default | Description |
|---|---|---|---|
| `image` | file | required | JPG/PNG camera frame |
| `camera_id` | string | `CAM_01` | Camera node ID |
| `latitude` | float | `12.9698` | GPS latitude |
| `longitude` | float | `79.1559` | GPS longitude |
| `enhance_night_vision` | bool | `false` | Apply CLAHE low-light enhancement |

**Response**
```json
{
  "id": "alert_1234567890",
  "camera_id": "CAM_NORTH_01",
  "timestamp": "2026-08-29T06:00:00Z",
  "location": { "lat": 12.9716, "lng": 79.1585 },
  "detections": [
    { "label": "elephant", "confidence": 0.91, "bbox": [x1, y1, x2, y2] }
  ],
  "threat_level": "MONITORED",
  "resolved": false,
  "annotated_image": "data:image/jpeg;base64,..."
}
```

---

### `POST /api/detect/video`
Video clip frame-by-frame detection.

**Request** — `multipart/form-data`
| Field | Type | Default |
|---|---|---|
| `video` | file | required |
| `camera_id` | string | `CAM_VIDEO_CCTV` |
| `latitude` | float | `12.9680` |
| `longitude` | float | `79.1620` |
| `sample_rate` | int | `1` (1 frame/sec) |

**Response**
```json
{
  "status": "success",
  "processed_frames": 120,
  "detections_found": 3,
  "incidents": [ ...alert objects... ]
}
```

---

### `POST /api/edge/telemetry`
Accepts pre-fused risk from the AI Service pipeline. Persists to DB and broadcasts via WebSocket.

**Request** — JSON body
```json
{
  "camera_id": "CAM_AI_PIPELINE",
  "latitude": 12.9716,
  "longitude": 79.1585,
  "threat_level": "HIGH",
  "detected_classes": ["elephant", "VEHICLE_APPROACH"],
  "max_confidence": 0.91
}
```

**Response**
```json
{ "status": "received", "alert_id": "lora_1234567890" }
```

---

### `GET /api/alerts`
Returns all stored alerts ordered by timestamp descending.

---

### `GET /api/alerts/filter`
Filter alerts by query params.

| Param | Type | Example |
|---|---|---|
| `threat_level` | string | `CRITICAL` |
| `camera_id` | string | `CAM_NORTH_01` |
| `resolved` | bool | `false` |

---

### `POST /api/alerts/{alert_id}/resolve`
Marks an alert as resolved.

---

### `DELETE /api/alerts/clear`
Wipes all alerts from the database.

---

### `GET /api/stats`
```json
{
  "total_events": 42,
  "critical_intrusions": 3,
  "high_threats": 7,
  "wildlife_sightings": 18,
  "active_camera_nodes": 3,
  "total_camera_nodes": 4
}
```

---

### `GET /api/cameras`
Returns the list of all camera node configs (id, name, GPS, status, battery).

---

### `GET /api/map/reserve`
Returns geofence config and camera positions for the map view.

---

### `GET /api/analytics`
Returns species distribution and threat severity breakdown.

---

### `WS /ws/alerts`
Real-time WebSocket stream. Emits on every new detection.

**Message format**
```json
{
  "type": "NEW_ALERT",
  "data": { ...alert object... }
}
```

---

## Audio AI Service API (`localhost:5001`)

### `GET /health`
```json
{ "status": "ok", "service": "wildlife-sentinel-audio", "version": "2.0.0" }
```

---

### `POST /api/audio/classify`
Audio-only WAV classification.

**Request** — `multipart/form-data`
| Field | Type | Description |
|---|---|---|
| `audio` | file | `.wav` file |

**Response**
```json
{
  "filename": "test.wav",
  "label": "VEHICLE_APPROACH",
  "risk_level": "HIGH",
  "features": {
    "sample_rate": 44100,
    "duration": 6.0,
    "rms": 0.18,
    "dominant_frequency": 320.5,
    "high_frequency_ratio": 0.12
  }
}
```

---

### `POST /api/audio/pipeline`
**The full fused pipeline orchestrator.** Accepts an image + audio pair, runs YOLO + acoustic classification, fuses with risk engine, dispatches telemetry to backend if HIGH/CRITICAL.

**Request** — `multipart/form-data`
| Field | Type | Default | Description |
|---|---|---|---|
| `image` | file | required | Camera trap image |
| `audio` | file | required | `.wav` acoustic file |
| `camera_id` | string | `CAM_AI_PIPELINE` | Camera node ID |
| `latitude` | float | `12.9698` | GPS latitude |
| `longitude` | float | `79.1559` | GPS longitude |

**Response**
```json
{
  "pipeline": "FULL_FUSION",
  "camera_id": "CAM_NORTH_01",
  "location": { "lat": 12.9716, "lng": 79.1585 },
  "vision": {
    "label": "elephant",
    "risk_level": "MONITORED",
    "detections": [...],
    "annotated_image": "data:image/jpeg;base64,..."
  },
  "audio": {
    "label": "VEHICLE_APPROACH",
    "risk_level": "HIGH",
    "features": {...}
  },
  "combined_risk": "HIGH",
  "risk_breakdown": {
    "vision_detection": "elephant",
    "vision_risk": "MONITORED",
    "audio_detection": "VEHICLE_APPROACH",
    "audio_risk": "HIGH",
    "combined_risk": "HIGH"
  },
  "alert_dispatched": true,
  "alert_id": "lora_1234567890",
  "frontend_notified": true
}
```

---

### `GET /api/audio/labels`
Returns all possible audio classification labels with risk mappings.

---

## Threat Level Reference

| Level | Score | Triggered By |
|---|---|---|
| `CRITICAL` | 4 | Both vision AND audio ≥ HIGH |
| `HIGH` | 3 | Person detected, OR vehicle, OR HIGH audio alone |
| `MEDIUM` | 2 | Human activity audio, OR medium vision |
| `MONITORED` | 1 | Wildlife sighting |
| `LOW` | 0 | Normal ambient environment |
