let pending: Promise<string> | null = null;

// Fetch the current HttpOnly cookie's matching token before every mutation;
// another tab or cookie expiry can invalidate an earlier in-memory token.
export async function csrfToken(): Promise<string> {
  if (!pending) {
    pending = fetch("/api/auth/csrf", { credentials: "same-origin", cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error("Unable to verify request security. Please refresh the page.");
        const body = await response.json() as { csrfToken?: string };
        if (!body.csrfToken) throw new Error("Request security token is missing. Please refresh the page.");
        return body.csrfToken;
      }).finally(() => { pending = null; });
  }
  return pending;
}

// A CSRF rejection happens before the route runs. It is the only write failure
// safe to replay; e.g. password/verification errors must not be retried.
export async function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const method = (init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(method);
  const send = async () => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    if (mutation) headers.set("X-CSRF-Token", await csrfToken());
    return fetch(input, { ...init, method, credentials: "same-origin", cache: "no-store", headers });
  };

  const response = await send();
  if (!mutation || response.status !== 403) return response;
  const body = await response.clone().json().catch(() => null) as { code?: string } | null;
  return body?.code === "INVALID_CSRF" ? send() : response;
}