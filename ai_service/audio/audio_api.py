"""YAMNet service and paired-input fusion orchestration."""

import asyncio
import logging
from contextlib import asynccontextmanager
import httpx
from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.concurrency import run_in_threadpool
import sentinel_config as config
from ai_service.audio.yamnet_classifier import classifier, LABEL_RISKS
from ai_service.risk_engine import calculate_combined_risk, VERSION
from backend.media import audio_upload, image_upload
from backend.middleware import BodyLimitMiddleware
from backend.schemas import SensorInput, Telemetry
from backend.security import require, rate_key

log = logging.getLogger(__name__)
limiter = Limiter(key_func=rate_key)
slots = asyncio.Semaphore(2)
operate = Depends(require("operator", service=True))


@asynccontextmanager
async def lifespan(app):
    await run_in_threadpool(classifier.initialize)
    yield


app = FastAPI(title="Wildlife Sentinel Audio", version="6.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(
    BodyLimitMiddleware,
    max_bytes=config.MAX_IMAGE_BYTES + config.MAX_AUDIO_BYTES + 1024 * 1024,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.exception_handler(Exception)
async def unexpected(request, exc):
    log.error("audio_request_failed path=%s", request.url.path, exc_info=exc)
    return JSONResponse({"detail": "Audio service error"}, status_code=500)


@app.get("/health")
def health_check():
    return {
        "status": "ready" if classifier.model is not None else "degraded",
        "audio_ready": classifier.model is not None,
        "audio_model_version": classifier.version,
    }


@app.get("/api/audio/labels", dependencies=[Depends(require(service=True))])
def labels():
    return {
        "labels": [
            {"label": name, "risk_level": risk} for name, risk in LABEL_RISKS.items()
        ],
        "unmapped_risk": "UNKNOWN",
    }


@app.post("/api/audio/classify", dependencies=[operate])
@limiter.limit("30/minute")
async def classify_audio_upload(request: Request, audio: UploadFile = File(...)):
    async with slots:
        waveform = await run_in_threadpool(audio_upload, audio)
        result = await run_in_threadpool(classifier.predict, waveform)
        return result.to_dict()


@app.post("/api/audio/pipeline", dependencies=[operate])
@limiter.limit("20/minute")
async def run_full_pipeline(
    request: Request,
    image: UploadFile = File(...),
    audio: UploadFile = File(...),
    camera_id: str = Form("CAM_MANUAL_FEED"),
    latitude: float = Form(12.9698),
    longitude: float = Form(79.1559),
    demo: bool = Form(False),
):
    try:
        node = SensorInput(camera_id=camera_id, latitude=latitude, longitude=longitude)
    except ValidationError:
        raise HTTPException(422, "Invalid camera or coordinates") from None
    async with slots:
        # Validate both uploads before model or network work; never accept arbitrary remote inputs.
        await run_in_threadpool(image_upload, image)
        await image.seek(0)
        image_bytes = await image.read(config.MAX_IMAGE_BYTES + 1)
        waveform = await run_in_threadpool(audio_upload, audio)
        errors = []
        try:
            audio_result = (
                await run_in_threadpool(classifier.predict, waveform)
            ).to_dict()
        except HTTPException:
            audio_result = {
                "label": None,
                "risk_level": "MODEL_ERROR",
                "confidence": None,
                "model_version": classifier.version,
            }
            errors.append("Audio model unavailable")
        headers = {"Authorization": "Bearer " + config.SERVICE_TOKEN}
        async with httpx.AsyncClient(
            timeout=60, trust_env=False, follow_redirects=False
        ) as client:
            try:
                response = await client.post(
                    config.BACKEND_URL + "/api/detect",
                    headers=headers,
                    files={"image": (image.filename, image_bytes, image.content_type)},
                    data={**node.model_dump(), "persist": "false"},
                )
                response.raise_for_status()
                vision_result = response.json()
                if (
                    "risk_level" not in vision_result
                    or "confidence" not in vision_result
                ):
                    raise ValueError("Invalid vision response")
            except (httpx.HTTPError, ValueError):
                vision_result = {
                    "label": None,
                    "risk_level": "UNAVAILABLE",
                    "confidence": None,
                    "detections": [],
                    "model_version": "unavailable",
                }
                errors.append("Vision service unavailable")
            combined = calculate_combined_risk(vision_result, audio_result)
            detections = list(vision_result.get("detections", []))
            if audio_result["risk_level"] in {
                "MONITORED",
                "MEDIUM",
                "HIGH",
                "CRITICAL",
            }:
                detections.append(
                    {
                        "label": audio_result["label"],
                        "confidence": audio_result["confidence"],
                        "kind": "audio",
                    }
                )
            receipt = {
                "accepted": False,
                "persisted": False,
                "alert_id": None,
                "frontend_notified": False,
                "broadcast_count": 0,
                "dispatch_status": "not_required",
            }
            if not demo:
                payload = Telemetry(
                    **node.model_dump(),
                    modality="Fused",
                    detections=detections,
                    threat_level=combined["combined_risk"],
                    vision_confidence=combined["vision_confidence"],
                    audio_confidence=combined["audio_confidence"],
                    model_versions={
                        "vision": vision_result["model_version"],
                        "audio": audio_result["model_version"],
                        "risk": VERSION,
                    },
                )
                try:
                    response = await client.post(
                        config.BACKEND_URL + "/api/edge/telemetry",
                        headers=headers,
                        json=payload.model_dump(mode="json"),
                    )
                    response.raise_for_status()
                    candidate = response.json()
                    if candidate.get("accepted") is not True or not all(
                        k in candidate
                        for k in (
                            "persisted",
                            "broadcast_count",
                            "frontend_notified",
                            "alert_id",
                        )
                    ):
                        raise ValueError("Invalid persistence receipt")
                    receipt = candidate
                except (httpx.HTTPError, ValueError):
                    errors.append("Telemetry persistence failed")
            result = {
                "pipeline": "FULL_FUSION",
                "mode": "DEMO" if demo else "REAL",
                "camera_id": camera_id,
                "vision": vision_result,
                "audio": audio_result,
                "combined_risk": combined["combined_risk"],
                "risk_breakdown": combined,
                **receipt,
                "errors": errors,
                "alert_dispatched": receipt.get("dispatch_status") == "sent",
            }
            return JSONResponse(result, status_code=207 if errors else 200)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("ai_service.audio.audio_api:app", host="127.0.0.1", port=5001)
