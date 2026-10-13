/** Request errors are not provider outcomes. Never display raw response text. */
export function templateTestRequestError(error: unknown, kind: "test" | "preview" = "test") {
  const value = error && typeof error === "object" ? error as { status?: unknown; data?: unknown } : {};
  const status = typeof value.status === "number" && Number.isInteger(value.status) &&
    value.status >= 400 && value.status <= 599 ? value.status : undefined;
  const title = `${kind === "test" ? "Test request" : "Preview request"} failed${status ? ` (HTTP ${status})` : ""}.`;
  if (status === 429) {
    const data = value.data && typeof value.data === "object" ? value.data as { code?: unknown; error?: unknown } : {};
    // Match only ClinicFlow's fixed rate-limit response; reconstruct safe text.
    const match = data.code === "RATE_LIMITED" && typeof data.error === "string"
      ? /^Too many attempts\. Try again in ([1-9]\d{0,4}) seconds\.$/.exec(data.error) : null;
    const seconds = match ? Number(match[1]) : 0;
    const wait = seconds > 0 && seconds <= 86400
      ? `Wait about ${Math.ceil(seconds / 60)} minute${seconds > 60 ? "s" : ""}` : "Wait for the rate-limit window to reset";
    return { title, detail: kind === "test"
      ? `ClinicFlow's test-request limit was reached. Tests allow three attempts per 15 minutes per account, with an additional shared network limit. This attempt was blocked before dispatch. ${wait}, then retry the same request.`
      : `ClinicFlow's preview-request limit was reached. Nothing was sent. ${wait}, then render the preview again.` };
  }
  if (status === 401) return { title, detail: "Your session has expired. Sign in again before retrying." };
  if (status === 403) return { title, detail: "The request was denied. Check your session and Superadmin access before retrying." };
  if (status === 409) return { title, detail: "The template or request no longer matches the server's saved version. Refresh the template and review your edits before testing again." };
  if (status === 400 || status === 422) return { title, detail: "ClinicFlow could not validate the request. Check the recipient, required placeholder values and template fields." };
  return { title, detail: kind === "test"
    ? "The server could not confirm the test result. Retrying uses the original request to prevent a duplicate dispatch. Do not start a fresh test while the outcome is uncertain."
    : "The preview could not be loaded. Nothing was sent. Try rendering the preview again." };
}
