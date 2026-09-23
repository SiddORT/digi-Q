import { Router } from "express";
import { db, clinics, branches, doctors, qrs } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { all, one, filtered, paginate } from "../lib/store";
import { query, assert } from "../lib/http";
import { enrich, publicDoctor } from "../lib/entities";
import { availability } from "../lib/availability";
import { queryPage } from "../lib/list-query";
export const publicRouter = Router();
for (const [kind, table, schema] of [
  ["clinics", clinics, z.ListPublicClinicsQueryParams],
  ["branches", branches, z.ListPublicBranchesQueryParams],
  ["doctors", doctors, z.ListPublicDoctorsQueryParams],
] as const) {
  publicRouter.get(`/public/${kind}`, async (req, res) => {
    const q = query(schema, req);
    const extra = kind === "branches" ? sql`exists(select 1 from clinics c where c.id=r.clinic_id and c.status='active') and ${"doctorId" in q && q.doctorId ? sql`exists(select 1 from doctors d join users u on u.id=d.user_id where d.id=${q.doctorId} and d.status='active' and u.status='active')` : sql`true`}`
      : kind === "doctors" ? sql`exists(select 1 from assignments a join clinics c on c.id=a.clinic_id join branches b on b.id=a.branch_id where a.user_id=r.user_id and c.status='active' and b.status='active')`
        : sql`true`;
    const result = await queryPage({ role: "superAdmin" }, kind, { ...q, status: "active" }, extra);
    if (kind === "doctors") result.items = result.items.map(publicDoctor);
    if (kind === "clinics") result.items = result.items.map(({ ownerId, ...r }: any) => r);
    res.json(result);
  });
}
publicRouter.get("/public/availability", async (req, res) => {
  const q = query(z.GetPublicAvailabilityQueryParams, req); res.json(await availability(q.doctorId, q.branchId, q.date));
});
export async function resolveQr(reference: string, conn: any = db, lock = false) {
  let qr;
  if (lock) {
    const [row] = await conn.select().from(qrs).where(eq(qrs.publicReference, reference)).for("update");
    qr = row;
  } else qr = (await all(qrs, conn)).find(q => q.publicReference === reference);
  assert(qr?.status === "active", 404, "Booking link expired or revoked");
  assert(qr, 404, "Booking link expired or revoked");
  const clinic = await one(clinics, qr.clinicId, conn);
  const branch = qr.branchId ? await one(branches, qr.branchId, conn) : null;
  const doctor = qr.doctorId ? await enrich("doctors", await one(doctors, qr.doctorId, conn), conn) : null;
  assert(clinic.status === "active" && (!branch || branch.status === "active") && (!doctor || doctor.status === "active"), 404, "Booking link unavailable");
  assert((!branch || branch.clinicId === clinic.id) && (!doctor || doctor.clinicIds.includes(clinic.id) && (!branch || doctor.branchIds.includes(branch.id))), 404, "Booking link context is no longer available");
  return { reference, clinicId: clinic.id, clinicName: clinic.name, branchId: branch?.id || null, branchName: branch?.name || null, doctorId: doctor?.id || null, doctorName: doctor?.fullName || null };
}
publicRouter.get("/public/qr/:reference", async (req, res) => { res.json(await resolveQr(req.params.reference as string)); });