/** Declarative SMS HTTP mapping: a constrained, non-executable description of a provider request. */
export type SmsMapping = {
  encoding: "json" | "form"; authMode: "header" | "bearer" | "body"; authField: string;
  fields: { recipient: string; message: string; senderId: string; dltEntityId: string; dltTemplateId: string };
  staticFields: Record<string, string>; acceptedStatuses: number[]; responseField?: string; responseValue?: string; dltRequired: boolean;
};
export const DEFAULT_MAPPING: SmsMapping = {
  encoding: "json", authMode: "header", authField: "X-API-Key",
  fields: { recipient: "to", message: "message", senderId: "sender", dltEntityId: "entity_id", dltTemplateId: "template_id" },
  staticFields: {}, acceptedStatuses: [200, 202], dltRequired: false,
};
const IDENT = /^[A-Za-z][A-Za-z0-9_]{0,49}$/;
const HEADER = /^[A-Za-z][A-Za-z0-9_-]{0,49}$/;
export function validateUrl(v: string): string | undefined {
  if (!v) return undefined;
  try {
    const u = new URL(v);
    if (u.protocol !== "https:") return "Use an https:// address.";
    if (u.username || u.password) return "Do not put credentials in the address.";
    if (u.search || u.hash) return "Do not include a query string; use static fields instead.";
    if (u.port && u.port !== "443") return "Only port 443 is supported.";
    return undefined;
  } catch { return "Enter a valid https:// address."; }
}
export function validateMapping(m: SmsMapping): string[] {
  const e: string[] = [];
  const ok = IDENT;
  if (!(m.authMode === "header" ? HEADER : ok).test(m.authField) && m.authMode !== "bearer") e.push("Authentication field name is not valid.");
  for (const [k, v] of Object.entries(m.fields)) if (!ok.test(v)) e.push(`Field name for ${k} is not valid.`);
  const names = Object.values(m.fields); if (new Set(names).size !== names.length) e.push("Payload field names must be different.");
  for (const [k, v] of Object.entries(m.staticFields)) { if (!ok.test(k)) e.push(`Static field "${k}" is not a valid name.`); if (v.length > 200) e.push(`Static field "${k}" is too long.`); }
  if (!m.acceptedStatuses.length || m.acceptedStatuses.some(n => !Number.isInteger(n) || n < 200 || n > 299)) e.push("Accepted statuses must be 2xx codes.");
  if (m.responseField && !/^[A-Za-z][A-Za-z0-9_]{0,49}(\.[A-Za-z][A-Za-z0-9_]{0,49}){0,4}$/.test(m.responseField)) e.push("Response field must be a dot path.");
  return e;
}
export function serializeMapping(m: SmsMapping): string {
  const out: any = { ...m };
  if (m.authMode === "bearer") out.authField = DEFAULT_MAPPING.authField;
  if (!m.responseField) { delete out.responseField; delete out.responseValue; } else if (!m.responseValue) delete out.responseValue;
  return JSON.stringify(out);
}
export function parseStatuses(v: string): number[] { return v.split(/[\s,]+/).filter(Boolean).map(Number); }
export function smsConfigurationValues(url:string,key:string,mapping:SmsMapping,mappingTouched:boolean,mappingSaved:boolean){
  const values:Record<string,string>={};
  if(url)values.NOTIFICATION_SMS_URL=url;
  if(key)values.NOTIFICATION_SMS_KEY=key;
  // Supply displayed defaults on first setup; a saved mapping is deliberately
  // kept when untouched, since read responses cannot expose its values.
  if(mappingTouched||!mappingSaved)values.NOTIFICATION_SMS_MAPPING=serializeMapping(mapping);
  return values;
}
