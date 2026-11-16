import { createHash, randomUUID } from "node:crypto";
import { db } from "@workspace/db";
import { eq } from "drizzle-orm";
import { assert, HttpError } from "../../lib/http";
import { audit } from "../../lib/store";
import { sniffDocument, safeDocumentName } from "../../lib/feature-policy";
import { fileRegistry, findFile, type PrivateFile } from "./repository";
import { authorizeFile, type FileSubject } from "./authorization";
import { fileKey, planFileStorage, readFileBytes, writeFileBytes } from "./storage";

export const digestBytes = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
export function fileMetadata(file: PrivateFile) {
  return { id: file.id, clinicId: file.clinicId, patientId: file.patientId, doctorId: file.doctorId,
    purpose: file.purpose, name: file.name, contentType: file.contentType, size: file.size,
    status: file.status, scanState: file.scanState, digest: file.digest,
    createdAt: file.createdAt.toISOString(), contentUrl: `/api/files/${encodeURIComponent(file.id)}/content` };
}
export async function uploadFile(user: any, input: FileSubject & { purpose: string; name: string }, bytes: Buffer) {
  await authorizeFile(user, input, "create");
  assert(Buffer.isBuffer(bytes), 400, "Choose a file");
  const contentType = sniffDocument(bytes);
  assert(contentType, 400, "Upload a PDF, PNG, JPEG, WebP or plain text file up to 10 MB");
  // Active markup and executable formats are not plain-text documents, even
  // when their first bytes happen to be printable UTF-8.
  assert(contentType !== "text/plain" || !/^(?:\s*(?:<!doctype|<html|<script|<svg)|MZ|#!)/i.test(bytes.toString("utf8")), 400, "Active content is not an allowed document type");
  const purposes = input.patientId ? ["profile", "documents", "medical"] : ["profile", "credentials"];
  assert(purposes.includes(input.purpose), 400, "Invalid file purpose");
  if (input.purpose === "profile") assert(contentType!.startsWith("image/"), 400, "Profile files must be images");
  const id = randomUUID();
  const key = fileKey(input.clinicId, input.patientId ? "patients" : "doctors", (input.patientId || input.doctorId)!, input.purpose, id, contentType!);
  const storage = planFileStorage(key);
  const row = { id, clinicId: input.clinicId, patientId: input.patientId || null, doctorId: input.doctorId || null,
    uploadedBy: user.id, name: safeDocumentName(input.name), purpose: input.purpose, size: bytes.length,
    contentType: contentType!, digest: digestBytes(bytes), provider: storage.provider, storageKey: storage.key,
    registryVersion: 1, scanState: "pending", status: "staging" };
  await db.insert(fileRegistry).values(row);
  try {
    const written = await writeFileBytes(key, bytes, contentType!, storage);
    assert(written.provider === row.provider && written.key === row.storageKey, 409, "Storage configuration changed during upload");
    return await db.transaction(async tx => {
      const [current] = await tx.select().from(fileRegistry).where(eq(fileRegistry.id, id)).for("update");
      assert(current?.status === "staging", 409, "File state changed during upload");
      const [file] = await tx.update(fileRegistry).set({ status: "quarantined", updatedAt: new Date() }).where(eq(fileRegistry.id, id)).returning();
      await audit(user, "uploadDocument", "patient_documents", { id, clinicId: row.clinicId }, tx);
      return file;
    });
  } catch (error) {
    // A failed/uncertain completion never serves bytes. Keep the durable
    // registry for reconciliation; do not invent an automatic purge policy.
    await db.update(fileRegistry).set({ status: "failed", updatedAt: new Date() }).where(eq(fileRegistry.id, id));
    throw error;
  }
}
export async function accessibleFile(user: any, id: string, options: { deleted?: boolean; pending?: boolean } = {}) {
  const file = await findFile(id);
  assert(file && (file.status === "active" || options.deleted && file.status === "deleted" || options.pending && file.status === "quarantined"), 404, "File not found");
  await authorizeFile(user, file!, "read");
  return file!;
}
export async function verifiedFileBytes(file: PrivateFile) {
  let bytes: Buffer;
  try { bytes = await readFileBytes(file); }
  catch (error: any) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(409, "Stored bytes are unavailable; the file was not changed");
  }
  assert(bytes.length === file.size && (!file.digest || digestBytes(bytes) === file.digest), 409, "Stored bytes do not match the registry");
  return bytes;
}
function mayDelete(user: any, file: PrivateFile) {
  assert(["superAdmin", "clinicAdmin"].includes(user.role) || file.uploadedBy === user.id, 403, "Only the uploader or a clinic administrator can delete or restore this file");
}
/** Serialize lifecycle transitions. Existing erased-asset/identity triggers
 * run for every write; restoring never repopulates an anonymized uploader. */
export async function changeFileState(user: any, id: string, operation: "delete" | "restore" | "approve", expectedDigest?: string) {
  const file = await accessibleFile(user, id, { deleted: operation === "restore", pending: true });
  await authorizeFile(user, file, operation === "delete" ? "delete" : "update");
  if (operation === "approve") assert(user.role === "superAdmin", 403, "Superadmin security review required");
  else mayDelete(user, file);
  assert(operation === "restore" ? file.status === "deleted" && !!file.deletedFrom && !!file.digest :
    operation === "approve" ? file.status === "quarantined" && file.registryVersion === 1 : ["active", "quarantined"].includes(file.status), 409, "File cannot make this state transition");
  const bytes = await verifiedFileBytes(file);
  if (operation === "approve") assert(file.digest === expectedDigest, 409, "Review must match the exact stored digest");
  return db.transaction(async tx => {
    const [current] = await tx.select().from(fileRegistry).where(eq(fileRegistry.id, id)).for("update");
    assert(current && current.status === file.status && +current.updatedAt === +file.updatedAt && current.storageKey === file.storageKey &&
      current.digest === file.digest && current.uploadedBy === file.uploadedBy && current.deletedUploader === file.deletedUploader, 409, "File changed; reload before retrying");
    const patch = operation === "delete" ? { status: "deleted", deletedFrom: current.status, deletedAt: new Date(), digest: digestBytes(bytes) } :
      operation === "restore" ? { status: current.deletedFrom!, deletedFrom: null, deletedAt: null } :
      { status: "active", scanState: "approved", scanReviewedAt: new Date() };
    const [next] = await tx.update(fileRegistry).set({ ...patch, updatedAt: new Date() }).where(eq(fileRegistry.id, id)).returning();
    await audit(user, operation === "delete" ? "deleteDocument" : operation === "restore" ? "restoreDocument" : "approveDocument", "patient_documents", { id, clinicId: next.clinicId }, tx);
    return next;
  });
}
