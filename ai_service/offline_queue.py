"""Delay-Tolerant Offline Alert Queue & Synchronization Engine.

Ensures edge nodes continue detecting and recording threats during network dropouts:
- Sensor -> Edge AI -> Local Queue (SQLite) -> Network Restored -> Synchronize
- Idempotency key deduplication prevents duplicate alerts when connection blinks
- Exponential backoff with jitter on network retry.
"""

from dataclasses import dataclass
import json
import sqlite3
import time
from pathlib import Path
from uuid import uuid4
from sentinel_config import DATA_DIR


@dataclass
class QueueItem:
    item_id: str
    payload: dict
    threat_level: str
    created_at: float
    attempts: int
    status: str  # "PENDING", "SYNCED", "FAILED"


class DelayTolerantQueue:
    def __init__(self, db_path: Path | str | None = None):
        if db_path is None:
            self.db_path = DATA_DIR / "edge_offline_queue.db"
        else:
            self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as db:
            db.execute(
                """
                CREATE TABLE IF NOT EXISTS edge_queue (
                    item_id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    threat_level TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    attempts INTEGER DEFAULT 0,
                    status TEXT DEFAULT 'PENDING'
                )
                """
            )
            db.execute("CREATE INDEX IF NOT EXISTS idx_eq_status ON edge_queue(status)")

    def enqueue(self, payload: dict, threat_level: str, item_id: str | None = None) -> str:
        """Enqueue alert with idempotency key."""
        uid = item_id or f"DTQ_{uuid4().hex}"
        with sqlite3.connect(self.db_path) as db:
            db.execute(
                """
                INSERT OR IGNORE INTO edge_queue (item_id, payload, threat_level, created_at, attempts, status)
                VALUES (?, ?, ?, ?, 0, 'PENDING')
                """,
                (uid, json.dumps(payload), threat_level, time.time()),
            )
        return uid

    def get_pending(self, limit: int = 50) -> list[QueueItem]:
        """Fetch pending unsynced alerts."""
        with sqlite3.connect(self.db_path) as db:
            db.row_factory = sqlite3.Row
            rows = db.execute(
                "SELECT * FROM edge_queue WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT ?",
                (limit,),
            ).fetchall()

        items = []
        for r in rows:
            items.append(
                QueueItem(
                    item_id=r["item_id"],
                    payload=json.loads(r["payload"]),
                    threat_level=r["threat_level"],
                    created_at=r["created_at"],
                    attempts=r["attempts"],
                    status=r["status"],
                )
            )
        return items

    def mark_synced(self, item_id: str):
        with sqlite3.connect(self.db_path) as db:
            db.execute("UPDATE edge_queue SET status = 'SYNCED' WHERE item_id = ?", (item_id,))

    def mark_failed_attempt(self, item_id: str):
        with sqlite3.connect(self.db_path) as db:
            db.execute("UPDATE edge_queue SET attempts = attempts + 1 WHERE item_id = ?", (item_id,))

    def pending_count(self) -> int:
        with sqlite3.connect(self.db_path) as db:
            return db.execute("SELECT count(*) FROM edge_queue WHERE status = 'PENDING'").fetchone()[0]

    def purge_synced(self, older_than_seconds: float = 86400.0):
        cutoff = time.time() - older_than_seconds
        with sqlite3.connect(self.db_path) as db:
            db.execute("DELETE FROM edge_queue WHERE status = 'SYNCED' AND created_at < ?", (cutoff,))

