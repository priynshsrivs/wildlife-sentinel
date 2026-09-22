# Wildlife Sentinel — API Contract & Specification

## 1. Services Architecture & Ports

| Service | Base URL | Protocol | Role |
|---|---|---|---|
| **Backend API** | `http://127.0.0.1:8000` | HTTP/REST, WebSocket | Core API, YOLOv8 vision, incident persistence, WebSocket push, dispatch |
| **Audio AI Service** | `http://127.0.0.1:5001` | HTTP/REST | YAMNet acoustic classification, paired multimodal fusion orchestration |
| **Frontend Dashboard** | `http://127.0.0.1:5173` | HTTP (Vite Dev Server) | Modular React dashboard, real-time map, alert feed, telemetry monitoring |
| **Camera MJPEG Server** | `http://127.0.0.1:8080` | HTTP/MJPEG (Waitress) | Authenticated local camera hardware streamer with single producer |
| **WebSocket Alerts** | `ws://127.0.0.1:8000/ws/alerts` | WebSocket | Authenticated single-use ticket real-time alert distribution with ACK |

---

## 2. Authentication & Authorization

All API endpoints (except `/health` and MJPEG root) require authentication via Bearer token:
```http
Authorization: Bearer <API_TOKEN>
```

### Roles & Permissions

- **`viewer`**: Read-only access to alerts, cameras, statistics, analytics, and settings.
- **`operator`**: Everything in `viewer`, plus detection ingestion (`/api/detect`, `/api/detect/video`, `/api/detect/audio`), edge telemetry (`/api/edge/telemetry`), alert resolution (`/api/alerts/{id}/resolve`), and audio pipeline runs.
- **`admin`**: Full access, including system configuration (`POST /api/settings`) and alert database clearing (`DELETE /api/alerts/clear`).
- **`service`**: Dedicated machine-to-machine token for internal communication between the Audio AI service and the Backend API.

### WebSocket Ticket Authentication

To prevent exposing credentials in WebSocket URLs, connection uses short-lived, single-use tickets:
1. Client requests a ticket: `POST /api/auth/ws-ticket` with standard Bearer authorization header.
2. Server responds with: `{ "ticket": "<32_byte_token>", "expires_in": 30 }`.
3. Client establishes WebSocket: `ws://127.0.0.1:8000/ws/alerts?ticket=<ticket>`.
4. The ticket is immediately consumed upon connection and cannot be replayed.

---

## 3. Threat Levels & Risk Engine Policy

### Risk Levels

| Level | Score | Primary Triggers | System Action |
|---|---|---|---|
| `CRITICAL` | 4 | Person detected, or both Vision AND Audio are HIGH/CRITICAL | Immediate ranger dispatch queued + WebSocket broadcast |
| `HIGH` | 3 | Vehicle detected, or high-threat acoustic event (Gunshot, Chainsaw, Explosion) | Ranger dispatch queued + WebSocket broadcast |
| `MEDIUM` | 2 | Suspicious human activity or acoustic anomaly | Persisted & logged |
| `MONITORED` | 1 | Verified wildlife sightings (elephant, zebra, giraffe, bird, etc.) | Persisted & logged |
| `LOW` | 0 | Ambient environment, wind, rain, rustling leaves, no detections | Not persisted (filtered at edge) |

### Sensor & Model Failure States

Sensor failures and model exceptions are **never converted into LOW risk**:
- `UNKNOWN`: Unclassified signal or confidence below threshold.
- `MODEL_ERROR`: Machine learning model unavailable, crashed, or corrupted.
- `SENSOR_ERROR`: Unreadable or malformed audio/video/image stream.
- `UNAVAILABLE`: Microservice endpoint unreachable or connection timed out.
- `INPUT_ERROR`: Payload exceeds byte limits, invalid coordinates, or unsupported codec.

### Risk Breakdown Schema
Multimodal fusion returns explicit, unmerged confidence and risk metrics:
```json
{
  "vision_detection": "person",
  "audio_detection": "Chainsaw",
  "vision_risk": "CRITICAL",
  "audio_risk": "HIGH",
  "vision_confidence": 0.92,
  "audio_confidence": 0.88,
  "max_confidence": 0.92,
  "combined_risk": "CRITICAL",
  "degraded": false,
  "risk_engine_version": "fusion-2"
}
```

---

## 4. Backend API Endpoints (`127.0.0.1:8000`)

