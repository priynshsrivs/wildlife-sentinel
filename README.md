# Wildlife Sentinel 🦁

**Autonomous AI edge-threat detection, multimodal fusion, and live ranger dispatch network for wildlife sanctuaries.**

Wildlife Sentinel combines real-time **computer vision (YOLOv8)** and **acoustic event classification (YAMNet)** into an ordinal fused risk score — automatically detecting poachers, unauthorized vehicles, gunshots, chainsaws, or distressed wildlife, and dispatching alerts to field rangers with straight-line response time estimates.

---

## 1. System Architecture

```
                                  ┌────────────────────────┐
                                  │   Hardware Camera /    │
                                  │   MJPEG Stream (:8080) │
                                  └───────────┬────────────┘
                                              │ (Allowlisted IP)
                                              ▼
Camera Trap (Image/Video)  ──→  YOLO Backend (:8000)   ──→  Vision Result ──┐
                                                                            ├──→ Risk Engine ──→ Combined Risk
Microphone (Audio WAV)     ──→  Audio API    (:5001)   ──→  Audio Result  ──┘
                                                                                  │
                                                                   if HIGH / CRITICAL
                                                                                  ↓
                                                         Backend WebSocket Broadcast (:8000/ws/alerts)
                                                         + Discord Dispatch Outbox (Async Worker)
                                                                                  ↓
                                                               React Frontend Dashboard (:5173)
```

### Services & Port Assignments

- **Backend API**: `http://127.0.0.1:8000` (FastAPI, YOLOv8 vision, incident persistence, rate limits, WebSocket)
- **Audio AI Service**: `http://127.0.0.1:5001` (FastAPI, YAMNet acoustic classifier, paired fusion runner)
- **Frontend Dashboard**: `http://127.0.0.1:5173` (Vite, React, Leaflet maps, live alert feeds, telemetry stats)
- **Camera MJPEG Server**: `http://127.0.0.1:8080` (Waitress, authenticated hardware camera stream)

---

## 2. Project Structure

```
wildlife-sentinel/
├── backend/                    # FastAPI core service
│   ├── cameras.py              # Allowlisted camera connections & health monitoring
│   ├── database.py             # SQLite WAL repository, migrations, incident clustering
│   ├── dispatch.py             # Circular Haversine geofence & Discord dispatch worker
│   ├── main.py                 # REST & WebSocket endpoints
│   ├── media.py                # Upload bounds & decoded media validation
│   ├── middleware.py           # Upload size limiters
│   ├── realtime.py             # WebSocket connection manager with ACK tracking
│   ├── schemas.py              # Pydantic models & GPS validation
│   ├── security.py             # Role-based Bearer auth & single-use WS tickets
│   └── requirements.txt        # Pinned runtime dependencies
│
├── ai_service/                 # Multimodal AI fusion service
│   ├── audio/
│   │   ├── audio_api.py        # FastAPI microservice (port 5001)
│   │   ├── audio_simulator.py  # Standalone audio monitoring runner
│   │   ├── classifier.py       # Unified compatibility classifier interface
│   │   ├── test_yamnet.py      # YAMNet smoke test
│   │   ├── yamnet_classifier.py# TensorFlow / YAMNet acoustic inference
│   │   └── test.wav            # Sample WAV audio fixture
│   ├── pipeline.py             # Paired test-fixture runner
│   ├── risk_engine.py          # Ordinal risk fusion (preserves separate confidences)
│   ├── stream_simulator.py     # Loop test fixtures through fusion pipeline
│   ├── vision.py               # YOLOv8 classifier with explicit failure handling
│   └── test_samples/           # Test fixtures (poachers, wildlife)
│
├── frontend/                   # React + Vite dashboard
│   ├── src/
│   │   ├── api/client.js       # Authenticated HTTP & WebSocket client
│   │   ├── components/         # Reusable UI (AuthGate, CameraFeed, GlassButton, etc.)
│   │   ├── constants/          # Themes, colors, animations
│   │   ├── pages/              # Modular views (Dashboard, Alerts, Map, Analytics, Settings)
│   │   └── utils/              # Alert merging & deduplication utilities
│   ├── tests/                  # Frontend unit tests
│   └── package.json
│
├── scripts/                    # Development, supervisor & testing tooling
│   ├── init_env.py             # Generates secure local .env tokens
│   ├── launch.py               # Process supervisor for all local services
│   └── smoke_system.py         # End-to-end integration smoke runner
│
├── tests/                      # Pytest automated test suite (111+ tests)
│   ├── test_api.py             # API validation, endpoints, RBAC, WS tickets
│   ├── test_audio_video.py     # Audio decoding, video sampling, pipeline errors
│   ├── test_incidents.py       # Deduplication, temporal aggregation, migrations
│   ├── test_policy.py          # Risk matrix, Haversine boundaries, ETA calculations
│   └── test_security_dispatch.py# SSRF checks, rate limits, Discord retry logic
│
├── docs/
│   └── api_contract.md         # Full API specifications, schemas & contracts
├── mjpeg_server.py             # Authenticated local camera streamer
├── sentinel_config.py          # Centralized configuration & environment loader
├── start.bat                   # Windows one-click service launcher
└── pyproject.toml              # Pytest configuration
```

