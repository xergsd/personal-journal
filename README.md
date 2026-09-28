# Дневник

Личный буллет-джорнал на ноутбуке: дневник и трекер. Работает локально,
все данные хранятся в `data/diary.db` на этом компьютере.
Полное ТЗ — в [ТЗ.md](ТЗ.md).

## Запуск

```bash
python3 -m venv .venv                # один раз
.venv/bin/pip install -r requirements.txt
.venv/bin/python main.py             # затем открыть http://localhost:8000
```

При первом открытии приложение попросит придумать PIN.

- `./scripts/open.sh` — открыть дневник отдельным окном Chrome, без вкладок.
  Ещё вариант — Safari: «Файл → Добавить в Dock».
- `./scripts/install_autostart.sh` — запускать сервер при входе в macOS.
  Отключить: `./scripts/uninstall_autostart.sh`.

## Как устроено

```
main.py               точка входа: FastAPI, страницы, запуск uvicorn
app/
  config.py           пути и константы
  models.py           таблицы (SQLModel) и схемы API
  db.py               подключение к SQLite, базовые теги
  security.py         PIN: хеширование и проверка входа
  quotes.py           цитата дня
  routers/
    auth.py           /api/auth/*   — PIN
    entries.py        /api/entries/* — записи
    misc.py           теги, цитата, настройки
data/
  quotes.json         100 цитат (утро/вечер) с указанием источника
  diary.db            база (создаётся сама, в git не попадает)
static/
  index.html          оболочка и шаблоны экранов
  css/style.css       стиль bujo, светлая и тёмная темы
  js/app.js           вход по PIN и переключение экранов
  js/views/*.js       экраны: PIN, письмо, закрытие записи, список, настройки
```

Автосохранение описано в начале `static/js/views/writer.js`.

Документация API: http://localhost:8000/docs
