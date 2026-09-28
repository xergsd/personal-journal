"""Цитата дня.

Цитата зависит только от даты и времени суток, поэтому весь день она одна и та же.
Порядок цитат перемешан один раз с фиксированным зерном: подряд идущие дни
не показывают одного и того же автора.
"""

import json
import random
from datetime import date
from functools import lru_cache

from app.config import QUOTES_PATH


@lru_cache
def _pools() -> dict[str, list[dict]]:
    quotes = json.loads(QUOTES_PATH.read_text(encoding="utf-8"))
    pools: dict[str, list[dict]] = {"morning": [], "evening": []}
    for q in quotes:
        pools[q["time"]].append(q)
    for pool in pools.values():
        random.Random(42).shuffle(pool)
    return pools


def quote_of_day(time_of_day: str, day: date | None = None) -> dict:
    pool = _pools()[time_of_day]
    day = day or date.today()
    return pool[day.toordinal() % len(pool)]
