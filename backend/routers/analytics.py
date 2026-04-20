from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import func, case
from sqlalchemy.orm import Session

from database import get_db
from models.models import User, Message, Ticket, TicketStatus, SentimentLabel, Conversation, UserRole
from schemas.schemas import (
    KPIResponse, DailyVolume, SentimentTrend, CategoryBreakdown,
    ResolutionBucket, PeakHour, AgentPerformance,
)
from auth.jwt import require_role

router = APIRouter(prefix="/analytics", tags=["analytics"])

_agent_or_admin = require_role(UserRole.agent, UserRole.admin)


@router.get("/kpi", response_model=KPIResponse)
def get_kpi(db: Session = Depends(get_db), _: User = Depends(_agent_or_admin)):
    total = db.query(func.count(Ticket.id)).scalar() or 0
    resolved = db.query(func.count(Ticket.id)).filter(Ticket.status == TicketStatus.resolved).scalar() or 0
    resolution_rate = round((resolved / total * 100) if total else 0, 1)

    # Avg response time: simple approximation using ticket count
    avg_response_time = 0.0
    try:
        from sqlalchemy import text as sa_text
        result = db.execute(sa_text("""
            SELECT AVG(EXTRACT(EPOCH FROM (bot.created_at - usr.created_at)))
            FROM messages usr
            JOIN messages bot ON bot.conversation_id = usr.conversation_id
            WHERE usr.sender_role = 'user' AND bot.sender_role = 'bot'
              AND bot.id = (
                SELECT id FROM messages m2
                WHERE m2.conversation_id = usr.conversation_id
                  AND m2.sender_role = 'bot'
                  AND m2.created_at > usr.created_at
                ORDER BY m2.created_at LIMIT 1
              )
              AND usr.id = (
                SELECT id FROM messages m3
                WHERE m3.conversation_id = usr.conversation_id
                  AND m3.sender_role = 'user'
                ORDER BY m3.created_at LIMIT 1
              )
        """)).scalar()
        avg_response_time = round(float(result or 0), 1)
    except Exception:
        avg_response_time = 0.0

    total_msgs = db.query(func.count(Message.id)).filter(Message.sender_role == "user").scalar() or 0
    neg_msgs = db.query(func.count(Message.id)).filter(
        Message.sender_role == "user",
        Message.sentiment_label == SentimentLabel.negative,
    ).scalar() or 0
    negative_pct = round((neg_msgs / total_msgs * 100) if total_msgs else 0, 1)

    return KPIResponse(
        total_tickets=total,
        resolution_rate=resolution_rate,
        avg_response_time_seconds=avg_response_time,
        negative_sentiment_pct=negative_pct,
    )


@router.get("/daily-volume", response_model=list[DailyVolume])
def daily_volume(days: int = 30, db: Session = Depends(get_db), _: User = Depends(_agent_or_admin)):
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(func.date(Ticket.created_at).label("date"), func.count(Ticket.id).label("count"))
        .filter(Ticket.created_at >= since)
        .group_by(func.date(Ticket.created_at))
        .order_by(func.date(Ticket.created_at))
        .all()
    )
    return [DailyVolume(date=str(r.date), count=r.count) for r in rows]


@router.get("/sentiment-trend", response_model=list[SentimentTrend])
def sentiment_trend(days: int = 30, db: Session = Depends(get_db), _: User = Depends(_agent_or_admin)):
    since = datetime.utcnow() - timedelta(days=days)
    rows = (
        db.query(
            func.date(Message.created_at).label("date"),
            func.count(case((Message.sentiment_label == SentimentLabel.positive, 1))).label("positive"),
            func.count(case((Message.sentiment_label == SentimentLabel.neutral, 1))).label("neutral"),
            func.count(case((Message.sentiment_label == SentimentLabel.negative, 1))).label("negative"),
        )
        .filter(Message.created_at >= since, Message.sender_role == "user")
        .group_by(func.date(Message.created_at))
        .order_by(func.date(Message.created_at))
        .all()
    )
    return [SentimentTrend(date=str(r.date), positive=r.positive, neutral=r.neutral, negative=r.negative) for r in rows]


@router.get("/category-breakdown", response_model=list[CategoryBreakdown])
def category_breakdown(db: Session = Depends(get_db), _: User = Depends(_agent_or_admin)):
    rows = (
        db.query(Ticket.category, func.count(Ticket.id).label("count"))
        .group_by(Ticket.category)
        .all()
    )
    return [CategoryBreakdown(category=r.category, count=r.count) for r in rows]


@router.get("/resolution-histogram", response_model=list[ResolutionBucket])
def resolution_histogram(db: Session = Depends(get_db), _: User = Depends(_agent_or_admin)):
    tickets = db.query(Ticket).filter(Ticket.resolved_at.isnot(None)).all()
    buckets: dict[str, int] = {"0-15": 0, "15-30": 0, "30-60": 0, "60-120": 0, "120+": 0}
    for t in tickets:
        minutes = (t.resolved_at - t.created_at).total_seconds() / 60
        if minutes < 15:
            buckets["0-15"] += 1
        elif minutes < 30:
            buckets["15-30"] += 1
        elif minutes < 60:
            buckets["30-60"] += 1
        elif minutes < 120:
            buckets["60-120"] += 1
        else:
            buckets["120+"] += 1
    return [ResolutionBucket(bucket_minutes=k, count=v) for k, v in buckets.items()]


@router.get("/peak-hours", response_model=list[PeakHour])
def peak_hours(db: Session = Depends(get_db), _: User = Depends(_agent_or_admin)):
    rows = (
        db.query(func.extract("hour", Message.created_at).label("hour"), func.count(Message.id).label("count"))
        .filter(Message.sender_role == "user")
        .group_by(func.extract("hour", Message.created_at))
        .order_by(func.extract("hour", Message.created_at))
        .all()
    )
    return [PeakHour(hour=int(r.hour), count=r.count) for r in rows]


@router.get("/agent-performance", response_model=list[AgentPerformance])
def agent_performance(db: Session = Depends(get_db), _: User = Depends(_agent_or_admin)):
    agents = db.query(User).filter(User.role.in_([UserRole.agent, UserRole.admin])).all()
    result = []
    for agent in agents:
        resolved_tickets = db.query(Ticket).filter(
            Ticket.assigned_agent_id == agent.id,
            Ticket.status == TicketStatus.resolved,
            Ticket.resolved_at.isnot(None),
        ).all()

        count = len(resolved_tickets)
        avg_minutes = 0.0
        if count:
            total_secs = sum((t.resolved_at - t.created_at).total_seconds() for t in resolved_tickets)
            avg_minutes = round(total_secs / count / 60, 1)

        result.append(AgentPerformance(
            agent_id=agent.id,
            name=agent.name,
            tickets_resolved=count,
            avg_resolution_minutes=avg_minutes,
        ))
    return result
