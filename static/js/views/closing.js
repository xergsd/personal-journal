// Экран закрытия записи: настроение, энергия, теги. Всё необязательно.

import { api } from "../api.js";
import { $, el, fromTemplate } from "../dom.js";
import { currentDraft } from "../storage.js";

export async function showClosing(view, entryId, navigate) {
  const [entry, allTags] = await Promise.all([
    api.get(`/api/entries/${entryId}`),
    api.get("/api/tags"),
  ]);

  const root = fromTemplate("closing");
  $(root, "title").textContent = entry.title || "Без заголовка";

  const values = { mood: entry.mood, energy: entry.energy };
  const selectedTags = new Set(entry.tags.map((t) => t.name));

  // Шкала 1–10 из кружков. Повторное нажатие снимает выбор.
  for (const name of ["mood", "energy"]) {
    const scale = root.querySelector(`[data-scale="${name}"]`);
    for (let n = 1; n <= 10; n++) {
      const btn = el("button", { type: "button", role: "radio", "aria-label": String(n) }, String(n));
      btn.addEventListener("click", () => {
        values[name] = values[name] === n ? null : n;
        renderScale(scale, values[name]);
      });
      scale.append(btn);
    }
    renderScale(scale, values[name]);
  }

  // Теги: базовые и свои. Новый тег появляется в списке уже выбранным.
  const tagsBox = $(root, "tags");
  const tagNames = allTags.map((t) => t.name);
  function renderTags() {
    tagsBox.replaceChildren(
      ...tagNames.map((name) => {
        const chip = el("button", { type: "button", class: "tag", "aria-pressed": String(selectedTags.has(name)) }, name);
        chip.addEventListener("click", () => {
          selectedTags.has(name) ? selectedTags.delete(name) : selectedTags.add(name);
          renderTags();
        });
        return chip;
      })
    );
  }
  renderTags();

  const tagInput = $(root, "tag-input");
  $(root, "tag-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = tagInput.value.trim().toLowerCase().replace(/^#/, "");
    if (!name) return;
    if (!tagNames.includes(name)) tagNames.push(name);
    selectedTags.add(name);
    tagInput.value = "";
    renderTags();
  });

  async function close(body) {
    await api.post(`/api/entries/${entryId}/close`, body);
    // Запись закончена: следующее «Писать» начнёт новую.
    if (currentDraft.get()?.id === entryId) currentDraft.clear();
    navigate("/entries");
  }

  $(root, "save").addEventListener("click", () =>
    close({ mood: values.mood, energy: values.energy, tags: [...selectedTags] })
  );
  // «Пропустить» сохраняет то, что уже было (например, при повторном закрытии старой записи).
  $(root, "skip").addEventListener("click", () =>
    close({ mood: entry.mood, energy: entry.energy, tags: entry.tags.map((t) => t.name) })
  );

  view.replaceChildren(root);
}

function renderScale(scale, value) {
  scale.querySelectorAll("button").forEach((b, i) => b.setAttribute("aria-checked", String(i + 1 === value)));
}
