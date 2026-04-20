from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
import models.models  # ensure all models are registered

from routers import auth, chat, tickets, analytics, voice

Base.metadata.create_all(bind=engine)

app = FastAPI(title="AI Customer Support API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(tickets.router)
app.include_router(analytics.router)
app.include_router(voice.router)


@app.get("/health")
def health():
    return {"status": "ok"}
