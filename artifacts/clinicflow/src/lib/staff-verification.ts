import { csrfFetch } from "./csrf";

export type VerificationChannel = "email" | "sms";
export type VerificationState = { email: string; mobile?: string | null; emailVerified: boolean; mobileVerified: boolean; promptRequired: boolean; welcomeEmailStatus?: string; welcomeSmsStatus?: string };
export type VerificationChallenge = { challengeId: string; expiresAt: string; resendAfterSeconds: number };

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const response = await csrfFetch(`/api/staff-verification${path}`, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const parsed = await response.json().catch(() => ({})) as { error?: unknown; message?: unknown };
  if (!response.ok) {
    const text = [parsed.message, parsed.error].find((v): v is string => typeof v === "string" && v.length < 200);
    throw Object.assign(new Error(text || "The verification request could not be completed. Please try again."), { status: response.status });
  }
  return parsed as T;
}

/** Codes live only in component state; none of these helpers touch a query cache or storage. */
export const getStaffVerification = () => call<VerificationState>("", "GET");
export const requestStaffVerification = (channel: VerificationChannel) => call<VerificationChallenge>("/request", "POST", { channel });
export const confirmStaffVerification = (input: { channel: VerificationChannel; challengeId: string; code: string }) => call<{ verified: true }>("/confirm", "POST", input);
export const deferStaffVerification = () => call<{ ok: true }>("/defer", "POST", {});
export const STAFF_VERIFICATION_KEY = ["staff-verification"] as const;
export const staffVerificationKey = (actor: string) => ["staff-verification", actor] as const;
