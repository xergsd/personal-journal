// Экран PIN: первый запуск (придумать PIN) или вход.

import { api } from "../api.js";
import { $, fromTemplate } from "../dom.js";

export function showPin(view, status, onSuccess) {
  const root = fromTemplate("pin");
  const form = $(root, "form");
  const input = root.querySelector("#pin-input");
  const hint = $(root, "hint");
  const error = $(root, "error");
  const submitBtn = $(root, "submit");

  const isSetup = !status.has_pin;
  let firstPin = null; // при создании PIN вводим его дважды

  hint.textContent = isSetup ? "Придумай PIN — от 4 до 8 цифр" : "Введи PIN";
  submitBtn.textContent = isSetup ? "Дальше" : "Войти";

  function fail(message) {
    error.textContent = message;
    input.value = "";
    input.classList.remove("shake");
    void input.offsetWidth; // перезапуск анимации
    input.classList.add("shake");
    input.focus();
  }

  async function submit() {
    const pin = input.value;
    error.textContent = "";
    if (!/^\d{4,8}$/.test(pin)) return fail("Нужно от 4 до 8 цифр");

    if (isSetup && firstPin === null) {
      firstPin = pin;
      input.value = "";
      hint.textContent = "Повтори PIN";
      submitBtn.textContent = "Готово";
      return;
    }
    if (isSetup && pin !== firstPin) {
      firstPin = null;
      hint.textContent = "Придумай PIN — от 4 до 8 цифр";
      submitBtn.textContent = "Дальше";
      return fail("PIN не совпал, давай ещё раз");
    }

    try {
      await api.post(isSetup ? "/api/auth/setup" : "/api/auth/login", { pin });
      onSuccess();
    } catch (e) {
      fail(e.message);
    }
  }

  form.addEventListener("submit", (e) => { e.preventDefault(); submit(); });
  // При входе PIN отправляется сам, как только введена последняя цифра.
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "");
    if (!isSetup && status.pin_length && input.value.length === status.pin_length) submit();
  });

  view.replaceChildren(root);
  input.focus();
}