### `GET /health`
Liveness and readiness check. Unauthenticated.
```json
{
  "status": "ready",
  "vision_ready": true,
  "vision_model_version": "yolo-3df4ada6b4dad6d6",
  "service": "backend"
}
```

### `GET /api/auth/me`
Inspect caller role.
- **Authorization**: Any valid token.
- **Response**: `{ "role": "admin" }`

### `POST /api/auth/ws-ticket`
Issue single-use WebSocket connection ticket.
- **Authorization**: `viewer`, `operator`, or `admin`.
- **Response**: `{ "ticket": "b4a8e...", "expires_in": 30 }`

### `POST /api/detect`
Single image inference via YOLOv8.
- **Authorization**: `operator` or `admin`.
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `image`: JPEG/PNG/WebP file (max 10 MB, max 16 MP).
  - `camera_id` (string, optional, default: `"CAM_MANUAL_FEED"`): Must match registered camera IDs.
  - `latitude` (float, optional, default: `12.9698`): Range [-90, 90].
  - `longitude` (float, optional, default: `79.1559`): Range [-180, 180].
  - `persist` (bool, optional, default: `true`): Whether detections should be clustered and saved to the database.
- **Response**:
```json
{
  "label": "person",
  "risk_level": "CRITICAL",
  "confidence": 0.91,
  "detections": [
    { "label": "person", "confidence": 0.91, "bbox": [10.0, 20.0, 150.0, 300.0], "kind": "object" }
  ],
  "model_version": "yolo-3df4ada6b4dad6d6",
  "threat_level": "CRITICAL",
  "accepted": true,
  "persisted": true,
  "alert_id": "a9d7...",
  "created": true,
  "broadcast_count": 1,
  "frontend_notified": false,
  "dispatch_status": "queued",
  "annotated_image": null
}
```

### `POST /api/detect/video`
Video clip frame sampling and incident clustering.
- **Authorization**: `operator` or `admin`.
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `video`: MP4/AVI/MOV/WebM (max 100 MB, max 120s, max 7200 frames).
  - `camera_id` (string): Registered camera ID.
  - `latitude` (float), `longitude` (float).
  - `sample_rate` (float, default: `2.0`): 1.0 to 30.0.
- **Response**:
```json
{
  "status": "success",
  "decoded_frames": 120,
  "processed_frames": 60,
  "fps": 30.0,
  "duration_seconds": 4.0,
  "detections_found": 12,
  "incidents": [ ...clustered alert objects... ]
}
```

### `POST /api/detect/audio`
Audio clip classification via proxy to Audio AI service with telemetry ingestion.
- **Authorization**: `operator` or `admin`.
- **Content-Type**: `multipart/form-data`
- **Fields**:
  - `audio`: WAV/FLAC/OGG/MP3 file (max 20 MB, 0.1s to 30s).
  - `camera_id`, `latitude`, `longitude`.
- **Response**: Classification output merged with ingestion receipt.

### `POST /api/edge/telemetry`
Validated telemetry ingestion endpoint for pre-fused edge events.
- **Authorization**: `operator`, `admin`, or `service`.
- **Content-Type**: `application/json`
- **Body**:
```json
{
  "camera_id": "COMPUTER_1",
  "latitude": 12.9735,
  "longitude": 79.1585,
  "threat_level": "CRITICAL",
  "modality": "Fused",
  "vision_confidence": 0.92,
  "audio_confidence": 0.88,
  "max_confidence": 0.92,
  "detections": [
    { "label": "person", "confidence": 0.92, "kind": "object" },
    { "label": "Chainsaw", "confidence": 0.88, "kind": "audio" }
  ],
  "model_versions": { "vision": "yolo-...", "audio": "yamnet-...", "risk": "fusion-2" }
}
```
- **Response**:
```json
{
  "accepted": true,
  "persisted": true,
  "alert_id": "8f3b...",
  "created": true,
  "broadcast_count": 1,
  "frontend_notified": false,
  "dispatch_status": "queued",
  "alert": { ...incident object... }
}
```

### `GET /api/alerts`
Paginated, cursor-enabled alert queries.
- **Authorization**: `viewer`, `operator`, `admin`.
- **Query Parameters**:
  - `limit` (int, default: 100, max: 500)
  - `before` (str): Alert cursor ID
  - `after` (str): Alert cursor ID
  - `camera` (str): Filter by camera ID
  - `threat_level` (Risk): Filter by threat severity
  - `resolved` (bool): Filter by resolution status
  - `start` (datetime ISO 8601 UTC), `end` (datetime ISO 8601 UTC)
