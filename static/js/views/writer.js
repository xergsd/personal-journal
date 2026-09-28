// Экран письма — сердце приложения.
//
// Как устроено сохранение (чтобы ничего не потерять):
//   1. При каждом нажатии клавиши текст сразу кладётся в localStorage.
//   2. Через 1,5 с после паузы (и не реже раза в 5 с) он уходит на сервер.
//   3. Когда сервер подтвердил — копия в браузере удаляется.
//   4. При закрытии вкладки несохранённое отправляется через navigator.sendBeacon.
//   Если сервер недоступен, копия остаётся в браузере и уйдёт при следующем открытии.

import { api, AuthError } from "../api.js";
import { $, formatDay, fromTemplate, parseDate, typeByHour } from "../dom.js";
import { currentDraft, localCopy } from "../storage.js";

const SAVE_DELAY = 1500;
const SAVE_MAX_WAIT = 5000;
const RETRY_DELAY = 5000;

// Какую запись открыть:
//   { entryId }  — существующую (из списка записей);
//   { newType }  — новую нужного типа (ссылка из напоминания, кнопка «Новая запись»);
//   {}           — продолжить начатую, а если её нет — новую.
async function resolveEntry(options) {
  if (options.entryId) {
    const entry = await loadEntry(options.entryId);
    return { id: options.entryId, entry, isCurrent: false };
  }

  const current = currentDraft.get();
  if (current) {
    const entry = await loadEntry(current.id);
    const hasContent = entry !== null || localCopy.get(current.id) !== null;
    const finished = entry?.finished;
    // Продолжаем начатую, если просили просто «писать»,
    // или если начатая пустая — тогда её можно переиспользовать под новую.
    if (!finished && (!options.newType || !hasContent)) {
      return { id: current.id, entry, isCurrent: true };
    }
  }

  const id = crypto.randomUUID();
  currentDraft.set(id);
  return { id, entry: null, isCurrent: true };
}

async function loadEntry(id) {
  try {
    return await api.get(`/api/entries/${id}`);
  } catch (e) {
    if (e instanceof AuthError) throw e;
    return null; // 404 — запись ещё ни разу не сохранялась, это нормально
  }
}

