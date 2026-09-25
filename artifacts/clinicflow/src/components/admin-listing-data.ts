export function csvCell(value:unknown) {
  const text=Array.isArray(value)?value.join("; "):String(value??"");
  // Leading whitespace and control characters must not bypass spreadsheet guards.
  return `"${(/^[\s\u0000-\u001f]*[=+\-@]/.test(text)?"'":"")+text.replace(/"/g,'""')}"`;
}

export function statusInput(resource:string,row:any,status:"active"|"inactive"):any {
  if(resource==="clinics")return {name:row.name,address:row.address,status};
  // Branch schema has a timezone default: explicitly preserve its actual value.
  if(resource==="branches")return {name:row.name,address:row.address,clinicId:row.clinicId,timezone:row.timezone,status};
  if(resource==="doctors")return {fullName:row.fullName,email:row.email,mobile:row.mobile,status};
  if(resource==="users")return {fullName:row.fullName,email:row.email,mobile:row.mobile,role:row.role,status};
  throw new Error("Status changes are not supported for this list.");
}