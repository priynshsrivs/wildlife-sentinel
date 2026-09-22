import httpx
import pytest
from backend import cameras, dispatch
from tests.test_incidents import event


@pytest.mark.parametrize(
    "url",
    [
        "http://169.254.169.254/latest/meta-data",
        "file:///etc/passwd",
        "http://localhost:8080/video",
        "http://user:pass@127.0.0.1/video",
        "http://127.0.0.1/video?target=secret",
        "ftp://127.0.0.1/video",
    ],
)
def test_ssrf_rejected(monkeypatch, url):
    monkeypatch.setattr(cameras, "CAMERA_ENDPOINTS", {"COMPUTER_1": url})
    monkeypatch.setattr(cameras, "CAMERA_ALLOWED_IPS", {"127.0.0.1", "169.254.169.254"})
    with pytest.raises(ValueError):
        cameras.validate_endpoint("COMPUTER_1")


def test_only_explicit_camera_allowed(monkeypatch):
    monkeypatch.setattr(
        cameras, "CAMERA_ENDPOINTS", {"COMPUTER_1": "http://127.0.0.1:8080/video"}
    )
    monkeypatch.setattr(cameras, "CAMERA_ALLOWED_IPS", set())
    with pytest.raises(ValueError):
        cameras.validate_endpoint("COMPUTER_1")
    monkeypatch.setattr(cameras, "CAMERA_ALLOWED_IPS", {"127.0.0.1"})
    assert cameras.validate_endpoint("COMPUTER_1").endswith("/video")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "status,expected",
    [
        (204, "sent"),
        (200, "sent"),
        (400, "failed"),
        (500, "pending"),
        (429, "pending"),
        (302, "pending"),
    ],
)
async def test_dispatch_http_outcomes(store, monkeypatch, status, expected):
    store.ingest(event())
    monkeypatch.setattr(
        dispatch,
        "DISCORD_WEBHOOK_URL",
        "https://discord.com/api/webhooks/123/test-token",
    )
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(status, json={"retry_after": 2})
        )
    ) as client:
        await dispatch.dispatch_once(store, client)
    with store.connection() as db:
        row = db.execute("SELECT status,attempts FROM dispatch_outbox").fetchone()
        assert row["status"] == expected and row["attempts"] == 1


@pytest.mark.asyncio
async def test_dispatch_timeout(store, monkeypatch):
    store.ingest(event())
    monkeypatch.setattr(
        dispatch,
        "DISCORD_WEBHOOK_URL",
        "https://discord.com/api/webhooks/123/test-token",
    )

    def timeout(request):
        raise httpx.ReadTimeout("timeout")

    async with httpx.AsyncClient(transport=httpx.MockTransport(timeout)) as client:
        await dispatch.dispatch_once(store, client)
    with store.connection() as db:
        assert (
            db.execute("SELECT status FROM dispatch_outbox").fetchone()[0] == "pending"
        )


def test_body_limit(client, auth):
    response = client.post(
        "/api/detect",
        headers={**auth, "Content-Length": str(200 * 1024 * 1024)},
        content=b"",
    )
    assert response.status_code == 413


def test_rate_limit(client, auth):
    from backend.main import limiter

    limiter.enabled = True
    limiter.reset()
    try:
        responses = [
            client.post("/api/settings", headers=auth, json={}) for _ in range(21)
        ]
        assert responses[-1].status_code == 429
    finally:
        limiter.enabled = False


def test_mjpeg_auth(monkeypatch):
    import mjpeg_server

    monkeypatch.setattr(mjpeg_server, "TOKEN", "camera-secret")
    with mjpeg_server.app.test_client() as client:
        assert client.get("/video").status_code == 401
        assert (
            client.get(
                "/", headers={"Authorization": "Bearer camera-secret"}
            ).status_code
            == 200
        )
        assert client.get("/health").json["status"] == "OFFLINE"
