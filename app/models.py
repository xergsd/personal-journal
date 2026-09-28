"""Таблицы базы данных и схемы запросов/ответов API."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import Field as PydField
from pydantic import NaiveDatetime
from sqlmodel import Field, Relationship, SQLModel


class EntryType(str, Enum):
    morning = "morning"
    evening = "evening"
    free = "free"


# ---------- Таблицы ----------

class EntryTagLink(SQLModel, table=True):
    """Связь «многие ко многим» между записями и тегами."""
    entry_id: str = Field(foreign_key="entry.id", primary_key=True, ondelete="CASCADE")
    tag_id: int = Field(foreign_key="tag.id", primary_key=True, ondelete="CASCADE")


class Tag(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True, index=True)
    color: str

    entries: list["Entry"] = Relationship(back_populates="tags", link_model=EntryTagLink)


class Entry(SQLModel, table=True):
    # id придумывает браузер (UUID) ещё до первого сохранения:
    # так одна и та же запись не задвоится, даже если сохранение сработает дважды.
    id: str = Field(primary_key=True)
    type: EntryType = EntryType.free
    title: str = ""
    text: str = ""
    mood: Optional[int] = None    # 1–10
    energy: Optional[int] = None  # 1–10
    finished: bool = False        # прошла ли запись экран закрытия (или его пропустили)
    # Время локальное, без часового пояса (NaiveDatetime): приложение работает
    # только на ноутбуке, и «сегодня» — это сегодня по его часам.
    created_at: NaiveDatetime = Field(default_factory=datetime.now, index=True)
    updated_at: NaiveDatetime = Field(default_factory=datetime.now)

    tags: list[Tag] = Relationship(back_populates="entries", link_model=EntryTagLink)


class Settings(SQLModel, table=True):
    """Единственная строка с настройками (id = 1)."""
    id: int = Field(default=1, primary_key=True)
    theme: str = "auto"  # auto | light | dark
    pin_hash: Optional[str] = None
    pin_salt: Optional[str] = None
    pin_length: Optional[int] = None


# ---------- Схемы API ----------

class TagRead(SQLModel):
    id: int
    name: str
    color: str


class EntrySave(SQLModel):
    """То, что присылает автосохранение."""
    type: EntryType
    title: str = PydField(default="", max_length=300)
    text: str = ""


class EntryClose(SQLModel):
    """Экран закрытия: всё необязательно."""
    mood: Optional[int] = PydField(default=None, ge=1, le=10)
    energy: Optional[int] = PydField(default=None, ge=1, le=10)
    tags: list[str] = []


class EntryRead(SQLModel):
    id: str
    type: EntryType
    title: str
    text: str
    mood: Optional[int]
    energy: Optional[int]
    finished: bool
    created_at: NaiveDatetime
    updated_at: NaiveDatetime
    tags: list[TagRead]


class PinBody(SQLModel):
    pin: str


class PinChange(SQLModel):
    old_pin: str
    new_pin: str


class SettingsRead(SQLModel):
    theme: str


class SettingsUpdate(SQLModel):
    theme: str = PydField(pattern="^(auto|light|dark)$")
