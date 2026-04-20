import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from models.models import User, Conversation, Message, SentimentLabel
from schemas.schemas import ChatRequest, ConversationOut
from auth.jwt import get_current_user
from services import chat_service, sentiment_service
from services.ticket_service import maybe_create_ticket

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("/")
async def chat(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    # Get or create conversation
    if payload.conversation_id:
        conv = db.query(Conversation).filter(
            Conversation.id == payload.conversation_id,
            Conversation.user_id == current_user.id,
        ).first()
        if not conv:
            raise HTTPException(status_code=404, detail="Conversation not found")
    else:
        conv = Conversation(user_id=current_user.id)
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # Analyze sentiment of user message
    score, label = sentiment_service.analyze(payload.message)

    # Persist user message
    user_msg = Message(
        conversation_id=conv.id,
        sender_role="user",
        content=payload.message,
        sentiment_score=score,
        sentiment_label=label,
    )
    db.add(user_msg)
    db.commit()

    # Build conversation history for LLM context
    history = [
        {"role": "user" if m.sender_role == "user" else "assistant", "content": m.content}
        for m in conv.messages[:-1]  # exclude the message we just added
    ]

    async def event_stream():
        full_response = ""
        yield f"data: {json.dumps({'conversation_id': conv.id, 'type': 'start'})}\n\n"

        async for token in chat_service.stream_response(payload.message, history):
            full_response += token
            yield f"data: {json.dumps({'type': 'token', 'content': token})}\n\n"

        # Persist bot response
        bot_msg = Message(
            conversation_id=conv.id,
            sender_role="bot",
            content=full_response,
        )
        db.add(bot_msg)
        db.commit()
        db.refresh(bot_msg)

        # Auto-create ticket if unresolved
        resolved = chat_service.is_resolved(full_response)
        ticket_id = None
        if not resolved:
            ticket = maybe_create_ticket(db, conv, current_user)
            if ticket:
                ticket_id = ticket.id

        yield f"data: {json.dumps({'type': 'done', 'sentiment_score': score, 'sentiment_label': label.value, 'resolved': resolved, 'ticket_id': ticket_id})}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@router.get("/conversations", response_model=list[ConversationOut])
def list_conversations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Conversation).filter(Conversation.user_id == current_user.id).all()


@router.get("/conversations/{conv_id}", response_model=ConversationOut)
def get_conversation(
    conv_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id,
        Conversation.user_id == current_user.id,
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conv
