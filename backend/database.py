"""SQLite repository, versioned additive migrations, transactional incident aggregation.
Run one API worker. BEGIN IMMEDIATE serializes grouping and outbox creation across threads.
"""

import base64
import hashlib
import json
import logging
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from sentinel_config import (
    DATABASE_PATH,
    DATA_DIR,
    DEFAULT_SETTINGS,
    INCIDENT_WINDOW_SECONDS,
    INCIDENT_IOU,
    BROADCAST_COOLDOWN_SECONDS,
)
from ai_service.risk_engine import PRIORITY

log = logging.getLogger(__name__)


def utcnow():
    return datetime.now(timezone.utc)


def iso(value):
    return value.astimezone(timezone.utc).isoformat()


def parse_time(value):
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return (
        parsed.replace(tzinfo=timezone.utc)
        if parsed.tzinfo is None
        else parsed.astimezone(timezone.utc)
    )


def overlap(a, b):
    if not a or not b:
        return True
    intersection = max(0, min(a[2], b[2]) - max(a[0], b[0])) * max(
        0, min(a[3], b[3]) - max(a[1], b[1])
    )
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - intersection
    return union > 0 and intersection / union >= INCIDENT_IOU


def same_event(old, new):
    # Require identical class sets, and overlap for each class when both have boxes.
    if {(d["label"], d.get("kind", "object")) for d in old} != {
        (d["label"], d.get("kind", "object")) for d in new
    }:
        return False
    return all(
        any(
            a["label"] == b["label"] and overlap(a.get("bbox"), b.get("bbox"))
            for b in old
        )
        for a in new
    )


