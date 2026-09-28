"""Настройки приложения: пути к файлам и константы."""

import secrets
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"

DB_PATH = DATA_DIR / "diary.db"
QUOTES_PATH = DATA_DIR / "quotes.json"
SECRET_KEY_PATH = DATA_DIR / "secret.key"

HOST = "127.0.0.1"  # только локально: с других устройств приложение недоступно
PORT = 8000

# Сколько живёт вход по PIN, прежде чем приложение попросит его снова.
SESSION_MAX_AGE = 12 * 60 * 60  # 12 часов

# Базовые теги, которые создаются при первом запуске.
BASE_TAGS = {
    "учёба": "#2F4C7A",
    "работа": "#6B5B3E",
    "здоровье": "#4E7A5A",
    "отношения": "#8A4F5C",
    "проекты": "#5B5690",
}
# Цвета для новых тегов по кругу.
TAG_COLORS = ["#2F4C7A", "#6B5B3E", "#4E7A5A", "#8A4F5C", "#5B5690", "#7A6A2F", "#3E6B70"]


def get_secret_key() -> str:
    """Ключ для подписи cookie сессии. Создаётся один раз и хранится в data/."""
    DATA_DIR.mkdir(exist_ok=True)
    if not SECRET_KEY_PATH.exists():
        SECRET_KEY_PATH.write_text(secrets.token_hex(32))
        SECRET_KEY_PATH.chmod(0o600)
    return SECRET_KEY_PATH.read_text().strip()
