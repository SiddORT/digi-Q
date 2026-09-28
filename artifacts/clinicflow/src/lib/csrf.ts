let pending: Promise<string> | null = null;

// The server can rotate its HttpOnly CSRF cookie on any status request (including
// a request from another tab), so never keep an old token for a later mutation.
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