const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiRequestError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include", // send/receive the HttpOnly session cookie
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (!res.ok) {
    throw new ApiRequestError(
      typeof body.code === "string" ? body.code : "UNKNOWN_ERROR",
      typeof body.message === "string" ? body.message : "Request failed.",
    );
  }

  return body as T;
}

export function apiPost<T>(path: string, payload: unknown): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: JSON.stringify(payload) });
}

export function apiDelete<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE" });
}

export function apiGet<T>(path: string): Promise<T> {
  return apiFetch<T>(path, { method: "GET" });
}
