import pytest
from ai_service.offline_queue import DelayTolerantQueue


def test_offline_queue_enqueue_and_sync(tmp_path):
    queue = DelayTolerantQueue(db_path=tmp_path / "test_queue.db")

    # Enqueue alert with unique idempotency ID
    item_id = queue.enqueue({"label": "person", "threat": "HIGH"}, threat_level="HIGH")
    assert queue.pending_count() == 1

    # Fetch pending
    pending = queue.get_pending()
    assert len(pending) == 1
    assert pending[0].item_id == item_id
    assert pending[0].threat_level == "HIGH"

    # Mark synced
    queue.mark_synced(item_id)
    assert queue.pending_count() == 0


def test_offline_queue_idempotency(tmp_path):
    queue = DelayTolerantQueue(db_path=tmp_path / "test_queue.db")

    # Enqueuing same item_id twice should be deduplicated
    id1 = queue.enqueue({"label": "person"}, threat_level="HIGH", item_id="SAME_ID")
    id2 = queue.enqueue({"label": "person"}, threat_level="HIGH", item_id="SAME_ID")

    assert id1 == id2
    assert queue.pending_count() == 1

