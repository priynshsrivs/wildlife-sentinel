"""Regressions for verified integration and input-validation failures."""

import time
from concurrent.futures import ThreadPoolExecutor
import pytest
from PIL import Image
from backend import cameras, main, security, hard_negatives
from backend.schemas import Detection, Telemetry
from tests.test_incidents import event
from tests.test_api import image_bytes


def test_bearer_scheme_case_and_non_ascii_credentials(client):
    assert (
        client.get(
            "/api/auth/me", headers={"Authorization": "bearer test-viewer"}
        ).status_code
        == 200
    )
    assert security.token_role("invalid-é") is None
    assert security.token_role("x" * 5000) is None


def test_explanation_uses_persisted_evidence(client, auth, store):
    alert, _, _ = store.ingest(event())
    response = client.get(f"/api/alerts/{alert['id']}/explain", headers=auth)
    assert response.status_code == 200
    audit = response.json()
    assert "person" in audit["summary"]
    assert audit["confidence"] == 0.8
    assert audit["frame_count"] == 1
    assert audit["threshold_audit"]["historical_threshold"] is None
    assert audit["temporal_confirmation_ratio"] is None
    assert audit["evidence_checklist"][0]["finding"].startswith("person detected")
    assert audit["dispatch"][0]["status"] == "pending"


def test_feedback_updates_the_active_repository(
    client, auth, store, monkeypatch, tmp_path
):
    destination = tmp_path / "hard_negatives"
    (destination / "images").mkdir(parents=True)
    monkeypatch.setattr(hard_negatives, "HARD_NEGATIVES_DIR", destination)
    alert, _, _ = store.ingest(event(), image_bytes())
    response = client.post(
        f"/api/alerts/{alert['id']}/feedback",
        headers=auth,
        json={"feedback_type": "FALSE_POSITIVE"},
    )
    assert response.status_code == 200
    assert response.json()["saved_to_hard_negatives"] is True
    with store.connection() as db:
        assert db.execute("SELECT count(*) FROM ranger_feedback").fetchone()[0] == 1
    assert len(list((destination / "images").glob("*.jpg"))) == 1
    # The old frontend contract must fail validation instead of silently recording bad data.
    assert (
        client.post(
            f"/api/alerts/{alert['id']}/feedback",
            headers=auth,
            json={"classification": "TRUE_THREAT"},
        ).status_code
        == 422
    )


def test_roi_annotations_can_be_persisted(client, auth, monkeypatch):
    monkeypatch.setattr(
        main.vision,
        "predict",
        lambda *args, **kwargs: {
            "risk_level": "HIGH",
            "confidence": 0.8,
            "model_version": "fixture",
            "detections": [
                {
                    "label": "person",
                    "confidence": 0.8,
                    "bbox": [1, 1, 20, 20],
                    "kind": "object",
                    "matched_rois": ["Restricted Gate"],
                }
            ],
        },
    )
    response = client.post(
        "/api/detect",
        headers=auth,
        files={"image": ("a.jpg", image_bytes(), "image/jpeg")},
    )
    assert response.status_code == 200
    assert response.json()["alert"]["detections"][0]["matched_rois"] == [
        "Restricted Gate"
    ]


@pytest.mark.asyncio
async def test_camera_buffer_consumes_each_frame_once_and_expires_stale_frames():
    buffer = cameras.LatestFrameBuffer("test")
    await buffer.put(b"fresh")
    assert (await buffer.get_latest())[0] == b"fresh"
    assert await buffer.get_latest() is None
    await buffer.put(b"stale")
    buffer.latest_time = time.monotonic() - 11
    assert await buffer.get_latest() is None


def test_websocket_ignores_non_object_messages_and_continues(client, auth):
    ticket = client.post("/api/auth/ws-ticket", headers=auth).json()["ticket"]
    with client.websocket_connect("/ws/alerts?ticket=" + ticket) as socket:
        for value in ([], None, "invalid", {"type": "ACK", "event_id": []}):
            socket.send_json(value)
        with ThreadPoolExecutor() as pool:
            result = pool.submit(
                client.post,
                "/api/edge/telemetry",
                headers=auth,
                json=event().model_dump(mode="json"),
            )
            message = socket.receive_json()
            socket.send_json({"type": "ACK", "event_id": message["event_id"]})
            assert result.result().json()["frontend_notified"] is True


def test_camera_motion_is_isolated(monkeypatch):
    from ai_service.vision import CascadedVisionEngine
    import sentinel_config as config

    class Result:
        boxes = []

    engine = CascadedVisionEngine()
    engine.nano_model = lambda *args, **kwargs: [Result()]
    engine.ready = True
    monkeypatch.setattr(config, "MOTION_FILTER_ENABLED", True)
    image = Image.new("RGB", (32, 32))
    first = engine.predict(image, camera_id="camera-a")
    second = engine.predict(image, camera_id="camera-b")
    third = engine.predict(image, camera_id="camera-a")
    assert not first.get("skipped_motion")
    assert not second.get("skipped_motion")
    assert third["skipped_motion"] is True


