"""Decoupled camera capture with latest-frame-wins buffering and health telemetry.

Separates high-rate network frame acquisition from neural inference.
Maintains rolling FPS, dropped-frame counts, and adaptive inference cadence.
"""

import asyncio
import ipaddress
import logging
import os
import time
from urllib.parse import urlsplit
import httpx

from backend.media import decode_image
from sentinel_config import (
    CAMERA_ALLOWED_IPS,
    CAMERA_ENDPOINTS,
    CAMERA_IDS,
    CAMERAS,
    MAX_IMAGE_BYTES,
)

log = logging.getLogger(__name__)

# Real-time state
health = {}
frames = {}
telemetry = {}


class LatestFrameBuffer:
    def __init__(self, camera_id: str):
        self.camera_id = camera_id
        self.latest_data: bytes | None = None
        self.latest_time: float = 0.0
        self.unconsumed: bool = False
        self.dropped_frames: int = 0
        self.frame_count: int = 0
        self.last_fps_calc: float = time.monotonic()
        self.measured_fps: float = 0.0
        self.lock = asyncio.Lock()

    async def put(self, data: bytes):
        async with self.lock:
            now = time.monotonic()
            if self.unconsumed:
                self.dropped_frames += 1
            self.latest_data = data
            self.latest_time = now
            self.unconsumed = True
            self.frame_count += 1

            elapsed = now - self.last_fps_calc
            if elapsed >= 1.0:
                self.measured_fps = round(self.frame_count / elapsed, 1)
                self.frame_count = 0
                self.last_fps_calc = now

    async def get_latest(self) -> tuple[bytes, float] | None:
        async with self.lock:
            if self.latest_data is None:
                return None
            self.unconsumed = False
            return self.latest_data, self.latest_time


def validate_endpoint(camera_id: str) -> str:
    if camera_id not in CAMERA_IDS or camera_id not in CAMERA_ENDPOINTS:
        raise ValueError("Unregistered camera endpoint")
    url = CAMERA_ENDPOINTS[camera_id]
    parsed = urlsplit(url)
    if (
        parsed.scheme not in {"http", "https"}
        or parsed.username
        or parsed.password
        or parsed.fragment
        or parsed.query
    ):
        raise ValueError("Camera endpoint must be HTTP(S) without credentials or query")
    address = ipaddress.ip_address(parsed.hostname or "")
    if (
        address.is_multicast
        or address.is_unspecified
        or address.is_link_local
        or address.is_reserved
    ):
        raise ValueError("Forbidden camera address")
    if str(address) not in CAMERA_ALLOWED_IPS:
        raise ValueError("Camera IP must be explicitly allowlisted")
    return url


def heartbeat(camera_id: str, status: str = "ONLINE"):
    now = time.monotonic()
    health[camera_id] = {"status": status, "last_seen_monotonic": now}
    if camera_id not in telemetry:
        telemetry[camera_id] = {
            "fps": 0.0,
            "inference_latency_ms": 0.0,
            "dropped_frames": 0,
            "activity_mode": "IDLE",
        }


def update_inference_telemetry(camera_id: str, latency_ms: float, risk_level: str):
    if camera_id not in telemetry:
        heartbeat(camera_id)
    telem = telemetry[camera_id]
    telem["inference_latency_ms"] = round(latency_ms, 1)

    # Adaptive cadence mode based on detection severity
    if risk_level in {"CRITICAL", "HIGH"}:
        telem["activity_mode"] = "THREAT"  # Target 15 FPS
    elif risk_level == "MEDIUM":
        telem["activity_mode"] = "SUSPICIOUS"  # Target 10 FPS
    elif risk_level == "MONITORED":
        telem["activity_mode"] = "MOTION"  # Target 5 FPS
    else:
        telem["activity_mode"] = "IDLE"  # Target 2 FPS


