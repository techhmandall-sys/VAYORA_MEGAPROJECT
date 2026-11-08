"""The VAYORA assistant: answers a member's questions about how VAYORA works, from its rules.

It sees only what the member typed in this conversation, which the browser sends whole each
time: intel keeps none of it, and the assistant reads no booking, ride or account. The answers
come from the service settings.yaml names, Gemini or Claude; without that service's key the
assistant is switched off, and says so.
"""

from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Callable

import yaml

HERE = Path(__file__).parent
log = logging.getLogger(__name__)

LANGUAGES = {"en": "English", "hi": "Hindi", "mr": "Marathi"}
# Where each service's key is read from.
KEYS = {"gemini": "GEMINI_API_KEY", "claude": "ANTHROPIC_API_KEY"}
# On a refusal, Claude's request runs again on the model the API picks for the refusal's category.
FALLBACK_BETA = "server-side-fallback-2026-07-01"

BUSY = "The assistant is busy. Try again in a minute."
UNREACHABLE = "The assistant cannot be reached just now. Try again later."
MISCONFIGURED = "The assistant is not set up correctly on this server"
NO_ANSWER = "The assistant could not answer that. Try asking another way."

# One answer to the conversation so far, in the reader's language.
Asker = Callable[[list[dict[str, str]], str], str]


class Unavailable(Exception):
    """No answer could be had. The message says why, in words the app translates."""


class Declined(Exception):
    """The model declined to answer."""


@lru_cache(maxsize=1)
def settings() -> dict[str, Any]:
    return yaml.safe_load((HERE / "settings.yaml").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def rules() -> str:
    """What the assistant knows and how it answers: the same for everyone, so it caches."""
    return (HERE / "knowledge.md").read_text(encoding="utf-8")


def provider() -> str:
    return settings()["provider"]


def enabled() -> bool:
    return bool(os.environ.get(KEYS[provider()]))


def in_language(language: str) -> str:
    name = LANGUAGES[language]
    return f"The member reads the app in {name}. Answer in {name} unless they write to you in another language."


def ask(messages: list[dict[str, str]], language: str) -> str:
    """The answer of whichever service settings.yaml names."""
    return {"gemini": ask_gemini, "claude": ask_claude}[provider()](messages, language)


# Recordings a browser makes, as the service that hears them names them. Safari records MP4
# audio, which Gemini knows as M4A.
AUDIO_TYPES = {"audio/webm": "audio/webm", "audio/ogg": "audio/ogg", "audio/mp4": "audio/m4a",
               "audio/m4a": "audio/m4a", "audio/aac": "audio/aac", "audio/mpeg": "audio/mpeg", "audio/wav": "audio/wav"}
LISTENING = ("The member's last question is a voice recording. In \"heard\", write exactly what they said, in the "
             "language and script they spoke it in, or nothing if no question can be heard. In \"answer\", answer it "
             "as you would a written question.")
# What a spoken question comes back as: the question as text, so the conversation goes on in
# text, and the answer.
HEARD_AND_ANSWER = {
    "type": "object",
    "properties": {"heard": {"type": "string"}, "answer": {"type": "string"}},
    "required": ["heard", "answer"],
}


class Unheard(Exception):
    """A recording in which no question could be heard."""


def listens() -> bool:
    """Whether the service in use can take a spoken question: Claude's API takes no audio."""
    return provider() == "gemini"


def listen(history: list[dict[str, str]], audio: bytes, mime_type: str, language: str) -> tuple[str, str]:
    """What the member said out loud, and the answer to it."""
    return listen_gemini(history, audio, mime_type, language)


# ---- Gemini

@lru_cache(maxsize=1)
def _gemini_client() -> Any:
    from google import genai  # only where the assistant runs on Gemini
    from google.genai import types

    return genai.Client(api_key=os.environ[KEYS["gemini"]],
                        http_options=types.HttpOptions(timeout=settings()["gemini"]["timeout_seconds"] * 1000))


def _turns(messages: list[dict[str, str]]) -> list[Any]:
    from google.genai import types

    # Gemini calls the assistant's side of the conversation the model's.
    return [types.Content(role="model" if m["role"] == "assistant" else "user", parts=[types.Part(text=m["content"])])
            for m in messages]


def ask_gemini(messages: list[dict[str, str]], language: str) -> str:
    """Gemini's answer to the conversation so far."""
    text = _gemini(_turns(messages), f"{rules()}\n\n{in_language(language)}").strip()
    if not text:
        raise Unavailable(NO_ANSWER)
    return text


def listen_gemini(history: list[dict[str, str]], audio: bytes, mime_type: str, language: str) -> tuple[str, str]:
    """What Gemini heard in the recording, and its answer, from one request."""
    import json

    from google.genai import types

    recording = types.Content(role="user", parts=[types.Part.from_bytes(data=audio, mime_type=AUDIO_TYPES[mime_type])])
    text = _gemini([*_turns(history), recording], f"{rules()}\n\n{in_language(language)}\n\n{LISTENING}", HEARD_AND_ANSWER)
    try:
        reply = json.loads(text)
        heard, answer = str(reply["heard"]).strip(), str(reply["answer"]).strip()
    except (ValueError, KeyError, TypeError):
        log.error("Gemini's reply to a spoken question was not the shape asked for")
        raise Unavailable(NO_ANSWER) from None
    if not heard:
        raise Unheard()
    if not answer:
        raise Unavailable(NO_ANSWER)
    return heard, answer


def _gemini(contents: list[Any], instruction: str, schema: dict[str, Any] | None = None) -> str:
    """The text of Gemini's reply, or the reason there is none, in the app's words.

    :param schema: the JSON the reply must be, or None for prose
    """
    from google.genai import errors, types

    config = settings()["gemini"]
    for attempt in range(1, config["attempts"] + 1):
        last = attempt == config["attempts"]
        try:
            response = _gemini_client().models.generate_content(
                model=config["model"],
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=instruction,
                    max_output_tokens=config["max_tokens"],
                    thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel[config["thinking_level"].upper()]),
                    **({"response_mime_type": "application/json", "response_json_schema": schema} if schema else {}),
                ),
            )
            break
        except errors.APIError as error:
            if error.code == 429:  # the free tier's limit per minute or per day: trying again only adds to it
                raise Unavailable(BUSY) from None
            if error.code in (401, 403) or (error.code == 400 and "API key" in str(error.message)):
                log.error("The assistant's Gemini key was refused: %s", error.status)
                raise Unavailable(MISCONFIGURED) from None
            if error.code >= 500:  # a stall (504) or an outage: once more, then say so
                if last:
                    raise Unavailable(UNREACHABLE) from None
                continue
            log.error("The assistant's request was refused: %s %s", error.code, error.message)
            raise Unavailable(NO_ANSWER) from None
        except Exception:  # the network, or a timeout: the SDK can use either of two HTTP libraries
            if last:
                log.exception("Gemini could not be reached")
                raise Unavailable(UNREACHABLE) from None
    if response.prompt_feedback is not None and response.prompt_feedback.block_reason:
        raise Declined()
    candidate = response.candidates[0] if response.candidates else None
    if candidate is None or candidate.finish_reason not in (types.FinishReason.STOP, types.FinishReason.MAX_TOKENS):
        raise Declined()
    text = (response.text or "").strip()
    if not text:
        raise Unavailable(NO_ANSWER)
    return text


