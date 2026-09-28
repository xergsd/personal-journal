// Всё, что хранится в браузере (localStorage).
// Любой доступ обёрнут в try: в приватном окне хранилище может быть недоступно.

function read(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
function remove(key) {
  try { localStorage.removeItem(key); } catch {}
}

// Текущая (новая, ещё не завершённая) запись: { id }.
// Благодаря ей «Писать» продолжает начатое, а не создаёт пустую запись каждый раз.
export const currentDraft = {
  get: () => read("diary.current"),
  set: (id) => write("diary.current", { id }),
  clear: () => remove("diary.current"),
};

// Несохранённый на сервере текст записи. Лежит, только пока сервер его не подтвердил.
export const localCopy = {
  get: (id) => read(`diary.draft.${id}`),
  set: (id, data) => write(`diary.draft.${id}`, data),
  clear: (id) => remove(`diary.draft.${id}`),
};

export const themePref = {
  get: () => { try { return localStorage.getItem("diary.theme") || "auto"; } catch { return "auto"; } },
  set: (value) => { try { localStorage.setItem("diary.theme", value); } catch {} },
};
