import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { assert } from "./http";

export type RemovalReviewMode = "handoff" | "delete";
type Review = {
  v: 1; mode: RemovalReviewMode; actor: string; target: string; binding: string;
  version: string; proposal: string; operationId: string; issuedAt: number; expiresAt: number;
};
const lifetime = 5 * 60_000;
function key() {
  const value = process.env.SESSION_SECRET;
  assert(typeof value === "string" && value.length >= 32, 503, "Staff-removal review signing is unavailable");
  return value!;
}
function canonical(value: any): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
  return JSON.stringify(value) ?? "null";
}
export const removalProposalDigest = (value: unknown) => createHash("sha256").update(canonical(value)).digest("hex");
const binding = (actor: string, sessionHash: string) => createHmac("sha256", key()).update("staff-removal-session:" + actor + ":" + sessionHash).digest("hex");
/** Issuing a token is not readiness: callers must first authorize the native
 * actor and prove the action-specific exact-row manifest. Never expose a raw
 * session hash in the review, and never use a handoff token to remove an account. */
export function issueRemovalReview(input: {
  mode: RemovalReviewMode; actorId: string; targetId: string; sessionHash: string;
  version: string; proposal: unknown; operationId: string;
}, now = Date.now()) {
  assert(/^[a-f0-9]{64}$/.test(input.sessionHash) && /^[a-f0-9]{64}$/.test(input.version) &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(input.operationId), 400, "Invalid staff-removal review context");
  const data: Review = { v: 1, mode: input.mode, actor: input.actorId, target: input.targetId,
    binding: binding(input.actorId, input.sessionHash), version: input.version,
    proposal: removalProposalDigest(input.proposal), operationId: input.operationId,
    issuedAt: now, expiresAt: now + lifetime };
  const body = Buffer.from(JSON.stringify(data)).toString("base64url");
  const mac = createHmac("sha256", key()).update("staff-removal-review:" + body).digest("base64url");
  return body + "." + mac;
}
export function verifyRemovalReview(token: unknown, input: {
  mode: RemovalReviewMode; actorId: string; targetId: string; sessionHash: string; proposal: unknown;
}, now = Date.now()): Review {
  assert(typeof token === "string" && token.length <= 4096, 409, "Review the current staff-removal impact again");
  const parts = token.split(".");
  assert(parts.length === 2 && /^[A-Za-z0-9_-]+$/.test(parts[0]) && /^[A-Za-z0-9_-]{43}$/.test(parts[1]), 409, "Invalid staff-removal review");
  const expected = createHmac("sha256", key()).update("staff-removal-review:" + parts[0]).digest();
  const actual = Buffer.from(parts[1], "base64url");
  assert(actual.length === expected.length && timingSafeEqual(actual, expected), 409, "Invalid staff-removal review");
  let data: Review;
  try { data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8")); }
  catch { assert(false, 409, "Invalid staff-removal review"); }
  assert(data!.v === 1 && data!.mode === input.mode && data!.actor === input.actorId && data!.target === input.targetId &&
    data!.binding === binding(input.actorId, input.sessionHash) && data!.proposal === removalProposalDigest(input.proposal),
    409, "The actor, session, target or selected action changed; review again");
  assert(Number.isSafeInteger(data!.issuedAt) && Number.isSafeInteger(data!.expiresAt) &&
    data!.expiresAt - data!.issuedAt === lifetime && data!.issuedAt <= now && now < data!.expiresAt,
    409, "The staff-removal review expired; review again");
  return data!;
}
