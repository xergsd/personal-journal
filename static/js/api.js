// Обёртка над fetch: JSON туда и обратно, понятные ошибки.

export class AuthError extends Error {}

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !url.startsWith("/api/auth/")) {
    // Сессия истекла — приложение покажет экран PIN.
    window.dispatchEvent(new CustomEvent("auth-lost"));
    throw new AuthError("Нужно ввести PIN");
  }
  if (!res.ok) {
    let message = `Ошибка ${res.status}`;
    try {
      const data = await res.json();
      if (typeof data.detail === "string") message = data.detail;
    } catch {}
    throw new Error(message);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (url) => request("GET", url),
  post: (url, body = {}) => request("POST", url, body),
  put: (url, body) => request("PUT", url, body),
  del: (url) => request("DELETE", url),
};
