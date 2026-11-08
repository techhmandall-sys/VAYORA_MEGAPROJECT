"""The VAYORA assistant: answers a member's questions about how VAYORA works, from its rules.

It sees only what the member typed in this conversation, which the browser sends whole each
time: intel keeps none of it, and the assistant reads no booking, ride or account. Without an
ANTHROPIC_API_KEY it is switched off, and says so.
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
# On a refusal, the request runs again on the model the API picks for the refusal's category.
FALLBACK_BETA = "server-side-fallback-2026-07-01"

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


def enabled() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY"))


def system(language: str) -> list[dict[str, Any]]:
    """The rules first, marked for caching; then the reader's language, which varies."""
    name = LANGUAGES[language]
    return [
        {"type": "text", "text": rules(), "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": f"The member reads the app in {name}. Answer in {name} unless they write to you in another language."},
    ]


@lru_cache(maxsize=1)
def _client() -> Any:
    import anthropic  # only where the assistant runs: nothing else in intel needs it

    # The key comes from ANTHROPIC_API_KEY.
    return anthropic.Anthropic(timeout=settings()["timeout_seconds"])


def ask_claude(messages: list[dict[str, str]], language: str) -> str:
    """Claude's answer to the conversation so far."""
    import anthropic

    config = settings()
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
        raise Unavailable("The assistant is not set up correctly on this server") from None
    except anthropic.RateLimitError:
        raise Unavailable("The assistant is busy. Try again in a minute.") from None
    except anthropic.APIConnectionError:  # a timeout is one too
        raise Unavailable("The assistant cannot be reached just now. Try again later.") from None
    except anthropic.APIStatusError as error:
        if error.status_code >= 500:
            raise Unavailable("The assistant cannot be reached just now. Try again later.") from None
        log.error("The assistant's request was refused: %s %s", error.status_code, error.message)
        raise Unavailable("The assistant could not answer that. Try asking another way.") from None
    # A refusal before any output leaves nothing to show; one mid-answer leaves a part.
    if response.stop_reason == "refusal":
        raise Declined()
    text = "".join(block.text for block in response.content if block.type == "text").strip()
    if not text:
        raise Unavailable("The assistant could not answer that. Try asking another way.")
    return text
