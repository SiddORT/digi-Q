/** Bounded in-memory per-client limiter for unauthenticated read-only reference data (no DB writes per keystroke). */
const hits = new Map<string, { count: number; reset: number }>();
export function publicReferenceLimit(key: string, max = 120, windowMs = 60_000, now = Date.now()) {
  if (hits.size > 10_000) for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  const entry = hits.get(key);
  if (!entry || entry.reset <= now) { hits.set(key, { count: 1, reset: now + windowMs }); return; }
  entry.count += 1;
  if (entry.count > max) throw Object.assign(new Error("Too many address lookups. Wait a minute or continue typing the address manually."), { status: 429, code: "RATE_LIMITED" });
}