- **Response Header**: `X-Next-Cursor` contains the cursor for the next page if limit is reached.

### `GET /api/alerts/{alert_id}/image`
Retrieve JPEG image evidence associated with an incident.
- **Authorization**: `viewer`, `operator`, `admin`.
- **Response**: `image/jpeg` binary data with `Cache-Control: private, no-store`.

### `POST /api/alerts/{alert_id}/resolve`
Resolve an incident.
- **Authorization**: `operator` or `admin`.
- **Response**: `{ "status": "success", "id": "<id>", "resolved": true }`

### `DELETE /api/alerts/clear`
Wipe all alerts from the database.
- **Authorization**: `admin` only.
- **Response**: `{ "status": "cleared", "deleted": <count> }`

### `GET /api/stats`
Aggregated operational statistics.
- **Response**:
```json
{
  "total_events": 15,
  "critical_intrusions": 2,
  "high_threats": 4,
  "wildlife_sightings": 9,
  "active_camera_nodes": 3,
  "total_camera_nodes": 7,
  "dispatch": { "sent": 6, "pending": 0, "failed": 0 }
}
```

### `GET /api/cameras`
Returns camera node statuses computed from real heartbeats.
- **Status values**: `ONLINE`, `OFFLINE`, `DEGRADED`, `UNKNOWN`.

### `GET /api/cameras/{camera_id}/frame`
Fetch the latest cached frame from a registered remote camera stream.
- **Response**: `image/jpeg`

### `GET /api/analytics`
SQL-aggregated analytics separated by species, threat objects, and acoustics.
- **Response**:
```json
{
  "total_events": 15,
  "threat_distribution": { "CRITICAL": 2, "HIGH": 4, "MONITORED": 9 },
  "species_distribution": { "elephant": 5, "zebra": 4 },
  "threat_object_distribution": { "person": 2, "car": 4 },
  "audio_event_distribution": { "Chainsaw": 2, "Gunshot, gunfire": 1 },
  "modality_distribution": { "Vision": 10, "Fused": 5 },
  "hourly_activity": { "08": 2, "14": 5 },
  "most_frequent_target": "elephant"
}
```

### `GET /api/settings` & `POST /api/settings`
View and update system configuration.
- `GET`: `viewer`, `operator`, `admin`.
- `POST`: `admin` only.
- Webhook URLs are never exposed in responses (returns `discord_webhook_configured: true/false`).
- Camera streams must be provisioned and allowlisted.

### `WS /ws/alerts?ticket=<ticket>`
Real-time bidirectional WebSocket connection.
- **Incoming Messages**:
  - `{"type": "NEW_ALERT", "payload": { ...alert... }, "event_id": "..."}`
  - `{"type": "UPDATE_ALERT", "payload": { ...alert... }, "event_id": "..."}`
  - `{"type": "CLEAR_ALERTS"}`
- **Client ACK**: Client sends `{"type": "ACK", "event_id": "<event_id>"}` within 500ms so the backend can record frontend receipt.

---

## 5. Audio AI Service Endpoints (`127.0.0.1:5001`)

### `GET /health`
```json
{
  "status": "ready",
  "audio_ready": true,
  "audio_model_version": "yamnet-672af6e1e34fe15a"
}
```

### `GET /api/audio/labels`
Returns supported YAMNet acoustic labels and their risk assignments.

### `POST /api/audio/classify`
Direct acoustic inference.
- **Authorization**: `operator` or `admin`.
- **Form Data**: `audio` file.
- **Response**:
```json
{
  "label": "Chainsaw",
  "confidence": 0.89,
  "risk_level": "HIGH",
  "model_version": "yamnet-672af6e1e34fe15a"
}
```

### `POST /api/audio/pipeline`
Full fused vision + acoustic pipeline orchestrator.
- **Authorization**: `operator` or `admin`.
- **Form Data**:
  - `image`: Image file
  - `audio`: Audio file
  - `camera_id`, `latitude`, `longitude`
  - `demo` (bool, default: `false`): If true, does not persist to database or dispatch alerts.
- **Response**: Returns full fusion analysis with `risk_breakdown`, individual confidences, combined risk, and partial failure reporting (HTTP 207 on partial failure).

---

## 6. Authenticated MJPEG Server (`127.0.0.1:8080`)

- `GET /health`: Liveness and camera status.
- `GET /`: Service metadata.
- `GET /video`: Authenticated `multipart/x-mixed-replace` video stream. Requires `Authorization: Bearer <CAMERA_STREAM_TOKEN>`.
