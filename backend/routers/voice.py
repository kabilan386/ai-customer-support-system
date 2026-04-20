import os
from fastapi import APIRouter, UploadFile, File, Depends
from openai import AsyncOpenAI

from auth.jwt import get_current_user
from models.models import User

router = APIRouter(prefix="/voice", tags=["voice"])
client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))


@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    audio_bytes = await file.read()
    transcript = await client.audio.transcriptions.create(
        model="whisper-1",
        file=(file.filename or "audio.webm", audio_bytes, file.content_type or "audio/webm"),
    )
    return {"text": transcript.text}


@router.get("/status")
def voice_status():
    return {"provider": "OpenAI Whisper (server-side STT) + Web Speech API TTS", "server_side": True}
