"""Wildlife Sentinel API. Start from project root: python -m uvicorn backend.main:app."""

import asyncio
import io
import logging
import math
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import cv2
import httpx
from fastapi import (
    FastAPI,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    Response,
    UploadFile,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import ValidationError
from PIL import Image, ImageDraw
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from starlette.concurrency import run_in_threadpool
import json
import sentinel_config as config
from ai_service.vision import vision
from ai_service.governor import AIComputeGovernor
from ai_service.heatmap import RiskHeatmapEngine
from ai_service.multi_camera import MultiCameraCorrelator
from ai_service.xai import generate_explainable_alert
from ai_service.evidence import EvidenceTimeline
from backend.hard_negatives import HardNegativeManager
from backend.database import store, utcnow
from backend.schemas import SensorInput, Telemetry, SettingsPayload, Risk, RangerFeedbackPayload
from backend.security import require, identity, issue_ticket, consume_ticket, rate_key
from backend.media import image_upload, read_upload, temporary_file
from backend.middleware import BodyLimitMiddleware
from backend.realtime import manager
from backend.dispatch import dispatch_worker
from backend.cameras import camera_worker, camera_status, heartbeat, validate_endpoint

governor = AIComputeGovernor()
heatmap_engine = RiskHeatmapEngine()
multi_camera_correlator = MultiCameraCorrelator()
hard_negative_mgr = HardNegativeManager(store.connection)
evidence_timeline = EvidenceTimeline()

log = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s"
)
limiter = Limiter(key_func=rate_key, default_limits=["120/minute"])
read_access = Depends(require(service=True))
operate = Depends(require("operator", service=True))
admin = Depends(require("admin"))
inference_slots = asyncio.Semaphore(2)


@asynccontextmanager
async def lifespan(app):
    await run_in_threadpool(store.initialize)
    await run_in_threadpool(vision.initialize)
    tasks = [asyncio.create_task(dispatch_worker(store))]
    tasks += [
        asyncio.create_task(camera_worker(c, store, process_camera))
        for c in config.CAMERAS
        if c["id"] in config.CAMERA_ENDPOINTS
    ]
    yield
    for task in tasks:
        task.cancel()
    await asyncio.gather(*tasks, return_exceptions=True)


app = FastAPI(title="Wildlife Sentinel", version="6.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(BodyLimitMiddleware, max_bytes=config.MAX_VIDEO_BYTES + 1024 * 1024)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_methods=["GET", "POST", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
    expose_headers=["X-Next-Cursor"],
)


@app.exception_handler(Exception)
async def unexpected_error(request, exc):
    log.error("request_failed path=%s", request.url.path, exc_info=exc)
    return JSONResponse({"detail": "Internal service error"}, status_code=500)


def sensor(camera_id, latitude, longitude):
    try:
        return SensorInput(camera_id=camera_id, latitude=latitude, longitude=longitude)
    except ValidationError:
        raise HTTPException(422, "Invalid camera or coordinates") from None


def jpeg(image, detections):
    annotated = image.copy()
    draw = ImageDraw.Draw(annotated)
    for detection in detections:
        if detection["bbox"]:
            draw.rectangle(detection["bbox"], outline="red", width=2)
            draw.text(detection["bbox"][:2], detection["label"], fill="red")
    buffer = io.BytesIO()
    annotated.save(buffer, format="JPEG", quality=80)
    return buffer.getvalue()