---

## 3. Edge Vision Pipeline & Model Cascade

```
Camera Frame
     │
     ▼
[Stage 0: Pre-Inference Motion Filter (0.24ms)]
     │
     ├── No Motion (Static Scene) ──→ Discard / Skip Compute (95% compute saved on idle)
     │
     └── Motion Detected / Tracking Active
              │
              ▼
     [Stage 1: Nano Detector (YOLO11n, 33.5ms CPU)]
              │
              ├── High Confidence Known Target ──→ Accept immediately
              ├── No Threat Classes ──────────────→ Filter / Discard
              └── Ambiguous / Medium Confidence Target
                       │
                       ▼
              [Stage 2: Escalation Detector (YOLO11s, 77.4ms CPU)]
                       │
                       ▼
              [Stage 3: Multi-Target Tracker (IoU + Centroid)]
                       │
                       ▼
              [Stage 4: Temporal Confirmation (>=3 frames in 5s)]
                       │
                       ▼
              [Stage 5: Contextual Threat Logic (Diurnal + Geofence + ROI)]
                       │
                       ▼
              Alert Dispatch (Only on Confirmed & Contextual Threats)
```

### Empirical Benchmark Results (Edge CPU)

Measured on Intel/AMD x86_64 CPU (PyTorch 2.14 / Ultralytics 8.4):

| Pipeline Stage / Model | Params | Binary Size | Mean Latency | P95 Latency | Throughput | Process RAM |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Stage 0: Motion Filter** | — | — | **0.24 ms** | **0.28 ms** | **4,230 FPS** | < 1 MB |
| **Low-Light CLAHE** | — | — | **2.90 ms** | **3.17 ms** | **345 FPS** | < 2 MB |
| **Stage 1: YOLO11n (Default)** | **2.62M** | **5.4 MB** | **33.5 ms** | **37.4 ms** | **29.9 FPS** | **157 MB** |
| **Stage 2: YOLO11s (Escalation)** | **9.46M** | **18.4 MB** | **77.4 ms** | **86.2 ms** | **12.9 FPS** | **128 MB** |
| *Legacy: YOLOv8x (Deprecated)* | *68.23M* | *130.5 MB* | *811.3 ms* | *855.7 ms* | *1.2 FPS* | *567 MB* |

### Edge Optimization Gains
- **Inference Speedup**: YOLO11n is **24.2x faster** than YOLOv8x.
- **Binary Footprint**: **24.4x smaller** storage size (5.4 MB vs 130.5 MB).
- **RAM Efficiency**: Uses **27.7%** of the memory footprint of YOLOv8x.
- **Static Filter Savings**: Pre-YOLO motion filter skips neural inference on static scenes, saving **~33.3ms per frame** (95% idle compute savings).
- **Decoupled Capture Buffer**: Latest-frame-wins circular ring buffer prevents camera lag and video stalling.

---

## 4. Threat Levels & Policy

| Level | Severity | Trigger | System Response |
|---|---|---|---|
| 🔴 `CRITICAL` | 4 | Weapon detected, or person + vehicle in restricted zone at night, or both Vision AND Audio are HIGH/CRITICAL | Immediate ranger dispatch queued + WebSocket push |
| 🟠 `HIGH` | 3 | Vehicle in reserve, person in CORE zone, or high-threat acoustic event (Gunshot, Chainsaw) | Ranger dispatch queued + WebSocket push |
| 🟡 `MEDIUM` | 2 | Suspicious human activity in buffer zone or acoustic anomaly | Logged & monitored |
| 🟢 `MONITORED` | 1 | Wildlife sightings (in `WILDLIFE_MONITORING` mode) | Logged & tracked |
| ⚪ `LOW` | 0 | Ambient environment / static scene | Edge-filtered (not stored) |

### Anti-Poaching Taxonomy vs Wildlife Separation
- **`ANTI_POACHING` Mode (Default)**: Ignores ordinary wildlife (`elephant`, `zebra`, `giraffe`, `bird`, `dog`, etc.) to conserve edge compute and eliminate false alarms. Focuses exclusively on threat targets: `person`, `car`, `motorcycle`, `truck`, `boat`, `firearm`, `chainsaw`, `snare`, `hunting_equipment`.
- **`WILDLIFE_MONITORING` Mode**: Tracks both wildlife and human activity for conservation census studies.

### Safe Failure Protocol
Failures are **never silently downgraded to LOW**:
- Unreadable audio/video → `SENSOR_ERROR`
- Model crashes/missing files → `MODEL_ERROR`
- Unreachable microservices → `UNAVAILABLE`
- Invalid payloads or coordinates → `INPUT_ERROR`
- Unrecognized signals → `UNKNOWN`

---