# ---- Claude

def system(language: str) -> list[dict[str, Any]]:
    """Claude's system prompt: the rules first, marked for caching; then the reader's language."""
    return [
        {"type": "text", "text": rules(), "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": in_language(language)},
    ]


@lru_cache(maxsize=1)
def _client() -> Any:
    import anthropic  # only where the assistant runs on Claude

    # The key comes from ANTHROPIC_API_KEY.
    return anthropic.Anthropic(timeout=settings()["claude"]["timeout_seconds"])


def ask_claude(messages: list[dict[str, str]], language: str) -> str:
    """Claude's answer to the conversation so far."""
    import anthropic

    config = settings()["claude"]
    try:
        response = _client().beta.messages.create(
            model=config["model"],
            max_tokens=config["max_tokens"],
            output_config={"effort": config["effort"]},
            betas=[FALLBACK_BETA],
            fallbacks="default",
            system=system(language),
            messages=messages,
        )
    except (anthropic.AuthenticationError, anthropic.PermissionDeniedError):
        log.exception("The assistant's API key was refused")
        raise Unavailable(MISCONFIGURED) from None
    except anthropic.RateLimitError:
        raise Unavailable(BUSY) from None
    except anthropic.APIConnectionError:  # a timeout is one too
        raise Unavailable(UNREACHABLE) from None
    except anthropic.APIStatusError as error:
        if error.status_code >= 500:
            raise Unavailable(UNREACHABLE) from None
        log.error("The assistant's request was refused: %s %s", error.status_code, error.message)
        raise Unavailable(NO_ANSWER) from None
    # A refusal before any output leaves nothing to show; one mid-answer leaves a part.
    if response.stop_reason == "refusal":
        raise Declined()
    text = "".join(block.text for block in response.content if block.type == "text").strip()
    if not text:
        raise Unavailable(NO_ANSWER)
    return text
