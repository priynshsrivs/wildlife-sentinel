import pytest
from fastapi.testclient import TestClient
from backend.database import Store
from backend import main, security
from backend.realtime import manager


@pytest.fixture
def store(tmp_path):
    repository = Store(tmp_path / "test.db", tmp_path / "images")
    repository.initialize()
    return repository


@pytest.fixture
def client(store, monkeypatch):
    monkeypatch.setattr(main, "store", store)
    monkeypatch.setattr(main.vision, "initialize", lambda: None)
    monkeypatch.setattr(main.vision, "model", None)
    monkeypatch.setattr(
        security,
        "API_TOKENS",
        {"viewer": "test-viewer", "operator": "test-operator", "admin": "test-admin"},
    )
    monkeypatch.setattr(security, "SERVICE_TOKEN", "test-service")
    main.limiter.enabled = False
    manager.connections.clear()
    manager.pending.clear()
    security.tickets.clear()
    with TestClient(main.app) as test_client:
        yield test_client


@pytest.fixture
def auth():
    return {"Authorization": "Bearer test-admin"}