## 4. Quickstart

### Prerequisites
- **Python**: 3.10 - 3.13 (64-bit)
- **Node.js**: 20 LTS or 24 LTS with `npm`

### One-Click Launch (Windows)
Double-click `start.bat` or run from PowerShell:
```powershell
.\start.bat
```
`start.bat` will automatically:
1. Verify the Python virtual environment and Node.js.
2. Initialize `.env` with secure role tokens if missing.
3. Install frontend dependencies if needed.
4. Launch the Backend (8000), Audio Service (5001), and Frontend (5173).

---

### Manual Setup (Step-by-Step)

#### 1. Set Up Python Virtual Environment
```bash
# Create virtual environment
python -m venv .venv

# Activate environment
# On Windows (PowerShell):
.\.venv\Scripts\Activate.ps1
# On Linux/macOS:
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

#### 2. Generate Local Security Credentials
```bash
python -m scripts.init_env
```
This generates a local `.env` file populated with unique, secure tokens for `ADMIN_API_TOKEN`, `OPERATOR_API_TOKEN`, `VIEWER_API_TOKEN`, `SERVICE_API_TOKEN`, and `CAMERA_STREAM_TOKEN`.

#### 3. Install Frontend Dependencies
```bash
cd frontend
npm install
cd ..
```

#### 4. Run All Services with Supervisor
```bash
python -m scripts.launch
```
To also launch the local hardware camera streamer:
```bash
python -m scripts.launch --camera
```

Open `http://127.0.0.1:5173` in your browser. Copy your `ADMIN_API_TOKEN` or `OPERATOR_API_TOKEN` from `.env` to sign into the dashboard.

---

### Running Individual Services Separately

```bash
# Backend API (Port 8000)
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000

# Audio AI Service (Port 5001)
python -m uvicorn ai_service.audio.audio_api:app --host 127.0.0.1 --port 5001

# Frontend Vite Dev Server (Port 5173)
cd frontend && npm run dev

# Authenticated Camera Streamer (Port 8080)
python mjpeg_server.py
```

---

## 5. Security Architecture

1. **Role-Based Access Control (RBAC)**:
   - `viewer`: Read-only access to stats, alerts, cameras.
   - `operator`: Sensor detection ingestion, alert resolution.
   - `admin`: System configuration, alert clearing.
   - `service`: Internal inter-service communication token.
2. **WebSocket Single-Use Tickets**:
   - Clients exchange their token for a short-lived, single-use ticket via `POST /api/auth/ws-ticket`.
   - Credentials are never exposed in WebSocket URL query strings.
3. **SSRF Protection on Remote Streams**:
   - Camera endpoints must use registered IDs and explicitly allowlisted IP addresses.
   - Cloud metadata IP (`169.254.169.254`), loopback, and internal addresses are blocked.
4. **Decoupled Media Storage**:
   - Image evidence is stored on the filesystem under `data/images/` and served via `/api/alerts/{id}/image`.
   - Database files (`*.db`, `*.db-wal`, `*.db-shm`) are excluded from version control.
5. **Rate Limiting & Upload Bounding**:
   - Endpoints are protected by `slowapi` rate limits.
   - Strict size and decompression limits for images (10MB, 16MP), audio (20MB, 30s), and video (100MB, 120s).

---

## 6. Testing & Quality Assurance

### Run Backend Test Suite
```bash
pytest
```
*Executes 111 unit, integration, and security tests covering risk fusion, Haversine geofences, ETA estimation, incident deduplication, RBAC, SSRF rejection, and database migrations.*

### Run Frontend Test Suite
```bash
cd frontend
npm test
```
*Verifies in-memory credential storage, WebSocket ticket handling, failed-response propagation, and bounded alert merging.*

### Run Frontend Lint & Build
```bash
cd frontend
npm run lint
npm run build
```

### Run Edge Vision Benchmark (Latency, FPS, Memory)
```bash
python scripts/benchmark_vision.py
```
*Benchmarks Motion Filter (0.24ms), Low-light CLAHE (2.9ms), YOLO11n vs YOLO11s vs YOLOv8x latency distributions, throughput (FPS), and process memory consumption.*

### Run Vision Pipeline Evaluation & False-Positive Rejection Test
```bash
python scripts/evaluate_vision.py
```
*Evaluates static-scene motion suppression (95% compute saved), low-light triggers, anti-poaching taxonomy filtering, and multi-frame temporal confirmation.*

### Run End-to-End System Smoke Test
```bash
python -m scripts.smoke_system
```
*Spawns an isolated test environment with real YOLO and YAMNet models, exercises all endpoints, tests paired multimodal fusion, and validates incident resolution.*


---

## 7. Demo & Simulation Tools

Run the included stream simulator with test fixtures:
```bash
python -m ai_service.stream_simulator
```
Run single-shot CLI multimodal pipeline:
```bash
python -m ai_service.pipeline
```
*(Demo executions are tagged with `mode: DEMO` and do not pollute production databases or dispatch alerts).*
