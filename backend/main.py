from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


def load_local_env() -> None:
    backend_dir = Path(__file__).resolve().parent
    repo_root_env = backend_dir.parent / ".env"
    backend_env = backend_dir / ".env"

    if repo_root_env.exists():
        load_dotenv(repo_root_env, override=False)
    elif backend_env.exists():
        load_dotenv(backend_env, override=False)


load_local_env()

from database import engine, Base
import models.models  # ensure all models are registered

from routers import auth, chat, tickets, analytics, voice, ws

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
app.include_router(ws.router)


@app.get("/health")
def health():
    return {"status": "ok"}
