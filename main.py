"""Точка входа: `python main.py` запускает дневник на http://localhost:8000."""

from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware

from app.config import HOST, PORT, SESSION_MAX_AGE, STATIC_DIR, get_secret_key
from app.db import init_db
from app.routers import auth, entries, misc


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title="Дневник", lifespan=lifespan)
app.add_middleware(
    SessionMiddleware,
    secret_key=get_secret_key(),
    session_cookie="diary_session",
    max_age=SESSION_MAX_AGE,
    same_site="strict",
)

app.include_router(auth.router)
app.include_router(entries.router)
app.include_router(misc.router)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# Страницы приложения. Весь интерфейс — один index.html,
# а какой экран показать, решает JavaScript по адресу.
@app.get("/", include_in_schema=False)
@app.get("/new", include_in_schema=False)
@app.get("/entries", include_in_schema=False)
@app.get("/entry/{entry_id}", include_in_schema=False)
@app.get("/close/{entry_id}", include_in_schema=False)
@app.get("/settings", include_in_schema=False)
def index():
    return FileResponse(STATIC_DIR / "index.html", headers={"Cache-Control": "no-cache"})


if __name__ == "__main__":
    uvicorn.run("main:app", host=HOST, port=PORT)
