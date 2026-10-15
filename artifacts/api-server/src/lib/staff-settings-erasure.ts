import { eraseStaffAttribution, unresolvedStaffReferences, unattributedStaffLabels, type StaffAttribution } from "./staff-attribution-erasure";
import { accountSubjectFingerprint, classifyHistoryForRemoval, erasedHistoryMarker } from "./notification-history-provenance";

export type SettingsDisposition = { action: "erase" | "anonymize" | "preserve" | "resolve"; data?: any; reason?: string };
export function exactStaffValue(value: any, needles: Set<string>): boolean {
  if (typeof value === "string") return needles.has(value);
  if (Array.isArray(value)) return value.some(v => exactStaffValue(v, needles));
  return !!value && typeof value === "object" && Object.entries(value).some(([k, v]) => needles.has(k) || exactStaffValue(v, needles));
}

/** Explicit settings-family dispositions. Unknown identity-bearing rows fail
 * closed; arbitrary narrative/template text is never globally replaced. */
export function classifyStaffSetting(row: { id: string; data: any }, target: StaffAttribution & {
  email?: string; mobile?: string; fullName?: string; clerkId?: string;
}, media?: { exclusiveLogoIds: string[]; sharedLogoIds: string[] }): SettingsDisposition {
  const { id, data } = row, family = id.split(":")[0];
  if (family === "notification-history-reconciliation") {
    // This family stores only anonymous review receipts, never source exports.
    // Strict shape validation prevents a later private field from inheriting it.
    const common = ["recordVersion", "reviewedAt", "reviewerFingerprint", "status"];
    const fields = data?.status === "verified" ? [...common, "sourceCount", "envelopeCount"] : [...common, "reason"];
    const valid = /^notification-history-reconciliation:[a-f0-9]{64}$/.test(id) &&
      data && typeof data === "object" && Object.keys(data).sort().join(",") === fields.sort().join(",") &&
      /^[a-f0-9]{64}$/.test(data.recordVersion) && /^[a-f0-9]{64}$/.test(data.reviewerFingerprint) &&
      Number.isSafeInteger(data.reviewedAt) && data.reviewedAt >= 0 &&
      (data.status === "verified"
        ? Number.isSafeInteger(data.sourceCount) && data.sourceCount >= 1 && data.sourceCount <= 10 &&
          Number.isSafeInteger(data.envelopeCount) && data.envelopeCount >= 0
        : data.status === "unresolved" && ["original_missing", "incomplete_evidence", "conflicting_sources", "unreadable_archive"].includes(data.reason));
    return valid ? { action: "preserve" } : { action: "resolve", reason: "Unclassified history reconciliation receipt" };
  }
  if (data?.erased === true) return Object.keys(data).sort().join(",") === "erased,reason" &&
    data.reason === "staff_account_removed" &&
    !id.split(":").some(part => [target.userId, target.clerkId].filter(Boolean).includes(part))
    ? { action: "preserve" } : { action: "resolve", reason: "Unrecognized or identifying erased record" };
  const needles = new Set([target.userId, target.clerkId, target.email, target.mobile, target.fullName, ...target.doctorIds].filter(Boolean) as string[]);
  const keyLinked = id.split(":").some(part => needles.has(part));
  const generatedPreviousDetails = typeof data?.previousDetails === "string" &&
    [target.fullName, target.email, target.mobile].filter(Boolean).some(value => data.previousDetails.includes(value));
  const linked = keyLinked || exactStaffValue(data, needles) || generatedPreviousDetails;
  if (family === "notification-history") {
    const ownership = classifyHistoryForRemoval(id, data, accountSubjectFingerprint(target.userId));
    return ownership === "erase" ? { action: "anonymize", data: erasedHistoryMarker() } :
      ownership === "blocked" ? { action: "resolve", reason: "Encrypted history requires verified ownership evidence" } : { action: "preserve" };
  }
  if (!linked) return { action: "preserve" };
  if (["sending", "delivery_unknown"].includes(data?.state) || ["sending", "delivery_unknown"].includes(data?.status))
    return { action: "resolve", reason: "A dispatch or media operation is active or uncertain" };
  if (["workspace", "staff-invitation", "staff-recovery", "notification-read", "notification-preferences"].includes(family) && id === `${family}:${target.userId}`)
    return { action: "erase" };
  if (id === "custom-roles") {
    const next = { ...data, bindings: (data.bindings ?? []).filter((b: any) => b.userId !== target.userId), revision: (data.revision ?? 0) + 1 };
    return unresolvedStaffReferences(next, target.userId).length ? { action: "resolve", reason: "Custom role reference requires review" } : { action: "anonymize", data: next };
  }
  if (family === "logo" && data.ownerId === target.userId) {
    if (!media) return { action: "resolve", reason: "Media ownership must be proved" };
    if (media.exclusiveLogoIds.includes(id)) return { action: "erase" };
    if (media.sharedLogoIds.includes(id)) { const next = { ...data, ownerId: null, deletedOwner: true }; return { action: "anonymize", data: next }; }
    return { action: "resolve", reason: "Unclassified staff media" };
  }
  if (["notification-test", "staff-dispatch"].includes(family)) {
    // Keep the occurrence key, never release deduplication claims for retry.
    return { action: "anonymize", data: erasedHistoryMarker() };
  }
  if (["mail-outbox", "sms-outbox"].includes(family)) {
    const recipient = data.recipientUserId === target.userId;
    const next = recipient ? erasedHistoryMarker() : eraseStaffAttribution(data, target);
    if (!recipient) {
      // Application-generated free text cannot be safely re-rendered from its
      // original snapshot once its author/clinician has been erased.
      delete next.previousDetails;
      next.state = "cancelled";
      next.removalReason = "staff_account_removed";
    }
    return unresolvedStaffReferences(next, target.userId).length || unattributedStaffLabels(next, target)
      ? { action: "resolve", reason: "Unclassified queued-message identity" } : { action: "anonymize", data: next };
  }
  if (["notification-template", "sms-template"].includes(family)) {
    const next = { ...data };
    for (const key of ["updatedBy", "publishedBy", "createdBy"]) if (next[key] === target.userId) { next[key] = null; next.deletedPublisher = true; }
    return exactStaffValue(next, new Set([target.userId, target.clerkId].filter(Boolean) as string[]))
      ? { action: "resolve", reason: "Template content has an unclassified account reference" } : { action: "anonymize", data: next };
  }
  if (["session", "tokens", "presence"].includes(family)) {
    if (family === "presence") {
      let today: string;
      try { today = new Intl.DateTimeFormat("en-CA", { timeZone: data.timezone || "UTC" }).format(new Date()); }
      catch { return { action: "resolve", reason: "Presence timezone requires review" }; }
      if ((!data.date || data.date >= today) && data.status !== "away")
        return { action: "resolve", reason: "End the doctor's active presence before removal" };
    }
    // These stable doctor IDs are historical queue coordinates, not account
    // identities. Retain counters so no token or duration history is reset.
    const next = eraseStaffAttribution(data, target);
    return exactStaffValue(next, new Set([target.userId])) ? { action: "resolve", reason: "Unclassified session identity" } :
      JSON.stringify(next) === JSON.stringify(data) ? { action: "preserve" } : { action: "anonymize", data: next };
  }
  return { action: "resolve", reason: "An unclassified settings relationship requires review" };
}
