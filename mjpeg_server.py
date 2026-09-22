"""Authenticated MJPEG service with a single shared camera producer."""

import atexit
import hmac
import logging
import os
import threading
import time
import cv2
from flask import Flask, Response, request, abort
from dotenv import load_dotenv

load_dotenv()
log = logging.getLogger(__name__)
app = Flask(__name__)
CAMERA_INDEX = int(os.getenv("CAMERA_INDEX", "0"))
TOKEN = os.getenv("CAMERA_STREAM_TOKEN", "")
condition = threading.Condition()
stop_event = threading.Event()
frame = None
last_frame = 0.0
producer = None
start_lock = threading.Lock()


def capture_loop():
    global frame, last_frame
    capture = None
    backoff = 1
    try:
        while not stop_event.is_set():
            if capture is None:
                capture = cv2.VideoCapture(
                    CAMERA_INDEX, cv2.CAP_DSHOW if os.name == "nt" else cv2.CAP_ANY
                )
                capture.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            success, image = capture.read()
            if not success:
                capture.release()
                capture = None
                with condition:
                    frame = None
                    condition.notify_all()
                log.warning("camera_unavailable")
                stop_event.wait(backoff)
                backoff = min(30, backoff * 2)
                continue
            success, encoded = cv2.imencode(
                ".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 80]
            )
            if success:
                with condition:
                    frame = encoded.tobytes()
                    last_frame = time.monotonic()
                    condition.notify_all()
                backoff = 1
            stop_event.wait(0.1)
    finally:
        if capture is not None:
            capture.release()


def ensure_producer():
    global producer
    with start_lock:
        if producer is None:
            producer = threading.Thread(
                target=capture_loop, name="mjpeg-camera", daemon=True
            )
            producer.start()


def shutdown():
    stop_event.set()
    with condition:
        condition.notify_all()
    if producer is not None:
        producer.join(timeout=3)


atexit.register(shutdown)


@app.before_request
def authenticate():
    if request.path == "/health":
        return
    supplied = request.headers.get("Authorization", "")
    if not TOKEN or not hmac.compare_digest(supplied, "Bearer " + TOKEN):
        abort(401)


def generate_frames():
    previous = 0
    while not stop_event.is_set():
        with condition:
            condition.wait_for(
                lambda: last_frame > previous or stop_event.is_set(), timeout=5
            )
            if stop_event.is_set():
                return
            if frame is None or time.monotonic() - last_frame > 5:
                return
            data = frame
            previous = last_frame
        yield (
            b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: "
            + str(len(data)).encode()
            + b"\r\n\r\n"
            + data
            + b"\r\n"
        )


@app.get("/")
def index():
    return {
        "service": "Wildlife Sentinel MJPEG",
        "stream": "/video",
        "authentication": "Bearer CAMERA_STREAM_TOKEN",
    }


@app.get("/video")
def video():
    ensure_producer()
    return Response(
        generate_frames(),
        mimetype="multipart/x-mixed-replace; boundary=frame",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/health")
def health():
    connected = frame is not None and time.monotonic() - last_frame < 5
    return {
        "status": "ONLINE" if connected else "OFFLINE",
        "camera_index": CAMERA_INDEX,
    }


if __name__ == "__main__":
    from waitress import serve

    logging.basicConfig(level=logging.INFO)
    if not TOKEN:
        raise SystemExit("Set CAMERA_STREAM_TOKEN before starting the camera server")
    log.info(
        "MJPEG service listening on http://127.0.0.1:8080; use the authenticated backend preview"
    )
    try:
        serve(
            app,
            host=os.getenv("MJPEG_BIND_HOST", "127.0.0.1"),
            port=8080,
            threads=8,
            connection_limit=16,
            channel_timeout=30,
        )
    finally:
        shutdown()