async def ingest(payload, image=None, event_time=None):
    alert, created, publish = await run_in_threadpool(
        store.ingest, payload, image, event_time
    )
    heartbeat(
        payload.camera_id,
        "DEGRADED"
        if payload.threat_level
        in {"MODEL_ERROR", "SENSOR_ERROR", "UNAVAILABLE", "UNKNOWN", "INPUT_ERROR"}
        else "ONLINE",
    )
    receipt = {
        "accepted": True,
        "persisted": alert is not None,
        "alert_id": alert["id"] if alert else None,
        "created": created,
        "broadcast_count": 0,
        "frontend_notified": False,
        "dispatch_status": "not_required",
        "alert": alert,
    }
    if alert and alert["threat_level"] in {"HIGH", "CRITICAL"}:
        receipt["dispatch_status"] = (
            "queued" if config.DISCORD_WEBHOOK_URL else "unconfigured"
        )
    if publish:
        receipt.update(
            await manager.broadcast(
                {"type": "NEW_ALERT" if created else "UPDATE_ALERT", "payload": alert}
            )
        )
    return receipt


async def process_camera(camera, image):
    async with inference_slots:
        settings = await run_in_threadpool(store.settings)
        from backend.dispatch import evaluate_geofence

        loc = camera.get("location")
        if not loc:
            raise ValueError("Remote camera location is required")
        geofence_status = evaluate_geofence(loc["lat"], loc["lng"], settings)
        prediction = await run_in_threadpool(
            vision.predict,
            image,
            threshold=settings["confidence_threshold"],
            camera_id=camera["id"],
            geofence_status=geofence_status,
        )
        payload = Telemetry(
            camera_id=camera["id"],
            latitude=loc["lat"],
            longitude=loc["lng"],
            threat_level=prediction["risk_level"],
            detections=prediction["detections"],
            vision_confidence=prediction["confidence"],
            model_versions={"vision": prediction["model_version"]},
        )
        receipt = await ingest(
            payload, await run_in_threadpool(jpeg, image, prediction["detections"])
        )
        return receipt


@app.get("/health")
def health():
    return {
        "status": "ready" if vision.ready else "degraded",
        "vision_ready": vision.ready,
        "vision_model_version": vision.version,
        "nano_model_version": vision.nano_version,
        "escalation_model_version": vision.escalation_version,
        "vision_mode": config.VISION_MODE,
        "hardware_backend": vision.hardware_backend,
        "service": "backend",
    }


@app.post("/api/auth/ws-ticket", dependencies=[Depends(require())])
@limiter.limit("30/minute")
def websocket_ticket(request: Request):
    return {"ticket": issue_ticket(), "expires_in": 30}


@app.get("/api/auth/me")
def current_identity(role=Depends(identity)):
    return {"role": role}


@app.websocket("/ws/alerts")
async def websocket_alerts(websocket: WebSocket):
    origin = websocket.headers.get("origin")
    if (origin and origin not in config.FRONTEND_ORIGINS) or not consume_ticket(
        websocket.query_params.get("ticket", "")
    ):
        await websocket.close(code=1008)
        return
    await manager.connect(websocket)
    try:
        while True:
            message = await websocket.receive_json()
            if message.get("type") == "ACK":
                manager.acknowledge(websocket, message.get("event_id"))
    except (WebSocketDisconnect, ValueError, TypeError):
        pass
    finally:
        manager.disconnect(websocket)


@app.post("/api/edge/telemetry", dependencies=[operate])
@limiter.limit("60/minute")
async def telemetry(request: Request, payload: Telemetry):
    return await ingest(payload)


@app.post("/api/detect", dependencies=[operate])
@limiter.limit("45/minute")
async def detect_feed(
    request: Request,
    image: UploadFile = File(...),
    camera_id: str = Form("CAM_MANUAL_FEED"),
    latitude: float = Form(12.9698),
    longitude: float = Form(79.1559),
    persist: bool = Form(True),
    force_escalation: bool = Form(False),
):
    node = sensor(camera_id, latitude, longitude)
    async with inference_slots:
        decoded = await run_in_threadpool(image_upload, image)
        settings = await run_in_threadpool(store.settings)
        from backend.dispatch import evaluate_geofence

        geofence_status = evaluate_geofence(node.latitude, node.longitude, settings)
        prediction = await run_in_threadpool(
            vision.predict,
            decoded,
            threshold=settings["confidence_threshold"],
            camera_id=camera_id,
            geofence_status=geofence_status,
            skip_motion_check=True,
            force_escalation=force_escalation,
        )
        payload = Telemetry(
            **node.model_dump(),
            threat_level=prediction["risk_level"],
            detections=prediction["detections"],
            vision_confidence=prediction["confidence"],
            model_versions={"vision": prediction["model_version"]},
        )
        receipt = (
            await ingest(
                payload,
                await run_in_threadpool(jpeg, decoded, prediction["detections"]),
            )
            if persist
            else {"persisted": False, "frontend_notified": False, "alert_id": None}
        )
        return {
            **prediction,
            "threat_level": prediction["risk_level"],
            **receipt,
            "annotated_image": None,
        }


