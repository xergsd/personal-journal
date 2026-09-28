// Тема: auto | light | dark. «Авто» — тёмная с 20:00 до 6:00.

import { api } from "./api.js";
import { themePref } from "./storage.js";

const LABELS = { auto: "Тема: авто", light: "Тема: светлая", dark: "Тема: тёмная" };
const ORDER = ["auto", "light", "dark"];

export function resolveTheme(pref) {
  if (pref !== "auto") return pref;
  const hour = new Date().getHours();
  return hour >= 20 || hour < 6 ? "dark" : "light";
}

export function applyTheme(pref) {
  themePref.set(pref);
  document.documentElement.dataset.theme = resolveTheme(pref);
  const toggle = document.getElementById("theme-toggle");
  if (toggle) toggle.textContent = LABELS[pref];
}

export async function setTheme(pref) {
  applyTheme(pref);
  try { await api.put("/api/settings", { theme: pref }); } catch {}
}

export function initThemeToggle() {
  applyTheme(themePref.get());
  document.getElementById("theme-toggle").addEventListener("click", () => {
    const next = ORDER[(ORDER.indexOf(themePref.get()) + 1) % ORDER.length];
    setTheme(next);
  });
  // В режиме «авто» тема сама переключится вечером, даже если окно открыто весь день.
  setInterval(() => applyTheme(themePref.get()), 5 * 60 * 1000);
}

// Настройка на сервере главнее: подтягиваем её после входа.
export async function syncThemeFromServer() {
  try {
    const { theme } = await api.get("/api/settings");
    if (theme !== themePref.get()) applyTheme(theme);
  } catch {}
}
