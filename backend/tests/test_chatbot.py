# TC-03, TC-04
from unittest.mock import AsyncMock, patch


def test_TC04_empty_message_rejected(client, auth_headers):
    """TC-04: Empty message → 400 Bad Request"""
    res = client.post("/chat/", json={"message": "   "}, headers=auth_headers)
    assert res.status_code == 400


def test_TC03_chat_starts_conversation(client, auth_headers):
    """TC-03: Valid message starts a conversation and returns SSE stream"""
    async def fake_stream(msg, history):
        yield "This is a test response. RESOLVED"

    with patch("routers.chat.chat_service.stream_response", side_effect=fake_stream):
        with patch("routers.chat.chat_service.is_resolved", return_value=True):
            res = client.post("/chat/", json={"message": "Hello"}, headers=auth_headers)
            assert res.status_code == 200
            assert "text/event-stream" in res.headers["content-type"]
