import { staffInput, type StaffTab } from "./staff-input";

type Assignment = { clinicIds?:string[]; branchIds?:string[] };

/** A clinic workspace may edit its own assignments without erasing assignments elsewhere. */
export function clinicScopedStaffInput(
  tab:StaffTab,
  values:Record<string,unknown>,
  original:Assignment,
  clinicId?:string,
  branchClinic?:ReadonlyMap<string,{clinicId?:string}>,
) {
  const body=staffInput(tab,values);
  if(!clinicId || tab==="admins") return body;
  body.clinicIds=[...new Set([...(original.clinicIds||[]).filter(id=>id!==clinicId),clinicId])];
  const selected=Array.isArray(values.branchIds) ? values.branchIds.filter((id):id is string=>typeof id==="string") : [];
  // Unknown original branches are retained until their actual location can be verified.
  const retained=(original.branchIds||[]).filter(id=>!selected.includes(id)&&branchClinic?.get(id)?.clinicId!==clinicId);
  body.branchIds=[...new Set([...selected,...retained])];
  return body;
}