import os
import io
import cv2
import base64
import tempfile
import shutil
import datetime
from typing import Optional

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import numpy as np
import uvicorn

from dispatch import send_critical_alert

app = FastAPI(title="Wildlife Sentinel API", version="1.0.0")

# Enable CORS for React frontend connection
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load lightweight pretrained model
model = YOLO("yolov8n.pt")

# In-memory storage for active alerts during demo
alerts_db = []

# High-threat targets: human intruders, unauthorized vehicles
THREAT_CLASSES = {"person", "car", "truck", "motorcycle", "bus"}
# Wildlife targets
WILDLIFE_CLASSES = {"bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"}

def draw_annotations(image_np: np.ndarray, detections: list) -> str:
    """Draws colored bounding boxes and labels onto the image and returns a base64 string."""
    img_bgr = cv2.cvtColor(image_np, cv2.COLOR_RGB2BGR)

    for det in detections:
        bbox = [int(coord) for coord in det["bbox"]]
        label = det["label"]
        confidence = det["confidence"]
        
        # Color coding: Red for threat/poachers, Green for wildlife, Cyan for others
        if label in THREAT_CLASSES:
            color = (0, 0, 230)  # Red (BGR)
        elif label in WILDLIFE_CLASSES:
            color = (34, 197, 94)  # Green (BGR)
        else:
            color = (255, 200, 0)

        # Draw bounding rectangle
        cv2.rectangle(img_bgr, (bbox[0], bbox[1]), (bbox[2], bbox[3]), color, 2)
        
        # Draw label badge
        caption = f"{label.upper()} {int(confidence * 100)}%"
        (w, h), _ = cv2.getTextSize(caption, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
        cv2.rectangle(img_bgr, (bbox[0], bbox[1] - 20), (bbox[0] + w + 6, bbox[1]), color, -1)
        cv2.putText(img_bgr, caption, (bbox[0] + 3, bbox[1] - 5), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1, cv2.LINE_AA)

    # Convert annotated image to base64 string
    _, buffer = cv2.imencode('.jpg', img_bgr)
    return "data:image/jpeg;base64," + base64.b64encode(buffer).decode('utf-8')

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "wildlife-sentinel-backend"}

@app.get("/api/stats")
def get_stats():
    """Returns aggregated monitoring statistics."""
    total_events = len(alerts_db)
    critical = sum(1 for a in alerts_db if a["threat_level"] == "CRITICAL")
    high = sum(1 for a in alerts_db if a["threat_level"] == "HIGH")
    monitored = sum(1 for a in alerts_db if a["threat_level"] == "MONITORED")
    unique_cameras = len(set(a["camera_id"] for a in alerts_db))
    
    return {
        "total_events": total_events,
        "critical_intrusions": critical,
        "high_threats": high,
        "wildlife_sightings": monitored,
        "active_camera_nodes": unique_cameras or 3
    }

@app.get("/api/alerts")
def get_alerts():
    return alerts_db

@app.get("/api/alerts/filter")
def filter_alerts(threat_level: Optional[str] = None, camera_id: Optional[str] = None):
    """Filters stored incident logs by threat level or camera ID."""
    results = alerts_db
    if threat_level:
        results = [a for a in results if a["threat_level"] == threat_level.upper()]
    if camera_id:
        results = [a for a in results if a["camera_id"] == camera_id]
    return results

@app.delete("/api/alerts/clear")
def clear_alerts():
    """Clears alerts memory for resetting demo scenarios."""
    global alerts_db
    alerts_db.clear()
    return {"status": "cleared", "message": "Alert log reset successfully"}

@app.post("/api/detect")
async def detect_feed(
    image: UploadFile = File(...),
    camera_id: str = Form("CAM_01"),
    latitude: float = Form(12.9698),
    longitude: float = Form(79.1559)
):
    """Processes single frame camera traps with real-time detection."""
    try:
        image_bytes = await image.read()
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        img_np = np.array(pil_img)

        results = model(pil_img)
        detections = []
        threat_level = "LOW"

        for box in results[0].boxes:
            cls_id = int(box.cls[0].item())
            label = model.names[cls_id]
            confidence = float(box.conf[0].item())
            bbox = [float(coord) for coord in box.xyxy[0].tolist()]

            if label in THREAT_CLASSES:
                threat_level = "CRITICAL" if label == "person" else "HIGH"
            elif label in WILDLIFE_CLASSES and threat_level == "LOW":
                threat_level = "MONITORED"

            detections.append({
                "label": label,
                "confidence": round(confidence, 3),
                "bbox": bbox
            })

        # Generate base64 annotated image preview
        annotated_image_b64 = draw_annotations(img_np, detections) if detections else None

        alert_entry = {
            "id": f"alert_{len(alerts_db) + 1}",
            "camera_id": camera_id,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "location": {"lat": latitude, "lng": longitude},
            "detections": detections,
            "threat_level": threat_level,
            "annotated_image": annotated_image_b64
        }

        alerts_db.insert(0, alert_entry)

        # Trigger automated dispatch alert for high/critical threats
        if threat_level in ["CRITICAL", "HIGH"]:
            send_critical_alert(
                camera_id=camera_id,
                threat_level=threat_level,
                detections=detections,
                location={"lat": latitude, "lng": longitude}
            )

        return alert_entry

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/detect/video")
async def detect_video(
    video: UploadFile = File(...),
    camera_id: str = Form("CAM_VIDEO_FEED"),
    latitude: float = Form(12.9680),
    longitude: float = Form(79.1620),
    sample_rate: int = Form(1) # process 1 frame per second
):
    """Processes video clips, running inference on sampled frames."""
    with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as tmp:
        shutil.copyfileobj(video.file, tmp)
        tmp_path = tmp.name

    cap = cv2.VideoCapture(tmp_path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25
    frame_interval = int(fps * sample_rate)
    
    frame_count = 0
    video_summary = []
    
    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break
            
        if frame_count % frame_interval == 0:
            timestamp_sec = round(frame_count / fps, 1)
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            pil_img = Image.fromarray(frame_rgb)
            
            results = model(pil_img)
            detections = []
            threat = "LOW"
            
            for box in results[0].boxes:
                cls_id = int(box.cls[0].item())
                label = model.names[cls_id]
                conf = float(box.conf[0].item())
                bbox = [float(c) for c in box.xyxy[0].tolist()]
                
                if label in THREAT_CLASSES:
                    threat = "CRITICAL" if label == "person" else "HIGH"
                elif label in WILDLIFE_CLASSES and threat == "LOW":
                    threat = "MONITORED"
                    
                detections.append({"label": label, "confidence": round(conf, 3), "bbox": bbox})
                
            if detections:
                annotated_b64 = draw_annotations(frame_rgb, detections)
                entry = {
                    "id": f"alert_v_{len(alerts_db) + 1}",
                    "camera_id": camera_id,
                    "video_timestamp_sec": timestamp_sec,
                    "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                    "location": {"lat": latitude, "lng": longitude},
                    "detections": detections,
                    "threat_level": threat,
                    "annotated_image": annotated_b64
                }
                alerts_db.insert(0, entry)
                video_summary.append(entry)
                
                if threat in ["CRITICAL", "HIGH"]:
                    send_critical_alert(
                        camera_id=camera_id,
                        threat_level=threat,
                        detections=detections,
                        location={"lat": latitude, "lng": longitude}
                    )
                
        frame_count += 1
        
    cap.release()
    os.remove(tmp_path)
    
    return {
        "processed_frames": frame_count,
        "detections_found": len(video_summary),
        "incidents": video_summary
    }

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)