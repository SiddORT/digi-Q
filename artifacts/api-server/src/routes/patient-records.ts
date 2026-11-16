import { Router, raw } from "express";
import { db, patients, patientDocuments, appointments, users, clinics } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { requireUser } from "../lib/auth";
import { query, assert } from "../lib/http";
import { audit, uid } from "../lib/store";
import { sourceSql, pageParams } from "../lib/list-query";
import { consumeRateLimit } from "../lib/native-auth";
import { enforcePermissionPolicy } from "../lib/permission-policy";
import { DOCUMENT_MAX_BYTES } from "../lib/feature-policy";
import { readablePatient, documentClinics, visibleClinic } from "../lib/patient-document-access";
import { accessibleFile, changeFileState, uploadFile, verifiedFileBytes } from "../features/files/service";
import { retainedDoctorVisitSql } from "../lib/retained-doctor-access";

export const patientRecordsRouter = Router();
const STAFF = ["superAdmin", "clinicAdmin", "doctor", "receptionist"];

patientRecordsRouter.use(["/patients/:id/documents", "/patient-documents/:id"], (_req, res, next) => {
  res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }); next();
});
patientRecordsRouter.get("/patients/:id/documents", async (req, res) => {
  const user = await requireUser(req), patient = await readablePatient(user, String(req.params.id));
  const allowed = await documentClinics(user, patient);
  const rows = await db.select({ d: patientDocuments, uploader: users.fullName, clinic: clinics.data }).from(patientDocuments)
    .leftJoin(users, eq(users.id, patientDocuments.uploadedBy)).leftJoin(clinics, eq(clinics.id, patientDocuments.clinicId))
    .where(and(eq(patientDocuments.patientId, patient.id), eq(patientDocuments.status, "active")));
  const items = rows.filter(r => visibleClinic(user, r.d.clinicId, allowed)).sort((a, b) => +b.d.createdAt - +a.d.createdAt).map(r => ({
    id: r.d.id, patientId: r.d.patientId, clinicId: r.d.clinicId, clinicName: (r.clinic as any)?.name, name: r.d.name, contentType: r.d.contentType, size: r.d.size, createdAt: r.d.createdAt.toISOString(), uploadedByName: r.d.deletedUploader ? "Deleted user" : r.uploader || undefined,
  }));
  res.json({ items, uploadClinicIds: allowed });
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
  await consumeRateLimit(`document-upload:${user.id}`, 30, 900000);
  const row = await uploadFile(user, { patientId: patient.id, clinicId, purpose: "documents", name: q.name }, req.body);
  res.status(201).json({ id: row.id, patientId: row.patientId, clinicId, name: row.name, contentType: row.contentType, size: row.size, createdAt: row.createdAt.toISOString(), uploadedByName: user.fullName, status: row.status, scanState: row.scanState });
});
patientRecordsRouter.get("/patient-documents/:id", async (req, res) => {
  const user = await requireUser(req), doc = await accessibleFile(user, String(req.params.id));
  assert(doc.patientId, 404, "Document not found");
  const bytes = await verifiedFileBytes(doc);
  await audit(user, "downloadDocument", "patient_documents", { id: doc.id, clinicId: doc.clinicId });
  res.set({ "Content-Type": doc.contentType, "Content-Length": String(bytes.length), "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store",
    "Content-Security-Policy": "sandbox", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.name).replace(/'/g, "%27")}` });
  res.send(bytes);
});
patientRecordsRouter.delete("/patient-documents/:id", async (req, res) => {
  const user = await requireUser(req), id = String(req.params.id);
  const doc = await accessibleFile(user, id, { pending: true });
  assert(doc.patientId, 404, "Document not found");
  await changeFileState(user, id, "delete");
  res.status(204).end();
});

patientRecordsRouter.get("/patients/:id/activity", async (req, res) => {
  const user = await requireUser(req), patient = await readablePatient(user, String(req.params.id));
  await enforcePermissionPolicy(user, { method: "GET", path: "/appointments" });
  const q = query(z.ListPatientActivityQueryParams, req), { page, pageSize } = pageParams(q);
  const retained = user.role === "doctor" && user.handoffHistoryInstalled
    ? sql`union select jsonb_build_object('id',r.id) as doc from appointments r where r.patient_id=${patient.id}
        and ${retainedDoctorVisitSql(user, sql`r.patient_id`, sql`r.id`)}` : sql``;
  const base = sql`from appointment_history h join (select distinct doc->>'id' as id from
    (${sourceSql(user, "appointments", sql`r.patient_id = ${patient.id}`)} ${retained}) visible_visits) a on a.id = h.appointment_id
    join appointments ap on ap.id = h.appointment_id left join doctors d on d.id = ap.doctor_id left join users du on du.id = d.user_id left join users au on au.id = h.actor_id`;
  const [count] = (await db.execute(sql`select count(*)::int as total ${base}`)).rows as any[];
  const rows = await db.execute(sql`select h.id, h.appointment_id as "appointmentId", h.from_status as "fromStatus", h.to_status as "toStatus", h.created_at as "occurredAt",
      coalesce(ap.data->>'reference','') as reference, case when d.status='retired' then 'Deleted doctor' else coalesce(du.full_name,'') end as "doctorName", ap.date,
      case when ${user.role === "patient"} then null when h.deleted_actor then 'Deleted user' else au.full_name end as "actorName"
    ${base} order by h.created_at desc, h.id limit ${pageSize} offset ${(page - 1) * pageSize}`);
  res.json({ items: (rows.rows as any[]).map(r => ({ ...r, occurredAt: new Date(r.occurredAt).toISOString() })), total: count.total, page, pageSize });
});

