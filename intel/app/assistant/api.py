"""HTTP face of the assistant: any signed-in member may ask, in writing or out loud, and nothing is kept."""

from __future__ import annotations

import base64
import binascii
from typing import Any, Callable, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import member
from . import service

router = APIRouter(prefix="/v1/assistant", tags=["assistant"])
LIMITS = service.settings()
VOICE = LIMITS["voice"]

# One spoken question: what was heard, and the answer.
Listener = Callable[[list[dict[str, str]], bytes, str, str], tuple[str, str]]


class Turn(BaseModel):
    # A member speaks as the user only: never as the system, whose words the model obeys.
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=LIMITS["max_message_chars"])


class Question(BaseModel):
    messages: list[Turn] = Field(min_length=1, max_length=LIMITS["max_messages"])
    language: Literal["en", "hi", "mr"] = "en"


class SpokenQuestion(BaseModel):
    # The conversation before the question; the question itself is the recording.
    history: list[Turn] = Field(default_factory=list, max_length=LIMITS["max_messages"] - 1)
    language: Literal["en", "hi", "mr"] = "en"
    # As the browser named it, parameters and all ("audio/webm;codecs=opus").
    mime_type: str = Field(max_length=100)
    # Base64, which carries four characters for every three bytes.
    audio: str = Field(min_length=1, max_length=VOICE["max_bytes"] * 4 // 3 + 4)


def asker() -> service.Asker:
    """Who answers: the service settings.yaml names, unless a test says otherwise."""
    return service.ask


def listener() -> Listener:
    """Who listens: Gemini, unless a test says otherwise."""
    return service.listen


@router.get("")
def status(_: int = Depends(member)) -> dict[str, Any]:
    """Whether the assistant is on, which service answers (the page says where questions go),
    whether it can take a spoken question, and how much one question may carry."""
    return {"enabled": service.enabled(), "provider": service.provider(), "voice": service.listens(),
            "max_messages": LIMITS["max_messages"], "max_message_chars": LIMITS["max_message_chars"],
            "max_voice_seconds": VOICE["max_seconds"]}


@router.post("/reply")
def reply(question: Question, _: int = Depends(member), ask: service.Asker = Depends(asker)) -> dict[str, Any]:
    if question.messages[-1].role != "user":
        raise HTTPException(400, "The last message must be a question")
    if not service.enabled():
        raise HTTPException(503, "The assistant is switched off on this server")
    try:
        answer = ask([turn.model_dump() for turn in question.messages], question.language)
    except service.Declined:
        return {"reply": None, "declined": True}
    except service.Unavailable as error:
        raise HTTPException(503, str(error)) from None
    return {"reply": answer, "declined": False}


@router.post("/voice")
def voice(question: SpokenQuestion, _: int = Depends(member), listen: Listener = Depends(listener)) -> dict[str, Any]:
    """A question asked out loud: what was heard, as text the conversation goes on in, and the answer."""
    if not service.enabled():
        raise HTTPException(503, "The assistant is switched off on this server")
    if not service.listens():
        raise HTTPException(400, "This assistant cannot listen. Type your question.")
    mime_type = question.mime_type.split(";")[0].strip().lower()
    if mime_type not in service.AUDIO_TYPES:
        raise HTTPException(415, "That recording cannot be read. Type your question.")
    try:
        audio = base64.b64decode(question.audio, validate=True)
    except (binascii.Error, ValueError):
        raise HTTPException(422, "That recording cannot be read. Type your question.") from None
    if len(audio) > VOICE["max_bytes"]:
        raise HTTPException(413, "That recording is too long. Ask in a shorter one.")
    try:
        heard, answer = listen([turn.model_dump() for turn in question.history], audio, mime_type, question.language)
    except service.Unheard:
        raise HTTPException(422, "The assistant could not hear a question. Try again, or type it.") from None
    except service.Declined:
        return {"heard": None, "reply": None, "declined": True}
    except service.Unavailable as error:
        raise HTTPException(503, str(error)) from None
    return {"heard": heard, "reply": answer, "declined": False}
