"""Who may ask intel for something: an administrator, or any signed-in member.

core-api signs the session tokens; intel only checks them, as the gateway does: HS256
with the shared JWT_SECRET, issued by core-api and not expired. intel keeps no state, so
it cannot see a suspension made after the token was issued.
"""

from __future__ import annotations

import os

import jwt
from fastapi import Header, HTTPException

ISSUER = "vayora-core-api"


def _claims(authorization: str | None, unset: str) -> dict:
    """What a session token core-api signed says, or the reason there is none.

    :param unset: why nothing can be checked when the server has no JWT_SECRET
    """
    secret = os.environ.get("JWT_SECRET")
    if not secret:
        raise HTTPException(503, unset)
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sign in first")
    try:
        return jwt.decode(authorization.removeprefix("Bearer "), secret, algorithms=["HS256"],
                          issuer=ISSUER, options={"require": ["exp", "iss", "sub"]})
    except jwt.PyJWTError:
        raise HTTPException(401, "Your session has ended. Sign in again.") from None


def administrator(authorization: str | None = Header(default=None)) -> int:
    """The signed-in administrator's id, or the reason there is none."""
    claims = _claims(authorization, "Live runs are not set up on this server")
    if claims.get("role") != "ADMIN":
        raise HTTPException(403, "Only an administrator can run the simulator")
    return int(claims["sub"])


def member(authorization: str | None = Header(default=None)) -> int:
    """The signed-in member's id, whatever their role, or the reason there is none."""
    return int(_claims(authorization, "The assistant is not set up on this server")["sub"])
