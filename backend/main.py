from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from ultralytics import YOLO
from PIL import Image
import io
import datetime
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

# Load lightweight pretrained model (downloads automatically on first run)
model = YOLO("yolov8n.pt")

# In-memory storage for active alerts during demo
alerts_db = []

# High-threat targets: human intruders, vehicles
THREAT_CLASSES = {"person", "car", "truck", "motorcycle", "bus"}
# Wildlife targets
WILDLIFE_CLASSES = {"bird", "cat", "dog", "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "wildlife-sentinel-backend"}

@app.get("/api/alerts")
def get_alerts():
    return alerts_db

@app.post("/api/detect")
async def detect_feed(
    image: UploadFile = File(...),
    camera_id: str = Form("CAM_01"),
    latitude: float = Form(12.9698),
    longitude: float = Form(79.1559)
):
    try:
        # Read image bytes into PIL Image
        image_bytes = await image.read()
        pil_img = Image.open(io.BytesIO(image_bytes)).convert("RGB")

        # Run inference
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

        alert_entry = {
            "id": f"alert_{len(alerts_db) + 1}",
            "camera_id": camera_id,
            "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
            "location": {"lat": latitude, "lng": longitude},
            "detections": detections,
            "threat_level": threat_level
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

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=5000, reload=True)