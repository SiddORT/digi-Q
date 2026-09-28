import { csrfFetch } from "./csrf";

export async function authRequest<T>(path: string, data?: unknown, method = "POST"): Promise<T> {
  const response = await csrfFetch(`/api/auth/${path}`, {
    method,
    headers: data !== undefined ? { "Content-Type": "application/json" } : undefined,
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const body = await response.json().catch(() => ({})) as T & { error?: string; message?: string };
  if (!response.ok) throw new Error(body.message || body.error || "The request could not be completed. Please try again.");
  return body;
}