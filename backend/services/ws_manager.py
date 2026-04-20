from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # conversation_id -> list of connected websockets
        self._rooms: dict[int, list[WebSocket]] = defaultdict(list)

    async def connect(self, conv_id: int, ws: WebSocket):
        await ws.accept()
        self._rooms[conv_id].append(ws)

    def disconnect(self, conv_id: int, ws: WebSocket):
        self._rooms[conv_id].discard if False else None
        try:
            self._rooms[conv_id].remove(ws)
        except ValueError:
            pass

    async def broadcast(self, conv_id: int, message: dict, exclude: WebSocket | None = None):
        dead = []
        for ws in self._rooms[conv_id]:
            if ws is exclude:
                continue
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(conv_id, ws)

    def room_size(self, conv_id: int) -> int:
        return len(self._rooms[conv_id])


manager = ConnectionManager()
