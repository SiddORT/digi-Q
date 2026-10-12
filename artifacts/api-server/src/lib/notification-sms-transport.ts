import { z } from "zod";
import { lookup } from "node:dns/promises";
import { request } from "node:https";
import { BlockList, isIP } from "node:net";

const field = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,49}$/);
export const smsMappingSchema = z.object({
  encoding: z.enum(["json", "form"]),
  authMode: z.enum(["header", "bearer", "body"]),
  authField: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,49}$/),
  fields: z.object({ recipient: field, message: field, senderId: field, dltEntityId: field, dltTemplateId: field, clientId: field.optional() }).strict(),
  staticFields: z.record(field, z.string().max(200)).default({}),
  acceptedStatuses: z.array(z.number().int().min(200).max(299)).min(1).max(10),
  responseField: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*){0,3}$/).max(100).optional(),
  responseValue: z.string().max(100).optional(),
  dltRequired: z.boolean(),
}).strict().superRefine((v, ctx) => {
  const names = [...Object.values(v.fields).filter((name): name is string => typeof name === "string"), ...Object.keys(v.staticFields), ...(v.authMode === "body" ? [v.authField] : [])];
  if (new Set(names).size !== names.length || names.some(n => ["__proto__", "constructor", "prototype"].includes(n)))
    ctx.addIssue({ code: "custom", message: "Payload fields must be distinct safe identifiers" });
  if (Object.keys(v.staticFields).length > 10 || JSON.stringify(v.staticFields).length > 2000)
    ctx.addIssue({ code: "custom", message: "At most ten non-secret static fields" });
  if (v.authMode === "body" && !/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(v.authField))
    ctx.addIssue({ code: "custom", message: "Invalid body authentication field" });
  if (v.authMode === "header" && /^(host|content-type|content-length|connection|transfer-encoding|cookie|proxy-.*|accept-encoding)$/i.test(v.authField))
    ctx.addIssue({ code: "custom", message: "Reserved authentication header" });
  if (!!v.responseField !== (v.responseValue !== undefined))
    ctx.addIssue({ code: "custom", message: "Response field and expected value must be specified together" });
});
export type SmsMapping = z.infer<typeof smsMappingSchema>;
export type SmsOutcome = "provider_accepted" | "provider_rejected" | "pre_dispatch_failed" | "delivery_unknown";
export function smsUrl(value: string) {
  const url = new URL(value);
  if (value.length > 2048 || url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      (url.port && url.port !== "443") || !url.hostname || /(^|\.)localhost\.?$/i.test(url.hostname))
    throw new Error("Unsupported SMS URL");
  const literal=url.hostname.replace(/^\[|\]$/g,"");
  if(isIP(literal)&&!publicSmsAddress(literal))throw new Error("Reserved SMS destination");
  return url;
}
const blocked = new BlockList();
for (const [ip, bits] of [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.0.2.0",24],["192.168.0.0",16],["192.88.99.0",24],["198.18.0.0",15],["198.51.100.0",24],["203.0.113.0",24],["224.0.0.0",4],["240.0.0.0",4]] as const) blocked.addSubnet(ip,bits,"ipv4");
// Permit only globally routed IPv6, excluding documentation, special use and transition ranges.
const global6 = new BlockList(); global6.addSubnet("2000::",3,"ipv6");
for (const [ip,bits] of [["2001::",23],["2001:db8::",32],["2002::",16],["3fff::",20]] as const) blocked.addSubnet(ip,bits,"ipv6");
export function publicSmsAddress(ip: string) {
  const family = isIP(ip);
  return family === 4 ? !blocked.check(ip,"ipv4") : family === 6 && global6.check(ip,"ipv6") && !blocked.check(ip,"ipv6");
}
export function notificationSmsConfig(env: NodeJS.ProcessEnv) {
  const url = smsUrl(env.NOTIFICATION_SMS_URL || "");
  const key = env.NOTIFICATION_SMS_KEY || "";
  if (!key || key.length > 2048 || !/^[\x21-\x7e]+$/.test(key)) throw new Error("Invalid SMS key");
  if((env.NOTIFICATION_SMS_MAPPING?.length||0)>8192)throw new Error("SMS mapping too large");
  const mapping = smsMappingSchema.parse(JSON.parse(env.NOTIFICATION_SMS_MAPPING || ""));
  // Static fields are not a second credential container.
  if (Object.values(mapping.staticFields).some(v => v.includes(key)) ||
      Object.keys(mapping.staticFields).some(k=>/password|secret|token|api_?key|authorization/i.test(k))) throw new Error("Secret in static fields");
  const statusUrl = env.NOTIFICATION_SMS_STATUS_URL ? smsUrl(env.NOTIFICATION_SMS_STATUS_URL) : undefined;
  const enabled = env.NOTIFICATION_SMS_ENABLED?.trim();
  if (enabled && enabled !== "true" && enabled !== "false") throw new Error("Invalid SMS notification switch");
  const clientId = env.NOTIFICATION_SMS_CLIENT_ID || "";
  const senderId = env.NOTIFICATION_SMS_SENDER_ID || "";
  const dltEntityId = env.NOTIFICATION_SMS_ENTITY_ID || "";
  if (clientId.length > 200 || /[\r\n]/.test(clientId) ||
      [senderId, dltEntityId].some(v => v.length > 50 || /[\r\n]/.test(v)))
    throw new Error("Invalid SMS provider identifiers");
  const clientField = mapping.fields.clientId ?? "client_id";
  if (clientId && [...Object.values(mapping.fields).filter(v => v !== mapping.fields.clientId), ...Object.keys(mapping.staticFields), ...(mapping.authMode === "body" ? [mapping.authField] : [])].includes(clientField))
    throw new Error("Client ID field conflicts with another provider field");
  return { url, key, mapping, statusUrl, clientId, senderId, dltEntityId, notificationsEnabled: enabled !== "false" };
}
/** Optional notification channel only; never controls verification/OTP. */
export function notificationSmsEnabled(env: NodeJS.ProcessEnv) {
  const value = env.NOTIFICATION_SMS_ENABLED?.trim();
  return !value || value === "true";
}
export function notificationSmsReadiness(env: NodeJS.ProcessEnv) {
  const names = ["NOTIFICATION_SMS_URL", "NOTIFICATION_SMS_KEY", "NOTIFICATION_SMS_MAPPING", "NOTIFICATION_SMS_STATUS_URL", "NOTIFICATION_SMS_CLIENT_ID", "NOTIFICATION_SMS_SENDER_ID", "NOTIFICATION_SMS_ENTITY_ID", "NOTIFICATION_SMS_ENABLED"];
  const keys = names.map(key => ({key, status: env[key]?.trim() ? "configured" as const : "missing" as const}));
  let ready = false;
  try { notificationSmsConfig(env); ready = true; } catch { /* sanitized presence/syntax only */ }
  const publicUrl = (value: string | undefined) => { try { return value ? smsUrl(value).href : ""; } catch { return ""; } };
  return {
    ready, notificationsEnabled: notificationSmsEnabled(env),
    apiUrl: publicUrl(env.NOTIFICATION_SMS_URL), statusApiUrl: publicUrl(env.NOTIFICATION_SMS_STATUS_URL),
    keys: keys.map(item => !ready && item.status === "configured" ? { ...item, status: "invalid" as const } : item),
  };
}
export function smsPayload(cfg: ReturnType<typeof notificationSmsConfig>, to: string, message: string, meta: {senderId?:string;dltEntityId?:string;dltTemplateId?:string}) {
  meta = { ...meta, senderId: meta.senderId || cfg.senderId, dltEntityId: meta.dltEntityId || cfg.dltEntityId };
  if (!/^\+[1-9]\d{6,14}$/.test(to) || !message || message.length > 1600 || Object.values(meta).some(v => v && (v.length > 50 || /[\r\n]/.test(v)))) throw new Error("Invalid SMS payload");
  if (cfg.mapping.dltRequired && (!meta.senderId || !meta.dltEntityId || !meta.dltTemplateId)) throw new Error("DLT metadata required");
  const fields = cfg.mapping.fields;
  const values: Record<string,string> = { ...cfg.mapping.staticFields, [fields.recipient]:to, [fields.message]:message };
  if (cfg.clientId) values[fields.clientId ?? "client_id"] = cfg.clientId;
  for (const key of ["senderId","dltEntityId","dltTemplateId"] as const) if(meta[key]) values[fields[key]] = meta[key]!;
  const headers: Record<string,string> = { "Content-Type": cfg.mapping.encoding === "json" ? "application/json" : "application/x-www-form-urlencoded" };
  if (cfg.mapping.authMode === "body") values[cfg.mapping.authField] = cfg.key;
  else headers[cfg.mapping.authMode === "bearer" ? "Authorization" : cfg.mapping.authField] = cfg.mapping.authMode === "bearer" ? `Bearer ${cfg.key}` : cfg.key;
  const body = cfg.mapping.encoding === "json" ? JSON.stringify(values) : new URLSearchParams(values).toString();
  if (Buffer.byteLength(body) > 16384) throw new Error("SMS payload too large");
  return {body,headers};
}
export function classifySmsResponse(mapping: SmsMapping, status: number, body: string): SmsOutcome {
  if (status >= 300 && status < 400) return "provider_rejected"; // Never follow redirects.
  if (!mapping.acceptedStatuses.includes(status)) return status >= 400 && status < 500 ? "provider_rejected" : "delivery_unknown";
  if (!mapping.responseField) return "provider_accepted";
  try {
    let value: any = JSON.parse(body);
    for (const part of mapping.responseField.split(".")) value = value && Object.hasOwn(value,part) ? value[part] : undefined;
    if (value === undefined || typeof value === "object") return "delivery_unknown";
    return String(value) === mapping.responseValue ? "provider_accepted" : "provider_rejected";
  } catch { return "delivery_unknown"; }
}
/** Resolve once, validate every answer and pin that exact address in TLS request lookup.
 * No fetch/global agent/proxy redirects or second DNS lookup can bypass the public-IP check. */
export async function sendNotificationSms(env: NodeJS.ProcessEnv, to: string, message: string, meta: {senderId?:string;dltEntityId?:string;dltTemplateId?:string}): Promise<SmsOutcome> {
  let cfg: ReturnType<typeof notificationSmsConfig>, payload: ReturnType<typeof smsPayload>;
  let pinned: {address:string;family:number};
  try {
    cfg = notificationSmsConfig(env); payload = smsPayload(cfg,to,message,meta);
    const host = cfg.url.hostname.replace(/^\[|\]$/g,"");
    const answers = await Promise.race([lookup(host,{all:true,verbatim:true}),new Promise<never>((_, reject)=>setTimeout(()=>reject(new Error("DNS timeout")),3000).unref())]);
    if (!answers.length || answers.some(a=>!publicSmsAddress(a.address))) return "pre_dispatch_failed";
    pinned = answers[0];
  } catch { return "pre_dispatch_failed"; }
  return new Promise(resolve => {
    let dispatched = false, finished = false;
    const finish = (value:SmsOutcome) => { if(!finished){finished=true;clearTimeout(timer);resolve(value);} };
    const req = request(cfg.url, { method:"POST",agent:false,headers:{...payload.headers,"Content-Length":Buffer.byteLength(payload.body)},
      lookup: ((_host: string, options: any, callback: any) => options?.all ? callback(null,[pinned]) : callback(null,pinned.address,pinned.family)) as any,
    }, res=>{
      let body = "", bytes = 0;
      res.on("data",chunk=>{bytes+=chunk.length;if(bytes>16384){finish("delivery_unknown");req.destroy();}else body+=chunk.toString("utf8");});
      res.on("end",()=>finish(classifySmsResponse(cfg.mapping,res.statusCode || 0,body)));
      res.on("error",()=>finish("delivery_unknown"));
    });
    const timer = setTimeout(()=>{finish(dispatched?"delivery_unknown":"pre_dispatch_failed");req.destroy();},10000);
    req.on("socket",socket=>socket.once("secureConnect",()=>{dispatched=true;}));
    req.on("error",()=>finish(dispatched?"delivery_unknown":"pre_dispatch_failed"));
    req.end(payload.body);
  });
}
