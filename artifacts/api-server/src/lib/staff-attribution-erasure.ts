/**
 * Only application-generated attribution, never patient names, medical notes,
 * document contents or arbitrary text substitution. Unknown relations remain
 * blockers for the caller's registry; this is not a generic JSON eraser.
 */
export type StaffAttribution = { userId: string; doctorIds: Set<string> };
const doctorIdentityFields = ["doctorName", "doctorEmail", "doctorMobile", "doctorPhone", "doctorAvatar", "doctorAvatarUrl"];
const actorIdentityFields = ["actorName", "actorEmail", "actorMobile", "actorPhone", "actorAvatar", "actorAvatarUrl"];
const nestedPaths = ["snapshot", "previousSession", "from", "to", "history", "registration", "createdByProfile", "updatedByProfile"];
/** Unattributed generated labels cannot be assumed to identify this account.
 * Block review rather than guessing or rewriting clinical/patient text. */
export function unattributedStaffLabels(value: any, identity: { fullName?: string; email?: string; mobile?: string }): boolean {
  if (Array.isArray(value)) return value.some(v => unattributedStaffLabels(v, identity));
  if (!value || typeof value !== "object") return false;
  const labels = new Set([...doctorIdentityFields, ...actorIdentityFields, "createdByName", "updatedByName", "uploadedByName",
    "decidedByName", "registeredByName", "managingAdminName", "adminName"]);
  return Object.entries(value).some(([key, entry]) => typeof entry === "string" && labels.has(key) &&
    [identity.fullName, identity.email, identity.mobile].filter(Boolean).includes(entry) ||
    entry && typeof entry === "object" && unattributedStaffLabels(entry, identity));
}
export function eraseStaffAttribution(input: any, target: StaffAttribution): any {
  if (!input || typeof input !== "object") return input;
  if (Array.isArray(input)) return input.map(value => eraseStaffAttribution(value, target));
  const result = { ...input };
  if (result.registrationReceipt?.actorId === target.userId) {
    delete result.registrationReceipt;
    result.registrationCompleted = true;
  }
  if (target.doctorIds.has(result.doctorId)) {
    for (const key of doctorIdentityFields) delete result[key];
    result.doctorName = "Deleted doctor";
    result.deletedDoctor = true;
  }
  if (result.actorId === target.userId) {
    delete result.actorId;
    for (const key of actorIdentityFields) delete result[key];
    result.deletedActor = true;
  }
  for (const [idKey, flag, label] of [
    ["createdBy", "deletedCreator", "createdByName"],
    ["updatedBy", "deletedUpdater", "updatedByName"],
    ["uploadedBy", "deletedUploader", "uploadedByName"],
    ["decidedBy", "deletedDecider", "decidedByName"],
    ["registeredByUserId", "deletedRegistrar", "registeredByName"],
  ]) {
    if (result[idKey] === target.userId) {
      result[idKey] = null; result[flag] = true;
      if (label in result) result[label] = "Deleted user";
      if (idKey === "createdBy") delete result.createdByProfile;
      if (idKey === "updatedBy") delete result.updatedByProfile;
    }
  }
  for (const key of nestedPaths)
    if (result[key] && typeof result[key] === "object") result[key] = eraseStaffAttribution(result[key], target);
  return result;
}

/** Exact native-ID relationships still present after known attribution erasure.
 * Contacts/names are deliberately not matched globally: a patient or shared
 * business can legitimately have the same name/contact. */
export function unresolvedStaffReferences(value: any, userId: string, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => unresolvedStaffReferences(v, userId, `${path}[${i}]`));
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, field]) => {
    const next = path ? `${path}.${key}` : key;
    if (field === userId && /^(userId|actorId|createdBy|updatedBy|uploadedBy|decidedBy|ownerId|adminId|managingAdminId|registeredByUserId|clerkUserId)$/.test(key)) return [next];
    return unresolvedStaffReferences(field, userId, next);
  });
}
