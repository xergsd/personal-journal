// Настройки: тема, смена PIN, ссылки для напоминаний.

import { api } from "../api.js";
import { $, fromTemplate } from "../dom.js";
import { themePref } from "../storage.js";
import { setTheme } from "../theme.js";

export function showSettings(view) {
  const root = fromTemplate("settings");

  const current = themePref.get();
  root.querySelectorAll('input[name="theme"]').forEach((radio) => {
    radio.checked = radio.value === current;
    radio.addEventListener("change", () => setTheme(radio.value));
  });

  const form = $(root, "pin-form");
  const msg = $(root, "pin-msg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const oldPin = form.querySelector("#old-pin");
    const newPin = form.querySelector("#new-pin");
    msg.classList.remove("error");
    try {
      await api.post("/api/auth/change", { old_pin: oldPin.value, new_pin: newPin.value });
      msg.textContent = "PIN изменён";
      form.reset();
    } catch (err) {
      msg.textContent = err.message;
      msg.classList.add("error");
    }
  });

  view.replaceChildren(root);
}
