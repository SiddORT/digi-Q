import { csrfFetch } from "./csrf";
import { friendlyError, isFriendlyText } from "./friendly-error";

/** Safe presentation plus machine-readable policy metadata; never retain a
 * response body that could contain provider diagnostics or credentials.
 */
export class AuthRequestError extends Error {
  readonly name = "AuthRequestError";
  readonly status: number;
  readonly code?: string;
  readonly retryAfter?: string;
  readonly retryAfterSeconds?: number;
  readonly data: { error: string; code?: string };
  constructor(response: Response, body: { error?: unknown; message?: unknown; code?: unknown }) {
    const status = response.status;
    const code = typeof body.code === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(body.code) ? body.code : undefined;
    const safeMessage = [body.message, body.error].find(isFriendlyText);
    const message = friendlyError({ status, data: { error: safeMessage } }, "auth",
      "The request could not be completed. Please try again.");
    super(message);
    this.status = status;
    this.code = code;
    this.data = { error: message, ...(code ? { code } : {}) };
    const retryAfter = response.headers.get("Retry-After");
    if (retryAfter && (/^\d+$/.test(retryAfter) || Number.isFinite(Date.parse(retryAfter)))) {
      this.retryAfter = retryAfter;
      this.retryAfterSeconds = /^\d+$/.test(retryAfter) ? Number(retryAfter)
        : Math.max(0, Math.ceil((Date.parse(retryAfter) - Date.now()) / 1000));
    }
  }
}

export async function authRequest<T>(path: string, data?: unknown, method = "POST"): Promise<T> {
  const startedAt = performance.now();
  const response = await csrfFetch(`/api/auth/${path}`, {
    method,
    headers: data !== undefined ? { "Content-Type": "application/json" } : undefined,
    ...(data !== undefined ? { body: JSON.stringify(data) } : {}),
  });
  const parsed = await response.json().catch(() => ({}));
  const body = (parsed && typeof parsed === "object" ? parsed : {}) as T & { error?: string; message?: string };
  if (!response.ok) {
    const error = new AuthRequestError(response, body);
    // Credential/code failures and public auth requests must never log out an
    // unrelated current session. Change-password can also return a genuine
    // missing-session rejection, distinct from a wrong current password.
    if (path === "change-password" && response.status === 401 &&
      (error.code === "SIGN_IN_REQUIRED" || body.error === "Sign in required") && typeof window !== "undefined")
      window.dispatchEvent(new CustomEvent("digiq:session-unauthorized", { detail: { startedAt } }));
    throw error;
  }
  return body;
}