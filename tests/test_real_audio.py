"""Opt-in real YAMNet inference through both APIs, with isolated alert storage."""

import os
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient


@pytest.mark.skipif(os.getenv("RUN_MODEL_TESTS") != "1", reason="Requires installed YAMNet model")
def test_real_audio_ingestion(client, auth, monkeypatch, store):
    from ai_service.audio import audio_api
    from ai_service.audio.yamnet_classifier import AudioClassifier
    from backend import main

    monkeypatch.setattr(audio_api, "classifier", AudioClassifier())
    monkeypatch.setattr(main.config, "SERVICE_TOKEN", "test-service")
    original = httpx.AsyncClient
    with TestClient(audio_api.app) as audio:
        assert audio.get("/health").json()["audio_ready"] is True

        def forward(request):
            response = audio.post(
                "/api/audio/classify",
                content=request.content,
                headers=dict(request.headers),
            )
            return httpx.Response(response.status_code, json=response.json())

        monkeypatch.setattr(
            main.httpx, "AsyncClient",
            lambda **kwargs: original(transport=httpx.MockTransport(forward)),
        )
        sample = Path(__file__).resolve().parents[1] / "ai_service/audio/test.wav"
        response = client.post(
            "/api/detect/audio", headers=auth,
            files={"audio": ("sample.wav", sample.read_bytes(), "audio/wav")},
        )
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["model_version"].startswith("yamnet-")
    assert 0 <= result["confidence"] <= 1
    should_persist = result["risk_level"] in {"MONITORED", "MEDIUM", "HIGH", "CRITICAL"}
    assert result["persisted"] is should_persist
    if should_persist:
        record = store.get(result["alert_id"])
        assert record["modality"] == "Audio"
        assert record["detections"][0]["label"] == result["label"]
    else:
        assert result["alert_id"] is None
