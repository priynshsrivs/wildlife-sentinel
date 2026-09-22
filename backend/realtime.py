import asyncio
import logging
from uuid import uuid4

log = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self):
        self.connections = set()
        self.pending = {}

    async def connect(self, websocket):
        await websocket.accept()
        self.connections.add(websocket)

    def disconnect(self, websocket):
        self.connections.discard(websocket)

    def acknowledge(self, websocket, event_id):
        pending = self.pending.get(event_id)
        if pending and websocket in pending[1]:
            pending[0].set()

    async def broadcast(self, message):
        event_id = uuid4().hex
        message = {**message, "event_id": event_id}
        connections = set(self.connections)
        acknowledged = asyncio.Event()
        self.pending[event_id] = (acknowledged, connections)

        async def send(ws):
            try:
                await asyncio.wait_for(ws.send_json(message), timeout=1)
                return True
            except Exception:
                self.disconnect(ws)
                return False

        try:
            results = await asyncio.gather(*(send(ws) for ws in connections))
            sent = sum(results)
            if sent:
                try:
                    await asyncio.wait_for(acknowledged.wait(), timeout=0.5)
                except TimeoutError:
                    pass
            log.info(
                "websocket_broadcast recipients=%d acknowledged=%s",
                sent,
                acknowledged.is_set(),
            )
            return {"broadcast_count": sent, "frontend_notified": acknowledged.is_set()}
        finally:
            self.pending.pop(event_id, None)


manager = ConnectionManager()
