"""Подключение к SQLite и первичное заполнение базы."""

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine, select

from app.config import BASE_TAGS, DATA_DIR, DB_PATH
from app.models import Settings, Tag

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    # FastAPI может обработать запрос в другом потоке — SQLite нужно это разрешить.
    connect_args={"check_same_thread": False},
)


@event.listens_for(engine, "connect")
def _sqlite_pragmas(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")   # иначе SQLite не удаляет связи каскадом
    cursor.execute("PRAGMA journal_mode = WAL")  # надёжнее при частых записях
    cursor.close()


def init_db() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        if session.get(Settings, 1) is None:
            session.add(Settings(id=1))
        existing = set(session.exec(select(Tag.name)).all())
        for name, color in BASE_TAGS.items():
            if name not in existing:
                session.add(Tag(name=name, color=color))
        session.commit()


def get_session():
    """Зависимость FastAPI: одна сессия БД на запрос."""
    with Session(engine) as session:
        yield session