def process_video(data, suffix, sample_rate, threshold):
    results = []
    with temporary_file(data, suffix) as path:
        capture = cv2.VideoCapture(path)
        try:
            fps = capture.get(cv2.CAP_PROP_FPS)
            total = capture.get(cv2.CAP_PROP_FRAME_COUNT)
            if (
                not capture.isOpened()
                or not math.isfinite(fps)
                or not 0 < fps <= 120
                or not math.isfinite(total)
                or total <= 0
            ):
                raise HTTPException(422, "INPUT_ERROR: corrupt video or invalid FPS")
            if (
                total > config.MAX_VIDEO_FRAMES
                or total / fps > config.MAX_VIDEO_SECONDS
            ):
                raise HTTPException(413, "Video exceeds frame or duration limits")
            step = max(1, round(fps * sample_rate))
            if math.ceil(total / step) > config.MAX_SAMPLED_FRAMES:
                raise HTTPException(413, "Too many sampled frames")
            decoded = 0
            while decoded < total:
                ok, frame = capture.read()
                if not ok:
                    raise HTTPException(422, "INPUT_ERROR: truncated or corrupt video")
                if frame.shape[0] * frame.shape[1] > config.MAX_IMAGE_PIXELS:
                    raise HTTPException(413, "Video frame dimensions exceed limits")
                if decoded % step == 0:
                    image = Image.fromarray(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
                    prediction = vision.predict(image, threshold, skip_motion_check=True)
                    results.append(
                        (
                            decoded / fps,
                            prediction,
                            jpeg(image, prediction["detections"]),
                        )
                    )
                decoded += 1
            return results, decoded, fps
        finally:
            capture.release()


@app.post("/api/detect/video", dependencies=[operate])
@limiter.limit("4/minute")
async def detect_video(
    request: Request,
    video: UploadFile = File(...),
    camera_id: str = Form("CAM_VIDEO_CCTV"),
    latitude: float = Form(12.9698),
    longitude: float = Form(79.1559),
    sample_rate: float = Form(2, ge=1, le=30),
):
    node = sensor(camera_id, latitude, longitude)
    async with inference_slots:
        data, suffix = await run_in_threadpool(
            read_upload,
            video,
            config.MAX_VIDEO_BYTES,
            {
                ".mp4": {"video/mp4"},
                ".avi": {"video/x-msvideo"},
                ".mov": {"video/quicktime"},
                ".webm": {"video/webm"},
            },
        )
        settings = await run_in_threadpool(store.settings)
        results, decoded, fps = await run_in_threadpool(
            process_video, data, suffix, sample_rate, settings["confidence_threshold"]
        )
        incidents = {}
        base_time = utcnow() - timedelta(seconds=decoded / fps)
        for offset, prediction, image in results:
            payload = Telemetry(
                **node.model_dump(),
                modality="Video",
                threat_level=prediction["risk_level"],
                detections=prediction["detections"],
                vision_confidence=prediction["confidence"],
                model_versions={"vision": vision.version},
                observed_at=base_time + timedelta(seconds=offset),
            )
            receipt = await ingest(payload, image, payload.observed_at)
            if receipt["alert"]:
                incidents[receipt["alert_id"]] = receipt["alert"]
        return {
            "status": "success",
            "decoded_frames": decoded,
            "processed_frames": len(results),
            "fps": fps,
            "duration_seconds": decoded / fps,
            "detections_found": sum(bool(r[1]["detections"]) for r in results),
            "incidents": list(incidents.values()),
        }


@app.post("/api/detect/audio", dependencies=[operate])
@limiter.limit("20/minute")
async def detect_audio(
    request: Request,
    audio: UploadFile = File(...),
    camera_id: str = Form("ACOUSTIC_EDGE_SENSOR_01"),
    latitude: float = Form(12.9698),
    longitude: float = Form(79.1559),
):
    from backend.media import AUDIO_TYPES

    node = sensor(camera_id, latitude, longitude)
    data, _ = await run_in_threadpool(
        read_upload, audio, config.MAX_AUDIO_BYTES, AUDIO_TYPES
    )
    try:
        async with httpx.AsyncClient(timeout=45, trust_env=False) as client:
            response = await client.post(
                config.AUDIO_API_URL + "/api/audio/classify",
                files={"audio": (audio.filename, data, audio.content_type)},
                headers={"Authorization": "Bearer " + config.SERVICE_TOKEN},
            )
            if response.status_code in (413, 415, 422, 503):
                raise HTTPException(
                    response.status_code,
                    "Audio service rejected input or model unavailable",
                )
            response.raise_for_status()
            result = response.json()
        payload = Telemetry(
            **node.model_dump(),
            modality="Audio",
            threat_level=result["risk_level"],
            audio_confidence=result["confidence"],
            detections=[
                {
                    "label": result["label"],
                    "confidence": result["confidence"],
                    "kind": "audio",
                }
            ],
            model_versions={"audio": result["model_version"]},
        )
    except (httpx.HTTPError, ValueError, KeyError):
        raise HTTPException(503, "UNAVAILABLE: audio service failed") from None
    return {**result, "threat_level": result["risk_level"], **await ingest(payload)}


@app.get("/api/alerts", dependencies=[read_access])
def get_alerts(
    response: Response,
    limit: int = Query(100, ge=1, le=500),
    before: str | None = None,
    after: str | None = None,
    camera: str | None = None,
    threat_level: Risk | None = None,
    resolved: bool | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
):
    if before and after:
        raise HTTPException(422, "Use before or after, not both")
    start, end = validate_range(start, end, default=False)
    result = store.alerts(
        limit, before, after, camera, threat_level, resolved, start, end
    )
    if len(result) == limit:
        response.headers["X-Next-Cursor"] = result[-1]["id"]
    return result


@app.get("/api/alerts/{alert_id}/image", dependencies=[read_access])
def alert_image(alert_id: str):
    with store.connection() as db:
        row = db.execute(
            "SELECT image_reference FROM alerts WHERE id=?", (alert_id,)
        ).fetchone()
    if not row or not row[0]:
        raise HTTPException(404, "Image not found")
    path = (store.media_dir / row[0]).resolve()
    if path.parent != store.media_dir.resolve() or not path.is_file():
        raise HTTPException(404, "Image not found")
    return FileResponse(
        path, media_type="image/jpeg", headers={"Cache-Control": "private, no-store"}
    )


@app.post("/api/alerts/{alert_id}/resolve", dependencies=[operate])
async def resolve_alert(alert_id: str):
    def update():
        with store.connection(write=True) as db:
            if not db.execute(
                "UPDATE alerts SET resolved=1 WHERE id=?", (alert_id,)
            ).rowcount:
                raise HTTPException(404, "Incident not found")
        return store.get(alert_id)

    alert = await run_in_threadpool(update)
    await manager.broadcast({"type": "UPDATE_ALERT", "payload": alert})
    return {"status": "success", "id": alert_id, "resolved": True}


@app.delete("/api/alerts/clear", dependencies=[admin])
async def clear_alerts():
    def clear():
        with store.connection(write=True) as db:
            return db.execute("DELETE FROM alerts").rowcount

    deleted = await run_in_threadpool(clear)
    await manager.broadcast({"type": "CLEAR_ALERTS"})
    return {"status": "cleared", "deleted": deleted}


def validate_range(start, end, default=True):
    if any(value is not None and value.tzinfo is None for value in (start, end)):
        raise HTTPException(422, "Dates must include timezone")
    if default:
        end = end or utcnow()
        start = start or end - timedelta(days=30)
    if start and end and (start > end or end - start > timedelta(days=366)):
        raise HTTPException(422, "Invalid date range; maximum 366 days")
    return start, end


@app.get("/api/analytics", dependencies=[read_access])
def analytics(start: datetime | None = None, end: datetime | None = None):
    return store.analytics(*validate_range(start, end))


@app.get("/api/stats", dependencies=[read_access])
def stats():
    with store.connection() as db:
        threats = dict(
            db.execute("SELECT threat_level,count(*) FROM alerts GROUP BY threat_level")
        )
        wildlife = db.execute(
            "SELECT count(DISTINCT alert_id) FROM detection_labels WHERE kind='species'"
        ).fetchone()[0]
        dispatch = dict(
            db.execute("SELECT status,count(*) FROM dispatch_outbox GROUP BY status")
        )
    cameras = camera_status()
    return {
        "total_events": sum(threats.values()),
        "critical_intrusions": threats.get("CRITICAL", 0),
        "high_threats": threats.get("HIGH", 0),
        "wildlife_sightings": wildlife,
        "active_camera_nodes": sum(c["status"] == "ONLINE" for c in cameras),
        "total_camera_nodes": len(cameras),
        "dispatch": dispatch,
    }


@app.get("/api/cameras", dependencies=[read_access])
def cameras():
    return camera_status()


@app.get("/api/settings", dependencies=[read_access])
def settings():
    result = store.settings()
    result["discord_webhook_configured"] = bool(config.DISCORD_WEBHOOK_URL)
    result["available_streams"] = sorted(config.CAMERA_ENDPOINTS)
    return result


@app.post("/api/settings", dependencies=[admin])
@limiter.limit("20/minute")
def update_settings(request: Request, payload: SettingsPayload):
    updates = payload.model_dump(exclude_none=True)
    if "remote_streams" in updates:
        try:
            for camera_id in updates["remote_streams"]:
                validate_endpoint(camera_id)
        except ValueError:
            raise HTTPException(
                422, "Stream must be a provisioned, allowlisted camera"
            ) from None
    store.update_settings(updates)
    return {"status": "updated", "settings": settings()}


@app.get("/api/cameras/{camera_id}/frame", dependencies=[read_access])
def camera_frame(camera_id: str):
    import time
    from backend.cameras import frames

    if camera_id not in config.CAMERA_IDS:
        raise HTTPException(404, "Camera not found")
    frame = frames.get(camera_id)
    if not frame or time.monotonic() - frame[0] > 10:
        raise HTTPException(503, "Camera feed unavailable")
    return Response(
        frame[1], media_type="image/jpeg", headers={"Cache-Control": "no-store"}
    )


@app.get("/api/governor", dependencies=[read_access])
def get_governor_state():
    import psutil

    cpu = psutil.cpu_percent()
    decision = governor.decide(
        has_motion=False,
        active_tracks_count=len(vision.tracker.get_active_tracks()),
        cpu_utilization_pct=cpu,
    )
    return {
        "cadence_mode": decision.cadence_mode,
        "target_fps": decision.target_fps,
        "model_tier": decision.model_tier,
        "input_resolution": decision.input_resolution,
        "tracking_enabled": decision.tracking_enabled,
        "clahe_enabled": decision.clahe_enabled,
        "audio_poll_seconds": decision.audio_poll_seconds,
        "cpu_utilization_pct": cpu,
        "rationale": decision.rationale,
    }


@app.get("/api/heatmap", dependencies=[read_access])
def get_risk_heatmap(hour: int | None = Query(None, ge=0, le=23)):
    with store.connection() as db:
        rows = db.execute("SELECT * FROM alerts").fetchall()
        alerts = [dict(r) for r in rows]
    sett = store.settings()
    hq = sett["ranger_hq"]
    cells = heatmap_engine.compute_heatmap(
        historical_alerts=alerts,
        target_hour=hour,
        core_center=(hq["lat"], hq["lng"]),
        core_radius_m=sett["geofence_core_radius_m"],
    )
    return cells


@app.get("/api/incidents/multi-camera", dependencies=[read_access])
def get_multi_camera_incidents():
    incidents = multi_camera_correlator.get_active_incidents()
    return [
        {
            "incident_id": inc.incident_id,
            "cameras": inc.cameras,
            "first_seen": inc.first_seen,
            "last_seen": inc.last_seen,
            "transit_duration_s": inc.transit_duration_s,
            "total_distance_m": inc.total_distance_m,
            "estimated_speed_kmh": inc.estimated_speed_kmh,
            "direction_heading_deg": inc.direction_heading_deg,
            "primary_label": inc.primary_label,
            "max_threat_level": inc.max_threat_level,
            "confidence": inc.confidence,
            "summary": inc.summary,
        }
        for inc in incidents
    ]


@app.post("/api/alerts/{alert_id}/feedback", dependencies=[operate])
def submit_ranger_feedback(alert_id: str, payload: RangerFeedbackPayload):
    alert = store.get(alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    img_bytes = None
    if alert.get("image_reference"):
        path = store.media_dir / alert["image_reference"]
        if path.is_file():
            img_bytes = path.read_bytes()
    return hard_negative_mgr.record_feedback(
        alert_id=alert_id,
        feedback=payload.feedback_type,
        ranger_id=payload.ranger_id,
        notes=payload.notes,
        image_bytes=img_bytes,
        detections=alert.get("detections"),
    )


@app.get("/api/feedback/metrics", dependencies=[read_access])
def get_feedback_metrics():
    return hard_negative_mgr.compute_metrics()


@app.get("/api/alerts/{alert_id}/explain", dependencies=[read_access])
def explain_alert(alert_id: str):
    alert = store.get(alert_id)
    if not alert:
        raise HTTPException(404, "Alert not found")
    sett = store.settings()
    from backend.dispatch import evaluate_geofence

    geofence_status = evaluate_geofence(alert["latitude"], alert["longitude"], sett)
    explanation = generate_explainable_alert(
        detections=alert.get("detections", []),
        threat_level=alert.get("threat_level", "LOW"),
        detection_level="THREAT"
        if alert.get("threat_level") in {"HIGH", "CRITICAL"}
        else "SUSPICIOUS",
        vision_confidence=alert.get("vision_confidence")
        or alert.get("peak_confidence")
        or 0.80,
        hits_confirmed=alert.get("frame_count", 1),
        total_frames_sampled=max(1, alert.get("frame_count", 1) + 2),
        is_night=False,
        in_core_geofence=(geofence_status == "CORE"),
        base_threshold=sett.get("confidence_threshold", 0.50),
    )
    return {
        "summary": explanation.summary_sentence,
        "evidence_checklist": explanation.evidence_checklist,
        "model_cascade_trace": explanation.model_cascade_trace,
        "temporal_confirmation_ratio": explanation.temporal_confirmation_ratio,
        "threshold_audit": explanation.threshold_audit,
        "recommended_action": explanation.operational_action_recommended,
    }


@app.get("/api/research/ablation", dependencies=[read_access])
def get_ablation_results():
    ablation_file = config.DATA_DIR / "ablation_results.json"
    if not ablation_file.is_file():
        ablation_file = config.ROOT / "data" / "ablation_results.json"
    if ablation_file.is_file():
        return json.loads(ablation_file.read_text(encoding="utf-8"))
    return []


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000)
