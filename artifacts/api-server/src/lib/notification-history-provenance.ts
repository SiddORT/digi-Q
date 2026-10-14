import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/** These are opaque account fingerprints, not login credentials or contacts. */
export const accountSubjectFingerprint = (id: string) => createHash("sha256").update(id).digest("hex");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function signingKey() {
  const value = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) throw new Error("History provenance unavailable");
  return Buffer.from(value, "hex");
}
function payload(id: string, data: any, subjects: string[]) {
  const canonical = (value: any): string => {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).filter(k => value[k] !== undefined).sort()
      .map(k => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
    return JSON.stringify(value) ?? "null";
  };
  const { provenance: _proof, ...record } = data;
  return JSON.stringify({
    version: 2, id, subjects,
    // Bind all metadata, not only selected coordinates. Otherwise a late writer
    // could append private fields to an unrelated entry without invalidating it.
    recordDigest: digest(canonical(record)),
    channel: data.channel, event: data.event, source: data.source,
    clinicId: data.clinicId ?? null, recipientGroup: data.recipientGroup,
    referenceDigest: typeof data.reference === "string" ? digest(data.reference) : null,
    createdAt: data.createdAt,
    senderHash: data.senderHash ?? null, recipientHash: data.recipientHash ?? null,
    envelopeDigests: [
      ...(typeof data.encrypted === "string" ? [digest(data.encrypted)] : []),
      ...(data.snapshots ?? []).map((s: any) => {
        if (typeof s.encrypted !== "string") throw new Error("Invalid historical envelope");
        return digest(s.encrypted);
      }),
    ],
  });
}
/** All captured envelopes and original source coordinates are covered by the MAC.
 * A changed source or historical envelope must not inherit another entry's proof. */
export function signHistorySubjects(id: string, data: any, subjects: string[], priorSubjects: string[] = []) {
  const fingerprints = [...new Set([...priorSubjects, ...subjects.map(accountSubjectFingerprint)])].sort();
  return {
    version: 2,
    subjects: fingerprints,
    mac: createHmac("sha256", signingKey()).update(payload(id, data, fingerprints)).digest("hex"),
  };
}
export function verifyHistorySubjects(id: string, data: any): string[] | null {
  try {
    const proof = data.provenance;
    if (proof?.version !== 2 || !Array.isArray(proof.subjects) ||
      !proof.subjects.every((v: unknown) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v)) ||
      typeof proof.mac !== "string" || !/^[a-f0-9]{64}$/.test(proof.mac)) return null;
    const sorted = [...new Set<string>(proof.subjects)].sort();
    if (JSON.stringify(sorted) !== JSON.stringify(proof.subjects)) return null;
    const expected = createHmac("sha256", signingKey()).update(payload(id, data, sorted)).digest();
    return timingSafeEqual(expected, Buffer.from(proof.mac, "hex")) ? sorted : null;
  } catch { return null; }
}
export function classifyHistoryForRemoval(id: string, data: any, targetFingerprint: string) {
  if (!data || typeof data !== "object" || Array.isArray(data)) return "blocked" as const;
  if (data.erased === true)
    return data.reason === "staff_account_removed" && Object.keys(data).sort().join(",") === "erased,reason"
      ? "preserve" as const : "blocked" as const;
  const subjects = verifyHistorySubjects(id, data);
  if (!subjects) return "blocked" as const; // Never guess ownership from names or current contacts.
  return subjects.includes(targetFingerprint) ? "erase" as const : "preserve" as const;
}
export function erasedHistoryMarker() {
  // Keep only the hashed history key outside this payload. No source, envelope,
  // subject fingerprints, contact hashes, ticket reference or private timeline.
  return { erased: true, reason: "staff_account_removed" };
}
