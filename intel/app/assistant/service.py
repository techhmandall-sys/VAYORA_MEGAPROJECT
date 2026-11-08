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


# ---- Gemini

@lru_cache(maxsize=1)
def _gemini_client() -> Any:
    from google import genai  # only where the assistant runs on Gemini
    from google.genai import types

    return genai.Client(api_key=os.environ[KEYS["gemini"]],
                        http_options=types.HttpOptions(timeout=settings()["gemini"]["timeout_seconds"] * 1000))


def ask_gemini(messages: list[dict[str, str]], language: str) -> str:
    """Gemini's answer to the conversation so far."""
    from google.genai import errors, types

    config = settings()["gemini"]
    try:
        response = _gemini_client().models.generate_content(
            model=config["model"],
            # Gemini calls the assistant's side of the conversation the model's.
            contents=[types.Content(role="model" if m["role"] == "assistant" else "user", parts=[types.Part(text=m["content"])])
                      for m in messages],
            config=types.GenerateContentConfig(
                system_instruction=f"{rules()}\n\n{in_language(language)}",
                max_output_tokens=config["max_tokens"],
                thinking_config=types.ThinkingConfig(thinking_level=types.ThinkingLevel[config["thinking_level"].upper()]),
            ),
        )
    except errors.APIError as error:
        if error.code == 429:  # the free tier's limit per minute or per day
            raise Unavailable(BUSY) from None
        if error.code in (401, 403) or (error.code == 400 and "API key" in str(error.message)):
            log.error("The assistant's Gemini key was refused: %s", error.status)
            raise Unavailable(MISCONFIGURED) from None
        if error.code >= 500:
            raise Unavailable(UNREACHABLE) from None
        log.error("The assistant's request was refused: %s %s", error.code, error.message)
        raise Unavailable(NO_ANSWER) from None
    except Exception:  # the network: the SDK can use either of two HTTP libraries
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
