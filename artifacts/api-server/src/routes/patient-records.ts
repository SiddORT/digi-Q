import { Router, raw } from "express";
import { db, patients, patientDocuments, appointments, users, clinics } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { requireUser, canRead } from "../lib/auth";
import { query, assert } from "../lib/http";
import { audit, uid } from "../lib/store";
import { sourceSql, pageParams } from "../lib/list-query";
import { consumeRateLimit } from "../lib/native-auth";
import { enforcePermissionPolicy } from "../lib/permission-policy";
import { sniffDocument, safeDocumentName, DOCUMENT_MAX_BYTES } from "../lib/feature-policy";
import { saveDocument, readDocument, removeDocument } from "../lib/document-storage";

export const patientRecordsRouter = Router();
const STAFF = ["superAdmin", "clinicAdmin", "doctor", "receptionist"];

async function readablePatient(user: any, id: string) {
  const [row] = await db.select().from(patients).where(eq(patients.id, id));
  assert(row && await canRead(user, "patients", row), 404, "Patient not found");
  return row!;
}
/** Clinics where this user may attach documents to this patient: their own clinic scope intersected with the patient's clinics. */
async function documentClinics(user: any, patient: any) {
  if (!STAFF.includes(user.role)) return [];
  const visits = await db.select({ clinicId: appointments.clinicId, doctorId: appointments.doctorId }).from(appointments).where(eq(appointments.patientId, patient.id));
  const ids = new Set<string>([...(patient.clinicId && user.role !== "doctor" ? [patient.clinicId] : []), ...visits.filter(v => user.role !== "doctor" || v.doctorId === user.doctorId).map(v => v.clinicId)]);
  return [...ids].filter(c => user.role === "superAdmin" || user.clinicIds.includes(c));
}
const visibleClinic = (user: any, clinicId: string) => user.role === "superAdmin" || user.role === "patient" || user.clinicIds.includes(clinicId);

