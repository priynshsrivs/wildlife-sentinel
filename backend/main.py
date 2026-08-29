import os
import io
import cv2
import json
import base64
import tempfile
import shutil
import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import numpy as np
import uvicorn

# SQLAlchemy Setup
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

from dispatch import send_critical_alert

# --- DATABASE CONFIGURATION (SQLite Persistence) ---
DATABASE_URL = "sqlite:///./wildlife_sentinel.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class AlertRecord(Base):
    __tablename__ = "alerts"
    id = Column(String, primary_key=True, index=True)
    camera_id = Column(String, index=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    latitude = Column(Float)
    longitude = Column(Float)
    threat_level = Column(String, index=True)
    detections = Column(Text)  # JSON-encoded detections
    resolved = Column(Boolean, default=False)
    annotated_image = Column(Text, nullable=True)

Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# --- FASTAPI APP SETUP ---
app = FastAPI(title="Wildlife Sentinel Enterprise API", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- WEBSOCKET CONNECTION MANAGER ---
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
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

# Load YOLOv8 model
model = YOLO("yolov8x.pt")

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
    "discord_webhook_url": os.getenv("DISCORD_WEBHOOK_URL", "")
}

camera_nodes_db = [
    {"id": "CAM_NORTH_01", "name": "North Ridge Outpost", "location": {"lat": 12.9735, "lng": 79.1585}, "status": "ONLINE", "battery_pct": 92},
    {"id": "CAM_SOUTH_02", "name": "South River Crossing", "location": {"lat": 12.9642, "lng": 79.1512}, "status": "ONLINE", "battery_pct": 84},
    {"id": "CAM_EAST_CORRIDOR", "name": "East Wildlife Migration Path", "location": {"lat": 12.9698, "lng": 79.1660}, "status": "ONLINE", "battery_pct": 78},
    {"id": "CAM_WEST_BUFFER", "name": "West Perimeter Fence", "location": {"lat": 12.9620, "lng": 79.1480}, "status": "OFFLINE", "battery_pct": 14}
]

# --- IMAGE ENHANCEMENT PIPELINE ---
def enhance_low_light_image(img_bgr: np.ndarray) -> np.ndarray:
    """Applies CLAHE contrast enhancement for night-vision and low-light feeds."""
    lab = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    cl = clahe.apply(l)
    enhanced_lab = cv2.merge((cl, a, b))
    return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

def draw_annotations(image_np: np.ndarray, detections: list) -> str:
    img_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)
    for det in detections:
        bbox = [int(coord) for coord in det["bbox"]]
        label = det["label"]
        confidence = det["confidence"]
        
        color = (0, 0, 230) if label.lower() in THREAT_CLASSES else (34, 197, 94)
        cv2.rectangle(img_bgr, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 3)
        caption = f"{label.upper()} {int(confidence * 100)}%"
        (w, h), _ = cv2.getTextSize(caption, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
        cv2.rectangle(img_bgr, (bbox[0], bbox[1] - 22), (bbox[0] + w + 8, bbox[1]), color, -1)
        cv2.putText(img_bgr, caption, (bbox[0] + 4, bbox[1] - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2, cv2.LINE_AA)
    _, buffer = cv2.imencode('.jpg', img_bgr)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

# --- WEBSOCKET ENDPOINT ---
@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# --- INGESTION ENDPOINTS ---
@app.post("/api/detect")
async def detect_feed(
    image: UploadFile = File(...),
    camera_id: str = Form("CAM_01"),
    latitude: float = Form(12.9698),
    longitude: float = Form(79.1559),
    enhance_night_vision: bool = Form(False),
    db: Session = Depends(get_db)
):
    try:
        image_bytes = await image.read()
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(pil_img)

        if enhance_night_vision:
            img_bgr = cv2.cvtColor(img_np, cv2.COLOR_RGB2BGR)
            img_bgr = enhance_low_light_image(img_bgr)
            img_np = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(img_np)

        results = model(pil_img, conf=system_settings["confidence_threshold"])
        detections = []
        threat_level = "LOW"

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

        # Save to SQLite
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

        # Real-time WebSocket Broadcast
        await manager.broadcast({"type": "NEW_ALERT", "data": payload})

        if threat_level in ["CRITICAL", "HIGH"]:
            send_critical_alert(camera_id, threat_level, detections, {"lat": latitude, "lng": longitude})

        return payload

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- LOW-BANDWIDTH LoRaWAN TELEMETRY ENDPOINT ---
class LoRaTelemetryPayload(BaseModel):
    camera_id: str
    latitude: float
    longitude: float
    threat_level: str
    detected_classes: List[str]
    max_confidence: float

@app.post("/api/edge/telemetry")
async def receive_lora_telemetry(payload: LoRaTelemetryPayload, db: Session = Depends(get_db)):
    """Receives lightweight text/JSON packets from LoRa/Satellite edge devices (no image payload required)."""
    alert_id = f"lora_{int(datetime.datetime.utcnow().timestamp() * 1000)}"
    detections = [{"label": c, "confidence": payload.max_confidence, "bbox": [0, 0, 0, 0]} for c in payload.detected_classes]

    new_alert = AlertRecord(
        id=alert_id,
        camera_id=payload.camera_id,
        timestamp=datetime.datetime.utcnow(),
        latitude=payload.latitude,
        longitude=payload.longitude,
        threat_level=payload.threat_level.upper(),
        detections=json.dumps(detections),
        resolved=False,
        annotated_image=None
    )
    db.add(new_alert)
    db.commit()

    alert_data = {
        "id": alert_id,
        "camera_id": payload.camera_id,
        "timestamp": new_alert.timestamp.isoformat() + "Z",
        "location": {"lat": payload.latitude, "lng": payload.longitude},
        "detections": detections,
        "threat_level": payload.threat_level.upper(),
        "resolved": False,
        "annotated_image": None,
        "source": "LoRaWAN Mesh"
    }

    await manager.broadcast({"type": "NEW_ALERT", "data": alert_data})
    return {"status": "received", "alert_id": alert_id}

# --- STATS, QUERY & MANAGEMENT ---
@app.get("/api/alerts")
def get_alerts(db: Session = Depends(get_db)):
    records = db.query(AlertRecord).order_by(AlertRecord.timestamp.desc()).all()
    return [
        {
            "id": r.id,
            "camera_id": r.camera_id,
            "timestamp": r.timestamp.isoformat() + "Z",
            "location": {"lat": r.latitude, "lng": r.longitude},
            "detections": json.loads(r.detections),
            "threat_level": r.threat_level,
            "resolved": r.resolved,
            "annotated_image": r.annotated_image
        }
        for r in records
    ]

@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    total_events = db.query(AlertRecord).count()
    critical = db.query(AlertRecord).filter(AlertRecord.threat_level == "CRITICAL").count()
    high = db.query(AlertRecord).filter(AlertRecord.threat_level == "HIGH").count()
    monitored = db.query(AlertRecord).filter(AlertRecord.threat_level == "MONITORED").count()
    online_cameras = sum(1 for c in camera_nodes_db if c["status"] == "ONLINE")

    return {
        "total_events": total_events,
        "critical_intrusions": critical,
        "high_threats": high,
        "wildlife_sightings": monitored,
        "active_camera_nodes": online_cameras,
        "total_camera_nodes": len(camera_nodes_db)
    }

@app.delete("/api/alerts/clear")
def clear_alerts(db: Session = Depends(get_db)):
    db.query(AlertRecord).delete()
    db.commit()
    return {"status": "cleared", "message": "Persistent alert log wiped successfully."}

@app.get("/api/map/reserve")
def get_reserve_map():
    return {
        "center": [12.9698, 79.1559],
        "zoom": 14,
        "geofence": {
            "core_zone": {
                "center": [system_settings["ranger_hq"]["lat"], system_settings["ranger_hq"]["lng"]],
                "radius_meters": system_settings["geofence_core_radius_m"],
                "color": "#ef4444"
            }
        },
        "ranger_hq": system_settings["ranger_hq"],
        "camera_nodes": camera_nodes_db
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)