import io
import pytest
from PIL import Image
from tests.test_incidents import event


def image_bytes():
    f = io.BytesIO()
    Image.new("RGB", (32, 32)).save(f, format="JPEG")
    return f.getvalue()


@pytest.mark.parametrize(
    "method,path",
    [
        ("get", "/api/alerts"),
        ("get", "/api/settings"),
        ("get", "/api/cameras"),
        ("get", "/api/stats"),
        ("get", "/api/analytics"),
        ("post", "/api/settings"),
        ("delete", "/api/alerts/clear"),
        ("post", "/api/alerts/id/resolve"),
        ("post", "/api/detect"),
        ("post", "/api/edge/telemetry"),
    ],
)
def test_unauthorized(client, method, path):
    assert getattr(client, method)(path).status_code == 401


def test_roles(client):
    viewer = {"Authorization": "Bearer test-viewer"}
    operator = {"Authorization": "Bearer test-operator"}
    assert client.get("/api/alerts", headers=viewer).status_code == 200
    assert client.post("/api/settings", headers=viewer, json={}).status_code == 403
    assert client.delete("/api/alerts/clear", headers=operator).status_code == 403
    assert (
        client.post(
            "/api/settings", headers={"Authorization": "Bearer test-service"}, json={}
        ).status_code
        == 403
    )


def test_telemetry_and_resolution(client, auth):
    response = client.post(
        "/api/edge/telemetry", headers=auth, json=event().model_dump(mode="json")
    )
    assert response.status_code == 200, response.text
    receipt = response.json()
    assert (
        receipt["persisted"]
        and not receipt["frontend_notified"]
        and receipt["broadcast_count"] == 0
    )
    alert_id = receipt["alert_id"]
    assert client.get("/api/alerts", headers=auth).json()[0]["id"] == alert_id
    assert client.post(f"/api/alerts/{alert_id}/resolve", headers=auth).json()[
        "resolved"
    ]
    assert client.get("/api/alerts?resolved=false", headers=auth).json() == []
    assert client.delete("/api/alerts/clear", headers=auth).json()["deleted"] == 1


@pytest.mark.parametrize(
    "patch",
    [
        {"camera_id": "UNREGISTERED"},
        {"latitude": 91},
        {"longitude": 181},
        {"threat_level": "FAKE"},
        {"vision_confidence": 1.1},
        {"detections": []},
    ],
)
def test_invalid_telemetry(client, auth, patch):
    payload = event().model_dump(mode="json")
    payload.update(patch)
    assert (
        client.post("/api/edge/telemetry", headers=auth, json=payload).status_code
        == 422
    )


def test_model_unavailable(client, auth):
    response = client.post(
        "/api/detect",
        headers=auth,
        files={"image": ("a.jpg", image_bytes(), "image/jpeg")},
    )
    assert response.status_code == 503
    assert client.get("/health").json()["vision_ready"] is False
    assert client.get("/api/alerts", headers=auth).json() == []


def test_empty_inference(client, auth, monkeypatch):
    from backend.main import vision

    monkeypatch.setattr(
        vision,
        "predict",
        lambda *args, **kwargs: {
            "label": "NO_DETECTION",
            "risk_level": "LOW",
            "confidence": 0,
            "detections": [],
            "model_version": "fixture",
        },
    )
    response = client.post(
        "/api/detect",
        headers=auth,
        files={"image": ("a.jpg", image_bytes(), "image/jpeg")},
    )
    assert response.status_code == 200, response.text
    assert not response.json()["persisted"]


@pytest.mark.parametrize(
    "filename,data,mime,status",
    [
        ("a.exe", b"x", "image/jpeg", 415),
        ("a.jpg", b"not an image", "image/jpeg", 422),
        ("a.jpg", b"", "image/jpeg", 422),
        ("a.jpg", b"abc", "text/plain", 415),
    ],
)
def test_image_validation(client, auth, filename, data, mime, status):
    assert (
        client.post(
            "/api/detect", headers=auth, files={"image": (filename, data, mime)}
        ).status_code
        == status
    )


def test_upload_gps_validation(client, auth):
    assert (
        client.post(
            "/api/detect",
            headers=auth,
            data={"latitude": "nan"},
            files={"image": ("a.jpg", image_bytes(), "image/jpeg")},
        ).status_code
        == 422
    )


def test_pagination_and_dates(client, auth, store):
    first = store.ingest(event())[0]
    second = store.ingest(event(camera="COMPUTER_2"))[0]
    response = client.get("/api/alerts?limit=1", headers=auth)
    assert response.headers["X-Next-Cursor"] == second["id"]
    assert (
        client.get("/api/alerts?before=" + second["id"], headers=auth).json()[0]["id"]
        == first["id"]
    )
    assert (
        client.get("/api/analytics?start=2025-01-01", headers=auth).status_code == 422
    )
    assert client.get("/api/alerts?limit=0", headers=auth).status_code == 422


def test_settings_ssrf_secrets(client, auth):
    assert (
        client.post(
            "/api/settings",
            headers=auth,
            json={"remote_streams": {"COMPUTER_1": "http://169.254.169.254/"}},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/settings", headers=auth, json={"discord_webhook_url": "secret"}
        ).status_code
        == 422
    )
    assert "discord_webhook_url" not in client.get("/api/settings", headers=auth).json()
    assert (
        client.post(
            "/api/settings", headers=auth, json={"geofence_core_radius_m": 0}
        ).status_code
        == 422
    )


def test_websocket_ticket_and_delivery(client, auth):
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/alerts"):
            pass
    ticket = client.post("/api/auth/ws-ticket", headers=auth).json()["ticket"]
    with client.websocket_connect("/ws/alerts?ticket=" + ticket) as ws:
        from concurrent.futures import ThreadPoolExecutor

        with ThreadPoolExecutor() as pool:
            future = pool.submit(
                client.post,
                "/api/edge/telemetry",
                headers=auth,
                json=event().model_dump(mode="json"),
            )
            message = ws.receive_json()
            assert message["type"] == "NEW_ALERT"
            ws.send_json({"type": "ACK", "event_id": message["event_id"]})
            assert future.result().json()["frontend_notified"] is True
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/ws/alerts?ticket=" + ticket):
            pass


def test_cors(client):
    response = client.options(
        "/api/alerts",
        headers={
            "Origin": "https://evil.example",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_camera_status_not_config_count(client, auth):
    from backend.cameras import health

    health.clear()
    assert client.get("/api/stats", headers=auth).json()["active_camera_nodes"] == 0
    assert all(
        c["status"] == "UNKNOWN"
        for c in client.get("/api/cameras", headers=auth).json()
    )