patientRecordsRouter.get("/patients/:id/documents", async (req, res) => {
  const user = await requireUser(req), patient = await readablePatient(user, String(req.params.id));
  const rows = await db.select({ d: patientDocuments, uploader: users.fullName, clinic: clinics.data }).from(patientDocuments)
    .leftJoin(users, eq(users.id, patientDocuments.uploadedBy)).leftJoin(clinics, eq(clinics.id, patientDocuments.clinicId))
    .where(and(eq(patientDocuments.patientId, patient.id), eq(patientDocuments.status, "active")));
  const items = rows.filter(r => visibleClinic(user, r.d.clinicId)).sort((a, b) => +b.d.createdAt - +a.d.createdAt).map(r => ({
    id: r.d.id, patientId: r.d.patientId, clinicId: r.d.clinicId, clinicName: (r.clinic as any)?.name, name: r.d.name, contentType: r.d.contentType, size: r.d.size, createdAt: r.d.createdAt.toISOString(), uploadedByName: r.uploader || undefined,
  }));
  res.json({ items, uploadClinicIds: await documentClinics(user, patient) });
});
patientRecordsRouter.post("/patients/:id/documents", async (req, _res, next) => {
  const user = await requireUser(req); assert(STAFF.includes(user.role), 403, "Your role cannot upload patient documents");
  next();
}, raw({ type: () => true, limit: DOCUMENT_MAX_BYTES }), async (req, res) => {
  const user = await requireUser(req), patient = await readablePatient(user, String(req.params.id));
  const q = query(z.UploadPatientDocumentQueryParams, req);
  const allowed = await documentClinics(user, patient);
  const clinicId = q.clinicId || allowed[0];
  assert(clinicId && allowed.includes(clinicId), 403, "You cannot add documents for this patient in that clinic");
  assert(Buffer.isBuffer(req.body) && req.body.length > 0, 400, "Choose a file to upload");
  const type = sniffDocument(req.body);
  assert(type, 400, "Upload a PDF, PNG, JPEG, WebP or plain text file up to 10 MB");
  await consumeRateLimit(`document-upload:${user.id}`, 30, 900000);
  const stored = await saveDocument(req.body, type!);
  const row = { id: uid(), patientId: patient.id, clinicId, uploadedBy: user.id, name: safeDocumentName(q.name), contentType: type!, size: req.body.length, provider: stored.provider, storageKey: stored.key };
  try {
    await db.transaction(async tx => {
      await tx.insert(patientDocuments).values(row);
      await audit(user, "uploadDocument", "patient_documents", { id: row.id, clinicId }, tx);
    });
  } catch (error) { await removeDocument(stored.provider, stored.key); throw error; }
  res.status(201).json({ id: row.id, patientId: row.patientId, clinicId, name: row.name, contentType: row.contentType, size: row.size, createdAt: new Date().toISOString(), uploadedByName: user.fullName });
});
async function authorizedDocument(user: any, id: string) {
  const [doc] = await db.select().from(patientDocuments).where(eq(patientDocuments.id, id));
  assert(doc && doc.status === "active" && visibleClinic(user, doc.clinicId), 404, "Document not found");
  await readablePatient(user, doc!.patientId);
  return doc!;
}
patientRecordsRouter.get("/patient-documents/:id", async (req, res) => {
  const user = await requireUser(req), doc = await authorizedDocument(user, String(req.params.id));
  const bytes = await readDocument(doc.provider, doc.storageKey);
  await audit(user, "downloadDocument", "patient_documents", { id: doc.id, clinicId: doc.clinicId });
  res.set({ "Content-Type": doc.contentType, "Content-Length": String(bytes.length), "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name)}` });
  res.send(bytes);
});
patientRecordsRouter.delete("/patient-documents/:id", async (req, res) => {
  const user = await requireUser(req), doc = await authorizedDocument(user, String(req.params.id));
  assert(["superAdmin", "clinicAdmin"].includes(user.role) || doc.uploadedBy === user.id, 403, "Only the uploader or a clinic administrator can delete this document");
  await db.transaction(async tx => {
    await tx.update(patientDocuments).set({ status: "deleted", deletedAt: new Date() }).where(eq(patientDocuments.id, doc.id));
    await audit(user, "deleteDocument", "patient_documents", { id: doc.id, clinicId: doc.clinicId }, tx);
  });
  await removeDocument(doc.provider, doc.storageKey);
  res.status(204).end();
});

patientRecordsRouter.get("/patients/:id/activity", async (req, res) => {
  const user = await requireUser(req), patient = await readablePatient(user, String(req.params.id));
  await enforcePermissionPolicy(user, { method: "GET", path: "/appointments" });
  const q = query(z.ListPatientActivityQueryParams, req), { page, pageSize } = pageParams(q);
  const base = sql`from appointment_history h join (${sourceSql(user, "appointments", sql`r.patient_id = ${patient.id}`)}) a on a.doc->>'id' = h.appointment_id
    join appointments ap on ap.id = h.appointment_id left join doctors d on d.id = ap.doctor_id left join users du on du.id = d.user_id left join users au on au.id = h.actor_id`;
  const [count] = (await db.execute(sql`select count(*)::int as total ${base}`)).rows as any[];
  const rows = await db.execute(sql`select h.id, h.appointment_id as "appointmentId", h.from_status as "fromStatus", h.to_status as "toStatus", h.created_at as "occurredAt",
      coalesce(ap.data->>'reference','') as reference, coalesce(du.full_name,'') as "doctorName", ap.date,
      case when ${user.role === "patient"} then null else au.full_name end as "actorName"
    ${base} order by h.created_at desc, h.id limit ${pageSize} offset ${(page - 1) * pageSize}`);
  res.json({ items: (rows.rows as any[]).map(r => ({ ...r, occurredAt: new Date(r.occurredAt).toISOString() })), total: count.total, page, pageSize });
});

