"""Вход по PIN."""

import asyncio

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlmodel import Session

from app.db import get_session
from app.models import PinBody, PinChange, Settings
from app.security import hash_pin, require_auth, validate_pin_format, verify_pin

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/status")
def auth_status(request: Request, session: Session = Depends(get_session)):
    settings = session.get(Settings, 1)
    return {
        "has_pin": settings.pin_hash is not None,
        # Длина нужна, чтобы вход срабатывал сразу после последней цифры, без Enter.
        "pin_length": settings.pin_length,
        "authed": bool(request.session.get("authed")),
    }


@router.post("/setup")
def setup_pin(body: PinBody, request: Request, session: Session = Depends(get_session)):
    """Первый запуск: придумать PIN."""
    settings = session.get(Settings, 1)
    if settings.pin_hash is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "PIN уже задан")
    validate_pin_format(body.pin)
    settings.pin_hash, settings.pin_salt = hash_pin(body.pin)
    settings.pin_length = len(body.pin)
    session.commit()
    request.session["authed"] = True
    return {"ok": True}


@router.post("/login")
async def login(body: PinBody, request: Request, session: Session = Depends(get_session)):
    settings = session.get(Settings, 1)
    if settings.pin_hash is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "PIN ещё не задан")
    if not verify_pin(body.pin, settings.pin_hash, settings.pin_salt):
        await asyncio.sleep(0.8)  # замедляем перебор
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Неверный PIN")
    request.session["authed"] = True
    return {"ok": True}


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@router.post("/change", dependencies=[Depends(require_auth)])
def change_pin(body: PinChange, session: Session = Depends(get_session)):
    settings = session.get(Settings, 1)
    if not verify_pin(body.old_pin, settings.pin_hash, settings.pin_salt):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Старый PIN неверный")
    validate_pin_format(body.new_pin)
    settings.pin_hash, settings.pin_salt = hash_pin(body.new_pin)
    settings.pin_length = len(body.new_pin)
    session.commit()
    return {"ok": True}
