from datetime import datetime
from sqlalchemy.orm import Session

from models.models import Conversation, Message, Ticket, TicketPriority, TicketStatus, SentimentLabel, User

CONSECUTIVE_NEGATIVE_THRESHOLD = 3


def _detect_category(content: str) -> str:
    text = content.lower()
    if any(w in text for w in ["order", "purchase", "buy"]):
        return "Order"
    if any(w in text for w in ["refund", "return", "money back"]):
        return "Refund"
    if any(w in text for w in ["delivery", "shipping", "track", "arrive"]):
        return "Delivery"
    if any(w in text for w in ["product", "item", "quality", "broken", "defect"]):
        return "Product"
    return "Other"


def _count_trailing_negatives(messages: list[Message]) -> int:
    user_msgs = [m for m in messages if m.sender_role == "user"]
    count = 0
    for msg in reversed(user_msgs):
        if msg.sentiment_label == SentimentLabel.negative:
            count += 1
        else:
            break
    return count


def maybe_create_ticket(db: Session, conv: Conversation, user: User) -> Ticket | None:
    existing = db.query(Ticket).filter(
        Ticket.conversation_id == conv.id,
        Ticket.status != TicketStatus.closed,
    ).first()

    if existing:
        _maybe_escalate(db, existing, conv)
        return existing

    messages = db.query(Message).filter(Message.conversation_id == conv.id).all()
    last_user_msg = next((m for m in reversed(messages) if m.sender_role == "user"), None)
    title = (last_user_msg.content[:80] + "...") if last_user_msg and len(last_user_msg.content) > 80 else (last_user_msg.content if last_user_msg else "Support request")
    category = _detect_category(last_user_msg.content if last_user_msg else "")

    trailing_negs = _count_trailing_negatives(messages)
    priority = TicketPriority.high if trailing_negs >= CONSECUTIVE_NEGATIVE_THRESHOLD else TicketPriority.medium

    ticket = Ticket(
        conversation_id=conv.id,
        title=title,
        category=category,
        priority=priority,
        status=TicketStatus.open,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return ticket


def _maybe_escalate(db: Session, ticket: Ticket, conv: Conversation) -> None:
    if ticket.priority == TicketPriority.high:
        return

    messages = db.query(Message).filter(Message.conversation_id == conv.id).all()
    trailing_negs = _count_trailing_negatives(messages)

    if trailing_negs >= CONSECUTIVE_NEGATIVE_THRESHOLD:
        ticket.priority = TicketPriority.high
        db.commit()


def resolve_ticket(db: Session, ticket_id: int) -> Ticket | None:
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if ticket:
        ticket.status = TicketStatus.resolved
        ticket.resolved_at = datetime.utcnow()
        db.commit()
        db.refresh(ticket)
    return ticket
