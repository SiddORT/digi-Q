import { validatePassword } from "./validators";

/** Create-only account credentials. Edits never carry or display passwords. */
export function passwordPairError(password: unknown, confirm: unknown): { password?: string; confirmPassword?: string } {
  const out: { password?: string; confirmPassword?: string } = {};
  if (typeof password !== "string" || !password) out.password = "This field is required";
  else out.password = validatePassword(password);
  if (typeof confirm !== "string" || !confirm) out.confirmPassword = "This field is required";
  else if (confirm !== password) out.confirmPassword = "Passwords do not match";
  if (!out.password) delete out.password;
  if (!out.confirmPassword) delete out.confirmPassword;
  return out;
}

/** Remove credential fields from any value bag destined for drafts, snapshots or caches. */
export function withoutPasswords<T extends Record<string, unknown>>(values: T): Omit<T, "password" | "confirmPassword"> {
  const { password: _p, confirmPassword: _c, ...rest } = values;
  return rest;
}

export const CREATE_SUCCESS = "Saved. This account is active and can sign in with its email and password.";
export const CREATE_SUCCESS_INACTIVE = "Saved. This account is inactive and cannot sign in until it is activated.";
export function noticeLabel(status?: string | null): string {
  return ({ awaiting_verification: "Awaiting verification", pending: "Queued", sending: "In progress",
    provider_accepted: "Submitted; delivery isn’t confirmed", provider_rejected: "Not sent", skipped: "Not sent",
    pre_dispatch_failed: "Not sent", delivery_unknown: "Sending couldn’t be confirmed" } as Record<string, string>)[status || ""] || "Not sent";
}
export const createSuccessMessage = (status?: string, notice?: { email?: string | null; sms?: string | null }) =>
  (status === "inactive" ? CREATE_SUCCESS_INACTIVE : CREATE_SUCCESS) +
  (notice ? ` Your notice: email ${noticeLabel(notice.email).toLowerCase()}; SMS ${noticeLabel(notice.sms).toLowerCase()}.` : "");
