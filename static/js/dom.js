// Мелкие помощники для работы с DOM и датами.

// Клонирует <template id="tpl-..."> и возвращает готовый фрагмент.
export function fromTemplate(name) {
  return document.getElementById(`tpl-${name}`).content.firstElementChild.cloneNode(true);
}

// Первый элемент с атрибутом data-<name> внутри root.
export function $(root, name) {
  return root.querySelector(`[data-${name}]`);
}

export function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (value !== undefined && value !== null && value !== false) node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.filter((c) => c !== null && c !== undefined && c !== false));
  return node;
}

const dayFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const timeFmt = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

export const formatDay = (date) => dayFmt.format(date);
export const formatTime = (date) => timeFmt.format(date);

// Сервер отдаёт локальное время без часового пояса — так его и понимаем.
// Микросекунды обрезаем до миллисекунд: не все браузеры их разбирают.
export const parseDate = (iso) => new Date(iso.replace(/(\.\d{3})\d+/, "$1"));

export const TYPE_LABELS = { morning: "утро", evening: "вечер", free: "свободная" };

export function typeByHour(date = new Date()) {
  const h = date.getHours();
  if (h >= 4 && h < 12) return "morning";
  if (h >= 18 || h < 4) return "evening";
  return "free";
}