export async function showWriter(view, options, navigate) {
  const { id, entry } = await resolveEntry(options);

  // Несохранённая копия из браузера новее того, что на сервере.
  const local = localCopy.get(id);
  const state = {
    type: local?.type ?? entry?.type ?? options.newType ?? typeByHour(),
    title: local?.title ?? entry?.title ?? "",
    text: local?.text ?? entry?.text ?? "",
  };
  if (options.newType && !entry && !local) state.type = options.newType;

  const root = fromTemplate("writer");
  const titleEl = $(root, "title");
  const mirrorEl = $(root, "title-mirror");
  const textEl = $(root, "text");
  const statusEl = $(root, "status");
  const quoteEl = $(root, "quote");
  const hintEl = $(root, "title-hint");

  $(root, "date").textContent = formatDay(entry ? parseDate(entry.created_at) : new Date());
  titleEl.value = state.title;
  textEl.value = state.text;

  // ---------- Сохранение ----------

  let dirty = local !== null;
  let version = 0;        // растёт при каждом изменении
  let inflight = null;    // промис сохранения, которое сейчас идёт
  let saveTimer = null;
  let maxWaitTimer = null;
  let retryTimer = null;

  function setStatus(text, isError = false) {
    statusEl.textContent = text;
    statusEl.classList.toggle("error", isError);
  }

  function markChanged() {
    state.title = titleEl.value;
    state.text = textEl.value;
    version += 1;
    dirty = true;
    localCopy.set(id, { ...state });
    setStatus("…");
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flush, SAVE_DELAY);
    if (!maxWaitTimer) maxWaitTimer = setTimeout(flush, SAVE_MAX_WAIT);
  }

  // Отправляет текущий текст на сервер. Возвращает true, если всё сохранено.
  async function flush() {
    clearTimeout(saveTimer);
    clearTimeout(maxWaitTimer);
    clearTimeout(retryTimer);
    maxWaitTimer = null;
    // Если сохранение уже идёт — дожидаемся его, чтобы запросы не обгоняли друг друга.
    while (inflight) await inflight;
    if (!dirty) return true;
    inflight = send();
    const ok = await inflight;
    inflight = null;
    return ok;
  }

  async function send() {
    const sentVersion = version;
    try {
      await api.put(`/api/entries/${id}`, { ...state });
      // Пока запрос шёл, могли напечатать ещё — тогда копию не трогаем.
      if (version === sentVersion) {
        dirty = false;
        localCopy.clear(id);
        setStatus("сохранено");
      }
      return !dirty;
    } catch (e) {
      if (!(e instanceof AuthError)) {
        setStatus("нет связи с сервером — текст сохранён в браузере", true);
        retryTimer = setTimeout(flush, RETRY_DELAY);
      }
      return false;
    }
  }

  // Закрытие вкладки или уход в другое окно: отправляем то, что не успело уйти.
  function saveOnLeave() {
    if (!dirty) return;
    const blob = new Blob([JSON.stringify(state)], { type: "application/json" });
    navigator.sendBeacon(`/api/entries/${id}/beacon`, blob);
  }
  function onVisibility() {
    if (document.visibilityState === "hidden") saveOnLeave();
  }

  // ---------- Заголовок, текст, цитата ----------

  function autosize(textarea) {
    const scrollY = window.scrollY;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
    window.scrollTo(0, scrollY);
  }

  function syncTitle() {
    mirrorEl.textContent = titleEl.value;
    autosize(titleEl);
  }

  function syncQuote() {
    quoteEl.classList.toggle("collapsed", textEl.value.trim() !== "");
  }

  titleEl.addEventListener("input", () => {
    // Заголовок — одна мысль, без переносов строк (например, при вставке).
    if (titleEl.value.includes("\n")) titleEl.value = titleEl.value.replace(/\n+/g, " ");
    hintEl.textContent = "";
    syncTitle();
    markChanged();
  });
  titleEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      textEl.focus();
    }
  });
  textEl.addEventListener("input", () => {
    autosize(textEl);
    syncQuote();
    markChanged();
  });
  quoteEl.addEventListener("click", () => quoteEl.classList.toggle("collapsed"));

  async function loadQuote(type) {
    try {
      const q = await api.get(`/api/quote?type=${type}`);
      $(quoteEl, "quote-text").textContent = q.text;
      $(quoteEl, "quote-author").textContent = q.author;
      $(quoteEl, "quote-source").textContent = q.source;
      quoteEl.hidden = false;
    } catch {
      quoteEl.hidden = true; // без цитаты писать тоже можно
    }
  }

  // ---------- Тип записи ----------

  const typeButtons = root.querySelectorAll("[data-type]");
  function renderType() {
    typeButtons.forEach((b) => b.setAttribute("aria-checked", String(b.dataset.type === state.type)));
  }
  typeButtons.forEach((b) =>
    b.addEventListener("click", () => {
      if (state.type === b.dataset.type) return;
      state.type = b.dataset.type;
      renderType();
      loadQuote(state.type);
      if (state.title || state.text) markChanged();
    })
  );

  // ---------- Завершение ----------

  async function finish() {
    if (!titleEl.value.trim()) {
      hintEl.textContent = "Сначала заголовок — пара слов о том, о чём запись";
      titleEl.focus();
      return;
    }
    let ok = await flush();
    if (!ok && dirty && !retryTimer) ok = await flush(); // успели допечатать во время сохранения
    if (ok) navigate(`/close/${id}`);
  }
  $(root, "finish").addEventListener("click", finish);

  // ---------- Режим письма: всё лишнее прячется, пока печатаешь ----------

  let lastMouse = null;
  function onKeydown(e) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      finish();
      return;
    }
    if (e.target === titleEl || e.target === textEl) document.body.classList.add("is-typing");
  }
  function onMouseMove(e) {
    // Реагируем только на заметное движение, а не на дрожание тачпада.
    if (lastMouse && Math.hypot(e.clientX - lastMouse.x, e.clientY - lastMouse.y) > 12) {
      document.body.classList.remove("is-typing");
    }
    lastMouse = { x: e.clientX, y: e.clientY };
  }

  document.addEventListener("keydown", onKeydown);
  document.addEventListener("mousemove", onMouseMove);
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("pagehide", saveOnLeave);

  // ---------- Показ ----------

  renderType();
  view.replaceChildren(root);
  syncTitle();
  autosize(textEl);
  syncQuote();
  loadQuote(state.type);
  if (dirty) flush(); // осталась несохранённая копия с прошлого раза

  // Курсор сразу там, где нужно писать.
  const focusTarget = state.title ? textEl : titleEl;
  focusTarget.focus();
  focusTarget.setSelectionRange(focusTarget.value.length, focusTarget.value.length);

  // Уборка при переходе на другой экран.
  return () => {
    flush();
    clearTimeout(retryTimer);
    document.removeEventListener("keydown", onKeydown);
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("pagehide", saveOnLeave);
    document.body.classList.remove("is-typing");
  };
}
