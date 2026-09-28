"""Записи дневника."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlmodel import Session, col, func, select

from app.config import TAG_COLORS
from app.db import get_session
from app.models import Entry, EntryClose, EntryRead, EntrySave, Tag
from app.security import require_auth

router = APIRouter(prefix="/api/entries", tags=["entries"], dependencies=[Depends(require_auth)])


def _get_or_404(session: Session, entry_id: str) -> Entry:
    entry = session.get(Entry, entry_id)
    if entry is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Запись не найдена")
    return entry


@router.get("", response_model=list[EntryRead])
def list_entries(limit: int = 200, session: Session = Depends(get_session)):
    query = (
        select(Entry)
        # Пустые черновики (открыл и ничего не написал) в списке не нужны.
        .where((Entry.title != "") | (Entry.text != ""))
        .order_by(col(Entry.created_at).desc())
        .limit(limit)
    )
    return session.exec(query).all()


@router.get("/{entry_id}", response_model=EntryRead)
def get_entry(entry_id: str, session: Session = Depends(get_session)):
    return _get_or_404(session, entry_id)


def _save(entry_id: str, body: EntrySave, session: Session) -> Entry | None:
    """Создать или обновить запись. Один метод и для PUT, и для sendBeacon."""
    entry = session.get(Entry, entry_id)
    if entry is None:
        if not body.title and not body.text:
            return None  # нечего сохранять
        entry = Entry(id=entry_id)
        session.add(entry)
    entry.type = body.type
    entry.title = body.title
    entry.text = body.text
    entry.updated_at = datetime.now()
    session.commit()
    session.refresh(entry)
    return entry


@router.put("/{entry_id}")
def save_entry(entry_id: str, body: EntrySave, session: Session = Depends(get_session)):
    entry = _save(entry_id, body, session)
    return {"ok": True, "updated_at": entry.updated_at if entry else None}


@router.post("/{entry_id}/beacon", status_code=status.HTTP_204_NO_CONTENT)
async def save_entry_beacon(entry_id: str, request: Request, session: Session = Depends(get_session)):
    """Последнее сохранение при закрытии вкладки.

    Браузер отправляет его через navigator.sendBeacon — это всегда POST,
    и ответ никто не читает. Поэтому тело разбираем вручную.
    """
    body = EntrySave.model_validate_json(await request.body())
    _save(entry_id, body, session)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


def _tags_by_names(session: Session, names: list[str]) -> list[Tag]:
    tags = []
    for raw in names:
        name = raw.strip().lstrip("#").strip().lower()[:40]
        if not name:
            continue
        tag = session.exec(select(Tag).where(Tag.name == name)).first()
        if tag is None:
            count = session.exec(select(func.count()).select_from(Tag)).one()
            tag = Tag(name=name, color=TAG_COLORS[count % len(TAG_COLORS)])
            session.add(tag)
        if tag not in tags:
            tags.append(tag)
    return tags


@router.post("/{entry_id}/close", response_model=EntryRead)
def close_entry(entry_id: str, body: EntryClose, session: Session = Depends(get_session)):
    """Экран закрытия: настроение, энергия, теги. «Пропустить» присылает пустое тело."""
    entry = _get_or_404(session, entry_id)
    entry.mood = body.mood
    entry.energy = body.energy
    entry.tags = _tags_by_names(session, body.tags)
    entry.finished = True
    session.commit()
    session.refresh(entry)
    return entry


@router.delete("/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_entry(entry_id: str, session: Session = Depends(get_session)):
    session.delete(_get_or_404(session, entry_id))
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
