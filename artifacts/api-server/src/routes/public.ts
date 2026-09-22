import { Router } from "express";
import { db, clinics, branches, doctors, qrs } from "@workspace/db";
import { eq } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { all, one, filtered, paginate } from "../lib/store";
import { query, assert } from "../lib/http";
import { enrich, publicDoctor } from "../lib/entities";
import { availability } from "../lib/availability";
export const publicRouter = Router();
for (const [kind, table, schema] of [
  ["clinics", clinics, z.ListPublicClinicsQueryParams],
  ["branches", branches, z.ListPublicBranchesQueryParams],
  ["doctors", doctors, z.ListPublicDoctorsQueryParams],
] as const) {
  publicRouter.get(`/public/${kind}`, async (req, res) => {
    const q = query(schema, req);
    let rows = (await Promise.all((await all(table)).filter(r => r.status === "active").map(r => enrich(kind, r)))).filter(r => r.status === "active");
    const activeClinics = (await all(clinics)).filter(c => c.status === "active").map(c => c.id);
    const activeBranches = (await all(branches)).filter(b => b.status === "active" && activeClinics.includes(b.clinicId)).map(b => b.id);
    if (kind === "branches") rows = rows.filter(b => activeClinics.includes(b.clinicId));
    if (kind === "doctors") rows = rows.map(d => ({ ...d, clinicIds: d.clinicIds.filter((id: string) => activeClinics.includes(id)), branchIds: d.branchIds.filter((id: string) => activeBranches.includes(id)) })).filter(d => d.branchIds.length);
    const result = paginate(filtered(rows, q), q);
    if (kind === "doctors") result.items = result.items.map(publicDoctor);
    if (kind === "clinics") result.items = result.items.map(({ ownerId, ...r }) => r);
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
  return { reference, clinicId: clinic.id, clinicName: clinic.name, branchId: branch?.id || null, branchName: branch?.name || null, doctorId: doctor?.id || null, doctorName: doctor?.fullName || null };
}
publicRouter.get("/public/qr/:reference", async (req, res) => { res.json(await resolveQr(req.params.reference as string)); });