def test_zero_confidence_remains_zero_in_explanation(client, auth, store):
    payload = Telemetry(
        threat_level="HIGH",
        vision_confidence=0,
        detections=[Detection(label="person", confidence=0)],
    )
    alert, _, _ = store.ingest(payload)
    audit = client.get(f"/api/alerts/{alert['id']}/explain", headers=auth).json()
    assert audit["confidence"] == 0


def test_resolution_cancels_unsent_dispatch(client, auth, store):
    alert, _, _ = store.ingest(event())
    assert (
        client.post(f"/api/alerts/{alert['id']}/resolve", headers=auth).status_code
        == 200
    )
    with store.connection() as db:
        assert (
            db.execute("SELECT status FROM dispatch_outbox").fetchone()[0]
            == "cancelled"
        )


def test_viewer_upload_is_rejected_before_multipart_validation(client):
    response = client.post(
        "/api/detect",
        headers={
            "Authorization": "Bearer test-viewer",
            "Content-Type": "multipart/form-data; boundary=invalid",
        },
        content=b"not a valid multipart body",
    )
    assert response.status_code == 403


@pytest.mark.parametrize("kind,code", [("binary", 1003), ("oversize", 1009)])
def test_websocket_rejects_unsupported_and_oversized_messages(client, auth, kind, code):
    from starlette.websockets import WebSocketDisconnect

    ticket = client.post("/api/auth/ws-ticket", headers=auth).json()["ticket"]
    with client.websocket_connect("/ws/alerts?ticket=" + ticket) as socket:
        if kind == "binary":
            socket.send_bytes(b"unsupported")
        else:
            socket.send_text("x" * 4097)
        with pytest.raises(WebSocketDisconnect) as result:
            socket.receive_json()
        assert result.value.code == code


def test_feedback_export_name_cannot_escape_collection(store, tmp_path, monkeypatch):
    directory = tmp_path / "collection"
    (directory / "images").mkdir(parents=True)
    monkeypatch.setattr(hard_negatives, "HARD_NEGATIVES_DIR", directory)
    manager = hard_negatives.HardNegativeManager(lambda: store.connection(write=True))
    result = manager.record_feedback(
        "../../escape", "FALSE_POSITIVE", image_bytes=image_bytes()
    )
    assert result["saved_to_hard_negatives"] is True
    assert len(list((directory / "images").glob("*.jpg"))) == 1
    assert not (tmp_path / "escape.jpg").exists()


def test_ticket_issue_and_consumption_are_thread_safe():
    with ThreadPoolExecutor(max_workers=8) as executor:
        issued = list(executor.map(lambda _: security.issue_ticket(), range(80)))
        accepted = list(executor.map(security.consume_ticket, issued))
    assert len(set(issued)) == 80
    assert all(accepted)
    assert not any(security.consume_ticket(ticket) for ticket in issued)


@pytest.mark.asyncio
async def test_websocket_connection_cap_is_atomic():
    import asyncio
    from backend.realtime import ConnectionManager

    class Socket:
        def __init__(self):
            self.closed = None

        async def accept(self):
            await asyncio.sleep(0)

        async def close(self, code):
            self.closed = code

    manager = ConnectionManager()
    sockets = [Socket() for _ in range(120)]
    accepted = await asyncio.gather(*(manager.connect(socket) for socket in sockets))
    assert sum(accepted) == 100
    assert sum(socket.closed == 1013 for socket in sockets) == 20


def test_wildlife_monitoring_records_wildlife_risk(monkeypatch):
    import numpy as np
    import sentinel_config as config
    from ai_service.vision import CascadedVisionEngine

    class Box:
        cls = np.array([0])
        conf = np.array([0.95])
        xyxy = np.array([[1, 1, 20, 20]])

    class Result:
        boxes = [Box()]

    class Model:
        names = {0: "elephant"}

        def __call__(self, *args, **kwargs):
            return [Result()]

    monkeypatch.setattr(config, "VISION_MODE", "WILDLIFE_MONITORING")
    engine = CascadedVisionEngine()
    engine.nano_model = Model()
    engine.ready = True
    result = engine.predict(Image.new("RGB", (32, 32)), skip_motion_check=True)
    assert result["risk_level"] == "MONITORED"
    assert result["detections"][0]["kind"] == "species"


def test_video_inference_receives_camera_and_geofence(
    client, auth, monkeypatch, tmp_path
):
    import cv2
    import numpy as np

    path = tmp_path / "context.avi"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 10, (32, 32))
    assert writer.isOpened()
    for _ in range(10):
        writer.write(np.zeros((32, 32, 3), dtype=np.uint8))
    writer.release()
    contexts = []

    def predict(*args, **kwargs):
        contexts.append(kwargs)
        return {
            "risk_level": "LOW",
            "confidence": 0,
            "model_version": "fixture",
            "detections": [],
        }

    monkeypatch.setattr(main.vision, "predict", predict)
    response = client.post(
        "/api/detect/video",
        headers=auth,
        files={"video": ("context.avi", path.read_bytes(), "video/avi")},
    )
    assert response.status_code == 200
    assert contexts[0]["camera_id"] == "CAM_VIDEO_CCTV"
    assert contexts[0]["geofence_status"] == "CORE"