def camera_status() -> list[dict]:
    result = []
    now = time.monotonic()
    for camera in CAMERAS:
        cid = camera["id"]
        state = health.get(cid)
        telem = telemetry.get(cid, {})
        status = (
            "UNKNOWN"
            if not state
            else state["status"]
            if now - state["last_seen_monotonic"] < 30
            else "OFFLINE"
        )
        result.append(
            {
                **camera,
                "status": status,
                "fps": telem.get("fps", 0.0),
                "inference_latency_ms": telem.get("inference_latency_ms", 0.0),
                "dropped_frames": telem.get("dropped_frames", 0),
                "activity_mode": telem.get("activity_mode", "IDLE"),
                "battery_pct": None,
                "signal_dbm": None,
                "stream_configured": cid in CAMERA_ENDPOINTS,
            }
        )
    return result


async def camera_worker(camera: dict, store, process):
    """Orchestrates decoupled acquisition and latest-frame-wins inference workers."""
    camera_id = camera["id"]
    buffer = LatestFrameBuffer(camera_id)
    stop_event = asyncio.Event()

    async def capture_loop():
        delay = 1
        while not stop_event.is_set():
            settings = await asyncio.to_thread(store.settings)
            if not settings["remote_streams"].get(camera_id, False):
                await asyncio.sleep(2)
                continue
            try:
                url = validate_endpoint(camera_id)
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(5, read=10),
                    trust_env=False,
                    follow_redirects=False,
                ) as client:
                    async with client.stream(
                        "GET",
                        url,
                        headers={
                            "Authorization": "Bearer "
                            + os.getenv("CAMERA_STREAM_TOKEN", "")
                        },
                    ) as response:
                        response.raise_for_status()
                        if "multipart/x-mixed-replace" not in response.headers.get(
                            "content-type", ""
                        ):
                            raise ValueError("Camera must provide MJPEG")
                        stream_buffer = bytearray()
                        async for chunk in response.aiter_bytes(65536):
                            if stop_event.is_set():
                                break
                            stream_buffer.extend(chunk)
                            if len(stream_buffer) > MAX_IMAGE_BYTES:
                                raise ValueError("Camera frame too large")
                            while True:
                                start = stream_buffer.find(b"\xff\xd8")
                                end = stream_buffer.find(b"\xff\xd9", max(start, 0))
                                if start < 0 or end < 0:
                                    break
                                data = bytes(stream_buffer[start : end + 2])
                                del stream_buffer[: end + 2]
                                heartbeat(camera_id)
                                frames[camera_id] = (time.monotonic(), data)
                                await buffer.put(data)
                                if camera_id in telemetry:
                                    telemetry[camera_id]["fps"] = buffer.measured_fps
                                    telemetry[camera_id]["dropped_frames"] = buffer.dropped_frames
                                delay = 1
                            if not (await asyncio.to_thread(store.settings))[
                                "remote_streams"
                            ].get(camera_id, False):
                                break
            except asyncio.CancelledError:
                raise
            except Exception:
                heartbeat(camera_id, "DEGRADED")
                log.warning("camera_capture_failed camera=%s", camera_id)
            await asyncio.sleep(delay)
            delay = min(30, delay * 2)

    async def inference_loop():
        cadence_intervals = {
            "IDLE": 0.50,  # 2 FPS
            "MOTION": 0.20,  # 5 FPS
            "SUSPICIOUS": 0.10,  # 10 FPS
            "THREAT": 0.066,  # 15 FPS
        }
        while not stop_event.is_set():
            settings = await asyncio.to_thread(store.settings)
            if not settings["remote_streams"].get(camera_id, False):
                await asyncio.sleep(1)
                continue

            frame_item = await buffer.get_latest()
            if frame_item is None:
                await asyncio.sleep(0.05)
                continue

            data, _ = frame_item
            t0 = time.perf_counter()
            try:
                frame_img = await asyncio.to_thread(decode_image, data)
                res = await process(camera, frame_img)
                latency_ms = (time.perf_counter() - t0) * 1000
                risk = res.get("threat_level", "LOW") if isinstance(res, dict) else "LOW"
                update_inference_telemetry(camera_id, latency_ms, risk)
            except Exception:
                log.exception("camera_inference_error camera=%s", camera_id)

            mode = telemetry.get(camera_id, {}).get("activity_mode", "IDLE")
            sleep_interval = cadence_intervals.get(mode, 0.50)
            await asyncio.sleep(sleep_interval)

    try:
        await asyncio.gather(capture_loop(), inference_loop())
    finally:
        stop_event.set()
