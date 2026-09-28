"""PIN-код: хеширование и проверка входа."""

import hashlib
import hmac
import secrets

from fastapi import HTTPException, Request, status

# PBKDF2 намеренно медленный: даже если кто-то скопирует базу,
# перебрать PIN будет дольше. Хранится только хеш, не сам PIN.
_ITERATIONS = 200_000


def hash_pin(pin: str, salt: str | None = None) -> tuple[str, str]:
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", pin.encode(), bytes.fromhex(salt), _ITERATIONS)
    return digest.hex(), salt


def verify_pin(pin: str, pin_hash: str, salt: str) -> bool:
    candidate, _ = hash_pin(pin, salt)
    return hmac.compare_digest(candidate, pin_hash)


def validate_pin_format(pin: str) -> None:
    if not (pin.isdigit() and 4 <= len(pin) <= 8):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "PIN — от 4 до 8 цифр")


def require_auth(request: Request) -> None:
    """Зависимость для всех закрытых маршрутов API."""
    if not request.session.get("authed"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Нужно ввести PIN")
