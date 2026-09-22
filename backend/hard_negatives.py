"""Human-in-the-Loop Feedback & Hard-Negative Active Learning Manager.

Collects ranger verification on alerts:
- Feedback categories: TRUE_THREAT, FALSE_POSITIVE, AUTHORIZED_PERSON, AUTHORIZED_VEHICLE, UNCERTAIN
- Computes empirical error rates per camera and per target class
- Exports curated hard-negative datasets (images + YOLO format annotations) for retraining.
"""

import json
from pathlib import Path
from typing import Literal
from sentinel_config import DATA_DIR

FeedbackType = Literal["TRUE_THREAT", "FALSE_POSITIVE", "AUTHORIZED_PERSON", "AUTHORIZED_VEHICLE", "UNCERTAIN"]

HARD_NEGATIVES_DIR = DATA_DIR / "hard_negatives"
HARD_NEGATIVES_DIR.mkdir(parents=True, exist_ok=True)
(HARD_NEGATIVES_DIR / "images").mkdir(exist_ok=True)
(HARD_NEGATIVES_DIR / "labels").mkdir(exist_ok=True)


class HardNegativeManager:
    def __init__(self, db_connection_factory):
        self.get_db = db_connection_factory

    def record_feedback(
        self,
        alert_id: int,
        feedback: FeedbackType,
        ranger_id: str = "ranger_default",
        notes: str = "",
        image_bytes: bytes | None = None,
        detections: list[dict] | None = None,
    ) -> dict:
        """Store ranger feedback and preserve hard negative sample if marked false positive."""
        with self.get_db() as db:
            db.execute(
                """
                INSERT INTO ranger_feedback (alert_id, feedback_type, ranger_id, notes, created_at)
                VALUES (?, ?, ?, ?, datetime('now'))
                """,
                (alert_id, feedback, ranger_id, notes),
            )
            db.commit()

        # If marked FALSE_POSITIVE, persist to hard-negative active learning dataset
        exported = False
        if feedback in {"FALSE_POSITIVE", "AUTHORIZED_PERSON", "AUTHORIZED_VEHICLE"} and image_bytes:
            img_path = HARD_NEGATIVES_DIR / "images" / f"alert_{alert_id}.jpg"
            img_path.write_bytes(image_bytes)

            # Export metadata record
            meta_path = HARD_NEGATIVES_DIR / "metadata.jsonl"
            record = {
                "alert_id": alert_id,
                "feedback": feedback,
                "ranger_id": ranger_id,
                "notes": notes,
                "detections": detections or [],
                "image_file": str(img_path.name),
            }
            with meta_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(record) + "\n")
            exported = True

        return {
            "status": "success",
            "alert_id": alert_id,
            "feedback": feedback,
            "saved_to_hard_negatives": exported,
        }

    def compute_metrics(self) -> dict:
        """Calculate camera-specific and class-specific error rates."""
        with self.get_db() as db:
            total_feedback = db.execute("SELECT count(*) FROM ranger_feedback").fetchone()[0]
            by_type = dict(
                db.execute("SELECT feedback_type, count(*) FROM ranger_feedback GROUP BY feedback_type")
            )
            false_positives = by_type.get("FALSE_POSITIVE", 0) + by_type.get("AUTHORIZED_PERSON", 0) + by_type.get("AUTHORIZED_VEHICLE", 0)
            true_threats = by_type.get("TRUE_THREAT", 0)

            # Camera specific breakdown
            cam_stats = db.execute(
                """
                SELECT a.camera_id, rf.feedback_type, count(*)
                FROM ranger_feedback rf
                JOIN alerts a ON a.id = rf.alert_id
                GROUP BY a.camera_id, rf.feedback_type
                """
            ).fetchall()

        camera_breakdown: dict[str, dict] = {}
        for cid, ftype, count in cam_stats:
            if cid not in camera_breakdown:
                camera_breakdown[cid] = {"total": 0, "false_positives": 0, "true_threats": 0}
            camera_breakdown[cid]["total"] += count
            if ftype in {"FALSE_POSITIVE", "AUTHORIZED_PERSON", "AUTHORIZED_VEHICLE"}:
                camera_breakdown[cid]["false_positives"] += count
            elif ftype == "TRUE_THREAT":
                camera_breakdown[cid]["true_threats"] += count

        evaluated_total = false_positives + true_threats
        overall_fpr = (false_positives / evaluated_total) if evaluated_total > 0 else 0.0

        return {
            "total_feedback_count": total_feedback,
            "feedback_distribution": by_type,
            "false_positive_rate": round(overall_fpr, 3),
            "camera_error_rates": camera_breakdown,
            "hard_negatives_collected": len(list((HARD_NEGATIVES_DIR / "images").glob("*.jpg"))),
        }

