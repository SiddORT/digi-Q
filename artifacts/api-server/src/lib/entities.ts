import { db, doctors, users, assignments, masters, branches, clinics } from "@workspace/db";
import { all, flatten, one } from "./store";
export async function enrich(kind: string, row: any, conn: any = db): Promise<any> {
  row = { ...row };
  if (kind === "doctors" || kind === "users") {
    if (kind === "users") row.mobile ||= "";
    const links = (await all(assignments, conn)).filter(a => a.userId === (kind === "doctors" ? row.userId : row.id));
    row.clinicIds = [...new Set(links.map(a => a.clinicId))]; row.branchIds = links.filter(a => a.branchId).map(a => a.branchId);
  }
  if (kind === "doctors") {
    const account = await one(users, row.userId, conn); row.fullName = account.fullName; row.email = account.email; row.mobile = account.mobile || "";
    if (account.status !== "active") row.status = "inactive";
    if (row.specializationId) row.specializationName = (await one(masters, row.specializationId, conn)).name;
    row.qualificationNames = (await all(masters, conn)).filter(m => row.qualificationIds?.includes(m.id)).map(m => m.name);
  }
  if (kind === "branches") row.clinicName = (await one(clinics, row.clinicId, conn)).name;
  if (kind === "qrs") row.reference = row.publicReference;
  return row;
}
export function publicDoctor(row: any) {
  return Object.fromEntries(["id", "fullName", "photoUrl", "specializationName", "qualificationNames", "about", "experienceYears", "consultationFee", "clinicIds", "branchIds"].map(k => [k, row[k]]));
}