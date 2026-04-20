from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr

from models.models import UserRole, SentimentLabel, TicketPriority, TicketStatus


# Auth
class UserRegister(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: UserRole = UserRole.customer


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    name: str


class UserOut(BaseModel):
    id: int
    email: str
    name: str
    role: UserRole
    created_at: datetime

    model_config = {"from_attributes": True}


# Chat
class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[int] = None


class MessageOut(BaseModel):
    id: int
    sender_role: str
    content: str
    sentiment_score: Optional[float]
    sentiment_label: Optional[SentimentLabel]
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: int
    user_id: int
    started_at: datetime
    messages: List[MessageOut] = []

    model_config = {"from_attributes": True}


# Tickets
class TicketOut(BaseModel):
    id: int
    conversation_id: int
    title: str
    category: str
    priority: TicketPriority
    status: TicketStatus
    created_at: datetime
    resolved_at: Optional[datetime]

    model_config = {"from_attributes": True}


class TicketUpdate(BaseModel):
    priority: Optional[TicketPriority] = None
    status: Optional[TicketStatus] = None
    assigned_agent_id: Optional[int] = None


# Analytics
class KPIResponse(BaseModel):
    total_tickets: int
    resolution_rate: float
    avg_response_time_seconds: float
    negative_sentiment_pct: float


class DailyVolume(BaseModel):
    date: str
    count: int


class SentimentTrend(BaseModel):
    date: str
    positive: int
    neutral: int
    negative: int


class CategoryBreakdown(BaseModel):
    category: str
    count: int


class ResolutionBucket(BaseModel):
    bucket_minutes: str
    count: int


class PeakHour(BaseModel):
    hour: int
    count: int


class AgentPerformance(BaseModel):
    agent_id: int
    name: str
    tickets_resolved: int
    avg_resolution_minutes: float
