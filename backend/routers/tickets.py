from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
import csv
import io
from fastapi.responses import StreamingResponse as FastAPIStreamingResponse

from database import get_db
from models.models import User, Ticket, TicketStatus, UserRole
from schemas.schemas import TicketOut, TicketUpdate
from auth.jwt import get_current_user
from services.ticket_service import resolve_ticket

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("/", response_model=list[TicketOut])
def list_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role in (UserRole.agent, UserRole.admin):
        return db.query(Ticket).order_by(Ticket.created_at.desc()).all()
    # Customers see only their own tickets via conversations
    from models.models import Conversation
    conv_ids = [c.id for c in db.query(Conversation).filter(Conversation.user_id == current_user.id).all()]
    return db.query(Ticket).filter(Ticket.conversation_id.in_(conv_ids)).order_by(Ticket.created_at.desc()).all()


@router.get("/{ticket_id}", response_model=TicketOut)
def get_ticket(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket


@router.patch("/{ticket_id}", response_model=TicketOut)
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in (UserRole.agent, UserRole.admin):
        raise HTTPException(status_code=403, detail="Agents and admins only")

    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    if payload.priority is not None:
        ticket.priority = payload.priority
    if payload.status is not None:
        if payload.status == TicketStatus.resolved:
            resolve_ticket(db, ticket_id)
            db.refresh(ticket)
        else:
            ticket.status = payload.status
    if payload.assigned_agent_id is not None:
        ticket.assigned_agent_id = payload.assigned_agent_id

    db.commit()
    db.refresh(ticket)
    return ticket


@router.get("/export/csv")
def export_tickets_csv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.role not in (UserRole.agent, UserRole.admin):
        raise HTTPException(status_code=403, detail="Agents and admins only")

    tickets = db.query(Ticket).order_by(Ticket.created_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Title", "Category", "Priority", "Status", "Created At", "Resolved At"])
    for t in tickets:
        writer.writerow([t.id, t.title, t.category, t.priority.value, t.status.value, t.created_at, t.resolved_at or ""])

    output.seek(0)
    return FastAPIStreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tickets.csv"},
    )
