import io
import numpy as np
import pytest
import soundfile as sf
from fastapi import HTTPException
from fastapi.testclient import TestClient
from backend.media import decode_audio
from ai_service.audio.yamnet_classifier import AudioClassifier, AudioPrediction
from ai_service.audio import audio_api
from backend import security


def wav(seconds=1, sr=16000, noise=False):
    output = io.BytesIO()
    values = (
        np.random.default_rng(42).normal(0, 0.1, int(seconds * sr))
        if noise
        else np.zeros(int(seconds * sr))
    )
    sf.write(output, values, sr, format="WAV")
    return output.getvalue()


@pytest.mark.parametrize("sr,noise", [(16000, False), (44100, True), (8000, True)])
def test_valid_waveform(sr, noise):
    decoded = decode_audio(wav(sr=sr, noise=noise))
    assert len(decoded) == 16000 and np.isfinite(decoded).all()


@pytest.mark.parametrize(
    "data", [b"", b"not audio", wav(seconds=0), wav(seconds=31), wav(sr=4000)], ids=["empty","invalid","zero-duration","too-long","bad-rate"]
)
def test_invalid_audio(data):
    with pytest.raises(HTTPException) as error:
        decode_audio(data)
    assert error.value.status_code in (413, 415, 422)


def test_model_failure_no_low():
    classifier = AudioClassifier()
    with pytest.raises(HTTPException) as error:
        classifier.predict(np.zeros(16000))
    assert error.value.status_code == 503
    classifier.model = lambda value: (_ for _ in ()).throw(
        RuntimeError("private model error")
    )
    with pytest.raises(HTTPException) as error:
        classifier.predict(np.zeros(16000))
    assert "private" not in error.value.detail


def test_audio_unmapped_unknown():
    classifier = AudioClassifier()
    classifier.names = ["Music"]

    class Scores:
        def numpy(self):
            return np.array([[0.99]])

    classifier.model = lambda waveform: (Scores(), None, None)
    result = classifier.predict(np.zeros(16000))
    assert result.risk_level == "UNKNOWN" and result.confidence == 0.99


@pytest.fixture
def audio_client(monkeypatch):
    monkeypatch.setattr(security, "API_TOKENS", {"operator": "audio-token"})
    monkeypatch.setattr(audio_api.classifier, "initialize", lambda: None)
    monkeypatch.setattr(audio_api.classifier, "model", None)
    audio_api.limiter.enabled = False
    with TestClient(audio_api.app) as client:
        yield client


def test_audio_endpoints(audio_client):
    headers = {"Authorization": "Bearer audio-token"}
    assert audio_client.get("/health").json()["audio_ready"] is False
    assert audio_client.post("/api/audio/classify").status_code == 401
    assert audio_client.get("/api/audio/labels", headers=headers).status_code == 200
    response = audio_client.post(
        "/api/audio/classify",
        headers=headers,
        files={"audio": ("a.wav", wav(), "audio/wav")},
    )
    assert response.status_code == 503
    for name, data, mime, expected in [
        ("a.exe", b"abc", "audio/wav", 415),
        ("a.wav", b"bad", "audio/wav", 422),
        ("a.wav", wav(), "text/plain", 415),
    ]:
        assert (
            audio_client.post(
                "/api/audio/classify",
                headers=headers,
                files={"audio": (name, data, mime)},
            ).status_code
            == expected
        )


def test_video_corrupt(client, auth):
    assert (
        client.post(
            "/api/detect/video",
            headers=auth,
            files={"video": ("a.mp4", b"broken", "video/mp4")},
        ).status_code
        == 422
    )
    assert (
        client.post(
            "/api/detect/video",
            headers=auth,
            data={"sample_rate": 0},
            files={"video": ("a.mp4", b"broken", "video/mp4")},
        ).status_code
        == 422
    )


def test_video_aggregation(client, auth, monkeypatch, tmp_path):
    import cv2
    from backend.main import vision

    path = tmp_path / "sample.avi"
    writer = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), 10, (32, 32))
    assert writer.isOpened()
    for _ in range(30):
        writer.write(np.zeros((32, 32, 3), dtype=np.uint8))
    writer.release()
    monkeypatch.setattr(
        vision,
        "predict",
        lambda *args, **kwargs: {
            "risk_level": "HIGH",
            "confidence": 0.8,
            "model_version": "fixture",
            "detections": [
                {
                    "label": "car",
                    "confidence": 0.8,
                    "bbox": [1, 1, 20, 20],
                    "kind": "object",
                }
            ],
        },
    )
    response = client.post(
        "/api/detect/video",
        headers=auth,
        data={"sample_rate": 1},
        files={"video": ("sample.avi", path.read_bytes(), "video/x-msvideo")},
    )
    assert response.status_code == 200, response.text
    result = response.json()
    assert (
        result["decoded_frames"] == 30
        and result["processed_frames"] == 3
        and len(result["incidents"]) == 1
    )
    assert result["incidents"][0]["frame_count"] == 3


def test_pipeline_persistence_and_failure(audio_client, monkeypatch):
    import httpx
    from tests.test_api import image_bytes

    headers = {"Authorization": "Bearer audio-token"}
    monkeypatch.setattr(
        audio_api.classifier,
        "predict",
        lambda _: AudioPrediction("Chainsaw", 0.9, "HIGH", "fixture"),
    )
    calls = []

    def transport(request):
        import json

        calls.append(request.url.path)
        if request.url.path == "/api/detect":
            assert b'name="persist"' in request.content and b"false" in request.content
            return httpx.Response(
                200,
                json={
                    "risk_level": "HIGH",
                    "confidence": 0.4,
                    "model_version": "fixture",
                    "detections": [
                        {"label": "car", "confidence": 0.4, "kind": "object"}
                    ],
                },
            )
        body = json.loads(request.content)
        assert body["max_confidence"] == 0.9 and body["threat_level"] == "CRITICAL"
        return httpx.Response(
            200,
            json={
                "accepted": True,
                "persisted": True,
                "alert_id": "test",
                "frontend_notified": False,
                "broadcast_count": 0,
                "dispatch_status": "queued",
            },
        )

    original = httpx.AsyncClient
    monkeypatch.setattr(
        audio_api.httpx,
        "AsyncClient",
        lambda **kw: original(transport=httpx.MockTransport(transport)),
    )
    files = {
        "image": ("a.jpg", image_bytes(), "image/jpeg"),
        "audio": ("a.wav", wav(), "audio/wav"),
    }
    response = audio_client.post("/api/audio/pipeline", headers=headers, files=files)
    assert response.status_code == 200, response.text
    assert (
        response.json()["persisted"]
        and not response.json()["frontend_notified"]
        and not response.json()["alert_dispatched"]
    )
    calls.clear()
    response = audio_client.post(
        "/api/audio/pipeline", headers=headers, files=files, data={"demo": "true"}
    )
    assert response.json()["mode"] == "DEMO" and "/api/edge/telemetry" not in calls
    monkeypatch.setattr(
        audio_api.httpx,
        "AsyncClient",
        lambda **kw: original(
            transport=httpx.MockTransport(lambda req: httpx.Response(503))
        ),
    )
    response = audio_client.post("/api/audio/pipeline", headers=headers, files=files)
    assert response.status_code == 207
    assert (
        response.json()["combined_risk"] == "HIGH"
        and not response.json()["persisted"]
        and response.json()["errors"]
    )
