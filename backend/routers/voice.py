import os
from fastapi import APIRouter, UploadFile, File, Depends, Request
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from openai import AsyncOpenAI
from elevenlabs.client import ElevenLabs
from elevenlabs import VoiceSettings
from elevenlabs.core.api_error import ApiError

from auth.jwt import get_current_user
from models.models import User

router = APIRouter(prefix="/voice", tags=["voice"])
openai_client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))


def get_elevenlabs_api_key() -> str:
    return os.getenv("ELEVENLABS_API_KEY", "").strip()


def get_elevenlabs_voice_id() -> str:
    return os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM").strip()  # Rachel


@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    audio_bytes = await file.read()
    transcript = await openai_client.audio.transcriptions.create(
        model="whisper-1",
        file=(file.filename or "audio.webm", audio_bytes, file.content_type or "audio/webm"),
    )
    return {"text": transcript.text}


@router.post("/tts")
async def text_to_speech(
    request: Request,
    current_user: User = Depends(get_current_user),
):
    body = await request.json()
    text = body.get("text", "").strip()
    if not text:
        return {"error": "No text provided"}

    elevenlabs_api_key = get_elevenlabs_api_key()
    if not elevenlabs_api_key:
        raise HTTPException(status_code=503, detail="ELEVENLABS_API_KEY is not configured on the backend")

    elevenlabs_voice_id = get_elevenlabs_voice_id()
    el_client = ElevenLabs(api_key=elevenlabs_api_key)

    def audio_stream():
        try:
            audio = el_client.text_to_speech.convert(
                voice_id=elevenlabs_voice_id,
                text=text,
                model_id="eleven_multilingual_v2",
                voice_settings=VoiceSettings(
                    stability=0.5,
                    similarity_boost=0.75,
                    style=0.0,
                    use_speaker_boost=True,
                ),
            )
            for chunk in audio:
                yield chunk
        except ApiError as exc:
            detail = getattr(exc, "body", {}) or {}
            if exc.status_code == 401:
                raise HTTPException(status_code=502, detail="ElevenLabs rejected the configured API key") from exc
            if exc.status_code == 402:
                raise HTTPException(
                    status_code=402,
                    detail="The configured ElevenLabs voice requires a paid plan. Set ELEVENLABS_VOICE_ID to a voice available in your account or upgrade your ElevenLabs subscription.",
                ) from exc
            raise HTTPException(status_code=502, detail={"message": "ElevenLabs request failed", "provider_error": detail}) from exc

    return StreamingResponse(audio_stream(), media_type="audio/mpeg")


@router.get("/status")
def voice_status():
    elevenlabs_api_key = get_elevenlabs_api_key()
    elevenlabs_voice_id = get_elevenlabs_voice_id()

    return {
        "stt": "OpenAI Whisper",
        "tts": "ElevenLabs" if elevenlabs_api_key else "browser speechSynthesis (no key set)",
        "server_side": True,
        "debug": {
            "elevenlabs_api_key_loaded": bool(elevenlabs_api_key),
            "elevenlabs_api_key_prefix": elevenlabs_api_key[:8] if elevenlabs_api_key else "",
            "elevenlabs_voice_id_loaded": bool(elevenlabs_voice_id),
            "elevenlabs_voice_id": elevenlabs_voice_id,
        },
    }
