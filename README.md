# Wildlife Sentinel 🦁

**Autonomous AI edge-threat detection and live ranger dispatch network for wildlife sanctuaries.**

Combines real-time **computer vision (YOLOv8)** and **acoustic event classification** into a fused risk score — automatically alerting rangers when poachers, vehicles, or distressed wildlife are detected.

---

## Architecture

```
Camera Trap (Image)  ──→  YOLO Backend (:5000)  ──→  Vision Result ──┐
                                                                        ├──→ Risk Engine ──→ Combined Risk
Microphone (WAV)     ──→  Audio API    (:5001)  ──→  Audio Result  ──┘
                                                                              │
                                                               if HIGH / CRITICAL
                                                                              ↓
                                                     Backend WebSocket broadcast (:5000/ws/alerts)
                                                                              ↓
                                                              React Frontend — Live Alert Dashboard
```

---

## Project Structure

```
wildlife-sentinel/
├── backend/                    # FastAPI server — YOLO inference, DB, WebSocket
│   ├── main.py                 # All REST + WebSocket endpoints
│   ├── dispatch.py             # Haversine ETA calc + Discord webhook
│   └── requirements.txt
│
├── ai_service/                 # AI fusion pipeline (this repo's owner)
│   ├── pipeline.py             # CLI runner — calls /api/audio/pipeline
│   ├── risk_engine.py          # Fuses vision + audio into combined risk score
│   ├── stream_simulator.py     # Loops test images+audio through the full pipeline
│   │
│   ├── audio/
│   │   ├── classifier.py       # Acoustic feature extraction + rule-based classifier
│   │   ├── audio_api.py        # FastAPI microservice (port 5001)
│   │   │   ├── POST /api/audio/classify   — audio-only classification
│   │   │   └── POST /api/audio/pipeline   — FULL fused pipeline orchestrator
│   │   ├── audio_simulator.py  # Standalone audio monitor loop
│   │   └── test.wav            # Sample WAV for testing
│   │
│   └── test_samples/
│       ├── poachers/           # Test images: person, vehicle
│       └── wildlife/           # Test images: elephant, bird, etc.
│
├── frontend/                   # React + Vite dashboard
│   └── src/App.jsx             # Live alert feed, map, stats, upload UI
│
└── docs/
    └── api_contract.md         # Full API reference
```

---

## Threat Levels

| Level | Trigger | Action |
|---|---|---|
| 🔴 CRITICAL | Person detected + high-risk audio | Ranger dispatch + Discord alert |
| 🟠 HIGH | Vehicle / high-risk audio alone | Ranger dispatch + Discord alert |
| 🟡 MEDIUM | Suspicious audio / MEDIUM vision | Logged + monitored |
| 🟢 MONITORED | Wildlife sighting | Logged |
| ⚪ LOW | Normal environment | No action |

---

## Quickstart

### 1. Backend (port 5000)
```bash
cd backend
pip install -r requirements.txt
python main.py
```

### 2. Audio API — AI Service (port 5001)
```bash
cd ai_service/audio
pip install fastapi uvicorn requests numpy
python audio_api.py
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 4. Run the stream simulation
```bash
# From project root
python -m ai_service.stream_simulator
```

### 5. Or run the single-shot CLI pipeline
```bash
python -m ai_service.pipeline
```

---

## API Endpoints

See [`docs/api_contract.md`](docs/api_contract.md) for the full contract.

**Backend** (`localhost:5000`):
- `POST /api/detect` — single image YOLO detection
- `POST /api/detect/video` — video frame sampling
- `POST /api/edge/telemetry` — receive pre-fused risk from AI service
- `GET  /api/alerts` — fetch all stored incidents
- `GET  /api/stats` — dashboard statistics
- `WS   /ws/alerts` — real-time alert push to frontend

**Audio AI Service** (`localhost:5001`):
- `POST /api/audio/classify` — WAV-only classification
- `POST /api/audio/pipeline` — **full fused pipeline** (image + audio)
- `GET  /api/audio/labels` — label reference

---

## Team

| Role | Scope |
|---|---|
| Backend | `backend/` — FastAPI, YOLO, SQLite, WebSocket |
| AI Service | `ai_service/` — Audio classifier, Risk engine, Pipeline |
| Frontend | `frontend/` — React dashboard, Map, Alert feed |
