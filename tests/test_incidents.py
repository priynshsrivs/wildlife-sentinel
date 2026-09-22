import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import timedelta
import pytest
from backend.database import Store, utcnow
from backend.schemas import Telemetry


def event(
    camera="COMPUTER_1",
    label="person",
    risk="HIGH",
    bbox=None,
    kind="object",
    modality="Vision",
):
    return Telemetry(
        camera_id=camera,
        threat_level=risk,
        modality=modality,
        vision_confidence=0.8,
        detections=[{"label": label, "confidence": 0.8, "bbox": bbox, "kind": kind}],
    )


def test_empty_and_ambient_no_incident(store):
    for payload in (
        Telemetry(threat_level="LOW"),
        Telemetry(threat_level="UNKNOWN"),
        event(label="Wind", kind="audio", risk="LOW", modality="Audio"),
    ):
        assert store.ingest(payload) == (None, False, False)
    assert store.alerts() == []


@pytest.mark.parametrize(
    "label,risk,kind",
    [
        ("person", "CRITICAL", "object"),
        ("car", "HIGH", "object"),
        ("elephant", "MONITORED", "species"),
    ],
)
def test_alert_creation(store, label, risk, kind):
    record, created, publish = store.ingest(event(label=label, risk=risk, kind=kind))
    assert created and publish and record["threat_level"] == risk
    assert record["frame_count"] == 1
    with store.connection() as db:
        assert db.execute("SELECT count(*) FROM dispatch_outbox").fetchone()[0] == int(
            risk in {"HIGH", "CRITICAL"}
        )


def test_temporal_spatial_camera_dedup(store):
    now = utcnow()
    payload = event(bbox=[0, 0, 100, 100])
    first, _, _ = store.ingest(payload, now=now)
    for second in (1, 2, 5, 10):
        current, created, _ = store.ingest(payload, now=now + timedelta(seconds=second))
        assert current["id"] == first["id"] and not created
    assert current["frame_count"] == 5
    assert store.ingest(event(camera="COMPUTER_2", bbox=[0, 0, 100, 100]), now=now)[1]
    assert store.ingest(event(bbox=[200, 200, 300, 300]), now=now)[1]
    assert store.ingest(payload, now=now + timedelta(seconds=50))[1]


def test_escalation_once(store):
    p = event()
    first, _, _ = store.ingest(p)
    p.threat_level = "CRITICAL"
    second, created, publish = store.ingest(p)
    assert not created and publish and second["id"] == first["id"]
    store.ingest(p)
    with store.connection() as db:
        assert db.execute("SELECT count(*) FROM dispatch_outbox").fetchone()[0] == 2


def test_concurrent_ingestion_one_incident(store):
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda _: store.ingest(event()), range(20)))
    assert len({r[0]["id"] for r in results}) == 1
    assert store.alerts()[0]["frame_count"] == 20


def test_sql_analytics_kinds(store):
    store.ingest(event(label="elephant", kind="species", risk="MONITORED"))
    store.ingest(event(label="car"))
    store.ingest(
        event(label="Gunshot", kind="audio", risk="CRITICAL", modality="Audio")
    )
    result = store.analytics(utcnow() - timedelta(days=1), utcnow() + timedelta(days=1))
    assert result["species_distribution"] == {"elephant": 1}
    assert result["audio_event_distribution"] == {"Gunshot": 1}
    assert result["threat_object_distribution"] == {"car": 1}
    assert result["most_frequent_target"] in ("car", "elephant")


def test_legacy_migration_preserves_data(tmp_path):
    path = tmp_path / "legacy.db"
    with sqlite3.connect(path) as db:
        db.execute(
            "CREATE TABLE alerts (id TEXT PRIMARY KEY,camera_id TEXT,timestamp TEXT,latitude REAL,longitude REAL,threat_level TEXT,detections TEXT,resolved BOOLEAN,annotated_image TEXT)"
        )
        db.execute(
            "INSERT INTO alerts VALUES (?,?,?,?,?,?,?,?,?)",
            (
                "legacy",
                "old",
                "2025-01-01 12:00:00",
                1,
                2,
                "HIGH",
                json.dumps([{"label": "person", "confidence": 0.9}]),
                0,
                "data:image/jpeg;base64,/9j/2Q==",
            ),
        )
    migrated = Store(path, tmp_path / "images")
    migrated.initialize()
    migrated.initialize()
    alert = migrated.get("legacy")
    assert alert["timestamp"] == "2025-01-01T12:00:00+00:00"
    assert alert["modality"] == "Unknown"
    assert alert["image_url"] == "/api/alerts/legacy/image"
    assert (tmp_path / "legacy.db.pre-v2.bak").exists()
    assert len(list((tmp_path / "images").glob("*.jpg"))) == 1


def test_settings_persist(store):
    store.update_settings({"geofence_core_radius_m": 1234})
    assert (
        Store(store.path, store.media_dir).settings()["geofence_core_radius_m"] == 1234
    )
