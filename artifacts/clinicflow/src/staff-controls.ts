import { staffInput, type StaffTab } from "./staff-input";

type Assignment = { clinicIds?:string[]; branchIds?:string[] };

/** Invitation replacement is not account deactivation or session revocation. */
export function staffInvitationRestriction(row:any, tab:StaffTab):string|undefined {
  if(row.status!=="active")return "Reactivate this account before sending an invitation.";
  if(row.passwordEnabled===true||row.invitationStatus==="notRequired")return "This account already has a password. Use password recovery assistance.";
  if(!(tab==="doctors"?row.userId:row.id))return "This staff record has no linked account. Reload the list.";
  return undefined;
}

export async function resendStaffInvitations(
  rows:any[], tab:StaffTab, send:(id:string)=>Promise<any>, describeError:(error:unknown)=>string,
):Promise<{label:string;ok:boolean;message?:string}[]> {
  const outcomes:{label:string;ok:boolean;message?:string}[]=[];
  for(const row of rows){
    const label=String(row.fullName||row.id);
    const restriction=staffInvitationRestriction(row,tab);
    if(restriction){outcomes.push({label,ok:false,message:restriction});continue;}
    try {
      const result=await send(tab==="doctors"?row.userId:row.id);
      if(result.invitationStatus!=="sent")throw new Error("Invitation was not sent. Reload the account and retry if setup is still required.");
      outcomes.push({label,ok:true});
    } catch(error) {outcomes.push({label,ok:false,message:describeError(error)});}
  }
  return outcomes;
}

/** A clinic workspace may edit its own assignments without erasing assignments elsewhere. */
export function clinicScopedStaffInput(
  tab:StaffTab,
  values:Record<string,unknown>,
  original:Assignment,
  clinicId?:string,
  branchClinic?:ReadonlyMap<string,{clinicId?:string}>,
) {
  const body=staffInput(tab,values);
  if(clinicId && tab!=="admins") {
  body.clinicIds=[...new Set([...(original.clinicIds||[]).filter(id=>id!==clinicId),clinicId])];
  const selected=Array.isArray(values.branchIds) ? values.branchIds.filter((id):id is string=>typeof id==="string") : [];
  // Unknown original branches are retained until their actual location can be verified.
  const retained=(original.branchIds||[]).filter(id=>!selected.includes(id)&&branchClinic?.get(id)?.clinicId!==clinicId);
  body.branchIds=[...new Set([...selected,...retained])];
  }
  // Displayed group IDs may be projections of branch-only links. Rebuilding
  // identical arrays would silently add broader clinic-level assignment rows.
  if((original as any).id)for(const key of ["clinicIds","branchIds"] as const){
    const before=[...new Set(original[key]||[])].sort();
    const after=[...new Set(body[key]||[])].sort();
    if(JSON.stringify(before)===JSON.stringify(after))delete body[key];
  }
  return body;
}