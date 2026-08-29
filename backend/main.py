import os
import sys
import io
import cv2
import json
import base64
import tempfile
import shutil
import datetime
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PIL import Image
from PIL.ExifTags import TAGS, GPSTAGS
import numpy as np
import uvicorn

from sqlalchemy import create_engine, Column, String, Float, Boolean, DateTime, Text, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.dispatch import send_critical_alert
from ai_service.audio.classifier import predict_audio_threat

DATABASE_FILE = PROJECT_ROOT / "wildlife_sentinel.db"
DATABASE_URL = f"sqlite:///{DATABASE_FILE}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 15})

@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA journal_mode=WAL;")
    cursor.execute("PRAGMA synchronous=NORMAL;")
    cursor.execute("PRAGMA foreign_keys=ON;")
    cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AlertRecord(Base):
    __tablename__ = "alerts"
    id = Column(String, primary_key=True, index=True)
    camera_id = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    threat_level = Column(String, index=True)
    detections = Column(Text)
    resolved = Column(Boolean, default=False, index=True)
    annotated_image = Column(Text, nullable=True)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

app = FastAPI(
    title="Wildlife Sentinel Enterprise API",
    description="Real-time multi-modal edge AI vision and acoustic surveillance platform",
    version="5.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in list(self.active_connections):
            try:
                await connection.send_json(message)
            except Exception:
                self.disconnect(connection)

manager = ConnectionManager()

try:
    from ultralytics import YOLO
    model = YOLO("yolov8x.pt")
except Exception:
    try:
        from ultralytics import YOLO
        model = YOLO("yolov8n.pt")
    except Exception:
        model = None

THREAT_CLASSES = {"person", "car", "truck", "motorcycle", "bus"}
WILDLIFE_CLASSES = {"bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"}
WILDLIFE_REMAP = {
    "sheep": "deer / antelope",
    "cow": "bison / wild cattle",
    "horse": "horse / zebra",
    "dog": "wild dog / wolf"
}

system_settings = {
    "confidence_threshold": 0.45,
    "geofence_core_radius_m": 800,
    "ranger_hq": {"name": "Sector 4 Ranger Station", "lat": 12.9700, "lng": 79.1550},
    "discord_webhook_url": os.getenv("DISCORD_WEBHOOK_URL", ""),
    "remote_streams": {
        "COMPUTER_1": "",
        "COMPUTER_2": "",
        "COMPUTER_3": ""
    }
}

camera_nodes_db = [
    {"id": "COMPUTER_1", "name": "Remote Laptop 1 (North Outpost)", "location": {"lat": 12.9735, "lng": 79.1585}, "status": "ONLINE", "battery_pct": 92, "signal_dbm": -68},
    {"id": "COMPUTER_2", "name": "Remote Laptop 2 (South River Crossing)", "location": {"lat": 12.9642, "lng": 79.1512}, "status": "ONLINE", "battery_pct": 84, "signal_dbm": -72},
    {"id": "COMPUTER_3", "name": "Remote Laptop 3 (East Migration Path)", "location": {"lat": 12.9698, "lng": 79.1660}, "status": "ONLINE", "battery_pct": 78, "signal_dbm": -64}
]

def draw_annotations(image_np: np.ndarray, detections: list) -> str:
    img_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
    for det in detections:
        bbox = [int(coord) for coord in det["bbox"]]
        label = det["label"]
        confidence = det["confidence"]
        
        color = (0, 0, 230) if label.lower() in THREAT_CLASSES else (74, 222, 128)
        cv2.rectangle(img_bgr, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
        caption = f"{label.upper()} {int(confidence * 100)}%"
        (w, h), _ = cv2.getTextSize(caption, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 2)
        cv2.rectangle(img_bgr, (bbox[0], bbox[1] - 20), (bbox[0] + w + 6, bbox[1]), color, -1)
        cv2.putText(img_bgr, caption, (bbox[0] + 3, bbox[1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1, cv2.LINE_AA)

    _, buffer = cv2.imencode('.jpg', img_bgr)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

async def analyze_remote_streams_worker():
    while True:
        await asyncio.sleep(2.0)
        streams = system_settings.get("remote_streams", {})
        for cam_id, stream_url in streams.items():
            if not stream_url or not stream_url.startswith("http"):
                continue

            try:
                cap = cv2.VideoCapture(stream_url)
                ret, frame = cap.read()
                cap.release()

                if not ret or frame is None:
                    continue

                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(frame_rgb)

                detections = []
                threat_level = "LOW"

                if model is not None:
                    results = model(pil_img, conf=system_settings["confidence_threshold"])
                    for box in results[0].boxes:
                        cls_id = int(box.cls[0].item())
                        raw_label = model.names[cls_id]
                        conf = float(box.conf[0].item())
                        bbox = [float(coord) for coord in box.xyxy[0].tolist()]

                        label = WILDLIFE_REMAP.get(raw_label, raw_label)
                        if raw_label in THREAT_CLASSES:
                            threat_level = "CRITICAL" if raw_label == "person" else "HIGH"
                        elif raw_label in WILDLIFE_CLASSES or raw_label in WILDLIFE_REMAP:
                            if threat_level == "LOW":
                                threat_level = "MONITORED"

                        detections.append({"label": label, "confidence": round(conf, 3), "bbox": bbox})

                if detections:
                    annotated_b64 = draw_annotations(frame_rgb, detections)
                    alert_id = f"remote_{cam_id.lower()}_{int(datetime.datetime.utcnow().timestamp() * 1000)}"

                    node_info = next((c for c in camera_nodes_db if c["id"] == cam_id), None)
                    lat = node_info["location"]["lat"] if node_info else 12.9698
                    lng = node_info["location"]["lng"] if node_info else 79.1559

                    db = SessionLocal()
                    new_alert = AlertRecord(
                        id=alert_id,
                        camera_id=cam_id,
                        timestamp=datetime.datetime.utcnow(),
                        latitude=lat,
                        longitude=lng,
                        threat_level=threat_level,
                        detections=json.dumps(detections),
                        resolved=False,
                        annotated_image=annotated_b64
                    )
                    db.add(new_alert)
                    db.commit()
                    db.close()

                    payload = {
                        "id": alert_id,
                        "camera_id": cam_id,
                        "timestamp": new_alert.timestamp.isoformat() + "Z",
                        "location": {"lat": lat, "lng": lng},
                        "detections": detections,
                        "threat_level": threat_level,
                        "resolved": False,
                        "annotated_image": annotated_b64
                    }

                    await manager.broadcast({"type": "NEW_ALERT", "payload": payload, "data": payload})
                    if threat_level in ["CRITICAL", "HIGH"]:
                        send_critical_alert(cam_id, threat_level, detections, {"lat": lat, "lng": lng})

            except Exception:
                pass

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(analyze_remote_streams_worker())

@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Wildlife Sentinel API",
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z"
    }

@app.post("/api/detect")
async def detect_feed(
    image: UploadFile = File(...),
    camera_id: str = Form("HOST_LAPTOP_CAM"),
    latitude: float = Form(12.9698),
    longitude: float = Form(79.1559),
    db: Session = Depends(get_db)
):
    try:
        image_bytes = await image.read()
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(pil_img)

        detections = []
        threat_level = "LOW"

        if model is not None:
            results = model(pil_img, conf=system_settings["confidence_threshold"])
            for box in results[0].boxes:
                cls_id = int(box.cls[0].item())
                raw_label = model.names[cls_id]
                confidence = float(box.conf[0].item())
                bbox = [float(coord) for coord in box.xyxy[0].tolist()]

                label = WILDLIFE_REMAP.get(raw_label, raw_label)
                if raw_label in THREAT_CLASSES:
                    threat_level = "CRITICAL" if raw_label == "person" else "HIGH"
                elif raw_label in WILDLIFE_CLASSES or raw_label in WILDLIFE_REMAP:
                    if threat_level == "LOW":
                        threat_level = "MONITORED"

                detections.append({"label": label, "confidence": round(confidence, 3), "bbox": bbox})

        annotated_image_b64 = draw_annotations(img_np, detections) if detections else None
        alert_id = f"alert_{int(datetime.datetime.utcnow().timestamp() * 1000)}"

        new_alert = AlertRecord(
            id=alert_id,
            camera_id=camera_id,
            timestamp=datetime.datetime.utcnow(),
            latitude=latitude,
            longitude=longitude,
            threat_level=threat_level,
            detections=json.dumps(detections),
            resolved=False,
            annotated_image=annotated_image_b64
        )
        db.add(new_alert)
        db.commit()

        payload = {
            "id": alert_id,
            "camera_id": camera_id,
            "timestamp": new_alert.timestamp.isoformat() + "Z",
            "location": {"lat": latitude, "lng": longitude},
            "detections": detections,
            "threat_level": threat_level,
            "resolved": False,
            "annotated_image": annotated_image_b64
        }

        await manager.broadcast({"type": "NEW_ALERT", "payload": payload, "data": payload})
        if threat_level in ["CRITICAL", "HIGH"]:
            send_critical_alert(camera_id, threat_level, detections, {"lat": latitude, "lng": longitude})

        return payload
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/detect/video")
async def detect_video(
    video: UploadFile = File(...),
    camera_id: str = Form("CAM_VIDEO_CCTV"),
    latitude: float = Form(12.9680),
    longitude: float = Form(79.1620),
    sample_rate: int = Form(1),
    db: Session = Depends(get_db)
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        shutil.copyfileobj(video.file, tmp)
        tmp_path = tmp.name

    cap = cv2.VideoCapture(tmp_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    frame_interval = max(1, int(fps * sample_rate))
    frame_count = 0
    video_summary = []

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break

            if frame_count % frame_interval == 0:
                timestamp_sec = round(frame_count / fps, 1)
                frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                pil_img = Image.fromarray(frame_rgb)

                detections = []
                threat_level = "LOW"

                if model is not None:
                    results = model(pil_img, conf=system_settings["confidence_threshold"])
                    for box in results[0].boxes:
                        cls_id = int(box.cls[0].item())
                        raw_label = model.names[cls_id]
                        conf = float(box.conf[0].item())
                        bbox = [float(c) for c in box.xyxy[0].tolist()]

                        label = WILDLIFE_REMAP.get(raw_label, raw_label)
                        if raw_label in THREAT_CLASSES:
                            threat_level = "CRITICAL" if raw_label == "person" else "HIGH"
                        elif raw_label in WILDLIFE_CLASSES or raw_label in WILDLIFE_REMAP:
                            if threat_level == "LOW":
                                threat_level = "MONITORED"

                        detections.append({"label": label, "confidence": round(conf, 3), "bbox": bbox})

                if detections:
                    annotated_b64 = draw_annotations(frame_rgb, detections)
                    alert_id = f"video_{int(datetime.datetime.utcnow().timestamp() * 1000)}_{frame_count}"

                    record = AlertRecord(
                        id=alert_id,
                        camera_id=f"{camera_id} [{timestamp_sec}s]",
                        timestamp=datetime.datetime.utcnow(),
                        latitude=latitude,
                        longitude=longitude,
                        threat_level=threat_level,
                        detections=json.dumps(detections),
                        resolved=False,
                        annotated_image=annotated_b64
                    )
                    db.add(record)
                    db.commit()

                    alert_payload = {
                        "id": alert_id,
                        "camera_id": f"{camera_id} [{timestamp_sec}s]",
                        "timestamp": record.timestamp.isoformat() + "Z",
                        "location": {"lat": latitude, "lng": longitude},
                        "detections": detections,
                        "threat_level": threat_level,
                        "resolved": False,
                        "annotated_image": annotated_b64
                    }
                    video_summary.append(alert_payload)
                    await manager.broadcast({"type": "NEW_ALERT", "payload": alert_payload, "data": alert_payload})

            frame_count += 1
    finally:
        cap.release()
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return {
        "status": "success",
        "processed_frames": frame_count,
        "detections_found": len(video_summary),
        "incidents": video_summary
    }

@app.post("/api/detect/audio")
async def detect_audio(
    audio: UploadFile = File(...),
    camera_id: str = Form("ACOUSTIC_SENSOR_01"),
    latitude: float = Form(12.9698),
    longitude: float = Form(79.1559),
    db: Session = Depends(get_db)
):
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
        shutil.copyfileobj(audio.file, tmp)
        tmp_path = tmp.name

    try:
        threat_label, confidence, threat_level = predict_audio_threat(tmp_path)
        detections = [{"label": f"[Audio] {threat_label}", "confidence": round(confidence, 3), "bbox": [0, 0, 0, 0]}]
        alert_id = f"audio_{int(datetime.datetime.utcnow().timestamp() * 1000)}"

        record = AlertRecord(
            id=alert_id,
            camera_id=camera_id,
            timestamp=datetime.datetime.utcnow(),
            latitude=latitude,
            longitude=longitude,
            threat_level=threat_level,
            detections=json.dumps(detections),
            resolved=False,
            annotated_image=None
        )
        db.add(record)
        db.commit()

        payload = {
            "id": alert_id,
            "camera_id": camera_id,
            "timestamp": record.timestamp.isoformat() + "Z",
            "location": {"lat": latitude, "lng": longitude},
            "detections": detections,
            "threat_level": threat_level,
            "resolved": False,
            "annotated_image": None,
            "source": "Acoustic Sensor Node"
        }

        await manager.broadcast({"type": "NEW_ALERT", "payload": payload, "data": payload})
        if threat_level in ["CRITICAL", "HIGH"]:
            send_critical_alert(camera_id, threat_level, detections, {"lat": latitude, "lng": longitude})

        return payload
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total_events = db.query(AlertRecord).count()
    critical = db.query(AlertRecord).filter(AlertRecord.threat_level == "CRITICAL").count()
    high = db.query(AlertRecord).filter(AlertRecord.threat_level == "HIGH").count()
    monitored = db.query(AlertRecord).filter(AlertRecord.threat_level == "MONITORED").count()

    return {
        "total_events": total_events,
        "critical_intrusions": critical,
        "high_threats": high,
        "wildlife_sightings": monitored,
        "active_camera_nodes": len(camera_nodes_db)
    }

@app.get("/api/alerts")
def get_alerts(limit: int = 100, db: Session = Depends(get_db)):
    records = db.query(AlertRecord).order_by(AlertRecord.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": r.id,
            "camera_id": r.camera_id,
            "timestamp": r.timestamp.isoformat() + "Z",
            "location": {"lat": r.latitude, "lng": r.longitude},
            "detections": json.loads(r.detections) if r.detections else [],
            "threat_level": r.threat_level,
            "resolved": r.resolved,
            "annotated_image": r.annotated_image
        }
        for r in records
    ]

@app.post("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: str, db: Session = Depends(get_db)):
    record = db.query(AlertRecord).filter(AlertRecord.id == alert_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Incident alert not found")
    record.resolved = True
    db.commit()
    return {"status": "success"}

@app.delete("/api/alerts/clear")
def clear_alerts(db: Session = Depends(get_db)):
    db.query(AlertRecord).delete()
    db.commit()
    return {"status": "cleared"}

@app.get("/api/analytics")
def get_analytics(db: Session = Depends(get_db)):
    records = db.query(AlertRecord).all()
    species_breakdown = {}
    threat_breakdown = {"CRITICAL": 0, "HIGH": 0, "MONITORED": 0, "LOW": 0}
    modality_breakdown = {"Vision Stream": 0, "Acoustic Sensor": 0, "LoRa Mesh": 0}
    hourly_distribution = [0] * 24

    for r in records:
        threat = r.threat_level or "LOW"
        threat_breakdown[threat] = threat_breakdown.get(threat, 0) + 1
        modality_breakdown["Vision Stream"] += 1

        if r.timestamp:
            hourly_distribution[r.timestamp.hour] += 1

        dets = json.loads(r.detections) if r.detections else []
        for det in dets:
            label = det.get("label", "unknown").capitalize()
            species_breakdown[label] = species_breakdown.get(label, 0) + 1

    hourly_trend = [{"hour": f"{h:02d}", "intrusions": hourly_distribution[h]} for h in range(24)]

    return {
        "species_distribution": species_breakdown,
        "threat_severity_distribution": threat_breakdown,
        "modality_distribution": modality_breakdown,
        "hourly_trend": hourly_trend,
        "most_frequent_target": max(species_breakdown, key=species_breakdown.get) if species_breakdown else "N/A"
    }

@app.get("/api/cameras")
def get_cameras():
    return camera_nodes_db

class SettingsPayload(BaseModel):
    confidence_threshold: Optional[float] = None
    geofence_core_radius_m: Optional[int] = None
    discord_webhook_url: Optional[str] = None
    remote_streams: Optional[Dict[str, str]] = None

@app.get("/api/settings")
def get_settings():
    return system_settings

@app.post("/api/settings")
def update_settings(payload: SettingsPayload):
    if payload.confidence_threshold is not None:
        system_settings["confidence_threshold"] = payload.confidence_threshold
    if payload.geofence_core_radius_m is not None:
        system_settings["geofence_core_radius_m"] = payload.geofence_core_radius_m
    if payload.discord_webhook_url is not None:
        system_settings["discord_webhook_url"] = payload.discord_webhook_url
    if payload.remote_streams is not None:
        system_settings["remote_streams"] = payload.remote_streams
    return {"status": "updated", "settings": system_settings}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)