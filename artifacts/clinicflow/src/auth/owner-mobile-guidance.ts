import type { OwnerMobileRequestGuidance } from "@workspace/api-zod";

/** Whitelist numbers only; never keep arbitrary auth/provider response data. */
export function ownerMobileGuidance(value: unknown): OwnerMobileRequestGuidance | undefined {
  if (!value || typeof value !== "object") return;
  const raw = value as Record<string, unknown>;
  const integer = (n: unknown, max: number): n is number =>
    typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;
  const window = (name: string, max: number, duration: number) => {
    const w = raw[name] as Record<string, unknown> | undefined;
    return w && integer(w.remaining, max) && integer(w.resetAfterSeconds, duration)
      ? { remaining: w.remaining, resetAfterSeconds: w.resetAfterSeconds } : undefined;
  };
  const subjectMinute = window("subjectMinute", 5, 60);
  const mobileHour = window("mobileHour", 10, 3600);
  const sourceIp = window("sourceIp", 60, 600);
  if (subjectMinute && mobileHour && sourceIp && integer(raw.retryAfterSeconds, 3600))
    return { subjectMinute, mobileHour, sourceIp, retryAfterSeconds: raw.retryAfterSeconds };
  return undefined;
}

export type RequestBudget = { guidance: OwnerMobileRequestGuidance; receivedAt: number };
export function ownerRequestFeedback(budget: RequestBudget | undefined, now: number) {
  if (!budget) return { wait: 0, text: "" };
  const elapsed = Math.max(0, (now - budget.receivedAt) / 1000);
  const { guidance: g } = budget;
  const active = (w: OwnerMobileRequestGuidance["subjectMinute"]) => w.resetAfterSeconds > elapsed;
  const exhaustedWait = [g.subjectMinute, g.mobileHour, g.sourceIp]
    .filter(w => w.remaining === 0 && active(w)).map(w => w.resetAfterSeconds - elapsed);
  const wait = Math.max(0, Math.ceil(Math.max(g.retryAfterSeconds - elapsed, ...exhaustedWait)));
  const label = (count: number, window: string) => `${count} request${count === 1 ? "" : "s"} left ${window}`;
  const text = [
    active(g.subjectMinute) ? label(g.subjectMinute.remaining, "in this minute") : "",
    active(g.mobileHour) ? label(g.mobileHour.remaining, "for this mobile in this hour") : "",
    g.sourceIp.remaining === 0 && active(g.sourceIp) ? "The shared network request limit has been reached" : "",
  ].filter(Boolean).join("; ");
  return { wait, text: text ? `${text}. Counts include the first request and unsuccessful sends; all limits apply.` : "" };
}
