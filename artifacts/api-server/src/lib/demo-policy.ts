export const DEMO_FIXTURE = "clinicflow:published-demo";
export const DEMO_LOGIN_WINDOW_MS = 10 * 60_000;
export const DEMO_LOGIN_IP_LIMIT = 10;
export const DEMO_LOGIN_GLOBAL_LIMIT = 200;

// A single, bounded settings row avoids one database row per untrusted IP.
// The caller supplies only an HMAC of the normalized IP, never its raw value.
export function nextDemoLoginAttempts(data: unknown, ipHash: string, now: number) {
  const source = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const recent = (value: unknown) => Array.isArray(value)
    ? value.filter((time): time is number => typeof time === "number" && Number.isFinite(time) &&
      time > now - DEMO_LOGIN_WINDOW_MS && time <= now) : [];
  const global = recent(source.attempts);
  const existing = source.byIp && typeof source.byIp === "object" ? source.byIp as Record<string, unknown> : {};
  const byIp: Record<string, number[]> = {};
  for (const [key, attempts] of Object.entries(existing)) {
    const valid = recent(attempts);
    if (/^[a-f0-9]{64}$/.test(key) && valid.length) byIp[key] = valid.slice(-DEMO_LOGIN_IP_LIMIT);
  }
  // At most one distinct address per globally admitted attempt, and no stale
  // entries survive the next admitted attempt.
  const ipAttempts = byIp[ipHash] || [];
  const permitted = global.length < DEMO_LOGIN_GLOBAL_LIMIT && ipAttempts.length < DEMO_LOGIN_IP_LIMIT;
  if (permitted) {
    global.push(now);
    byIp[ipHash] = [...ipAttempts, now];
  }
  return { permitted, data: { attempts: global, byIp } };
}

/** A demo owner can operate the existing clinic but cannot change its structure. */
export function demoWriteAllowed(method: string, path: string): boolean {
  if (method === "GET" || method === "HEAD") return true;
  if (method === "POST" && path === "/queue/call-next") return true;
  if (method === "POST" && /^\/guest-requests\/[^/]+\/decision$/.test(path)) return true;
  if (method === "POST" && /^\/appointments\/[^/]+\/(actions|reschedule)$/.test(path)) return true;
  if (method === "PATCH" && /^\/doctors\/[^/]+\/presence$/.test(path)) return true;
  return false;
}