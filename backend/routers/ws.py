from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from sqlalchemy.orm import Session
from datetime import datetime

from database import SessionLocal
from models.models import Message, Conversation, User, UserRole
from services.ws_manager import manager
from auth.jwt import SECRET_KEY, ALGORITHM
from jose import jwt, JWTError

router = APIRouter()


def get_user_from_token(token: str, db: Session) -> User | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
        return db.query(User).filter(User.id == user_id).first()
    except (JWTError, ValueError, TypeError):
        return None


@router.websocket("/ws/chat/{conv_id}")
async def websocket_chat(
    conv_id: int,
    websocket: WebSocket,
    token: str = Query(...),
):
    db = SessionLocal()
    try:
        user = get_user_from_token(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        conv = db.query(Conversation).filter(Conversation.id == conv_id).first()
        if not conv:
            await websocket.close(code=4004)
            return

        # Only the conversation owner or agent/admin can join
        if user.role == UserRole.customer and conv.user_id != user.id:
            await websocket.close(code=4003)
            return

        await manager.connect(conv_id, websocket)

        # Send existing messages on connect
        messages = db.query(Message).filter(Message.conversation_id == conv_id).order_by(Message.created_at).all()
        for m in messages:
            await websocket.send_json({
                "type": "history",
                "sender": m.sender_role,
                "sender_name": user.name if m.sender_role == "user" else "AI Bot",
                "content": m.content,
                "sentiment_label": m.sentiment_label.value if m.sentiment_label else None,
                "created_at": m.created_at.isoformat(),
            })

        # Notify room that agent joined
        if user.role in (UserRole.agent, UserRole.admin):
            await manager.broadcast(conv_id, {
                "type": "system",
                "content": f"Agent {user.name} has joined the conversation.",
            })

        try:
            while True:
                data = await websocket.receive_json()
                text = data.get("content", "").strip()
                if not text:
                    continue

                # Persist message
                msg = Message(
                    conversation_id=conv_id,
                    sender_role="agent" if user.role in (UserRole.agent, UserRole.admin) else "user",
                    content=text,
                )
                db.add(msg)
                db.commit()
                db.refresh(msg)

                # Broadcast to all in room
                await manager.broadcast(conv_id, {
                    "type": "message",
                    "sender": msg.sender_role,
                    "sender_name": user.name,
                    "content": text,
                    "created_at": msg.created_at.isoformat(),
                })

        except WebSocketDisconnect:
            manager.disconnect(conv_id, websocket)
            if user.role in (UserRole.agent, UserRole.admin):
                await manager.broadcast(conv_id, {
                    "type": "system",
                    "content": f"Agent {user.name} has left the conversation.",
                })
    finally:
        db.close()