class Store:
    def __init__(self, path=DATABASE_PATH, media_dir=DATA_DIR / "images"):
        self.path, self.media_dir = Path(path), Path(media_dir)

    @contextmanager
    def connection(self, write=False):
        db = sqlite3.connect(self.path, timeout=15)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        db.execute("PRAGMA busy_timeout=15000")
        try:
            if write:
                db.execute("BEGIN IMMEDIATE")
            yield db
            db.commit()
        except Exception:
            db.rollback()
            log.exception("database_transaction_failed")
            raise
        finally:
            db.close()

    def initialize(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if self.path.exists():
            with sqlite3.connect(self.path, timeout=15) as source:
                has_version = source.execute(
                    "SELECT 1 FROM sqlite_master WHERE name='schema_migrations'"
                ).fetchone()
                version = (
                    source.execute(
                        "SELECT max(version) FROM schema_migrations"
                    ).fetchone()[0]
                    if has_version
                    else 0
                )
                if (version or 0) < 2:
                    backup = self.path.with_name(self.path.name + ".pre-v2.bak")
                    if not backup.exists():
                        with sqlite3.connect(backup) as target:
                            source.backup(target)
        self.media_dir.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(self.path, timeout=15) as db:
            db.execute("PRAGMA journal_mode=WAL")
        with self.connection(write=True) as db:
            db.execute(
                "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)"
            )
            version = (
                db.execute("SELECT max(version) FROM schema_migrations").fetchone()[0]
                or 0
            )
            if version < 1:
                db.execute(
                    "CREATE TABLE IF NOT EXISTS alerts (id TEXT PRIMARY KEY, camera_id TEXT, timestamp TEXT, latitude REAL, longitude REAL, threat_level TEXT, detections TEXT, resolved BOOLEAN DEFAULT 0, annotated_image TEXT)"
                )
                columns = {r["name"] for r in db.execute("PRAGMA table_info(alerts)")}
                additions = {
                    "first_seen": "TEXT",
                    "last_seen": "TEXT",
                    "frame_count": "INTEGER DEFAULT 1",
                    "peak_confidence": "REAL DEFAULT 0",
                    "modality": "TEXT DEFAULT 'Unknown'",
                    "image_reference": "TEXT",
                    "model_versions": "TEXT DEFAULT '{}'",
                    "vision_confidence": "REAL",
                    "audio_confidence": "REAL",
                    "last_broadcast": "TEXT",
                    "observed_at": "TEXT",
                }
                for name, kind in additions.items():
                    if name not in columns:
                        db.execute(f"ALTER TABLE alerts ADD COLUMN {name} {kind}")
                db.execute(
                    "UPDATE alerts SET first_seen=timestamp, last_seen=timestamp WHERE first_seen IS NULL"
                )
                for name in (
                    "timestamp",
                    "threat_level",
                    "camera_id",
                    "resolved",
                    "last_seen",
                ):
                    db.execute(
                        f"CREATE INDEX IF NOT EXISTS idx_alert_{name} ON alerts({name})"
                    )
                db.execute(
                    "CREATE TABLE IF NOT EXISTS settings (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)"
                )
                db.execute(
                    "CREATE TABLE IF NOT EXISTS detection_labels (alert_id TEXT REFERENCES alerts(id) ON DELETE CASCADE, label TEXT, kind TEXT, PRIMARY KEY(alert_id,label,kind))"
                )
                db.execute(
                    "CREATE INDEX IF NOT EXISTS idx_labels_kind ON detection_labels(kind,label)"
                )
                db.execute(
                    "CREATE TABLE IF NOT EXISTS dispatch_outbox (id INTEGER PRIMARY KEY, alert_id TEXT REFERENCES alerts(id) ON DELETE CASCADE, severity TEXT, status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, next_attempt TEXT, UNIQUE(alert_id,severity))"
                )
                # Original records have unknown provenance; do not invent model or modality data.
                for row in db.execute("SELECT id,detections FROM alerts"):
                    try:
                        detections = json.loads(row["detections"] or "[]")
                        for det in detections:
                            kind = det.get("kind", "legacy")
                            db.execute(
                                "INSERT OR IGNORE INTO detection_labels VALUES (?,?,?)",
                                (row["id"], det["label"], kind),
                            )
                    except (ValueError, KeyError, TypeError):
                        log.warning("legacy_detections_invalid id=%s", row["id"])
                db.execute(
                    "INSERT INTO schema_migrations VALUES (1,?)", (iso(utcnow()),)
                )
            if version < 2:
                for row in db.execute(
                    "SELECT id,timestamp,first_seen,last_seen FROM alerts"
                ):
                    for field in ("timestamp", "first_seen", "last_seen"):
                        if row[field]:
                            db.execute(
                                f"UPDATE alerts SET {field}=? WHERE id=?",
                                (iso(parse_time(row[field])), row["id"]),
                            )
                # Move legacy JPEG payloads without deleting unrecognizable local data.
                for row in db.execute(
                    "SELECT id,annotated_image FROM alerts WHERE annotated_image IS NOT NULL"
                ):
                    value = row["annotated_image"]
                    if value.startswith("data:image/jpeg;base64,"):
                        try:
                            data = base64.b64decode(
                                value.split(",", 1)[1], validate=True
                            )
                            name = (
                                hashlib.sha256(row["id"].encode()).hexdigest() + ".jpg"
                            )
                            self.write_image(name, data)
                            db.execute(
                                "UPDATE alerts SET image_reference=?,annotated_image=NULL WHERE id=?",
                                (name, row["id"]),
                            )
                        except ValueError:
                            log.warning("legacy_image_invalid id=%s", row["id"])
                db.execute(
                    "INSERT INTO schema_migrations VALUES (2,?)", (iso(utcnow()),)
                )
            if version < 3:
                db.execute(
                    """
                    CREATE TABLE IF NOT EXISTS ranger_feedback (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        alert_id TEXT,
                        feedback_type TEXT NOT NULL,
                        ranger_id TEXT NOT NULL,
                        notes TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                db.execute("CREATE INDEX IF NOT EXISTS idx_rf_alert ON ranger_feedback(alert_id)")
                db.execute("CREATE INDEX IF NOT EXISTS idx_rf_type ON ranger_feedback(feedback_type)")
                db.execute(
                    """
                    CREATE TABLE IF NOT EXISTS multi_camera_incidents (
                        incident_id TEXT PRIMARY KEY,
                        cameras TEXT NOT NULL,
                        first_seen TEXT NOT NULL,
                        last_seen TEXT NOT NULL,
                        transit_duration_s REAL,
                        total_distance_m REAL,
                        estimated_speed_kmh REAL,
                        direction_heading_deg REAL,
                        primary_label TEXT,
                        max_threat_level TEXT,
                        confidence REAL,
                        summary TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                db.execute(
                    """
                    CREATE TABLE IF NOT EXISTS camera_tamper_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        camera_id TEXT NOT NULL,
                        tamper_type TEXT NOT NULL,
                        confidence REAL NOT NULL,
                        details TEXT,
                        created_at TEXT NOT NULL
                    )
                    """
                )
                db.execute(
                    "INSERT INTO schema_migrations VALUES (3,?)", (iso(utcnow()),)
                )

    def write_image(self, name, data):
        target = self.media_dir / name
        temporary = target.with_suffix(".tmp")
        temporary.write_bytes(data)
        temporary.replace(target)

    def settings(self):
        with self.connection() as db:
            row = db.execute("SELECT value FROM settings WHERE id=1").fetchone()
        result = json.loads(json.dumps(DEFAULT_SETTINGS))
        if row:
            result.update(json.loads(row["value"]))
        return result

    def update_settings(self, updates):
        with self.connection(write=True) as db:
            row = db.execute("SELECT value FROM settings WHERE id=1").fetchone()
            result = json.loads(json.dumps(DEFAULT_SETTINGS))
            if row:
                result.update(json.loads(row["value"]))
            result.update(updates)
            db.execute(
                "INSERT INTO settings VALUES (1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
                (json.dumps(result),),
            )
        return result

    def serialize(self, row):
        result = dict(row)
        result.pop("annotated_image", None)
        result["detections"] = json.loads(result["detections"] or "[]")
        result["model_versions"] = json.loads(result["model_versions"] or "{}")
        result["location"] = {
            "lat": result.pop("latitude"),
            "lng": result.pop("longitude"),
        }
        result["resolved"] = bool(result["resolved"])
        result["incident_id"] = result["id"]
        result["image_url"] = (
            f"/api/alerts/{result['id']}/image"
            if result.pop("image_reference", None)
            else None
        )
        for field in (
            "timestamp",
            "first_seen",
            "last_seen",
            "observed_at",
            "last_broadcast",
        ):
            if result.get(field):
                result[field] = iso(parse_time(result[field]))
        return result

    def ingest(self, telemetry, image=None, now=None):
        now = now or utcnow()
        stamp = iso(now)
        if not telemetry.detections or telemetry.threat_level not in {
            "MONITORED",
            "MEDIUM",
            "HIGH",
            "CRITICAL",
        }:
            return None, False, False
        detections = [d.model_dump() for d in telemetry.detections]
        with self.connection(write=True) as db:
            candidates = db.execute(
                "SELECT * FROM alerts WHERE camera_id=? AND modality=? AND resolved=0 AND last_seen>=? ORDER BY last_seen DESC LIMIT 100",
                (
                    telemetry.camera_id,
                    telemetry.modality,
                    iso(now - timedelta(seconds=INCIDENT_WINDOW_SECONDS)),
                ),
            ).fetchall()
            record = next(
                (
                    r
                    for r in candidates
                    if same_event(json.loads(r["detections"]), detections)
                ),
                None,
            )
            created = record is None
            escalated = record is not None and PRIORITY[
                telemetry.threat_level
            ] > PRIORITY.get(record["threat_level"], -1)
            publish = (
                created
                or escalated
                or (
                    now - parse_time(record["last_broadcast"] or record["last_seen"])
                ).total_seconds()
                >= BROADCAST_COOLDOWN_SECONDS
            )
            alert_id = uuid.uuid4().hex if created else record["id"]
            level = (
                telemetry.threat_level
                if created or escalated
                else record["threat_level"]
            )
            if created:
                image_name = alert_id + ".jpg" if image else None
                if image:
                    self.write_image(image_name, image)
                db.execute(
                    "INSERT INTO alerts (id,camera_id,timestamp,latitude,longitude,threat_level,detections,resolved,first_seen,last_seen,frame_count,peak_confidence,modality,image_reference,model_versions,vision_confidence,audio_confidence,last_broadcast,observed_at) VALUES (?,?,?,?,?,?,?,0,?,?,1,?,?,?,?,?,?,?,?)",
                    (
                        alert_id,
                        telemetry.camera_id,
                        stamp,
                        telemetry.latitude,
                        telemetry.longitude,
                        level,
                        json.dumps(detections),
                        stamp,
                        stamp,
                        telemetry.max_confidence,
                        telemetry.modality,
                        image_name,
                        json.dumps(telemetry.model_versions),
                        telemetry.vision_confidence,
                        telemetry.audio_confidence,
                        stamp,
                        iso(telemetry.observed_at),
                    ),
                )
            else:
                db.execute(
                    "UPDATE alerts SET last_seen=?,frame_count=frame_count+1,peak_confidence=max(peak_confidence,?),threat_level=?,detections=?,vision_confidence=?,audio_confidence=?,last_broadcast=?,observed_at=? WHERE id=?",
                    (
                        stamp,
                        telemetry.max_confidence,
                        level,
                        json.dumps(detections),
                        telemetry.vision_confidence,
                        telemetry.audio_confidence,
                        stamp if publish else record["last_broadcast"],
                        iso(telemetry.observed_at),
                        alert_id,
                    ),
                )
            for det in detections:
                db.execute(
                    "INSERT OR IGNORE INTO detection_labels VALUES (?,?,?)",
                    (alert_id, det["label"], det["kind"]),
                )
            if (created or escalated) and level in {"HIGH", "CRITICAL"}:
                db.execute(
                    "INSERT OR IGNORE INTO dispatch_outbox (alert_id,severity,next_attempt) VALUES (?,?,?)",
                    (alert_id, level, stamp),
                )
            result = self.serialize(
                db.execute("SELECT * FROM alerts WHERE id=?", (alert_id,)).fetchone()
            )
        log.info(
            "incident_persisted id=%s created=%s modality=%s",
            alert_id,
            created,
            telemetry.modality,
        )
        return result, created, publish

    def get(self, alert_id):
        with self.connection() as db:
            row = db.execute("SELECT * FROM alerts WHERE id=?", (alert_id,)).fetchone()
        return self.serialize(row) if row else None

    def alerts(
        self,
        limit=100,
        before=None,
        after=None,
        camera=None,
        threat_level=None,
        resolved=None,
        start=None,
        end=None,
    ):
        conditions, params = [], []
        for field, value in [
            ("camera_id", camera),
            ("threat_level", threat_level),
            ("resolved", resolved),
        ]:
            if value is not None:
                conditions.append(f"{field}=?")
                params.append(value)
        for field, op, value in [("timestamp", ">=", start), ("timestamp", "<=", end)]:
            if value:
                conditions.append(f"{field}{op}?")
                params.append(iso(value))
        with self.connection() as db:
            for cursor, op in [(before, "<"), (after, ">")]:
                if cursor:
                    row = db.execute(
                        "SELECT timestamp,id FROM alerts WHERE id=?", (cursor,)
                    ).fetchone()
                    if not row:
                        from fastapi import HTTPException

                        raise HTTPException(422, "Unknown pagination cursor")
                    conditions.append(f"(timestamp,id){op}(?,?)")
                    params.extend(row)
            query = (
                "SELECT * FROM alerts"
                + (" WHERE " + " AND ".join(conditions) if conditions else "")
                + " ORDER BY timestamp DESC,id DESC LIMIT ?"
            )
            return [self.serialize(row) for row in db.execute(query, [*params, limit])]

    def analytics(self, start, end):
        with self.connection() as db:
            params = (iso(start), iso(end))
            where = "timestamp>=? AND timestamp<=?"
            threats = dict(
                db.execute(
                    f"SELECT threat_level,count(*) FROM alerts WHERE {where} GROUP BY threat_level",
                    params,
                )
            )
            modalities = dict(
                db.execute(
                    f"SELECT modality,count(*) FROM alerts WHERE {where} GROUP BY modality",
                    params,
                )
            )
            kinds = {}
            for kind in ("species", "object", "audio"):
                kinds[kind] = dict(
                    db.execute(
                        f"SELECT label,count(*) FROM detection_labels JOIN alerts ON alerts.id=alert_id WHERE {where} AND kind=? GROUP BY label",
                        (*params, kind),
                    )
                )
            hours = dict(
                db.execute(
                    f"SELECT strftime('%H',timestamp),count(*) FROM alerts WHERE {where} GROUP BY 1",
                    params,
                )
            )
        targets = {**kinds["species"], **kinds["object"]}
        return {
            "species_distribution": kinds["species"],
            "threat_object_distribution": kinds["object"],
            "audio_event_distribution": kinds["audio"],
            "threat_severity_distribution": threats,
            "modality_distribution": modalities,
            "hourly_trend": [
                {"hour": f"{h:02}", "intrusions": hours.get(f"{h:02}", 0)}
                for h in range(24)
            ],
            "most_frequent_target": max(targets, key=targets.get) if targets else "N/A",
            "start": iso(start),
            "end": iso(end),
        }


store = Store()
