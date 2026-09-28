// Список записей, сгруппированный по дням.

import { api } from "../api.js";
import { $, el, formatDay, formatTime, fromTemplate, parseDate, TYPE_LABELS } from "../dom.js";
import { currentDraft, localCopy } from "../storage.js";

export async function showEntries(view) {
  const entries = await api.get("/api/entries");
  const root = fromTemplate("entries");
  const list = $(root, "list");

  if (entries.length === 0) {
    list.append(
      el("div", { class: "empty" },
        el("p", {}, "Здесь будут твои записи"),
        el("a", { class: "btn", href: "/", "data-link": true }, "Написать первую"),
      )
    );
    view.replaceChildren(root);
    return;
  }

  // Группируем по календарному дню (записи уже отсортированы от новых к старым).
  const days = new Map();
  for (const entry of entries) {
    const date = parseDate(entry.created_at);
    const key = date.toDateString();
    if (!days.has(key)) days.set(key, { date, items: [] });
    days.get(key).items.push({ entry, date });
  }

  for (const { date, items } of days.values()) {
    const count = items.length;
    list.append(
      el("section", { class: "day" },
        el("h2", { class: "day-head" }, formatDay(date), el("small", {}, plural(count, "запись", "записи", "записей"))),
        ...items.map(({ entry, date }) => renderRow(entry, date)),
      )
    );
  }

  view.replaceChildren(root);
}

function renderRow(entry, date) {
  const excerpt = entry.text.replace(/\s+/g, " ").trim().slice(0, 240);
  const scores = [
    entry.mood ? `настроение ${entry.mood}` : null,
    entry.energy ? `энергия ${entry.energy}` : null,
  ].filter(Boolean);

  const row = el("a", { class: "entry-row", href: `/entry/${entry.id}`, "data-link": true },
    el("span", { class: "entry-time" }, formatTime(date)),
    el("div", { class: "entry-main" },
      el("h3", { class: "entry-title" },
        entry.title || "Без заголовка",
        el("span", { class: "entry-type" }, TYPE_LABELS[entry.type]),
        entry.finished ? null : el("span", { class: "entry-draft" }, "не завершена"),
      ),
      excerpt ? el("p", { class: "entry-excerpt" }, excerpt) : null,
      entry.tags.length ? el("div", { class: "entry-tags" }, ...entry.tags.map((t) => el("span", {}, `#${t.name}`))) : null,
    ),
    el("div", { class: "entry-side" }, ...scores.map((s) => el("span", {}, s)), deleteControl(entry)),
  );
  return row;
}

// «удалить» → «Удалить? да / нет» прямо в строке, без всплывающих окон.
function deleteControl(entry) {
  const box = el("span", {});
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };

  function renderIdle() {
    box.replaceChildren(el("button", { class: "entry-delete", type: "button", onclick: (e) => { stop(e); renderConfirm(); } }, "удалить"));
  }
  function renderConfirm() {
    box.replaceChildren(
      el("span", { class: "confirm" }, "Удалить?",
        el("button", { type: "button", onclick: async (e) => {
          stop(e);
          await api.del(`/api/entries/${entry.id}`);
          localCopy.clear(entry.id);
          if (currentDraft.get()?.id === entry.id) currentDraft.clear();
          const day = box.closest(".day");
          box.closest(".entry-row").remove();
          if (!day.querySelector(".entry-row")) day.remove();
        } }, "да"),
        el("button", { type: "button", onclick: (e) => { stop(e); renderIdle(); } }, "нет"),
      )
    );
  }
  renderIdle();
  return box;
}

function plural(n, one, few, many) {
  const mod10 = n % 10, mod100 = n % 100;
  const word = mod10 === 1 && mod100 !== 11 ? one
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? few
    : many;
  return `${n} ${word}`;
}
