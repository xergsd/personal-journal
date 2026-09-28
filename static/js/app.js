// Точка входа интерфейса: проверка PIN и переключение экранов по адресу.

import { api, AuthError } from "./api.js";
import { initThemeToggle, syncThemeFromServer } from "./theme.js";
import { showClosing } from "./views/closing.js";
import { showEntries } from "./views/entries.js";
import { showPin } from "./views/pin.js";
import { showSettings } from "./views/settings.js";
import { showWriter } from "./views/writer.js";

const view = document.getElementById("view");
const nav = document.getElementById("nav");

// Адрес → экран. section подсвечивает пункт меню.
const routes = [
  { pattern: /^\/$/, section: "write", show: () => showWriter(view, {}, navigate) },
  { pattern: /^\/new$/, section: "write", show: () => showWriter(view, { newType: newTypeParam() }, navigate) },
  { pattern: /^\/entry\/([\w-]+)$/, section: "entries", show: ([id]) => showWriter(view, { entryId: id }, navigate) },
  { pattern: /^\/close\/([\w-]+)$/, section: "write", show: ([id]) => showClosing(view, id, navigate) },
  { pattern: /^\/entries$/, section: "entries", show: () => showEntries(view) },
  { pattern: /^\/settings$/, section: "settings", show: () => showSettings(view) },
];

function newTypeParam() {
  const type = new URLSearchParams(location.search).get("type");
  return ["morning", "evening", "free"].includes(type) ? type : "free";
}

let cleanup = null; // функция уборки текущего экрана (например, дописать сохранение)
let renderId = 0;

export function navigate(url, { replace = false } = {}) {
  if (replace) history.replaceState(null, "", url);
  else history.pushState(null, "", url);
  render();
}

async function render() {
  const myRender = ++renderId;
  if (cleanup) { cleanup(); cleanup = null; }

  const status = await api.get("/api/auth/status");
  if (myRender !== renderId) return;
  if (!status.authed) {
    nav.hidden = true;
    showPin(view, status, () => {
      syncThemeFromServer();
      render();
    });
    return;
  }
  nav.hidden = false;

  const path = location.pathname;
  const route = routes.find((r) => r.pattern.test(path)) ?? routes[0];
  const params = path.match(route.pattern)?.slice(1) ?? [];

  nav.querySelectorAll("[data-section]").forEach((a) =>
    a.classList.toggle("active", a.dataset.section === route.section)
  );

  try {
    const result = await route.show(params);
    if (myRender !== renderId) { if (typeof result === "function") result(); return; }
    if (typeof result === "function") cleanup = result;
    // Ссылка из напоминания (/new?type=…) создаёт запись один раз:
    // после этого адрес меняется на «/», и обновление страницы её продолжит.
    if (path === "/new") history.replaceState(null, "", "/");
    window.scrollTo(0, 0);
  } catch (e) {
    if (e instanceof AuthError) return; // экран PIN покажет обработчик auth-lost
    view.textContent = `Что-то пошло не так: ${e.message}`;
  }
}

// Переходы по внутренним ссылкам — без перезагрузки страницы.
document.addEventListener("click", (e) => {
  const link = e.target.closest("a[data-link]");
  if (!link || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  navigate(link.getAttribute("href"));
});
window.addEventListener("popstate", render);
window.addEventListener("auth-lost", () => render());

document.getElementById("lock").addEventListener("click", async () => {
  if (cleanup) { cleanup(); cleanup = null; }
  await api.post("/api/auth/logout");
  render();
});

initThemeToggle();
render();
