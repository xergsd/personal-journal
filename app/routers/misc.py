"""Небольшие маршруты: теги, цитата дня, настройки."""

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.db import get_session
from app.models import EntryType, Settings, SettingsRead, SettingsUpdate, Tag, TagRead
from app.quotes import quote_of_day
from app.security import require_auth

router = APIRouter(prefix="/api", dependencies=[Depends(require_auth)])


@router.get("/tags", response_model=list[TagRead])
def list_tags(session: Session = Depends(get_session)):
    return session.exec(select(Tag).order_by(Tag.id)).all()


@router.get("/quote")
def get_quote(type: EntryType = EntryType.free):
    if type == EntryType.free:
        # Для свободной записи: до 15:00 — утренняя цитата, после — вечерняя.
        time_of_day = "morning" if datetime.now().hour < 15 else "evening"
    else:
        time_of_day = type.value
    return quote_of_day(time_of_day)


@router.get("/settings", response_model=SettingsRead)
def get_settings(session: Session = Depends(get_session)):
    return session.get(Settings, 1)


@router.put("/settings", response_model=SettingsRead)
def update_settings(body: SettingsUpdate, session: Session = Depends(get_session)):
    settings = session.get(Settings, 1)
    settings.theme = body.theme
    session.commit()
    session.refresh(settings)
    return settings
