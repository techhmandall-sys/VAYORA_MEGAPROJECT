"""HTTP face of the assistant: any signed-in member may ask, and nothing is kept."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..auth import member
from . import service

router = APIRouter(prefix="/v1/assistant", tags=["assistant"])
LIMITS = service.settings()


class Turn(BaseModel):
    # A member speaks as the user only: never as the system, whose words the model obeys.
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=LIMITS["max_message_chars"])


class Question(BaseModel):
    messages: list[Turn] = Field(min_length=1, max_length=LIMITS["max_messages"])
    language: Literal["en", "hi", "mr"] = "en"


def asker() -> service.Asker:
    """Who answers: the service settings.yaml names, unless a test says otherwise."""
    return service.ask


@router.get("")
def status(_: int = Depends(member)) -> dict[str, Any]:
    """Whether the assistant is on, which service answers (the page says where questions go), and
    how much one question may carry."""
    return {"enabled": service.enabled(), "provider": service.provider(), "max_messages": LIMITS["max_messages"],
            "max_message_chars": LIMITS["max_message_chars"]}


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
