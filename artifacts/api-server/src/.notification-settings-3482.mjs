var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all2) => {
  for (var name in all2)
    __defProp(target, name, { get: all2[name], enumerable: true });
};

// kit-network:node:dns/promises
var lookup;
var init_promises = __esm({
  "kit-network:node:dns/promises"() {
    lookup = async () => [{ address: "8.8.8.8", family: 4 }];
  }
});

// kit-network:node:https
import { EventEmitter } from "node:events";
function request(url, options, callback) {
  const req = new EventEmitter();
  req.destroy = () => {
  };
  req.end = (body) => {
    globalThis.kitNetwork.push({ url: String(url), options, body: JSON.parse(body) });
    queueMicrotask(() => {
      const socket = new EventEmitter();
      req.emit("socket", socket);
      socket.emit("secureConnect");
      const res = new EventEmitter();
      res.statusCode = 200;
      callback(res);
      res.emit("data", Buffer.from(JSON.stringify(globalThis.kitResponse ?? { Success: true, Message: "private diagnostic" })));
      res.emit("end");
    });
  };
  return req;
}
var init_node_https = __esm({
  "kit-network:node:https"() {
  }
});

// artifacts/api-server/src/lib/notification-sms-diagnostics.ts
function storedSmsDiagnostic(code, httpStatus) {
  if (typeof code !== "string" || !Object.hasOwn(messages, code)) return void 0;
  const key4 = code;
  return { code: key4, message: messages[key4], ...typeof httpStatus === "number" && Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599 ? { httpStatus } : {} };
}
function smsRejectionDiagnostic(httpStatus, body) {
  let text2 = "";
  try {
    const result = JSON.parse(body);
    text2 = ["Message", "message", "Error", "error", "ErrorMessage", "error_description", "ErrorCode", "errorCode", "Code", "code"].filter((key4) => result && Object.hasOwn(result, key4) && typeof result[key4] === "string").map((key4) => result[key4].slice(0, 500)).join(" ");
  } catch {
  }
  let code = "unspecified_rejection";
  if (httpStatus === 401 || httpStatus === 403 || /unauthori[sz]ed|(?:invalid|expired|wrong).*(?:api.?key|token|credential|client.?id)|(?:api.?key|token|credential|client.?id).*(?:invalid|expired|wrong)|authentication.*(?:fail|error)|access denied/i.test(text2)) code = "authentication_failed";
  else if (httpStatus === 429) code = "rate_limited";
  else if (httpStatus === 404) code = "endpoint_not_found";
  else if (/insufficient.*(?:balance|credit)|(?:balance|credit).*(?:insufficient|exhausted)|not enough.*credit/i.test(text2)) code = "insufficient_credit";
  else if (/\bdlt\b|\btemplate(?:[ _-]?id)?\b|message.*(?:mismatch|not match)/i.test(text2)) code = "dlt_validation_failed";
  else if (/\bsender(?:[ _-]?id)?\b|\bheader\b/i.test(text2)) code = "sender_validation_failed";
  else if (/\brecipient\b|\bmobile\b|\bphone\b|country.?code/i.test(text2)) code = "recipient_validation_failed";
  else if (/\bblocked\b|\bdisabled\b|\bsuspended\b|\bblacklist\b/i.test(text2)) code = "account_or_route_blocked";
  else if (/message.*(?:invalid|length|character|too long|empty)|invalid.*message/i.test(text2)) code = "message_validation_failed";
  return storedSmsDiagnostic(code, httpStatus);
}
var messages;
var init_notification_sms_diagnostics = __esm({
  "artifacts/api-server/src/lib/notification-sms-diagnostics.ts"() {
    "use strict";
    messages = {
      authentication_failed: "The provider denied authentication or access. Check the API key, Bearer token, Client ID and account permissions.",
      dlt_validation_failed: "The provider reports a DLT/template problem. Check this event's DLT Template ID and match the approved message wording exactly.",
      sender_validation_failed: "The provider reports a Sender ID/header problem. Check that the configured sender is approved for this account and template.",
      recipient_validation_failed: "The provider reports an invalid recipient or country code. Check the recipient and the configured country-code format.",
      insufficient_credit: "The provider reports insufficient SMS balance or credits.",
      rate_limited: "The provider rate-limited the request. Wait before starting another test.",
      account_or_route_blocked: "The provider reports a blocked, disabled or suspended account or SMS route.",
      message_validation_failed: "The provider reports invalid message content, length or characters. Check the approved template and provider message limits.",
      endpoint_not_found: "The provider endpoint was not found. Check the configured SMS API URL.",
      unspecified_rejection: "The provider rejected the message without a recognized reason. Check the provider portal for this attempt; no detailed response text is retained."
    };
  }
});

// artifacts/api-server/src/lib/notification-sms-transport.ts
import { z } from "zod";
import { BlockList, isIP } from "node:net";
import { parsePhoneNumberFromString } from "libphonenumber-js";
function smsUrl(value) {
  const url = new URL(value);
  if (value.length > 2048 || url.protocol !== "https:" || url.username || url.password || url.search || url.hash || url.port && url.port !== "443" || !url.hostname || /(^|\.)localhost\.?$/i.test(url.hostname))
    throw new Error("Unsupported SMS URL");
  const literal2 = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(literal2) && !publicSmsAddress(literal2)) throw new Error("Reserved SMS destination");
  return url;
}
function publicSmsAddress(ip) {
  const family = isIP(ip);
  return family === 4 ? !blocked.check(ip, "ipv4") : family === 6 && global6.check(ip, "ipv6") && !blocked.check(ip, "ipv6");
}
function notificationSmsConfig(env) {
  const provider = env.NOTIFICATION_SMS_PROVIDER || "generic";
  if (!["generic", "keepInTouch"].includes(provider)) throw new Error("Invalid SMS provider");
  const kit = provider === "keepInTouch";
  const url = smsUrl(kit ? env.NOTIFICATION_SMS_KEEP_IN_TOUCH_URL || KEEP_IN_TOUCH_URL : env.NOTIFICATION_SMS_URL || "");
  const key4 = env.NOTIFICATION_SMS_KEY || "";
  if (!key4 || key4.length > 2048 || !/^[\x21-\x7e]+$/.test(key4)) throw new Error("Invalid SMS key");
  const bearerToken = env.NOTIFICATION_SMS_BEARER_TOKEN || "";
  const protectedBearerToken = env.NOTIFICATION_SMS_BEARER_TOKEN || "";
  const countryCodeFormat = env.NOTIFICATION_SMS_COUNTRY_CODE_FORMAT || "";
  if (!bearerToken || bearerToken.length > 2048 || !/^[\x21-\x7e]+$/.test(bearerToken)) throw new Error("Invalid SMS bearer token");
  if (kit && (!bearerToken || !["digits", "plus"].includes(countryCodeFormat))) throw new Error("Invalid Keep in Touch authentication or country code format");
  if ((env.NOTIFICATION_SMS_MAPPING?.length || 0) > 8192) throw new Error("SMS mapping too large");
  const mapping = smsMappingSchema.parse(kit ? keepInTouchMapping : JSON.parse(env.NOTIFICATION_SMS_MAPPING || ""));
  if (kit && env.NOTIFICATION_SMS_MAPPING) {
    const retained = smsMappingSchema.parse(JSON.parse(env.NOTIFICATION_SMS_MAPPING));
    if (Object.values(retained.staticFields).some((v) => v.includes(key4) || v.includes(bearerToken)) || Object.keys(retained.staticFields).some((k) => /password|secret|token|api_?key|authorization/i.test(k)))
      throw new Error("Secret in static fields");
  }
  if (Object.values(mapping.staticFields).some((v) => v.includes(key4) || protectedBearerToken && v.includes(protectedBearerToken)) || Object.keys(mapping.staticFields).some((k) => /password|secret|token|api_?key|authorization/i.test(k))) throw new Error("Secret in static fields");
  const statusUrl = env.NOTIFICATION_SMS_STATUS_URL ? smsUrl(env.NOTIFICATION_SMS_STATUS_URL) : void 0;
  const enabled = env.NOTIFICATION_SMS_ENABLED?.trim();
  if (enabled && enabled !== "true" && enabled !== "false") throw new Error("Invalid SMS notification switch");
  const clientId = env.NOTIFICATION_SMS_CLIENT_ID || "";
  const senderId = env.NOTIFICATION_SMS_SENDER_ID || "";
  const dltEntityId = kit ? "" : env.NOTIFICATION_SMS_ENTITY_ID || "";
  if (!senderId.trim()) throw new Error("SMS sender ID required");
  if (kit && (!clientId.trim() || !/^[A-Za-z0-9_-]{1,50}$/.test(senderId))) throw new Error("Invalid Keep in Touch identifiers");
  if (clientId.length > 200 || /[\r\n]/.test(clientId) || [senderId, dltEntityId].some((v) => v.length > 50 || /[\r\n]/.test(v)))
    throw new Error("Invalid SMS provider identifiers");
  const clientField = mapping.fields.clientId ?? "client_id";
  if (clientId && [...Object.values(mapping.fields).filter((v) => v !== mapping.fields.clientId), ...Object.keys(mapping.staticFields), ...mapping.authMode === "body" ? [mapping.authField] : []].includes(clientField))
    throw new Error("Client ID field conflicts with another provider field");
  return { url, key: key4, mapping, statusUrl, clientId, senderId, dltEntityId, provider, bearerToken, countryCodeFormat, notificationsEnabled: enabled !== "false" };
}
function notificationSmsEnabled(env) {
  const value = env.NOTIFICATION_SMS_ENABLED?.trim();
  return !value || value === "true";
}
function notificationSmsReadiness(env) {
  const kit = env.NOTIFICATION_SMS_PROVIDER === "keepInTouch";
  const names2 = kit ? ["NOTIFICATION_SMS_KEEP_IN_TOUCH_URL", "NOTIFICATION_SMS_KEY", "NOTIFICATION_SMS_BEARER_TOKEN", "NOTIFICATION_SMS_CLIENT_ID", "NOTIFICATION_SMS_SENDER_ID", "NOTIFICATION_SMS_COUNTRY_CODE_FORMAT", "NOTIFICATION_SMS_ENABLED", "NOTIFICATION_SMS_MAPPING"] : ["NOTIFICATION_SMS_URL", "NOTIFICATION_SMS_KEEP_IN_TOUCH_URL", "NOTIFICATION_SMS_BEARER_TOKEN", "NOTIFICATION_SMS_COUNTRY_CODE_FORMAT", "NOTIFICATION_SMS_KEY", "NOTIFICATION_SMS_MAPPING", "NOTIFICATION_SMS_STATUS_URL", "NOTIFICATION_SMS_CLIENT_ID", "NOTIFICATION_SMS_SENDER_ID", "NOTIFICATION_SMS_ENTITY_ID", "NOTIFICATION_SMS_ENABLED"];
  const keys = names2.map((key4) => ({ key: key4, status: env[key4]?.trim() ? "configured" : key4 === "NOTIFICATION_SMS_KEEP_IN_TOUCH_URL" || ["NOTIFICATION_SMS_STATUS_URL", "NOTIFICATION_SMS_ENTITY_ID"].includes(key4) || kit && ["NOTIFICATION_SMS_MAPPING", "NOTIFICATION_SMS_ENABLED"].includes(key4) ? "default" : "missing" }));
  let ready2 = false;
  try {
    notificationSmsConfig(env);
    ready2 = true;
  } catch {
  }
  const publicUrl2 = (value) => {
    try {
      return value ? smsUrl(value).href : "";
    } catch {
      return "";
    }
  };
  return {
    ready: ready2,
    notificationsEnabled: notificationSmsEnabled(env),
    smsProvider: kit ? "keepInTouch" : "generic",
    countryCodeFormat: ["digits", "plus"].includes(env.NOTIFICATION_SMS_COUNTRY_CODE_FORMAT || "") ? env.NOTIFICATION_SMS_COUNTRY_CODE_FORMAT : void 0,
    customApiUrl: publicUrl2(env.NOTIFICATION_SMS_URL),
    keepInTouchApiUrl: publicUrl2(env.NOTIFICATION_SMS_KEEP_IN_TOUCH_URL || KEEP_IN_TOUCH_URL),
    apiUrl: kit ? publicUrl2(env.NOTIFICATION_SMS_KEEP_IN_TOUCH_URL || KEEP_IN_TOUCH_URL) : publicUrl2(env.NOTIFICATION_SMS_URL),
    statusApiUrl: publicUrl2(env.NOTIFICATION_SMS_STATUS_URL),
    keys: keys.map((item) => {
      if (item.status === "missing" || item.status === "default") return item;
      const value = env[item.key];
      const invalid = ["NOTIFICATION_SMS_KEY", "NOTIFICATION_SMS_BEARER_TOKEN"].includes(item.key) ? value.length > 2048 || !/^[\x21-\x7e]+$/.test(value) : item.key === "NOTIFICATION_SMS_COUNTRY_CODE_FORMAT" ? !["digits", "plus"].includes(value) : item.key === "NOTIFICATION_SMS_ENABLED" ? !["true", "false"].includes(value.trim()) : item.key.endsWith("_URL") ? !publicUrl2(value) : item.key === "NOTIFICATION_SMS_MAPPING" ? (() => {
        try {
          smsMappingSchema.parse(JSON.parse(value));
          return false;
        } catch {
          return true;
        }
      })() : item.key === "NOTIFICATION_SMS_SENDER_ID" && kit ? !/^[A-Za-z0-9_-]{1,50}$/.test(value) : value.length > (item.key === "NOTIFICATION_SMS_SENDER_ID" ? 50 : 200) || /[\r\n]/.test(value);
      return invalid ? { ...item, status: "invalid" } : item;
    })
  };
}
function smsMetadataReady(cfg, meta) {
  if (cfg.provider === "keepInTouch") return /^[A-Za-z0-9_-]{1,50}$/.test(meta.senderId || cfg.senderId) && /^[A-Za-z0-9_-]{1,50}$/.test(meta.dltTemplateId || "");
  return !cfg.mapping.dltRequired || !!((meta.senderId || cfg.senderId) && (meta.dltEntityId || cfg.dltEntityId) && meta.dltTemplateId);
}
function smsPayload(cfg, to, message, meta) {
  meta = {
    senderId: meta.senderId || cfg.senderId,
    dltEntityId: meta.dltEntityId || cfg.dltEntityId,
    dltTemplateId: meta.dltTemplateId
  };
  if (cfg.provider === "keepInTouch") meta.dltEntityId = void 0;
  if (!/^\+[1-9]\d{6,14}$/.test(to) || !message || message.length > 1600 || Object.values(meta).some((v) => v && (v.length > 50 || /[\r\n]/.test(v)))) throw new Error("Invalid SMS payload");
  if (!smsMetadataReady(cfg, meta)) throw new Error("SMS template metadata required");
  if (cfg.provider === "keepInTouch") {
    const phone = parsePhoneNumberFromString(to);
    if (!phone?.isValid() || phone.number !== to) throw new Error("Invalid international SMS recipient");
    const body2 = JSON.stringify({
      countryCode: `${cfg.countryCodeFormat === "plus" ? "+" : ""}${phone.countryCallingCode}`,
      mobile: String(phone.nationalNumber),
      senderId: meta.senderId,
      message,
      apiKey: cfg.key,
      clientId: cfg.clientId,
      templateId: meta.dltTemplateId
    });
    if (Buffer.byteLength(body2) > 16384) throw new Error("SMS payload too large");
    return { body: body2, headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.bearerToken}` } };
  }
  const fields = cfg.mapping.fields;
  const values = { ...cfg.mapping.staticFields, [fields.recipient]: to, [fields.message]: message };
  if (cfg.clientId) values[fields.clientId ?? "client_id"] = cfg.clientId;
  for (const key4 of ["senderId", "dltEntityId", "dltTemplateId"]) if (meta[key4]) values[fields[key4]] = meta[key4];
  const headers = { "Content-Type": cfg.mapping.encoding === "json" ? "application/json" : "application/x-www-form-urlencoded" };
  if (cfg.mapping.authMode === "body") values[cfg.mapping.authField] = cfg.key;
  else headers[cfg.mapping.authMode === "bearer" ? "Authorization" : cfg.mapping.authField] = cfg.mapping.authMode === "bearer" ? `Bearer ${cfg.bearerToken}` : cfg.key;
  const body = cfg.mapping.encoding === "json" ? JSON.stringify(values) : new URLSearchParams(values).toString();
  if (Buffer.byteLength(body) > 16384) throw new Error("SMS payload too large");
  return { body, headers };
}
function classifySmsResponse(mapping, status, body, provider = "generic") {
  if (status >= 300 && status < 400) return "provider_rejected";
  if (!mapping.acceptedStatuses.includes(status)) return status >= 400 && status < 500 ? "provider_rejected" : "delivery_unknown";
  if (provider === "keepInTouch") {
    try {
      const result = JSON.parse(body);
      if (Object.hasOwn(result ?? {}, "Success") && Object.hasOwn(result ?? {}, "success") && result.Success !== result.success) return "delivery_unknown";
      const value = result?.Success ?? result?.success;
      return value === true ? "provider_accepted" : value === false ? "provider_rejected" : "delivery_unknown";
    } catch {
      return "delivery_unknown";
    }
  }
  if (!mapping.responseField) return "provider_accepted";
  try {
    let value = JSON.parse(body);
    for (const part of mapping.responseField.split(".")) value = value && Object.hasOwn(value, part) ? value[part] : void 0;
    if (value === void 0 || typeof value === "object") return "delivery_unknown";
    return String(value) === mapping.responseValue ? "provider_accepted" : "provider_rejected";
  } catch {
    return "delivery_unknown";
  }
}
async function sendNotificationSms(env, to, message, meta, onHttpStatus, onDiagnostic) {
  let cfg, payload2;
  let pinned;
  try {
    cfg = notificationSmsConfig(env);
    payload2 = smsPayload(cfg, to, message, meta);
    const host = cfg.url.hostname.replace(/^\[|\]$/g, "");
    const answers = await Promise.race([lookup(host, { all: true, verbatim: true }), new Promise((_, reject) => setTimeout(() => reject(new Error("DNS timeout")), 3e3).unref())]);
    if (!answers.length || answers.some((a) => !publicSmsAddress(a.address))) return "pre_dispatch_failed";
    pinned = answers[0];
  } catch {
    return "pre_dispatch_failed";
  }
  return new Promise((resolve) => {
    let dispatched = false, finished = false;
    const finish = (value) => {
      if (!finished) {
        finished = true;
        clearTimeout(timer);
        resolve(value);
      }
    };
    const req = request(cfg.url, {
      method: "POST",
      agent: false,
      headers: { ...payload2.headers, "Content-Length": Buffer.byteLength(payload2.body) },
      lookup: ((_host, options, callback) => options?.all ? callback(null, [pinned]) : callback(null, pinned.address, pinned.family))
    }, (res) => {
      if (res.statusCode) onHttpStatus?.(res.statusCode);
      let body = "", bytes = 0;
      res.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 16384) {
          finish("delivery_unknown");
          req.destroy();
        } else body += chunk.toString("utf8");
      });
      res.on("end", () => {
        if (finished) return;
        const outcome = classifySmsResponse(cfg.mapping, res.statusCode || 0, body, cfg.provider);
        if (outcome === "provider_rejected") {
          try {
            onDiagnostic?.(smsRejectionDiagnostic(res.statusCode || 0, body));
          } catch {
          }
        }
        finish(outcome);
      });
      res.on("error", () => finish("delivery_unknown"));
    });
    const timer = setTimeout(() => {
      finish(dispatched ? "delivery_unknown" : "pre_dispatch_failed");
      req.destroy();
    }, cfg.provider === "keepInTouch" ? KEEP_IN_TOUCH_REQUEST_TIMEOUT_MS : 1e4);
    req.on("socket", (socket) => socket.once("secureConnect", () => {
      dispatched = true;
    }));
    req.on("error", () => finish(dispatched ? "delivery_unknown" : "pre_dispatch_failed"));
    req.end(payload2.body);
  });
}
var KEEP_IN_TOUCH_URL, KEEP_IN_TOUCH_REQUEST_TIMEOUT_MS, keepInTouchMapping, field, smsMappingSchema, blocked, global6;
var init_notification_sms_transport = __esm({
  "artifacts/api-server/src/lib/notification-sms-transport.ts"() {
    "use strict";
    init_promises();
    init_node_https();
    init_notification_sms_diagnostics();
    KEEP_IN_TOUCH_URL = "https://api.keepintouch.life/kitversion01/api/DripMaster/SendSMS";
    KEEP_IN_TOUCH_REQUEST_TIMEOUT_MS = 3e4;
    keepInTouchMapping = {
      encoding: "json",
      authMode: "bearer",
      authField: "Authorization",
      fields: { recipient: "mobile", message: "message", senderId: "senderId", dltEntityId: "entityId", dltTemplateId: "templateId", clientId: "clientId" },
      staticFields: {},
      acceptedStatuses: [200],
      responseField: "Success",
      responseValue: "true",
      dltRequired: false
    };
    field = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,49}$/);
    smsMappingSchema = z.object({
      encoding: z.enum(["json", "form"]),
      authMode: z.enum(["header", "bearer", "body"]),
      authField: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,49}$/),
      fields: z.object({ recipient: field, message: field, senderId: field, dltEntityId: field, dltTemplateId: field, clientId: field.optional() }).strict(),
      staticFields: z.record(field, z.string().max(200)).default({}),
      acceptedStatuses: z.array(z.number().int().min(200).max(299)).min(1).max(10),
      responseField: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*){0,3}$/).max(100).optional(),
      responseValue: z.string().max(100).optional(),
      dltRequired: z.boolean()
    }).strict().superRefine((v, ctx) => {
      const names2 = [...Object.values(v.fields).filter((name) => typeof name === "string"), ...Object.keys(v.staticFields), ...v.authMode === "body" ? [v.authField] : []];
      if (new Set(names2).size !== names2.length || names2.some((n) => ["__proto__", "constructor", "prototype"].includes(n)))
        ctx.addIssue({ code: "custom", message: "Payload fields must be distinct safe identifiers" });
      if (Object.keys(v.staticFields).length > 10 || JSON.stringify(v.staticFields).length > 2e3)
        ctx.addIssue({ code: "custom", message: "At most ten non-secret static fields" });
      if (v.authMode === "body" && !/^[A-Za-z][A-Za-z0-9_]{0,49}$/.test(v.authField))
        ctx.addIssue({ code: "custom", message: "Invalid body authentication field" });
      if (v.authMode === "header" && /^(host|content-type|content-length|connection|transfer-encoding|cookie|proxy-.*|accept-encoding)$/i.test(v.authField))
        ctx.addIssue({ code: "custom", message: "Reserved authentication header" });
      if (!!v.responseField !== (v.responseValue !== void 0))
        ctx.addIssue({ code: "custom", message: "Response field and expected value must be specified together" });
    });
    blocked = new BlockList();
    for (const [ip, bits] of [["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10], ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12], ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.168.0.0", 16], ["192.88.99.0", 24], ["198.18.0.0", 15], ["198.51.100.0", 24], ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4]]) blocked.addSubnet(ip, bits, "ipv4");
    global6 = new BlockList();
    global6.addSubnet("2000::", 3, "ipv6");
    for (const [ip, bits] of [["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20]]) blocked.addSubnet(ip, bits, "ipv6");
  }
});

// lib/db/src/schema/core.ts
import { pgTable, text, jsonb, timestamp, integer, boolean, index, uniqueIndex, check, foreignKey, primaryKey } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
var id, data, created, users, clinics, branches, assignments, masters, doctors, patients, schedules, availabilityExceptions, appointments, appointmentHistory, appointmentTransitions, guestRequests, qrs, auditLogs, settings, integrationCredentials, otpChallenges, staffSessionProofs, authSessions, authChallenges, staffErasedIdentities, authRateLimits, notificationReads, patientDocuments, savedViews, staffDeletionReceipts, staffErasedAssets;
var init_core = __esm({
  "lib/db/src/schema/core.ts"() {
    "use strict";
    id = () => text("id").primaryKey();
    data = () => jsonb("data").$type().notNull().default({});
    created = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
    users = pgTable("users", {
      id: id(),
      clerkId: text("clerk_id").unique(),
      email: text("email").notNull().unique(),
      passwordHash: text("password_hash"),
      emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
      passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
      fullName: text("full_name").notNull(),
      mobile: text("mobile"),
      role: text("role").notNull(),
      managingAdminId: text("managing_admin_id").references(() => users.id),
      invitationStatus: text("invitation_status").notNull().default("failed"),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [
      index("user_managing_admin_idx").on(t.managingAdminId),
      check("users_role", sql`${t.role} in ('superAdmin','clinicAdmin','doctor','receptionist','patient')`),
      check("users_managing_admin_role", sql`${t.managingAdminId} is null or ${t.role} = 'receptionist'`),
      check("users_invitation_status", sql`${t.invitationStatus} in ('sent','failed','notRequired')`)
    ]);
    clinics = pgTable("clinics", {
      id: id(),
      ownerId: text("owner_id").references(() => users.id),
      adminId: text("admin_id").notNull().references(() => users.id),
      // Display preferences belong to the parent, in the existing settings document.
      // Keeping these additive JSON fields avoids missing-column failures before migration.
      status: text("status").notNull().default("active"),
      data: jsonb("data").$type().notNull().default({}),
      createdAt: created()
    }, (t) => [index("clinic_owner_idx").on(t.ownerId), index("clinic_admin_idx").on(t.adminId), uniqueIndex("clinic_name_unique").on(sql`lower(${t.data}->>'name')`), uniqueIndex("clinic_slug_unique").on(sql`(${t.data}->>'slug')`)]);
    branches = pgTable("branches", {
      // data.scheduleDayOverrides is server-owned doctor/weekday intent, including days with no sessions.
      id: id(),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [
      index("branch_clinic_idx").on(t.clinicId),
      uniqueIndex("branch_id_clinic_unique").on(t.id, t.clinicId),
      uniqueIndex("branch_name_clinic_unique").on(t.clinicId, sql`lower(${t.data}->>'name')`),
      uniqueIndex("branch_slug_clinic_unique").on(t.clinicId, sql`(${t.data}->>'slug')`)
    ]);
    assignments = pgTable("assignments", {
      id: id(),
      userId: text("user_id").notNull().references(() => users.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id)
    }, (t) => [
      index("assignment_user_idx").on(t.userId),
      index("assignment_scope_idx").on(t.clinicId, t.branchId),
      uniqueIndex("assignment_user_clinic_only_unique").on(t.userId, t.clinicId).where(sql`${t.branchId} is null`),
      uniqueIndex("assignment_user_branch_unique").on(t.userId, t.branchId).where(sql`${t.branchId} is not null`),
      foreignKey({ columns: [t.branchId, t.clinicId], foreignColumns: [branches.id, branches.clinicId], name: "assignment_branch_clinic_fk" })
    ]);
    masters = pgTable("masters", {
      id: id(),
      category: text("category").notNull(),
      code: text("code").notNull(),
      parentId: text("parent_id").references(() => masters.id),
      status: text("status").notNull().default("active"),
      data: data()
    }, (t) => [uniqueIndex("master_category_code").on(t.category, t.code)]);
    doctors = pgTable("doctors", {
      id: id(),
      userId: text("user_id").unique().references(() => users.id),
      ownerAdminId: text("owner_admin_id").references(() => users.id),
      specializationId: text("specialization_id").references(() => masters.id),
      status: text("status").notNull().default("active"),
      data: data(),
      retiredAt: timestamp("retired_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    }, (t) => [
      index("doctor_owner_admin_idx").on(t.ownerAdminId),
      check("doctor_retired_identity", sql`(${t.status} = 'retired' and ${t.userId} is null and ${t.ownerAdminId} is null and ${t.retiredAt} is not null) or (${t.status} <> 'retired' and ${t.userId} is not null and ${t.ownerAdminId} is not null and ${t.retiredAt} is null)`)
    ]);
    patients = pgTable("patients", {
      id: id(),
      userId: text("user_id").unique().references(() => users.id),
      clinicId: text("clinic_id").references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id),
      mobile: text("mobile"),
      mobileVerified: boolean("mobile_verified").notNull().default(false),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [index("patient_scope_idx").on(t.clinicId, t.branchId), index("patient_mobile_idx").on(t.mobile)]);
    schedules = pgTable("schedules", {
      id: id(),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      dayOfWeek: integer("day_of_week").notNull(),
      status: text("status").notNull().default("active"),
      data: data()
    }, (t) => [
      index("schedule_lookup_idx").on(t.doctorId, t.branchId, t.dayOfWeek),
      uniqueIndex("schedule_active_location_day_unique").on(t.doctorId, t.branchId, t.dayOfWeek, sql`(${t.data}->>'startTime')`).where(sql`${t.status} = 'active'`),
      check("schedule_weekday", sql`${t.dayOfWeek} between 0 and 6`)
    ]);
    availabilityExceptions = pgTable("availability_exceptions", {
      id: id(),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      date: text("date").notNull(),
      status: text("status").notNull().default("active"),
      data: data()
    }, (t) => [uniqueIndex("exception_date_idx").on(t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'sessionId','')`)]);
    appointments = pgTable("appointments", {
      id: id(),
      patientId: text("patient_id").notNull().references(() => patients.id),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      date: text("date").notNull(),
      tokenNumber: integer("token_number").notNull(),
      status: text("status").notNull().default("booked"),
      requestId: text("request_id"),
      actorId: text("actor_id").references(() => users.id),
      deletedActor: boolean("deleted_actor").notNull().default(false),
      data: data(),
      createdAt: created()
    }, (t) => [
      uniqueIndex("appointment_token_idx").on(t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'startTime','')`, t.tokenNumber),
      uniqueIndex("appointment_request_idx").on(t.actorId, t.requestId),
      uniqueIndex("appointment_reference_idx").on(sql`(${t.data}->>'reference')`),
      index("appointment_patient_idx").on(t.patientId),
      index("appointment_scope_idx").on(t.clinicId, t.branchId, t.date),
      uniqueIndex("appointment_active_patient_idx").on(t.patientId, t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'startTime','')`).where(sql`${t.status} not in ('cancelled','completed','noShow')`),
      uniqueIndex("appointment_one_consult_idx").on(t.doctorId, t.branchId, t.date, sql`coalesce(${t.data}->>'startTime','')`).where(sql`${t.status} in ('called','inConsultation')`),
      check("appointment_status_check", sql`${t.status} in ('booked','checkedIn','waiting','called','inConsultation','completed','noShow','cancelled')`),
      check("appointment_token_positive", sql`${t.tokenNumber} > 0`),
      check("appointment_anonymous_actor", sql`(${t.actorId} is not null and not ${t.deletedActor}) or (${t.actorId} is null and ${t.deletedActor})`)
    ]);
    appointmentHistory = pgTable("appointment_history", {
      id: id(),
      appointmentId: text("appointment_id").notNull().references(() => appointments.id),
      actorId: text("actor_id").references(() => users.id),
      deletedActor: boolean("deleted_actor").notNull().default(false),
      fromStatus: text("from_status"),
      toStatus: text("to_status").notNull(),
      createdAt: created()
    }, (t) => [
      index("history_appointment_idx").on(t.appointmentId),
      check("history_anonymous_actor", sql`(${t.actorId} is not null and not ${t.deletedActor}) or (${t.actorId} is null and ${t.deletedActor})`)
    ]);
    appointmentTransitions = pgTable("appointment_transitions", {
      id: id(),
      operationId: text("operation_id").notNull(),
      appointmentId: text("appointment_id").notNull().references(() => appointments.id),
      patientId: text("patient_id").notNull().references(() => patients.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      actorId: text("actor_id").references(() => users.id),
      deletedActor: boolean("deleted_actor").notNull().default(false),
      fromDoctorId: text("from_doctor_id").notNull().references(() => doctors.id),
      toDoctorId: text("to_doctor_id").notNull().references(() => doctors.id),
      fromBranchId: text("from_branch_id").notNull().references(() => branches.id),
      toBranchId: text("to_branch_id").notNull().references(() => branches.id),
      beforeCoordinates: jsonb("before_coordinates").$type().notNull(),
      afterCoordinates: jsonb("after_coordinates").$type().notNull(),
      referenceFingerprint: text("reference_fingerprint").notNull(),
      fromRevision: integer("from_revision").notNull(),
      toRevision: integer("to_revision").notNull(),
      createdAt: created()
    }, (t) => [
      uniqueIndex("transition_operation_visit").on(t.operationId, t.appointmentId),
      uniqueIndex("transition_visit_revision").on(t.appointmentId, t.toRevision),
      index("transition_visit_idx").on(t.appointmentId),
      check("transition_anonymous_actor", sql`(${t.actorId} is not null and not ${t.deletedActor}) or (${t.actorId} is null and ${t.deletedActor})`),
      check("transition_reference_fingerprint", sql`${t.referenceFingerprint} ~ '^[a-f0-9]{64}$'`),
      check("transition_revision", sql`${t.fromRevision} >= 0 and ${t.toRevision} = ${t.fromRevision} + 1`),
      check("transition_doctor_change", sql`${t.fromDoctorId} <> ${t.toDoctorId}`),
      check("transition_coordinates", sql`jsonb_typeof(${t.beforeCoordinates}) = 'object' and jsonb_typeof(${t.afterCoordinates}) = 'object'
    and ${t.beforeCoordinates} - ARRAY['date','sessionId','startTime','endTime','timezone','token','tokenNumber','expectedDurationMinutes']::text[] = '{}'::jsonb
    and ${t.afterCoordinates} - ARRAY['date','sessionId','startTime','endTime','timezone','token','tokenNumber','expectedDurationMinutes']::text[] = '{}'::jsonb`)
    ]);
    guestRequests = pgTable("guest_requests", {
      id: id(),
      requestId: text("request_id").notNull().unique(),
      receiptHash: text("receipt_hash").notNull().unique(),
      inputHash: text("input_hash").notNull(),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").notNull().references(() => branches.id),
      doctorId: text("doctor_id").notNull().references(() => doctors.id),
      date: text("date").notNull(),
      status: text("status").notNull().default("pending"),
      appointmentId: text("appointment_id").unique().references(() => appointments.id),
      decidedBy: text("decided_by").references(() => users.id),
      deletedDecider: boolean("deleted_decider").notNull().default(false),
      data: data(),
      createdAt: created()
    }, (t) => [
      index("guest_request_scope_idx").on(t.clinicId, t.branchId, t.status),
      check("guest_request_status", sql`${t.status} in ('pending','confirmed','rejected')`),
      check("guest_anonymous_decider", sql`not ${t.deletedDecider} or ${t.decidedBy} is null`)
    ]);
    qrs = pgTable("qrs", {
      id: id(),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id),
      doctorId: text("doctor_id").references(() => doctors.id),
      publicReference: text("public_reference").notNull().unique(),
      status: text("status").notNull().default("active"),
      data: data(),
      createdAt: created()
    }, (t) => [index("qr_scope_idx").on(t.clinicId, t.branchId)]);
    auditLogs = pgTable("audit_logs", {
      id: id(),
      actorId: text("actor_id").references(() => users.id),
      clinicId: text("clinic_id").references(() => clinics.id),
      branchId: text("branch_id").references(() => branches.id),
      deletedActor: boolean("deleted_actor").notNull().default(false),
      action: text("action").notNull(),
      entityType: text("entity_type").notNull(),
      entityId: text("entity_id").notNull(),
      summary: text("summary").notNull(),
      createdAt: created()
    }, (t) => [
      index("audit_scope_idx").on(t.clinicId, t.branchId, t.createdAt),
      check("audit_anonymous_actor", sql`not ${t.deletedActor} or ${t.actorId} is null`)
    ]);
    settings = pgTable("settings", { id: id(), data: data() }, (t) => [
      // Must match the owner-history predicate and numeric timestamp/null ordering exactly.
      index("settings_owner_booking_history_idx").on(
        sql`(${t.data}->>'clinicId')`,
        sql`((${t.data}->>'createdAt')::bigint) desc nulls last`,
        t.id.desc().nullsFirst()
      ).where(sql`${t.id} like 'mail-outbox:booking:%' and ${t.data}->>'event' = 'booking' and ${t.data}->>'recipientGroup' = 'clinicAdmin'`),
      index("settings_notification_history_page_idx").on(sql`((${t.data}->>'createdAt')::bigint) desc`, t.id.desc().nullsFirst()).where(sql`${t.id} like 'notification-history:%'`),
      index("settings_notification_history_scope_idx").on(sql`(${t.data}->>'clinicId')`, sql`(${t.data}->>'channel')`, sql`((${t.data}->>'createdAt')::bigint) desc`, t.id.desc().nullsFirst()).where(sql`${t.id} like 'notification-history:%'`),
      index("settings_notification_history_recipient_idx").on(sql`(${t.data}->>'recipientHash')`, sql`((${t.data}->>'createdAt')::bigint) desc`, t.id.desc().nullsFirst()).where(sql`${t.id} like 'notification-history:%'`),
      index("settings_notification_history_sender_idx").on(sql`(${t.data}->>'senderHash')`, sql`((${t.data}->>'createdAt')::bigint) desc`, t.id.desc().nullsFirst()).where(sql`${t.id} like 'notification-history:%'`),
      index("settings_legacy_notification_time_idx").on(sql`((${t.data}->>'createdAt')::bigint) desc`, t.id.desc().nullsFirst()).where(sql`${t.id} like 'mail-outbox:%' or ${t.id} like 'sms-outbox:%'`)
    ]);
    integrationCredentials = pgTable("integration_credentials", {
      provider: text("provider").primaryKey(),
      encrypted: text("encrypted").notNull(),
      revision: text("revision").notNull()
    });
    otpChallenges = pgTable("otp_challenges", {
      id: id(),
      userId: text("user_id").notNull().references(() => users.id),
      mobile: text("mobile").notNull(),
      codeHash: text("code_hash").notNull(),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      attempts: integer("attempts").notNull().default(0),
      consumedAt: timestamp("consumed_at", { withTimezone: true }),
      createdAt: created()
    }, (t) => [index("otp_user_idx").on(t.userId, t.createdAt)]);
    staffSessionProofs = pgTable("staff_session_proofs", {
      sessionId: text("session_id").primaryKey(),
      clerkUserId: text("clerk_user_id").notNull(),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      createdAt: created()
    }, (t) => [
      index("staff_session_proof_user_idx").on(t.clerkUserId),
      index("staff_session_proof_expiry_idx").on(t.expiresAt)
    ]);
    authSessions = pgTable("auth_sessions", {
      tokenHash: text("token_hash").primaryKey(),
      userId: text("user_id").notNull().references(() => users.id),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      revokedAt: timestamp("revoked_at", { withTimezone: true }),
      createdAt: created()
    }, (t) => [index("auth_session_user_idx").on(t.userId), index("auth_session_expiry_idx").on(t.expiresAt)]);
    authChallenges = pgTable("auth_challenges", {
      id: id(),
      userId: text("user_id").references(() => users.id),
      email: text("email").notNull(),
      purpose: text("purpose").notNull(),
      tokenHash: text("token_hash").notNull(),
      data: data(),
      attempts: integer("attempts").notNull().default(0),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      consumedAt: timestamp("consumed_at", { withTimezone: true }),
      createdAt: created()
    }, (t) => [index("auth_challenge_email_idx").on(t.email, t.purpose), index("auth_challenge_expiry_idx").on(t.expiresAt)]);
    staffErasedIdentities = pgTable("staff_erased_identities", {
      identityFingerprint: text("identity_fingerprint").primaryKey(),
      operationId: text("operation_id").notNull().references(() => staffDeletionReceipts.id),
      createdAt: created()
    }, (t) => [check("staff_erased_identities_fingerprint", sql`${t.identityFingerprint} ~ '^[a-f0-9]{64}$'`)]);
    authRateLimits = pgTable("auth_rate_limits", {
      key: text("key").primaryKey(),
      attempts: integer("attempts").notNull().default(0),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull()
    }, (t) => [index("auth_rate_limit_expiry_idx").on(t.expiresAt)]);
    notificationReads = pgTable("notification_reads", {
      userId: text("user_id").notNull().references(() => users.id),
      notificationId: text("notification_id").notNull(),
      readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow()
    }, (t) => [primaryKey({ columns: [t.userId, t.notificationId] })]);
    patientDocuments = pgTable("patient_documents", {
      id: id(),
      patientId: text("patient_id").notNull().references(() => patients.id),
      clinicId: text("clinic_id").notNull().references(() => clinics.id),
      uploadedBy: text("uploaded_by").references(() => users.id),
      deletedUploader: boolean("deleted_uploader").notNull().default(false),
      name: text("name").notNull(),
      contentType: text("content_type").notNull(),
      size: integer("size").notNull(),
      provider: text("provider").notNull(),
      storageKey: text("storage_key").notNull(),
      status: text("status").notNull().default("active"),
      createdAt: created(),
      deletedAt: timestamp("deleted_at", { withTimezone: true })
    }, (t) => [
      index("patient_document_patient_idx").on(t.patientId, t.clinicId),
      check("document_anonymous_uploader", sql`(${t.uploadedBy} is not null and not ${t.deletedUploader}) or (${t.uploadedBy} is null and ${t.deletedUploader})`)
    ]);
    savedViews = pgTable("saved_views", {
      id: id(),
      userId: text("user_id").references(() => users.id),
      deletedOwner: boolean("deleted_owner").notNull().default(false),
      tableKey: text("table_key").notNull(),
      name: text("name").notNull(),
      data: data(),
      sharedRole: text("shared_role"),
      clinicIds: jsonb("clinic_ids").$type().notNull().default([]),
      createdAt: created()
    }, (t) => [
      index("saved_view_owner_idx").on(t.userId, t.tableKey),
      index("saved_view_shared_idx").on(t.sharedRole, t.tableKey),
      check("saved_views_retired_owner", sql`${t.userId} is not null or (${t.sharedRole} is not null and ${t.deletedOwner})`)
    ]);
    staffDeletionReceipts = pgTable("staff_deletion_receipts", {
      id: id(),
      accountFingerprint: text("account_fingerprint").notNull().unique(),
      reviewHash: text("review_hash").notNull(),
      state: text("state").notNull(),
      encryptedJobs: text("encrypted_jobs"),
      fileCount: integer("file_count").notNull(),
      verifiedCount: integer("verified_count").notNull().default(0),
      createdAt: created(),
      completedAt: timestamp("completed_at", { withTimezone: true })
    }, (t) => [
      check("staff_receipt_fingerprints", sql`${t.accountFingerprint} ~ '^[a-f0-9]{64}$' and ${t.reviewHash} ~ '^[a-f0-9]{64}$'`),
      check("staff_receipt_progress", sql`${t.fileCount} >= 0 and ${t.verifiedCount} >= 0 and ${t.verifiedCount} <= ${t.fileCount}`),
      check("staff_receipt_state", sql`(${t.state} = 'complete' and ${t.verifiedCount} = ${t.fileCount} and ${t.completedAt} is not null and ${t.encryptedJobs} is null)
    or (${t.state} = 'cleanup_pending' and ${t.verifiedCount} < ${t.fileCount} and ${t.completedAt} is null and ${t.encryptedJobs} is not null)`)
    ]);
    staffErasedAssets = pgTable("staff_erased_assets", {
      assetFingerprint: text("asset_fingerprint").primaryKey(),
      operationId: text("operation_id").notNull().references(() => staffDeletionReceipts.id),
      createdAt: created()
    }, (t) => [check("staff_erased_asset_fingerprint", sql`${t.assetFingerprint} ~ '^[a-f0-9]{64}$'`)]);
  }
});

// fixture:db
var db;
var init_db = __esm({
  "fixture:db"() {
    init_core();
    db = globalThis.notificationSettingsDb;
  }
});

// artifacts/api-server/src/lib/http.ts
import { ZodError } from "zod";
function assert(value, status, message) {
  if (!value) throw new HttpError(status, message);
}
function parse(schema, value) {
  validateDates(value);
  if (value?.mobile) assert(/^\+[1-9][0-9]{7,14}$/.test(value.mobile), 400, "Mobile must use international format, for example +919876543210");
  return normalizeDates(schema.parse(value));
}
function validateDates(value) {
  for (const key4 of ["date", "from", "to", "dateOfBirth"]) {
    if (value?.[key4] !== void 0) {
      const v = value[key4];
      if (key4 === "dateOfBirth" && v === null) continue;
      assert(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v, 400, `Invalid ${key4}; expected YYYY-MM-DD`);
    }
  }
}
function normalizeDates(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (Array.isArray(value)) return value.map(normalizeDates);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalizeDates(v)]));
  return value;
}
function query(schema, req) {
  const q = { ...req.query };
  validateDates(q);
  for (const k of ["date", "from", "to"]) if (q[k] !== void 0) q[k] = new Date(q[k]);
  for (const k of ["page", "pageSize", "dayOfWeek", "weekday"]) if (q[k] !== void 0) q[k] = Number(q[k]);
  if (q.linkedOnly !== void 0) {
    assert(["true", "false"].includes(String(q.linkedOnly)), 400, "linkedOnly must be true or false");
    q.linkedOnly = String(q.linkedOnly) === "true";
  }
  const result = normalizeDates(schema.parse(q));
  if (result.from && result.to) assert(result.from <= result.to, 400, "Start date must be on or before end date");
  for (const [key4, value] of Object.entries(result)) assert(value !== "undefined", 400, `${key4} is required`);
  return result;
}
var HttpError;
var init_http = __esm({
  "artifacts/api-server/src/lib/http.ts"() {
    "use strict";
    HttpError = class extends Error {
      constructor(status, message, code = "REQUEST_FAILED") {
        super(message);
        this.status = status;
        this.code = code;
      }
      status;
      code;
    };
  }
});

// artifacts/api-server/src/lib/integration-config.ts
function smtpEnvironment(env = process.env) {
  return Object.fromEntries(smtpFields.map((name) => [name, env[name]]));
}
function validEmailAddress(value) {
  return value.length <= 254 && emailAddressPattern.test(value);
}
function key(env, name, valid = () => true, optional = false) {
  const value = env[name];
  return { key: name, status: !value?.trim() ? optional ? "default" : "missing" : valid(value) ? "configured" : "invalid" };
}
function smtpKeys(env) {
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : Number(env.SMTP_PORT) === 465;
  return [
    key(env, "SMTP_HOST", (value) => /^[a-z0-9.-]+$/i.test(value)),
    key(env, "SMTP_PORT", (value) => /^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 65535),
    key(env, "SMTP_USER", (value) => !/[\r\n]/.test(value)),
    key(env, "SMTP_PASSWORD"),
    key(env, "SMTP_FROM", (value) => {
      const address = value.match(/^[^<>\r\n]+<([^<>]+)>$/)?.[1] ?? value;
      return validEmailAddress(address);
    }),
    key(env, "SMTP_SECURE", (value) => /^(true|false)$/.test(value), true),
    key(env, "SMTP_REQUIRE_TLS", (value) => value === "true" || value === "false" && secure, true),
    key(env, "SMTP_FROM_NAME", (value) => value.length <= 150 && !/[\x00-\x1f\x7f<>]/.test(value), true),
    key(env, "SMTP_NOTIFICATIONS_ENABLED", (value) => /^(true|false)$/.test(value), true)
  ];
}
function emailNotificationsEnabled(env = smtpEnvironment()) {
  const value = env.SMTP_NOTIFICATIONS_ENABLED?.trim();
  return !value || value === "true";
}
function smtpSender(env) {
  const original = env.SMTP_FROM || "";
  const match = original.match(/^([^<>\r\n]+)<([^<>]+)>$/);
  const address = match?.[2] ?? original;
  let inherited = match?.[1].trim() ?? "";
  if (inherited.startsWith('"') && inherited.endsWith('"')) {
    try {
      inherited = JSON.parse(inherited);
    } catch {
    }
  }
  const name = env.SMTP_FROM_NAME !== void 0 ? env.SMTP_FROM_NAME.trim() : inherited;
  return { address, name, from: env.SMTP_FROM_NAME === void 0 ? original : name ? `${JSON.stringify(name)} <${address}>` : address };
}
function integrationReadiness(env = { ...process.env, ...smtpEnvironment() }) {
  const smtp = smtpKeys(env);
  const sms = [
    key(env, "OTP_PROVIDER", (value) => value === "twilio" || value === "development" && env.NODE_ENV === "development"),
    key(env, "TWILIO_ACCOUNT_SID", (value) => /^AC[a-f0-9]{32}$/i.test(value)),
    key(env, "TWILIO_MESSAGING_SERVICE_SID", (value) => /^MG[a-f0-9]{32}$/i.test(value)),
    key(env, "TWILIO_AUTH_TOKEN", (value) => /^[a-f0-9]{32}$/i.test(value))
  ];
  const sender = smtpSender(env);
  const secure = env.SMTP_SECURE ? env.SMTP_SECURE === "true" : Number(env.SMTP_PORT) === 465;
  return {
    smtp: {
      ready: ready(smtp),
      keys: smtp,
      notificationsEnabled: emailNotificationsEnabled(env),
      smtpHost: smtp.find((k) => k.key === "SMTP_HOST")?.status === "configured" ? env.SMTP_HOST : "",
      smtpPort: smtp.find((k) => k.key === "SMTP_PORT")?.status === "configured" ? Number(env.SMTP_PORT) : 587,
      fromEmail: smtp.find((k) => k.key === "SMTP_FROM")?.status === "configured" ? sender.address : "",
      fromName: smtp.find((k) => k.key === "SMTP_FROM")?.status === "configured" && smtp.find((k) => k.key === "SMTP_FROM_NAME")?.status !== "invalid" ? sender.name : "",
      useSsl: secure,
      useTls: !secure && env.SMTP_REQUIRE_TLS !== "false"
    },
    sms: { ready: ready(sms), keys: sms }
  };
}
function smtpConfig(env = smtpEnvironment()) {
  if (!ready(smtpKeys(env).filter((item) => item.key !== "SMTP_NOTIFICATIONS_ENABLED"))) throw new HttpError(503, "Email delivery is not configured", "EMAIL_UNCONFIGURED");
  const port = Number(env.SMTP_PORT);
  return {
    host: env.SMTP_HOST,
    port,
    user: env.SMTP_USER,
    password: env.SMTP_PASSWORD,
    from: smtpSender(env).from,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === "true" : port === 465,
    requireTLS: env.SMTP_REQUIRE_TLS !== "false"
  };
}
function smtpTransportOptions(cfg) {
  return {
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    requireTLS: !cfg.secure && cfg.requireTLS,
    auth: { user: cfg.user, pass: cfg.password },
    connectionTimeout: 1e4,
    greetingTimeout: 1e4,
    socketTimeout: 2e4,
    logger: false,
    debug: false,
    disableFileAccess: true,
    disableUrlAccess: true
  };
}
var smtpFields, emailAddressPattern, ready;
var init_integration_config = __esm({
  "artifacts/api-server/src/lib/integration-config.ts"() {
    "use strict";
    init_http();
    smtpFields = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM", "SMTP_SECURE", "SMTP_REQUIRE_TLS", "SMTP_FROM_NAME", "SMTP_NOTIFICATIONS_ENABLED"];
    emailAddressPattern = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
    ready = (keys) => keys.every((item) => item.status === "configured" || item.status === "default");
  }
});

// artifacts/api-server/src/lib/erased-asset-guard.ts
import { sql as sql2 } from "drizzle-orm";
async function assertNoErasedAssetReference(conn, value) {
  const exists = await conn.execute(sql2`select to_regclass('public.staff_erased_assets') is not null as present`);
  if (!exists.rows[0]?.present) return;
  const result = await conn.execute(sql2`select 1 from staff_erased_assets f
    join clinicflow_asset_alias_fingerprints(${JSON.stringify(value) ?? ""}) a on a=f.asset_fingerprint limit 1`);
  assert(!result.rows.length, 409, "An erased asset cannot be referenced or recreated");
  const identities = await conn.execute(sql2`select to_regclass('public.staff_erased_identities') is not null as present`);
  if (identities.rows[0]?.present) {
    const erased = await conn.execute(sql2`select 1 from staff_erased_identities f
      join clinicflow_json_identity_tokens(${JSON.stringify(value) ?? "null"}::jsonb) token
      on f.identity_fingerprint=encode(sha256(convert_to(token,'UTF8')),'hex') limit 1`);
    assert(!erased.rows.length, 409, "A removed staff identity cannot be restored");
  }
}
var init_erased_asset_guard = __esm({
  "artifacts/api-server/src/lib/erased-asset-guard.ts"() {
    "use strict";
    init_http();
  }
});

// artifacts/api-server/src/lib/demo-policy.ts
var DEMO_FIXTURE, DEMO_LOGIN_WINDOW_MS;
var init_demo_policy = __esm({
  "artifacts/api-server/src/lib/demo-policy.ts"() {
    "use strict";
    DEMO_FIXTURE = "clinicflow:published-demo";
    DEMO_LOGIN_WINDOW_MS = 10 * 6e4;
  }
});

// artifacts/api-server/src/lib/logger.ts
import pino from "pino";
var isProduction, logger;
var init_logger = __esm({
  "artifacts/api-server/src/lib/logger.ts"() {
    "use strict";
    isProduction = process.env.NODE_ENV === "production";
    logger = pino({
      level: process.env.LOG_LEVEL ?? "info",
      redact: [
        "req.headers.authorization",
        "req.headers.cookie",
        "req.body.password",
        "req.body.confirmPassword",
        "req.body.admin.password",
        "req.body.admin.confirmPassword",
        "req.body.currentPassword",
        "req.body.receiptSecret",
        "req.body.capability",
        "res.body.url",
        "capability",
        "liveTicketUrl",
        "req.body.values",
        "currentPassword",
        "encrypted",
        "password",
        "res.headers['set-cookie']"
      ],
      ...isProduction ? {} : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true }
        }
      }
    });
  }
});

// artifacts/api-server/src/lib/notification-staff-subjects.ts
import { sql as sql3 } from "drizzle-orm";
async function notificationStaffSubjects(conn, data2) {
  const ids = /* @__PURE__ */ new Set();
  if (data2.recipientUserId && data2.recipientGroup !== "patient") ids.add(data2.recipientUserId);
  for (const row of [data2.snapshot || {}, data2.previousSession || {}]) {
    if (row.actorId) {
      const result = await conn.execute(sql3`select role from users where id=${row.actorId}`);
      if (!result.rows[0] || result.rows[0].role !== "patient") ids.add(row.actorId);
    }
    if (row.doctorId) {
      const result = await conn.execute(sql3`select user_id,status from doctors where id=${row.doctorId}`);
      const doctor = result.rows[0];
      assert(doctor, 409, "Notification doctor reference is no longer available");
      if (doctor.user_id) ids.add(doctor.user_id);
      else assert(doctor.status === "retired" && row.doctorName === "Deleted doctor", 409, "Notification requires anonymous historical doctor details");
    }
  }
  return [...ids].sort();
}
var init_notification_staff_subjects = __esm({
  "artifacts/api-server/src/lib/notification-staff-subjects.ts"() {
    "use strict";
    init_http();
  }
});

// artifacts/api-server/src/lib/notification-history-provenance.ts
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
function signingKey() {
  const value = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!value || !/^[a-f0-9]{64}$/i.test(value)) throw new Error("History provenance unavailable");
  return Buffer.from(value, "hex");
}
function payload(id2, data2, subjects) {
  const canonical = (value) => {
    if (value instanceof Date) return JSON.stringify(value.toISOString());
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object") return "{" + Object.keys(value).filter((k) => value[k] !== void 0).sort().map((k) => JSON.stringify(k) + ":" + canonical(value[k])).join(",") + "}";
    return JSON.stringify(value) ?? "null";
  };
  const { provenance: _proof, ...record2 } = data2;
  return JSON.stringify({
    version: 2,
    id: id2,
    subjects,
    // Bind all metadata, not only selected coordinates. Otherwise a late writer
    // could append private fields to an unrelated entry without invalidating it.
    recordDigest: digest(canonical(record2)),
    channel: data2.channel,
    event: data2.event,
    source: data2.source,
    clinicId: data2.clinicId ?? null,
    recipientGroup: data2.recipientGroup,
    referenceDigest: typeof data2.reference === "string" ? digest(data2.reference) : null,
    createdAt: data2.createdAt,
    senderHash: data2.senderHash ?? null,
    recipientHash: data2.recipientHash ?? null,
    envelopeDigests: [
      ...typeof data2.encrypted === "string" ? [digest(data2.encrypted)] : [],
      ...(data2.snapshots ?? []).map((s) => {
        if (typeof s.encrypted !== "string") throw new Error("Invalid historical envelope");
        return digest(s.encrypted);
      })
    ]
  });
}
function signHistorySubjects(id2, data2, subjects, priorSubjects = []) {
  const fingerprints = [.../* @__PURE__ */ new Set([...priorSubjects, ...subjects.map(accountSubjectFingerprint)])].sort();
  return {
    version: 2,
    subjects: fingerprints,
    mac: createHmac("sha256", signingKey()).update(payload(id2, data2, fingerprints)).digest("hex")
  };
}
function verifyHistorySubjects(id2, data2) {
  try {
    const proof = data2.provenance;
    if (proof?.version !== 2 || !Array.isArray(proof.subjects) || !proof.subjects.every((v) => typeof v === "string" && /^[a-f0-9]{64}$/.test(v)) || typeof proof.mac !== "string" || !/^[a-f0-9]{64}$/.test(proof.mac)) return null;
    const sorted = [...new Set(proof.subjects)].sort();
    if (JSON.stringify(sorted) !== JSON.stringify(proof.subjects)) return null;
    const expected = createHmac("sha256", signingKey()).update(payload(id2, data2, sorted)).digest();
    return timingSafeEqual(expected, Buffer.from(proof.mac, "hex")) ? sorted : null;
  } catch {
    return null;
  }
}
var accountSubjectFingerprint, digest;
var init_notification_history_provenance = __esm({
  "artifacts/api-server/src/lib/notification-history-provenance.ts"() {
    "use strict";
    accountSubjectFingerprint = (id2) => createHash("sha256").update(id2).digest("hex");
    digest = (value) => createHash("sha256").update(value).digest("hex");
  }
});

// artifacts/api-server/src/lib/notification-explicit-subjects.ts
import { sql as sql4 } from "drizzle-orm";
import { parsePhoneNumberFromString as parsePhoneNumberFromString2 } from "libphonenumber-js";
async function explicitNotificationSubjects(conn, channel, recipient) {
  if (!recipient) return [];
  if (channel === "email") {
    const result = await conn.execute(sql4`select id from users where role<>'patient'
      and lower(trim(email))=lower(trim(${recipient}))`);
    return result.rows.map((r) => r.id);
  }
  const phone = parsePhoneNumberFromString2(recipient, "IN");
  if (!phone?.isValid()) throw new Error("Explicit notification destination is invalid");
  const candidates = await conn.execute(sql4`select id,mobile,data from users where role<>'patient'
    and regexp_replace(coalesce(mobile,data->>'mobile',''),'[^0-9]','','g')
      in (${phone.number.slice(1)},${phone.nationalNumber})`);
  return candidates.rows.filter((r) => {
    const raw2 = String(r.mobile || r.data?.mobile || "").trim();
    const country = String(r.data?.countryCode || "");
    const input = raw2.startsWith("+") ? raw2 : /^\+?[1-9][0-9]{0,3}$/.test(country) ? "+" + country.replace("+", "") + raw2.replace(/\D/g, "") : raw2;
    const candidate = parsePhoneNumberFromString2(input, "IN");
    return candidate?.isValid() && candidate.number === phone.number;
  }).map((r) => r.id);
}
var init_notification_explicit_subjects = __esm({
  "artifacts/api-server/src/lib/notification-explicit-subjects.ts"() {
    "use strict";
  }
});

// artifacts/api-server/src/lib/notification-history.ts
var notification_history_exports = {};
__export(notification_history_exports, {
  authorizeNotificationHistory: () => authorizeNotificationHistory,
  claimNotificationOccurrence: () => claimNotificationOccurrence,
  cleanupNotificationHistory: () => cleanupNotificationHistory,
  getNotificationLog: () => getNotificationLog,
  historyAssetSnapshots: () => historyAssetSnapshots,
  historyId: () => historyId,
  historyRecords: () => historyRecords,
  listNotificationLogs: () => listNotificationLogs,
  notificationEntry: () => notificationEntry,
  projection: () => projection,
  recordDecision: () => recordDecision,
  recordNotification: () => recordNotification,
  safeNotificationText: () => safeNotificationText,
  templateSnapshot: () => templateSnapshot
});
import { createCipheriv, createDecipheriv, createHmac as createHmac2, randomBytes, createHash as createHash2 } from "node:crypto";
import { eq, sql as sql5 } from "drizzle-orm";
import { z as z2 } from "zod";
function key2() {
  const raw2 = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw2 || !/^[a-f0-9]{64}$/i.test(raw2)) throw new Error("History encryption unavailable");
  return Buffer.from(raw2, "hex");
}
function safeNotificationText(value) {
  return value.replace(/https?:\/\/[^\s<>"']+/gi, "[link withheld]").replace(/\/(?:book|ticket|check-in|checkin|appointments\/verify)\/[^\s<>"']+/gi, "[private link withheld]").replace(/\b(?:token|apiKey|authorization|bearer|password|secret)\s*[:=]\s*[^\s]+/gi, "[protected value withheld]").slice(0, 24e3);
}
function protect(id2, value, secrets) {
  const clean = { ...value };
  for (const field2 of ["subject", "message", "sender", "recipient", "dltTemplateId", "templateId", "provider"]) {
    if (clean[field2] !== void 0) {
      let text2 = String(clean[field2]);
      for (const secret of secrets.filter(Boolean)) text2 = text2.split(secret).join("[credential withheld]");
      clean[field2] = safeNotificationText(text2);
    }
  }
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key2(), nonce);
  cipher.setAAD(Buffer.from(id2));
  const bytes = Buffer.concat([cipher.update(JSON.stringify(clean)), cipher.final()]);
  return [nonce.toString("base64"), cipher.getAuthTag().toString("base64"), bytes.toString("base64")].join(".");
}
function reveal(id2, encrypted) {
  const [nonce, tag, body] = encrypted.split(".");
  const cipher = createDecipheriv("aes-256-gcm", key2(), Buffer.from(nonce, "base64"));
  cipher.setAAD(Buffer.from(id2));
  cipher.setAuthTag(Buffer.from(tag, "base64"));
  return JSON.parse(Buffer.concat([cipher.update(Buffer.from(body, "base64")), cipher.final()]).toString("utf8"));
}
function historyAssetSnapshots(id2, data2) {
  return [data2.encrypted, ...(data2.snapshots ?? []).map((s) => s.encrypted)].filter(Boolean).map((encrypted) => reveal(id2, encrypted));
}
async function recordNotification(conn, job, entry, status, snapshot, secrets = [], now = Date.now(), httpStatus, initialOnly = false) {
  try {
    await conn.transaction(async (tx) => {
      const id2 = historyId(job);
      await tx.execute(sql5`select pg_advisory_xact_lock(hashtext(${id2}))`);
      const [prior] = await tx.select().from(settings).where(eq(settings.id, id2));
      const old = prior?.data;
      if (old?.erased === true) return;
      const previousSubjects = old?.provenance ? verifyHistorySubjects(id2, old) : null;
      if (old?.provenance && !previousSubjects) throw new Error("Historical source proof is invalid");
      const { _sourceInput, ...publicEntry } = entry;
      const subjects = _sourceInput ? await notificationStaffSubjects(tx, _sourceInput) : null;
      if (subjects && entry.source === "test" && snapshot?.recipient)
        subjects.push(...await explicitNotificationSubjects(tx, entry.channel, snapshot.recipient));
      for (const subject of [...new Set(subjects ?? [])].sort()) {
        const [native] = await tx.select({ id: users.id }).from(users).where(eq(users.id, subject)).for("share");
        if (!native) throw new Error("Notification subject account is unavailable");
      }
      const previousStatus = old?.status;
      if (initialOnly && old) return;
      const data2 = old || { ...publicEntry, source: entry.source || "automatic", createdAt: entry.createdAt ?? now, status, timeline: [] };
      if (!old && _sourceInput && subjects) {
        const actor = _sourceInput.actorId || (entry.event === "booking" || entry.source === "test" ? _sourceInput.snapshot?.actorId : void 0);
        const recipient = _sourceInput.recipientUserId;
        data2.reporting = {
          actor: actor && subjects.includes(actor) ? accountSubjectFingerprint(actor) : null,
          recipient: recipient && subjects.includes(recipient) ? accountSubjectFingerprint(recipient) : null,
          branchId: _sourceInput.snapshot?.branchId || null
        };
      }
      const unprovenHistoricalEnvelope = !!old && !previousSubjects && !!(old.encrypted || old.snapshots?.length || old.senderHash || old.recipientHash);
      if (previousStatus === status && (!snapshot || status === "sending")) return;
      if (snapshot && (status !== "sending" ? !data2.dispatchAt : previousStatus !== "sending")) {
        await assertNoErasedAssetReference(tx, snapshot);
        try {
          data2.encrypted = protect(id2, snapshot, secrets);
          data2.senderHash = snapshot.sender ? contactHash(snapshot.sender) : void 0;
          data2.recipientHash = snapshot.recipient ? contactHash(snapshot.recipient) : void 0;
          data2.detailsUnavailable = false;
          if (status === "sending") data2.snapshots = [...data2.snapshots || [], { at: now, encrypted: data2.encrypted }].slice(-30);
        } catch {
          delete data2.encrypted;
          delete data2.senderHash;
          delete data2.recipientHash;
          data2.detailsUnavailable = true;
          logger.warn("Notification sensitive snapshot unavailable; metadata only retained");
        }
      }
      data2.status = status;
      data2.reason = status === "pending" || status === "sending" || status === "provider_accepted" ? null : status === "preparation_failed" && entry.preparationReason ? entry.preparationReason : status;
      if (status === "pending") {
        data2.queuedAt ??= now;
        data2.dueAt = entry.dueAt ?? data2.dueAt ?? now;
        delete data2.completedAt;
      }
      if (status === "sending" && previousStatus !== "sending") data2.dispatchAt = now;
      if (!["pending", "sending"].includes(status)) data2.completedAt = now;
      if (httpStatus && Number.isInteger(httpStatus) && httpStatus >= 100 && httpStatus <= 599) data2.httpStatus = httpStatus;
      data2.timeline = [...data2.timeline, { status, at: now, reason: data2.reason }].slice(-30);
      if (subjects && !unprovenHistoricalEnvelope) {
        try {
          data2.provenance = signHistorySubjects(id2, data2, subjects, previousSubjects ?? []);
        } catch {
          delete data2.provenance;
          data2.provenanceUnavailable = true;
        }
      }
      await tx.insert(settings).values({ id: id2, data: data2 }).onConflictDoUpdate({ target: settings.id, set: { data: data2 } });
    });
  } catch {
    logger.warn("Notification history unavailable; operational dispatch state preserved");
  }
}
async function claimNotificationOccurrence(conn, channel, event, row) {
  const inserted = await conn.insert(settings).values({
    id: `notification-occurrence:${channel}:${event}:${row.id}:${row.revision || 0}`,
    data: { createdAt: Date.now() }
  }).onConflictDoNothing().returning({ id: settings.id });
  return inserted.length > 0;
}
function notificationEntry(data2, channel) {
  return {
    channel,
    event: data2.event,
    clinicId: data2.clinicId,
    reference: data2.snapshot?.reference,
    recipientGroup: data2.recipientGroup || "patient",
    occurrence: `${data2.event}:${data2.appointmentId || data2.snapshot?.id || data2.clinicId}:${data2.snapshot?.revision || 0}`,
    createdAt: data2.createdAt,
    dueAt: data2.dueAt,
    _sourceInput: data2
  };
}
function templateSnapshot(template, event, group, channel) {
  return { templateId: `${channel}:${event}:${group}`, templateScope: template.source, templateRevision: template.effectiveRevision ?? template.local?.revision ?? 0 };
}
function authorizeNotificationHistory(user) {
  assert(user.role === "superAdmin" && !user.demo && user.demoFixture !== DEMO_FIXTURE, 403, "Real Superadmin access required");
}
function projection(row, now) {
  const d = row.data;
  const status = d.status === "sending" && d.dispatchAt < now - 3e5 ? "delivery_unknown" : d.status;
  let snapshot = {};
  if (d.encrypted) snapshot = reveal(row.id, d.encrypted);
  const timeline = [...d.timeline || []];
  if (status !== d.status) timeline.push({ status, at: d.dispatchAt + 3e5, reason: "abandoned_dispatch_claim" });
  return {
    id: row.id,
    channel: d.channel,
    event: d.event,
    status,
    source: d.source,
    occurrence: d.occurrence || null,
    clinicId: d.clinicId || null,
    reference: d.reference || null,
    recipientGroup: d.recipientGroup,
    ...Object.fromEntries(["provider", "sender", "recipient", "subject", "message", "templateId", "templateRevision", "templateScope", "dltTemplateId"].map((k) => [k, snapshot[k] ?? null])),
    createdAt: d.createdAt ?? null,
    queuedAt: d.queuedAt ?? null,
    dueAt: d.dueAt ?? null,
    dispatchAt: d.dispatchAt ?? null,
    completedAt: d.completedAt ?? null,
    reason: status !== d.status ? "abandoned_dispatch_claim" : d.reason || null,
    httpStatus: d.httpStatus ?? null,
    providerId: null,
    legacy: !!d.legacy,
    detailsUnavailable: !!d.detailsUnavailable,
    timeline
  };
}
async function listNotificationLogs(user, input, conn = db, now = Date.now()) {
  authorizeNotificationHistory(user);
  const parsed = querySchema.safeParse(input);
  assert(parsed.success, 400, "Invalid notification history filters");
  const q = parsed.data;
  assert(!q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), 400, "Invalid date range");
  const conditions = [sql5`${settings.id} like ${prefix + "%"}`, sql5`coalesce(${settings.data}->>'erased','false') <> 'true'`];
  for (const field2 of ["channel", "event", "clinicId", "recipientGroup", "source", "reference"])
    if (q[field2]) conditions.push(sql5`${settings.data}->>${field2} = ${q[field2]}`);
  const statusExpr = sql5`case when ${settings.data}->>'status' = 'sending' and (${settings.data}->>'dispatchAt')::bigint < ${now - 3e5} then 'delivery_unknown' else ${settings.data}->>'status' end`;
  if (q.status) conditions.push(sql5`${statusExpr} = ${q.status}`);
  if (q.from) conditions.push(sql5`(${settings.data}->>'createdAt')::bigint >= ${Date.parse(q.from)}`);
  if (q.to) conditions.push(sql5`(${settings.data}->>'createdAt')::bigint <= ${Date.parse(q.to)}`);
  for (const field2 of ["sender", "recipient"]) if (q[field2]) conditions.push(sql5`${settings.data}->>${field2 + "Hash"} = ${contactHash(q[field2])}`);
  if (q.cursor) {
    let cursor;
    try {
      cursor = JSON.parse(Buffer.from(q.cursor, "base64url").toString());
    } catch {
      assert(false, 400, "Invalid cursor");
    }
    assert(Array.isArray(cursor) && cursor.length === 2 && Number.isSafeInteger(cursor[0]) && typeof cursor[1] === "string" && (/^notification-history:[a-f0-9]{64}$/.test(cursor[1]) || legacyIdPattern.test(cursor[1])), 400, "Invalid cursor");
    conditions.push(sql5`(coalesce((${settings.data}->>'createdAt')::bigint,-9007199254740991), ${settings.id}) < (${cursor[0]}::bigint, ${cursor[1]}::text)`);
  }
  conditions[0] = sql5`true`;
  const result = await conn.execute(sql5`with notification_records as (${historyRecords()})
    select settings.id, settings.data from notification_records settings
    where ${sql5.join(conditions, sql5` and `)}
    order by coalesce((${settings.data}->>'createdAt')::bigint,-9007199254740991) desc, ${settings.id} desc limit ${q.pageSize + 1}`);
  const rows = result.rows;
  const selected = rows.slice(0, q.pageSize), last = selected.at(-1);
  return { items: selected.map((r) => projection(r, now)), nextCursor: rows.length > q.pageSize ? Buffer.from(JSON.stringify([last.data.createdAt ?? -9007199254740991, last.id])).toString("base64url") : null, timezone: "Asia/Kolkata" };
}
async function getNotificationLog(user, id2, conn = db, now = Date.now()) {
  authorizeNotificationHistory(user);
  assert(/^notification-history:[a-f0-9]{64}$/.test(id2) || legacyIdPattern.test(id2), 400, "Invalid notification log ID");
  let row;
  if (id2.startsWith("legacy:")) {
    const [original] = await conn.select().from(settings).where(eq(settings.id, id2.slice(7)));
    const [captured] = original ? await conn.select().from(settings).where(eq(settings.id, historyId(original.data.historyKey || original.id))) : [];
    if (original && !captured) {
      const d = original.data;
      row = { id: id2, data: {
        channel: original.id.startsWith("sms-") ? "sms" : "email",
        event: d.event,
        status: d.state,
        source: "automatic",
        clinicId: d.clinicId,
        reference: d.snapshot?.reference,
        recipientGroup: d.recipientGroup || "patient",
        createdAt: d.createdAt,
        dueAt: d.dueAt,
        dispatchAt: d.claimedAt,
        completedAt: d.finishedAt,
        legacy: true
      } };
    }
  } else [row] = await conn.select().from(settings).where(eq(settings.id, id2));
  assert(row && row.data.erased !== true, 404, "Notification log unavailable");
  return projection(row, now);
}
async function cleanupNotificationHistory(conn = db, now = Date.now()) {
}
var prefix, historyId, states, contactHash, recordDecision, querySchema, legacyIdPattern, historyRecords;
var init_notification_history = __esm({
  "artifacts/api-server/src/lib/notification-history.ts"() {
    "use strict";
    init_erased_asset_guard();
    init_db();
    init_http();
    init_demo_policy();
    init_logger();
    init_notification_staff_subjects();
    init_notification_history_provenance();
    init_notification_explicit_subjects();
    prefix = "notification-history:";
    historyId = (key4) => prefix + createHash2("sha256").update(key4).digest("hex");
    states = ["pending", "sending", "provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "configuration_failed", "preparation_failed", "disabled", "obsolete", "no_recipient", "not_attempted"];
    contactHash = (v) => createHmac2("sha256", key2()).update(v.trim().toLowerCase()).digest("hex");
    recordDecision = (conn, job, entry, state, snapshot, secrets = []) => recordNotification(conn, job, entry, state, snapshot, secrets, Date.now(), void 0, true);
    querySchema = z2.object({
      from: z2.string().datetime({ offset: true }).optional(),
      to: z2.string().datetime({ offset: true }).optional(),
      channel: z2.enum(["email", "sms"]).optional(),
      event: z2.enum(["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "booking_status_link", "provider_test"]).optional(),
      status: z2.enum(states).optional(),
      clinicId: z2.string().min(1).max(100).optional(),
      recipientGroup: z2.enum(["patient", "clinicAdmin", "doctor", "receptionist", "explicit"]).optional(),
      source: z2.enum(["automatic", "test", "manual"]).optional(),
      sender: z2.string().min(1).max(254).optional(),
      recipient: z2.string().min(1).max(254).optional(),
      reference: z2.string().min(1).max(100).optional(),
      cursor: z2.string().max(1e3).optional(),
      pageSize: z2.coerce.number().int().min(1).max(100).default(20)
    }).strict();
    legacyIdPattern = /^legacy:(mail|sms)-outbox:[A-Za-z0-9:_-]{1,170}$/;
    historyRecords = (metadataOnly = false, selection = {}) => sql5`
  select id, ${metadataOnly ? sql5`jsonb_build_object(
    'channel',data->'channel','event',data->'event','status',data->'status','source',data->'source',
    'clinicId',data->'clinicId','recipientGroup',data->'recipientGroup','createdAt',data->'createdAt',
    'dispatchAt',data->'dispatchAt','completedAt',data->'completedAt','queuedAt',data->'queuedAt',
    'dueAt',data->'dueAt','httpStatus',data->'httpStatus','erased',data->'erased',
    'reporting',data->'reporting',
    'provenance',jsonb_build_object('version',data->'provenance'->'version'))` : sql5`data`} as data
  from settings where id like 'notification-history:%'
    ${selection.id ? sql5`and id=${selection.id}` : sql5``}
    ${selection.clinicId ? sql5`and data->>'clinicId'=${selection.clinicId}` : sql5``}
    ${selection.ownerId ? sql5`and data->>'clinicId' in (select id from clinics where admin_id=${selection.ownerId})` : sql5``}
    ${selection.source ? sql5`and data->>'source'=${selection.source}` : sql5``}
  union all
  select 'legacy:' || s.id as id,
    jsonb_build_object(
      'channel',case when s.id like 'sms-outbox:%' then 'sms' else 'email' end,
      'event',s.data->>'event','status',s.data->>'state','source','automatic',
      'clinicId',s.data->>'clinicId','reference',s.data->'snapshot'->>'reference',
      'recipientGroup',coalesce(s.data->>'recipientGroup','patient'),
      'createdAt',s.data->'createdAt','dueAt',s.data->'dueAt',
      'dispatchAt',s.data->'claimedAt','completedAt',s.data->'finishedAt','legacy',true
    ) as data
  from settings s where (s.id like 'mail-outbox:%' or s.id like 'sms-outbox:%')
    ${selection.id ? sql5`and s.id=${selection.id.startsWith("legacy:") ? selection.id.slice(7) : ""}` : sql5``}
    ${selection.clinicId ? sql5`and s.data->>'clinicId'=${selection.clinicId}` : sql5``}
    ${selection.ownerId ? sql5`and s.data->>'clinicId' in (select id from clinics where admin_id=${selection.ownerId})` : sql5``}
    ${selection.source === "test" ? sql5`and false` : sql5``}
    and not exists (
      select 1 from settings h where h.id =
        'notification-history:' || encode(sha256(convert_to(coalesce(s.data->>'historyKey',s.id),'UTF8')),'hex')
    )`;
  }
});

// artifacts/api-server/src/lib/integration-vault.ts
import { createCipheriv as createCipheriv2, createDecipheriv as createDecipheriv2, randomBytes as randomBytes2, randomUUID } from "node:crypto";
import { eq as eq2 } from "drizzle-orm";
function masterKey() {
  const raw2 = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw2 || !/^[a-f0-9]{64}$/i.test(raw2))
    throw new HttpError(503, "Configure the server integration encryption key before editing credentials.", "INTEGRATION_KEY_REQUIRED");
  return Buffer.from(raw2, "hex");
}
function vaultConfigured() {
  try {
    masterKey();
    return true;
  } catch {
    return false;
  }
}
function encryptIntegration(provider, values) {
  const nonce = randomBytes2(12);
  const cipher = createCipheriv2("aes-256-gcm", masterKey(), nonce);
  cipher.setAAD(Buffer.from(`digiq:integrations:v1:${provider}`));
  const data2 = Buffer.concat([cipher.update(JSON.stringify(values), "utf8"), cipher.final()]);
  return ["v1", nonce.toString("base64"), cipher.getAuthTag().toString("base64"), data2.toString("base64")].join(".");
}
function decryptIntegration(provider, encrypted) {
  try {
    const [version, nonce, tag, data2, extra] = encrypted.split(".");
    if (version !== "v1" || extra !== void 0) throw new Error("Format");
    const cipher = createDecipheriv2("aes-256-gcm", masterKey(), Buffer.from(nonce, "base64"));
    cipher.setAAD(Buffer.from(`digiq:integrations:v1:${provider}`));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return JSON.parse(Buffer.concat([cipher.update(Buffer.from(data2, "base64")), cipher.final()]).toString("utf8"));
  } catch {
    throw new HttpError(503, "Stored integration configuration cannot be decrypted. Restore the correct server encryption key.", "INTEGRATION_DECRYPT_FAILED");
  }
}
async function resolvedIntegration(provider, conn = db) {
  const [row] = await conn.select().from(integrationCredentials).where(eq2(integrationCredentials.provider, provider));
  return {
    env: row ? { NODE_ENV: process.env.NODE_ENV, ...decryptIntegration(provider, row.encrypted) } : provider === "smtp" ? smtpEnvironment() : process.env,
    source: row ? "database" : "environment",
    revision: row?.revision ?? null
  };
}
async function integrationSettings(conn = db) {
  const [smtp, sms, notificationSms] = await Promise.all([resolvedIntegration("smtp", conn), resolvedIntegration("sms", conn), resolvedIntegration("notificationSms", conn)]);
  return {
    editable: vaultConfigured(),
    smtp: { ...integrationReadiness(smtp.env).smtp, source: smtp.source, revision: smtp.revision },
    sms: { ...integrationReadiness(sms.env).sms, source: sms.source, revision: sms.revision },
    notificationSms: { ...notificationSmsReadiness(notificationSms.env), source: notificationSms.source, revision: notificationSms.revision }
  };
}
async function saveIntegration(provider, values, revision, mode, actor) {
  masterKey();
  await db.transaction(async (tx) => {
    const { sql: sql29 } = await import("drizzle-orm");
    await tx.execute(sql29`select pg_advisory_xact_lock(hashtext(${`digiq:integration:${provider}`}))`);
    const [current] = await tx.select().from(integrationCredentials).where(eq2(integrationCredentials.provider, provider));
    if ((current?.revision ?? null) !== revision)
      throw new HttpError(409, "Configuration changed in another session. Refresh before saving.", "INTEGRATION_CONFLICT");
    if (mode === "environment") {
      await tx.delete(integrationCredentials).where(eq2(integrationCredentials.provider, provider));
    } else {
      const previous = current ? decryptIntegration(provider, current.encrypted) : provider === "smtp" ? smtpEnvironment() : process.env;
      const merged = {};
      for (const name of integrationFields[provider]) {
        const protectedBlank = provider === "notificationSms" && ["NOTIFICATION_SMS_KEY", "NOTIFICATION_SMS_BEARER_TOKEN", "NOTIFICATION_SMS_CLIENT_ID", "NOTIFICATION_SMS_SENDER_ID", "NOTIFICATION_SMS_ENTITY_ID"].includes(name) && values[name] === "";
        const value = protectedBlank ? previous[name] : values[name] ?? previous[name];
        if (value !== void 0) merged[name] = value;
      }
      if (provider === "sms") merged.OTP_PROVIDER = "twilio";
      if (provider === "notificationSms") {
        try {
          for (const field2 of ["NOTIFICATION_SMS_URL", "NOTIFICATION_SMS_KEEP_IN_TOUCH_URL", "NOTIFICATION_SMS_STATUS_URL"]) if (merged[field2]) smsUrl(merged[field2]);
        } catch {
          throw new HttpError(400, "Use a public HTTPS endpoint without credentials, queries or fragments.", "INTEGRATION_INVALID");
        }
      }
      if (!(provider === "notificationSms" ? notificationSmsReadiness(merged) : integrationReadiness(merged)[provider]).ready)
        throw new HttpError(400, "Complete all required fields with valid values before saving.", "INTEGRATION_INVALID");
      await tx.insert(integrationCredentials).values({ provider, encrypted: encryptIntegration(provider, merged), revision: randomUUID() }).onConflictDoUpdate({ target: integrationCredentials.provider, set: { encrypted: encryptIntegration(provider, merged), revision: randomUUID() } });
      if (provider === "notificationSms" && merged.NOTIFICATION_SMS_ENABLED === "false" || provider === "smtp" && merged.SMTP_NOTIFICATIONS_ENABLED === "false") {
        const stopped = await tx.update(settings).set({
          data: sql29`${settings.data} || ${JSON.stringify({ state: "disabled", finishedAt: Date.now() })}::jsonb`
        }).where(sql29`${settings.id} like ${provider === "smtp" ? "mail-outbox:%" : "sms-outbox:%"} and ${settings.data}->>'state' = 'pending'`).returning();
        const { recordNotification: recordNotification2, notificationEntry: notificationEntry2 } = await Promise.resolve().then(() => (init_notification_history(), notification_history_exports));
        for (const row of stopped) await recordNotification2(tx, row.data.historyKey || row.id, notificationEntry2(row.data, provider === "smtp" ? "email" : "sms"), "disabled");
      }
    }
    await tx.insert(auditLogs).values({
      id: randomUUID(),
      actorId: actor,
      action: "configure",
      entityType: "integration",
      entityId: provider,
      summary: `${provider} configuration changed; source=${mode}; fields=${Object.keys(values).sort().join(",") || "none"}`
    });
  });
}
var integrationFields;
var init_integration_vault = __esm({
  "artifacts/api-server/src/lib/integration-vault.ts"() {
    "use strict";
    init_db();
    init_http();
    init_integration_config();
    init_notification_sms_transport();
    integrationFields = {
      smtp: smtpFields,
      sms: ["OTP_PROVIDER", "TWILIO_ACCOUNT_SID", "TWILIO_MESSAGING_SERVICE_SID", "TWILIO_AUTH_TOKEN"],
      notificationSms: ["NOTIFICATION_SMS_KEEP_IN_TOUCH_URL", "NOTIFICATION_SMS_URL", "NOTIFICATION_SMS_KEY", "NOTIFICATION_SMS_MAPPING", "NOTIFICATION_SMS_STATUS_URL", "NOTIFICATION_SMS_CLIENT_ID", "NOTIFICATION_SMS_SENDER_ID", "NOTIFICATION_SMS_ENTITY_ID", "NOTIFICATION_SMS_ENABLED", "NOTIFICATION_SMS_PROVIDER", "NOTIFICATION_SMS_BEARER_TOKEN", "NOTIFICATION_SMS_COUNTRY_CODE_FORMAT"]
    };
  }
});

// artifacts/api-server/src/lib/email-presentation.ts
function safeEmailUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : void 0;
  } catch {
    return void 0;
  }
}
function emailAction(value, label) {
  const url = safeEmailUrl(value);
  if (!url) return emailText(value);
  return `<div style="margin:16px 0"><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:12px 22px;border-radius:7px;background:#0969da;color:#ffffff;font-weight:bold;text-decoration:none">${escapeEmailHtml(label)}</a><div style="margin-top:10px;font-size:12px;line-height:1.6">Or use this link:<br><a href="${escapeEmailHtml(url)}" style="color:#0969da;word-break:break-all">${escapeEmailHtml(value)}</a></div></div>`;
}
function emailCard(content, label) {
  return `<div style="margin:16px 0;padding:18px;background:#f7f9fc;border:1px solid #dfe7f1;border-radius:10px;overflow-wrap:anywhere;word-break:break-word">${label ? `<div style="font-size:12px;letter-spacing:1px;color:#53647b;font-weight:bold;margin-bottom:12px">${escapeEmailHtml(label)}</div>` : ""}${content}</div>`;
}
function visitEmailCard(visit, source) {
  const row = (label, value) => value ? `<tr><td style="padding:10px 8px 10px 0;width:30%;vertical-align:top;color:#596780;font-size:13px">${label}</td><td style="padding:10px 0;border-bottom:1px solid #e4eaf2;font-weight:bold;overflow-wrap:anywhere;word-break:break-word">${emailText(value)}</td></tr>` : "";
  return emailCard(`<div style="margin-bottom:10px">${emailText(visit.introduction)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;border-collapse:collapse">
${row("Clinic", visit.clinic)}${row("Location", visit.location)}${row("Doctor", visit.doctor)}${row("Date", visit.date)}${row("Session", `${visit.start}\u2013${visit.end} (${visit.timezone})`)}${/\{\{\s*reference\s*\}\}/.test(source) ? "" : row("Reference", visit.reference)}${row("Token", visit.token)}${/\{\{\s*clinic_contact\s*\}\}/.test(source) && visit.contact !== "Contact reception at the clinic" ? "" : row("Clinic contact", visit.contact)}
</table><div style="margin-top:16px;padding:12px;border-left:3px solid #0969da;background:#eef6ff;font-size:13px;line-height:1.7">${emailText(visit.closing)}</div>`);
}
function otpEmailPanel(code, expiry, punctuation = "") {
  const cells = [...code].map((digit) => `<span aria-hidden="true" style="display:inline-block;box-sizing:border-box;width:12%;max-width:54px;margin:0 1%;padding:14px 0;border:1px solid #d4e2f1;border-radius:7px;background:#ffffff;color:#0969da;font-size:28px;font-weight:bold;line-height:1.2;text-align:center">${escapeEmailHtml(digit)}</span>`).join("");
  return `<div style="margin:22px 0;padding:22px 8px;text-align:center;background:#eff7ff;border-radius:12px"><div style="font-size:12px;letter-spacing:2px;color:#596780;margin-bottom:16px;font-weight:bold">YOUR OTP</div><div role="text" aria-label="Verification code ${escapeEmailHtml(code)}" style="display:inline-block;width:94%;white-space:nowrap;user-select:all">${cells}</div>${punctuation ? `<span style="font-size:13px;user-select:none">${escapeEmailHtml(punctuation)}</span>` : ""}${expiry && /^\d+$/.test(expiry) && Number(expiry) > 0 ? `<div style="margin-top:16px;font-size:14px;color:#53647b">Valid for <strong>${escapeEmailHtml(expiry)} minutes</strong></div>` : ""}</div>`;
}
function emailShell(subject, bodyHtml, options = {}) {
  const logo = options.logoUrl && (options.logoUrl === "cid:clinic-logo" || safeEmailUrl(options.logoUrl));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeEmailHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f5f9;color:${ink};font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f5f9"><tr><td align="center" style="padding:20px 8px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;table-layout:fixed;background:#ffffff;border:1px solid #e0e7f0;border-radius:10px">
<tr><td style="padding:24px 22px;border-bottom:1px solid #dfe7f1">
${logo ? `<img src="${escapeEmailHtml(options.logoUrl)}" alt="${escapeEmailHtml(options.logoAlt || "Clinic logo")}" width="160" style="max-width:100%;height:auto;max-height:80px;object-fit:contain"><br>` : ""}
<div style="font-size:25px;font-weight:bold;color:#0c173d">${emailBrand}</div><div style="font-size:12px;color:#596780;margin-top:5px">Care. Plan. Care Together.</div>
${options.label ? `<div style="margin-top:16px;font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#596780;text-transform:uppercase">${escapeEmailHtml(options.label)}</div>` : ""}</td></tr>
<tr><td style="padding:26px 22px;overflow-wrap:anywhere;word-break:break-word">${options.greeting ? `<div style="margin-bottom:14px;font-size:15px">${emailText(options.greeting)}</div>` : ""}<h1 style="margin:0 0 20px;font-size:26px;line-height:1.3;color:${ink}">${escapeEmailHtml(subject)}</h1>
<div style="font-size:15px;line-height:1.75;overflow-wrap:anywhere;word-break:break-word">${bodyHtml}</div>
${options.security ? `<div style="margin-top:22px;padding:16px;background:#f7faff;border-radius:8px"><span aria-hidden="true" style="display:inline-block;border:2px solid #0969da;border-radius:8px 8px 14px 14px;padding:2px 8px;color:#0969da">&#10003;</span> <strong style="font-size:14px">For your security</strong><div style="margin-top:8px;font-size:13px;color:#53647b">Do not share this code with anyone. If you did not request this OTP, you can safely ignore this email.</div></div>` : ""}
<div style="margin-top:24px;padding-top:20px;border-top:1px solid #dfe7f1;font-size:13px"><div style="display:inline-block;vertical-align:top;width:330px;max-width:100%;margin:8px 0 12px"><strong>Need help?</strong><div style="margin-top:6px">${options.helpHtml ?? "Reach out to our support team."}</div></div>${supportAction}</div>
</td></tr>
<tr><td style="padding:20px 22px;background:#f4f6fb;border-top:1px solid #e4e9f0;color:#596780;font-size:12px;line-height:1.7;overflow-wrap:anywhere;word-break:break-word"><strong style="color:${ink};font-size:16px">${emailBrand}</strong><br>Care. Plan. Care Together.<br><br>${options.footerHtml ?? automatedFooter}</td></tr>
</table></td></tr></table></body></html>`;
}
var emailBrand, automatedFooter, emailSupportAddress, emailSupportText, supportAction, escapeEmailHtml, ink, emailText;
var init_email_presentation = __esm({
  "artifacts/api-server/src/lib/email-presentation.ts"() {
    "use strict";
    emailBrand = "Digi-Q";
    automatedFooter = "This is an automated message from Digi-Q. Please do not reply to this email.";
    emailSupportAddress = "no-reply@digi-q.in";
    emailSupportText = `Need help?
Get support: mailto:${emailSupportAddress}
${emailSupportAddress}`;
    supportAction = `<div style="display:inline-block;vertical-align:top;width:200px;max-width:100%;margin-top:8px"><a href="mailto:${emailSupportAddress}" style="display:inline-block;padding:12px 22px;border:1px solid #0969da;border-radius:7px;color:#0969da;background:#ffffff;font-weight:bold;text-decoration:none">Get support <span aria-hidden="true">&#8594;</span></a><div style="margin-top:10px;font-size:13px">Email: <a href="mailto:${emailSupportAddress}" style="color:#0969da;overflow-wrap:anywhere">${emailSupportAddress}</a></div></div>`;
    escapeEmailHtml = (value) => value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    ink = "#101d42";
    emailText = (value) => escapeEmailHtml(value).replace(/\r?\n/g, "<br>");
  }
});

// artifacts/api-server/src/lib/notification-email-presentation.ts
function notificationEmailHtml(content, subject, values, context = {}) {
  let otpShown = false;
  const render = (source) => {
    const parts = [];
    let offset = 0;
    for (const match of source.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)) {
      parts.push(emailText(source.slice(offset, match.index)));
      const key4 = match[1], value = values[key4] ?? `[${key4.replaceAll("_", " ")}]`;
      let punctuationLength = 0;
      if (key4 === "otp" && /^\d{6}$/.test(value)) {
        const punctuation = /^[.,;:!?]/.exec(source.slice(match.index + match[0].length))?.[0] || "";
        punctuationLength = punctuation.length;
        parts.push(otpEmailPanel(value, values.expiry_minutes, punctuation));
        otpShown = true;
      } else if (key4 === "appointment_details") {
        parts.push(context.visit ? visitEmailCard(context.visit, content.body) : emailCard(emailText(value)));
      } else if (key4 === "previous_details") {
        parts.push(emailCard(emailText(value), "PREVIOUS VISIT"));
      } else if (actions[key4]) {
        parts.push(emailAction(value, actions[key4]));
      } else if (key4 === "clinic_contact") {
        parts.push(value.trim() ? `<div style="margin-top:22px;color:#53647b;font-size:13px"><strong style="color:#101d42">Clinic contact</strong><div style="margin-top:6px">${emailText(value)}</div></div>` : "");
      } else {
        parts.push(`<strong style="color:#101d42">${emailText(value)}</strong>`);
      }
      offset = match.index + match[0].length + punctuationLength;
    }
    parts.push(emailText(source.slice(offset)));
    return parts.join("");
  };
  const body = render(content.body), footer = render(content.footer);
  return emailShell(subject, body, {
    label: labels[context.event || ""] || (otpShown ? "OTP verification" : void 0),
    logoUrl: content.logoUrl.startsWith("/api/branding/logos/") ? "cid:clinic-logo" : content.logoUrl,
    logoAlt: `${values.clinic_name || "Clinic"} logo`,
    footerHtml: footer || void 0,
    security: otpShown,
    greeting: otpShown && !/^\s*(?:hello|hi|dear)\b/i.test(content.body) ? "Hello," : void 0,
    // The shell owns the fixed support destination; no editable security URL.
    helpHtml: otpShown || /\{\{\s*clinic_contact\s*\}\}/.test(content.body) ? void 0 : values.clinic_contact?.trim() ? emailText(values.clinic_contact) : void 0
  });
}
var actions, labels;
var init_notification_email_presentation = __esm({
  "artifacts/api-server/src/lib/notification-email-presentation.ts"() {
    "use strict";
    init_email_presentation();
    actions = { setup_link: "Set up your password", sign_in_link: "Sign in", booking_link: "Open clinic booking" };
    labels = {
      booking: "Booking confirmation",
      onboarding: "Clinic onboarding",
      rescheduled: "Appointment rescheduled",
      cancelled: "Appointment cancelled",
      completed: "Visit completed",
      reminder: "Appointment reminder",
      patient_login_otp: "Login verification",
      clinic_registration_otp: "Clinic registration verification",
      patient_email_otp: "Email verification",
      staff_email_otp: "Staff email verification",
      registration_mobile_otp: "Mobile verification",
      staff_mobile_otp: "Staff mobile verification",
      doctor_setup: "Account setup",
      staff_setup: "Account setup",
      password_setup_complete: "Account security"
    };
  }
});

// artifacts/api-server/src/lib/appointment-notification-scope.ts
function appointmentNotificationTarget(event, recipient) {
  return appointmentNotificationEvents.includes(event) && appointmentNotificationRecipients.includes(recipient);
}
var appointmentNotificationEvents, appointmentNotificationRecipients, appointmentActivationId;
var init_appointment_notification_scope = __esm({
  "artifacts/api-server/src/lib/appointment-notification-scope.ts"() {
    "use strict";
    appointmentNotificationEvents = ["booking", "rescheduled", "cancelled", "completed", "reminder"];
    appointmentNotificationRecipients = ["patient", "clinicAdmin", "doctor"];
    appointmentActivationId = "appointment-notification-activation";
  }
});

// artifacts/api-server/src/lib/security-template-definitions.ts
import { eventVariables } from "@workspace/api-zod/notification-variable-contract";
function securityDefault(event, sms = false) {
  if (event === "staff_email_otp" || event === "staff_mobile_otp") return {
    enabled: true,
    subject: securityTitles[event],
    body: "Your Digi-Q verification code is {{otp}}. It expires in {{expiry_minutes}} minutes. Do not share it.",
    prefix: "",
    footer: "",
    logoUrl: ""
  };
  const otp = event.endsWith("_otp");
  const body = otp ? `Your DigiQ ${event === "registration_mobile_otp" ? "mobile" : "email"} verification code is {{otp}}. It expires in {{expiry_minutes}} minutes. Do not share this code.` : event === "password_setup_complete" ? "Hello {{recipient_name}}, your DigiQ {{role_name}} password setup is complete. No password is included in this message. If you did not do this, contact your administrator." : sms ? "Hello {{recipient_name}}, your DigiQ {{role_name}} account is ready for setup. Use the secure link emailed to you. It expires in {{expiry_minutes}} minutes. No password is sent by SMS." : "Hello {{recipient_name}},\n\nSet up your DigiQ {{role_name}} password using this secure, single-use link:\n{{setup_link}}\n\nThis link expires in {{expiry_minutes}} minutes. We never send passwords. If you did not expect this invitation, contact your administrator.";
  const defaultBody = event === "clinic_registration_otp" ? "Your clinic administrator registration code is {{otp}}. It expires in {{expiry_minutes}} minutes. Verify your email to continue setting up your clinic. This is not a doctor invitation. If you did not start this registration, ignore this email." : body;
  const subject = event === "clinic_registration_otp" ? "Verify your DigiQ clinic registration" : securityTitles[event];
  return {
    enabled: true,
    subject: sms ? subject : subject.replaceAll("DigiQ", "Digi-Q"),
    body: sms ? defaultBody : defaultBody.replaceAll("DigiQ", "Digi-Q"),
    prefix: "",
    footer: "",
    logoUrl: ""
  };
}
function validSecurityContent(event, content) {
  const body = content.body;
  const required = event.endsWith("_otp") ? ["otp", "expiry_minutes"] : event === "password_setup_complete" ? [] : ["expiry_minutes"];
  if (!required.every((v) => new RegExp(`\\{\\{\\s*${v}\\s*\\}\\}`).test(body))) return false;
  const literal2 = [content.subject, body, content.prefix, content.footer].join("\n").replace(/\{\{\s*[a-z_]+\s*\}\}/g, "");
  return !/(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:|href\s*=|[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}|[a-z0-9-]+\.[a-z]{2,}\b)/i.test(literal2);
}
var securityEvents, isSecurityEvent, requiredEvent, securityTitles;
var init_security_template_definitions = __esm({
  "artifacts/api-server/src/lib/security-template-definitions.ts"() {
    "use strict";
    securityEvents = [
      "clinic_registration_otp",
      "patient_email_otp",
      "registration_mobile_otp",
      "doctor_setup",
      "staff_setup",
      "password_setup_complete",
      "staff_email_otp",
      "staff_mobile_otp"
    ];
    isSecurityEvent = (event) => securityEvents.includes(event);
    requiredEvent = (event) => isSecurityEvent(event) || event === "patient_login_otp";
    securityTitles = {
      staff_email_otp: "Staff email verification",
      staff_mobile_otp: "Staff mobile verification",
      clinic_registration_otp: "Clinic Admin registration verification",
      patient_email_otp: "Patient email verification",
      registration_mobile_otp: "Optional registration mobile verification",
      doctor_setup: "Doctor password setup",
      staff_setup: "Staff password setup",
      password_setup_complete: "Password setup completed"
    };
  }
});

// artifacts/api-server/src/lib/notification-templates.ts
import { z as z3 } from "zod";
import { notificationVariables, eventVariables as eventVariables2 } from "@workspace/api-zod/notification-variable-contract";
function validTemplateTarget(event, recipient, channel) {
  if (event === "booking_status_link") return recipient === "patient" && channel === "sms";
  if (event === "staff_created_admin") return ["superAdmin", "clinicAdmin", "doctor"].includes(recipient);
  if (event === "staff_welcome") return ["clinicAdmin", "doctor", "receptionist"].includes(recipient);
  if (isSecurityEvent(event)) {
    if (event === "staff_email_otp" || event === "staff_mobile_otp")
      return recipient !== "patient" && channel === (event === "staff_email_otp" ? "email" : "sms");
    if (event === "clinic_registration_otp") return recipient === "clinicAdmin" && channel === "email";
    if (event === "patient_email_otp") return recipient === "patient" && channel === "email";
    if (event === "registration_mobile_otp") return ["patient", "clinicAdmin"].includes(recipient) && channel === "sms";
    if (event === "doctor_setup") return recipient === "doctor";
    return ["clinicAdmin", "receptionist", "superAdmin", ...event === "password_setup_complete" ? ["doctor"] : []].includes(recipient);
  }
  if (event === "patient_login_otp") return recipient === "patient" && channel === "sms";
  if (recipient === "superAdmin") return event === "onboarding";
  return event !== "onboarding" || recipient === "clinicAdmin";
}
function variablesForTemplate(event) {
  return eventVariables2(event);
}
function validEventContent(event, content) {
  const allowed = variablesForTemplate(event);
  const used = [content.subject, content.body, content.prefix, content.footer].flatMap((text2) => [...text2.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((match) => match[1]));
  return used.every((variable) => allowed.includes(variable)) && (event !== "booking_status_link" || /\{\{\s*booking_status_link\s*\}\}/.test(content.body)) && (!isSecurityEvent(event) || validSecurityContent(event, content)) && (event !== "patient_login_otp" || /\{\{\s*otp\s*\}\}/.test(content.body));
}
function defaultTemplate(event, recipient = defaultRecipient(event)) {
  if (event === "booking_status_link") return {
    enabled: false,
    subject: eventTitles[event],
    body: "{{booking_status_link}}",
    prefix: "",
    footer: "",
    logoUrl: ""
  };
  if (event === "staff_created_admin" || event === "staff_welcome") return {
    enabled: true,
    subject: event === "staff_welcome" ? "Welcome to Digi-Q" : "Digi-Q staff account saved",
    body: event === "staff_welcome" ? "Hello {{recipient_name}}, your Digi-Q {{role_name}} account is ready. {{clinic_name}} {{location_names}}\nSign in with your email and password: {{sign_in_link}}" : "Hello {{recipient_name}}, {{staff_name}}'s {{role_name}} account is saved. {{clinic_name}} {{location_names}}\nStaff sign-in: {{sign_in_link}}",
    prefix: "",
    footer: "",
    logoUrl: ""
  };
  if (isSecurityEvent(event)) return securityDefault(event);
  if (event === "patient_login_otp") return { enabled: true, subject: "Patient login OTP", body: bodies[event], prefix: "", footer: "", logoUrl: "" };
  if (event === "onboarding" && recipient === "superAdmin") return { enabled: true, subject: "Clinic registered \u2014 {{clinic_name}}", body: "Hello {{recipient_name}},\n\nA clinic has completed registration: {{clinic_name}}.\n{{clinic_contact}}", prefix: "", footer: "", logoUrl: "" };
  return { enabled: appointmentNotificationTarget(event, recipient) || recipient === defaultRecipient(event) || event === "booking" && recipient === "clinicAdmin", subject: `${eventTitles[event]} \u2014 {{clinic_name}}`, body: recipient === defaultRecipient(event) ? bodies[event] : `Clinic notification: ${eventTitles[event]}
Patient: {{patient_name}}
Doctor: {{doctor_name}}
{{appointment_details}}
Reference: {{reference}}
{{clinic_contact}}`, prefix: "", logoUrl: "", footer: "This is an automated clinic message. Contact your clinic for assistance." };
}
function substitute(text2, values) {
  return text2.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, key4) => values[key4] ?? `[${key4.replaceAll("_", " ")}]`);
}
function renderNotification(content, values, context = {}) {
  const subject = [substitute(content.prefix, values), substitute(content.subject, values)].filter(Boolean).join(" ").replace(/[\r\n]+/g, " ");
  const body = substitute(content.body, values), footer = substitute(content.footer, values);
  const logoPath = content.logoUrl.startsWith("/api/branding/logos/") ? content.logoUrl : void 0;
  return {
    subject,
    logoPath,
    text: [body, emailSupportText, footer || automatedFooter].filter(Boolean).join("\n\n"),
    html: notificationEmailHtml(content, subject, values, context)
  };
}
var templateEvents, templateRecipients, defaultRecipient, templateVariables, templateContent, smsTemplateContent, templateSaveFields, templateSave, eventTitles, patientLoginSmsBody, bodies;
var init_notification_templates = __esm({
  "artifacts/api-server/src/lib/notification-templates.ts"() {
    "use strict";
    init_notification_email_presentation();
    init_email_presentation();
    init_appointment_notification_scope();
    init_security_template_definitions();
    init_security_template_definitions();
    templateEvents = ["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "booking_status_link", "patient_login_otp", "staff_created_admin", "staff_welcome", ...securityEvents];
    templateRecipients = ["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"];
    defaultRecipient = (event) => event === "onboarding" || event === "clinic_registration_otp" || event === "staff_created_admin" ? "clinicAdmin" : event === "doctor_setup" ? "doctor" : ["staff_setup", "password_setup_complete", "staff_welcome", "staff_email_otp", "staff_mobile_otp"].includes(event) ? "receptionist" : "patient";
    templateVariables = notificationVariables;
    templateContent = z3.object({
      enabled: z3.boolean().default(true),
      subject: z3.string().trim().min(1).max(180).refine((v) => !/[\r\n]/.test(v), "Subject must be one line"),
      body: z3.string().trim().min(1).max(8e3),
      prefix: z3.string().trim().max(60).refine((v) => !/[\r\n]/.test(v), "Prefix must be one line"),
      footer: z3.string().trim().max(500),
      logoUrl: z3.string().max(1e3).refine((value) => {
        if (!value) return true;
        if (/^\/api\/branding\/logos\/[a-f0-9-]{36}$/.test(value)) return true;
        try {
          const u = new URL(value);
          return u.protocol === "https:" && !u.username && !u.password;
        } catch {
          return false;
        }
      }, "Use an HTTPS logo URL without credentials")
    }).strict().superRefine((value, ctx) => {
      for (const field2 of ["subject", "body", "prefix", "footer"]) {
        const remaining = value[field2].replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (token, variable) => {
          if (!templateVariables.includes(variable))
            ctx.addIssue({ code: "custom", path: [field2], message: `Unsupported variable: ${variable}` });
          return "";
        });
        if (/[{}]/.test(remaining)) ctx.addIssue({ code: "custom", path: [field2], message: "Use supported variables in double braces" });
      }
    });
    smsTemplateContent = z3.object({
      enabled: z3.boolean().default(false),
      subject: z3.string().min(1).max(180),
      body: z3.string().min(1).max(1600).refine((v) => !!v.trim(), "Message is required"),
      prefix: z3.literal(""),
      footer: z3.literal(""),
      logoUrl: z3.literal(""),
      senderId: z3.string().regex(/^[A-Za-z0-9_-]{0,50}$/).default(""),
      dltEntityId: z3.string().regex(/^[A-Za-z0-9_-]{0,50}$/).default(""),
      dltTemplateId: z3.string().regex(/^[A-Za-z0-9_-]{0,50}$/).default("")
    }).strict().superRefine((value, ctx) => {
      const remaining = value.body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_, variable) => {
        if (!templateVariables.includes(variable)) ctx.addIssue({ code: "custom", path: ["body"], message: `Unsupported variable: ${variable}` });
        return "";
      });
      if (/[{}]/.test(remaining)) ctx.addIssue({ code: "custom", path: ["body"], message: "Use supported variables in double braces" });
    });
    templateSaveFields = {
      recipient: z3.enum(templateRecipients).optional(),
      clinicId: z3.string().min(1).max(100).optional(),
      event: z3.enum(templateEvents),
      revision: z3.number().int().min(0),
      mode: z3.enum(["draft", "publish", "reset"])
    };
    templateSave = z3.preprocess((input) => {
      if (input && typeof input === "object" && !Array.isArray(input) && !("channel" in input))
        return { ...input, channel: "email" };
      return input;
    }, z3.discriminatedUnion("channel", [
      z3.object({ ...templateSaveFields, channel: z3.literal("email"), content: templateContent.optional() }).strict(),
      z3.object({ ...templateSaveFields, channel: z3.literal("sms"), content: smsTemplateContent.optional() }).strict()
    ])).refine((v) => v.mode === "reset" || !!v.content, { message: "Template content is required" });
    eventTitles = {
      booking_status_link: "Manual booking-status link (approved registration required)",
      staff_created_admin: "Staff account created",
      staff_welcome: "Staff welcome",
      ...securityTitles,
      booking: "Booking confirmation",
      onboarding: "Clinic onboarding",
      rescheduled: "Appointment rescheduled",
      cancelled: "Appointment cancelled",
      completed: "Thank you after your visit",
      reminder: "Appointment reminder",
      patient_login_otp: "Patient login OTP"
    };
    patientLoginSmsBody = "Your DigiQ Doctors login code is {{otp}}. It expires in {{expiry_minutes}} minutes. Do not share this code.";
    bodies = {
      booking: "Hello {{patient_name}},\n\nYour booking at {{clinic_name}} is confirmed.\n{{appointment_details}}\nReference: {{reference}}\n\n{{clinic_contact}}",
      onboarding: "Welcome to {{clinic_name}}.\n\nComplete your clinic opening hours, doctor sessions and staff assignments before sharing your booking link.\n\n{{clinic_contact}}",
      rescheduled: "Hello {{patient_name}},\n\nYour visit at {{clinic_name}} has been rescheduled.\nPrevious details: {{previous_details}}\nNew details:\n{{appointment_details}}\nReference: {{reference}}",
      cancelled: "Hello {{patient_name}},\n\nYour booking at {{clinic_name}} has been cancelled.\n{{appointment_details}}\nReference: {{reference}}\nContact the clinic if you need to book another visit.\n{{clinic_contact}}",
      completed: "Hello {{patient_name}},\n\nThank you for visiting {{clinic_name}}. Your visit is now complete.\nFor further assistance, contact your clinic.\n{{clinic_contact}}",
      reminder: "Hello {{patient_name}},\n\nA reminder of your upcoming session at {{clinic_name}}.\n{{appointment_details}}\nReference: {{reference}}\nQueue-based visits do not guarantee an exact consultation time.",
      patient_login_otp: "Your Digi-Q login code is {{otp}}. It expires in {{expiry_minutes}} minutes. Do not share this code."
    };
  }
});

// artifacts/api-server/src/lib/otp-delivery.ts
function developmentOtpEnabled() {
  return process.env.NODE_ENV === "development" && process.env.OTP_PROVIDER === "development";
}
async function otpDeliveryConfigured(conn) {
  const { env, source } = await resolvedIntegration("sms", conn);
  return source === "environment" && developmentOtpEnabled() || integrationReadiness(env).sms.ready;
}
var init_otp_delivery = __esm({
  "artifacts/api-server/src/lib/otp-delivery.ts"() {
    "use strict";
    init_http();
    init_integration_vault();
    init_integration_config();
  }
});

// artifacts/api-server/src/lib/store.ts
import { randomUUID as randomUUID2 } from "node:crypto";
import { eq as eq3 } from "drizzle-orm";
function flatten(row) {
  if (!row) return null;
  const { data: data2, clerkId: _legacyProviderId, passwordHash: _hash, tokenHash: _token, ...fields } = row;
  const { passwordHash: _nestedHash, tokenHash: _nestedToken, ...safeData } = data2 || {};
  return { ...safeData, ...fields };
}
async function all(table, conn = db) {
  return (await conn.select().from(table)).map(flatten);
}
async function one(table, id2, conn = db) {
  const [row] = await conn.select().from(table).where(eq3(table.id, id2));
  assert(row, 404, "Record not found");
  return flatten(row);
}
async function put(table, fields, conn = db) {
  const [row] = await conn.insert(table).values(fields).returning();
  return flatten(row);
}
async function change(table, id2, fields, conn = db) {
  const [row] = await conn.update(table).set(fields).where(eq3(table.id, id2)).returning();
  assert(row, 404, "Record not found");
  return flatten(row);
}
async function audit(user, action, type, row, conn = db) {
  await conn.insert(auditLogs).values({ id: uid(), actorId: user.id, clinicId: row.clinicId || (type === "clinics" ? row.id : null), branchId: row.branchId || (type === "branches" ? row.id : null), action, entityType: type, entityId: row.id, summary: `${user.privateReceipt ? "Patient via protected booking receipt: " : ""}${action} ${type} record` });
}
async function getSettings(conn = db, clinicId) {
  const [row] = await conn.select().from(settings).where(eq3(settings.id, "platform"));
  const clinic = clinicId ? await one(clinics, clinicId, conn) : null;
  return { ...defaultSettings, ...row?.data, ...clinic?.policies || {}, otpProviderConfigured: await otpDeliveryConfigured(conn), queuePollSeconds: 30 };
}
function filtered(rows, q) {
  return rows.filter((r) => {
    for (const k of ["clinicId", "branchId", "doctorId", "patientId", "managingAdminId", "status", "role", "category", "parentId", "gender", "city", "specializationId", "source", "entityType", "actorId", "date"]) {
      if (q[k] !== void 0 && r[k] !== q[k] && !(k === "clinicId" && r.clinicIds?.includes(q[k])) && !(k === "branchId" && r.branchIds?.includes(q[k]))) return false;
    }
    const date2 = r.date || new Date(r.createdAt || 0).toISOString().slice(0, 10);
    if (q.from && date2 < q.from || q.to && date2 > q.to) return false;
    return !q.search || ["name", "fullName", "email", "mobile", "code", "reference", "patientName", "doctorName", "summary"].some((k) => String(r[k] || "").toLowerCase().includes(q.search.toLowerCase()));
  });
}
function paginate(rows, q) {
  const sort = q.sort || "-createdAt", key4 = sort.replace(/^-/, "");
  assert(["createdAt", "name", "fullName", "date", "status", "code", "tokenNumber", "sortOrder", "email"].includes(key4), 400, "Unsupported sort field");
  const direction = sort.startsWith("-") ? -1 : 1;
  rows.sort((a, b) => String(a[key4] ?? "").localeCompare(String(b[key4] ?? ""), void 0, { numeric: true }) * direction || String(a.id ?? "").localeCompare(String(b.id ?? "")) * direction);
  const page = q.page || 1, pageSize = q.pageSize || 20;
  return { items: rows.slice((page - 1) * pageSize, page * pageSize), total: rows.length, page, pageSize };
}
var uid, defaultSettings;
var init_store = __esm({
  "artifacts/api-server/src/lib/store.ts"() {
    "use strict";
    init_db();
    init_http();
    init_otp_delivery();
    uid = () => randomUUID2();
    defaultSettings = {
      platformName: "DigiQ Doctors",
      timezone: "Asia/Kolkata",
      bookingHorizonDays: 60,
      cancellationCutoffMinutes: 0,
      requireMobileVerification: false,
      otpExpirySeconds: 300,
      otpMaxAttempts: 5,
      sessionTimeoutMinutes: 60,
      notificationsEnabled: true,
      queuePollSeconds: 30
    };
  }
});

// artifacts/api-server/src/lib/display-preferences.ts
function clinicDisplayPreferences(clinic) {
  const dateFormats = ["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
  const source = clinic?.data ? { ...clinic.data, ...clinic } : clinic;
  return {
    dateFormat: dateFormats.includes(source?.dateFormat) ? source.dateFormat : "DD MMM YYYY",
    timeFormat: source?.timeFormat === "24h" ? "24h" : "12h"
  };
}
var init_display_preferences = __esm({
  "artifacts/api-server/src/lib/display-preferences.ts"() {
    "use strict";
  }
});

// artifacts/api-server/src/lib/notification-template-values.ts
import { parsePublicOrigin, publicWebsiteUrl } from "@workspace/api-zod/public-website";
function clinicBookingLink(clinic, origin = process.env.CLINICFLOW_PUBLIC_ORIGIN) {
  const slug = clinic?.slug ?? clinic?.data?.slug;
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !origin) return "";
  try {
    const site = parsePublicOrigin(origin);
    return site ? publicWebsiteUrl(site, `/${encodeURIComponent(slug)}`) : "";
  } catch {
    return "";
  }
}
function formatTemplateSession(row, clinic) {
  const preferences = clinicDisplayPreferences(clinic);
  const date2 = String(row?.date || "");
  const instant = /* @__PURE__ */ new Date(`${date2}T00:00:00Z`);
  let formattedDate = "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(date2) && Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === date2) {
    const [year, month, day] = date2.split("-");
    formattedDate = preferences.dateFormat === "DD/MM/YYYY" ? `${day}/${month}/${year}` : preferences.dateFormat === "MM/DD/YYYY" ? `${month}/${day}/${year}` : preferences.dateFormat === "YYYY-MM-DD" ? date2 : `${day} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(month) - 1]} ${year}`;
  }
  const time = (value) => {
    const clock = String(value || "");
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(clock)) return "";
    if (preferences.timeFormat === "24h") return clock;
    const [hour, minute] = clock.split(":");
    return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) < 12 ? "AM" : "PM"}`;
  };
  return { date: formattedDate, start: time(row?.startTime), end: time(row?.endTime) };
}
function appointmentSnapshotComplete(row) {
  return !!row && ["patientName", "doctorName", "clinicName", "branchName", "timezone", "reference", "token"].every((key4) => typeof row[key4] === "string" && !!row[key4].trim()) && !!formatTemplateSession(row, {}).date && !!formatTemplateSession(row, {}).start && !!formatTemplateSession(row, {}).end;
}
function previousSessionSnapshot(row) {
  return row && typeof row === "object" ? {
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime,
    detailsAvailable: appointmentSnapshotComplete(row),
    ...row.doctorId ? { doctorId: row.doctorId, doctorName: row.doctorName } : {},
    ...row.actorId ? { actorId: row.actorId } : {}
  } : void 0;
}
function visitTemplateValues(row, clinic, recipientName, previous) {
  const current = formatTemplateSession(row, clinic);
  const old = formatTemplateSession(previous, clinic);
  const cancellation = row?.status === "cancelled" && Array.isArray(row.history) ? [...row.history].reverse().find((entry) => entry?.action === "cancel" && entry?.status === "cancelled") : void 0;
  const cancelReason = typeof cancellation?.reason === "string" ? cancellation.reason.trim() : "";
  return {
    booking_link: clinicBookingLink(clinic),
    clinic_name: row ? row.clinicName || "" : clinic?.name || "",
    patient_name: row?.patientName || "",
    doctor_name: row?.doctorName || "",
    reference: row?.reference || "",
    timezone: row?.timezone || "",
    recipient_name: recipientName || "",
    appointment_date: current.date,
    session_start: current.start,
    session_end: current.end,
    previous_date: old.date,
    previous_session_start: old.start,
    previous_session_end: old.end,
    queue_token: String(row?.token ?? ""),
    token_number: Number.isInteger(row?.tokenNumber) && row.tokenNumber > 0 ? String(row.tokenNumber) : "",
    cancel_reason: row?.status === "cancelled" ? cancelReason || "Not specified" : ""
  };
}
function onboardingTemplateValues(snapshot, clinic, recipientName) {
  const sameClinic = snapshot?.clinicId === clinic?.id;
  const bound = sameClinic && snapshot?.adminId === clinic?.adminId;
  return {
    ...visitTemplateValues(null, clinic, recipientName),
    // Older occurrences never captured a label; retain their existing same-clinic
    // display fallback, but never infer the new owner-name placeholder.
    clinic_name: sameClinic ? snapshot.name || clinic.name || "" : "",
    clinic_admin_name: bound ? snapshot.clinicAdminName || "" : ""
  };
}
function missingVisitVariables(texts, values) {
  const used = texts.flatMap((text2) => [...text2.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((match) => match[1]));
  const required = used.filter((name) => name !== "clinic_contact");
  if (used.includes("appointment_details"))
    required.push("clinic_name", "patient_name", "doctor_name", "appointment_date", "session_start", "session_end", "queue_token", "reference", "timezone");
  if (used.includes("previous_details"))
    required.push("previous_date", "previous_session_start", "previous_session_end");
  return [...new Set(required.filter((name) => typeof values[name] !== "string" || !values[name].trim() || name === "otp" && !/^\d{6}$/.test(values[name]) || name === "expiry_minutes" && (!/^\d+$/.test(values[name]) || Number(values[name]) <= 0)))];
}
function snapshotIdentityMatches(snapshot, current, clinic) {
  return !!snapshot && !!current && clinic?.id === snapshot.clinicId && ["id", "clinicId", "branchId", "patientId", "doctorId"].every((key4) => typeof snapshot[key4] === "string" && !!snapshot[key4] && snapshot[key4] === current[key4]);
}
var init_notification_template_values = __esm({
  "artifacts/api-server/src/lib/notification-template-values.ts"() {
    "use strict";
    init_display_preferences();
  }
});

// artifacts/api-server/src/lib/objectAcl.ts
function isPermissionAllowed(requested, granted) {
  if (requested === "read" /* READ */) {
    return ["read" /* READ */, "write" /* WRITE */].includes(granted);
  }
  return granted === "write" /* WRITE */;
}
function createObjectAccessGroup(group) {
  switch (group.type) {
    // Implement per access group type, e.g.:
    // case "USER_LIST":
    //   return new UserListAccessGroup(group.id);
    default:
      throw new Error(`Unknown access group type: ${group.type}`);
  }
}
async function setObjectAclPolicy(objectFile, aclPolicy) {
  const [exists] = await objectFile.exists();
  if (!exists) {
    throw new Error(`Object not found: ${objectFile.name}`);
  }
  await objectFile.setMetadata({
    metadata: {
      [ACL_POLICY_METADATA_KEY]: JSON.stringify(aclPolicy)
    }
  });
}
async function getObjectAclPolicy(objectFile) {
  const [metadata2] = await objectFile.getMetadata();
  const aclPolicy = metadata2?.metadata?.[ACL_POLICY_METADATA_KEY];
  if (!aclPolicy) {
    return null;
  }
  return JSON.parse(aclPolicy);
}
async function canAccessObject({
  userId,
  objectFile,
  requestedPermission
}) {
  const aclPolicy = await getObjectAclPolicy(objectFile);
  if (!aclPolicy) {
    return false;
  }
  if (aclPolicy.visibility === "public" && requestedPermission === "read" /* READ */) {
    return true;
  }
  if (!userId) {
    return false;
  }
  if (aclPolicy.owner === userId) {
    return true;
  }
  for (const rule of aclPolicy.aclRules || []) {
    const accessGroup = createObjectAccessGroup(rule.group);
    if (await accessGroup.hasMember(userId) && isPermissionAllowed(requestedPermission, rule.permission)) {
      return true;
    }
  }
  return false;
}
var ACL_POLICY_METADATA_KEY;
var init_objectAcl = __esm({
  "artifacts/api-server/src/lib/objectAcl.ts"() {
    "use strict";
    ACL_POLICY_METADATA_KEY = "custom:aclPolicy";
  }
});

// artifacts/api-server/src/lib/objectStorage.ts
import { randomUUID as randomUUID3 } from "crypto";
import { Readable } from "stream";
import { Storage } from "@google-cloud/storage";
function parseObjectPath(path2) {
  if (!path2.startsWith("/")) {
    path2 = `/${path2}`;
  }
  const pathParts = path2.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");
  return {
    bucketName,
    objectName
  };
}
async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec
}) {
  const request2 = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1e3).toISOString()
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(request2),
      signal: AbortSignal.timeout(3e4)
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, make sure you're running on Replit`
    );
  }
  const { signed_url: signedURL } = await response.json();
  return signedURL;
}
var REPLIT_SIDECAR_ENDPOINT, objectStorageClient, ObjectNotFoundError, ObjectStorageService;
var init_objectStorage = __esm({
  "artifacts/api-server/src/lib/objectStorage.ts"() {
    "use strict";
    init_objectAcl();
    REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";
    objectStorageClient = new Storage({
      credentials: {
        audience: "replit",
        subject_token_type: "access_token",
        token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
        type: "external_account",
        credential_source: {
          url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
          format: {
            type: "json",
            subject_token_field_name: "access_token"
          }
        },
        universe_domain: "googleapis.com"
      },
      projectId: ""
    });
    ObjectNotFoundError = class _ObjectNotFoundError extends Error {
      constructor() {
        super("Object not found");
        this.name = "ObjectNotFoundError";
        Object.setPrototypeOf(this, _ObjectNotFoundError.prototype);
      }
    };
    ObjectStorageService = class {
      constructor() {
      }
      getPublicObjectSearchPaths() {
        const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
        const paths = Array.from(
          new Set(
            pathsStr.split(",").map((path2) => path2.trim()).filter((path2) => path2.length > 0)
          )
        );
        if (paths.length === 0) {
          throw new Error(
            "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
          );
        }
        return paths;
      }
      getPrivateObjectDir() {
        const dir = process.env.PRIVATE_OBJECT_DIR || "";
        if (!dir) {
          throw new Error(
            "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
          );
        }
        return dir;
      }
      async searchPublicObject(filePath2) {
        for (const searchPath of this.getPublicObjectSearchPaths()) {
          const fullPath = `${searchPath}/${filePath2}`;
          const { bucketName, objectName } = parseObjectPath(fullPath);
          const bucket = objectStorageClient.bucket(bucketName);
          const file = bucket.file(objectName);
          const [exists] = await file.exists();
          if (exists) {
            return file;
          }
        }
        return null;
      }
      async downloadObject(file, cacheTtlSec = 3600) {
        const [metadata2] = await file.getMetadata();
        const aclPolicy = await getObjectAclPolicy(file);
        const isPublic = aclPolicy?.visibility === "public";
        const nodeStream = file.createReadStream();
        const webStream = Readable.toWeb(nodeStream);
        const headers = {
          "Content-Type": metadata2.contentType || "application/octet-stream",
          "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`
        };
        if (metadata2.size) {
          headers["Content-Length"] = String(metadata2.size);
        }
        return new Response(webStream, { headers });
      }
      async getObjectEntityUploadURL(objectId = randomUUID3()) {
        const privateObjectDir = this.getPrivateObjectDir();
        if (!privateObjectDir) {
          throw new Error(
            "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' tool and set PRIVATE_OBJECT_DIR env var."
          );
        }
        if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(objectId))
          throw new Error("Invalid reserved upload identifier");
        const fullPath = `${privateObjectDir}/uploads/${objectId}`;
        const { bucketName, objectName } = parseObjectPath(fullPath);
        return signObjectURL({
          bucketName,
          objectName,
          method: "PUT",
          ttlSec: 900
        });
      }
      async getObjectEntityFile(objectPath) {
        if (!objectPath.startsWith("/objects/")) {
          throw new ObjectNotFoundError();
        }
        const parts = objectPath.slice(1).split("/");
        if (parts.length < 2) {
          throw new ObjectNotFoundError();
        }
        const entityId = parts.slice(1).join("/");
        let entityDir = this.getPrivateObjectDir();
        if (!entityDir.endsWith("/")) {
          entityDir = `${entityDir}/`;
        }
        const objectEntityPath = `${entityDir}${entityId}`;
        const { bucketName, objectName } = parseObjectPath(objectEntityPath);
        const bucket = objectStorageClient.bucket(bucketName);
        const objectFile = bucket.file(objectName);
        const [exists] = await objectFile.exists();
        if (!exists) {
          throw new ObjectNotFoundError();
        }
        return objectFile;
      }
      normalizeObjectEntityPath(rawPath) {
        if (!rawPath.startsWith("https://storage.googleapis.com/")) {
          return rawPath;
        }
        const url = new URL(rawPath);
        const rawObjectPath = url.pathname;
        let objectEntityDir = this.getPrivateObjectDir();
        if (!objectEntityDir.endsWith("/")) {
          objectEntityDir = `${objectEntityDir}/`;
        }
        if (!rawObjectPath.startsWith(objectEntityDir)) {
          return rawObjectPath;
        }
        const entityId = rawObjectPath.slice(objectEntityDir.length);
        return `/objects/${entityId}`;
      }
      async trySetObjectEntityAclPolicy(rawPath, aclPolicy) {
        const normalizedPath = this.normalizeObjectEntityPath(rawPath);
        if (!normalizedPath.startsWith("/")) {
          return normalizedPath;
        }
        const objectFile = await this.getObjectEntityFile(normalizedPath);
        await setObjectAclPolicy(objectFile, aclPolicy);
        return normalizedPath;
      }
      async canAccessObjectEntity({
        userId,
        objectFile,
        requestedPermission
      }) {
        return canAccessObject({
          userId,
          objectFile,
          requestedPermission: requestedPermission ?? "read" /* READ */
        });
      }
    };
  }
});

// artifacts/api-server/src/lib/local-media.ts
import { isAbsolute, join } from "node:path";
import { mkdir, open, unlink } from "node:fs/promises";
import { constants } from "node:fs";
function mediaConfig(env = process.env) {
  const driver = env.MEDIA_STORAGE || "object";
  assert(["local", "object"].includes(driver), 500, "MEDIA_STORAGE must be local or object");
  const root = env.MEDIA_ROOT || "";
  const url = (env.MEDIA_URL || "/media").replace(/\/$/, "");
  assert(/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(url) && !/^\/(api|admin|assets)(\/|$)/.test(url), 500, "MEDIA_URL must be a dedicated URL path, such as /media");
  if (driver === "local") {
    assert(isAbsolute(root) && root !== "/", 500, "Local media requires an absolute MEDIA_ROOT folder");
  }
  return { driver, root, url };
}
function filePath(key4) {
  assert(/^[a-f0-9-]{36}\.png$/.test(key4), 400, "Invalid media key");
  const { root } = mediaConfig();
  assert(isAbsolute(root), 503, "MEDIA_ROOT is required to read local logos");
  return join(root, key4);
}
async function readLocalLogo(key4) {
  const handle = await open(filePath(key4), constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    assert(stat.isFile() && stat.size <= 20 * 1024 * 1024, 400, "Invalid stored logo");
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}
var init_local_media = __esm({
  "artifacts/api-server/src/lib/local-media.ts"() {
    "use strict";
    init_http();
  }
});

// artifacts/api-server/src/lib/logo-bytes.ts
var logo_bytes_exports = {};
__export(logo_bytes_exports, {
  loadLogoBytes: () => loadLogoBytes
});
import { eq as eq4 } from "drizzle-orm";
async function loadLogoBytes(path2) {
  assert(/^\/api\/branding\/logos\/[a-f0-9-]{36}$/.test(path2), 400, "Invalid logo");
  const [row] = await db.select().from(settings).where(eq4(settings.id, `logo:${path2.split("/").at(-1)}`));
  const data2 = row?.data;
  assert(data2?.state === "ready", 400, "Logo is unavailable");
  if (data2.provider === "local") return readLocalLogo(data2.validatedPath);
  const file = await new ObjectStorageService().getObjectEntityFile(data2.validatedPath);
  const [bytes] = await file.download();
  return bytes;
}
var init_logo_bytes = __esm({
  "artifacts/api-server/src/lib/logo-bytes.ts"() {
    "use strict";
    init_db();
    init_objectStorage();
    init_http();
    init_local_media();
  }
});

// artifacts/api-server/src/lib/email-preview.ts
async function emailPreviewHtml(rendered, load = loadLogoBytes) {
  if (!rendered.logoPath) return rendered.html;
  try {
    const bytes = await load(rendered.logoPath);
    if (bytes.length > 2 * 1024 * 1024) throw new Error("Logo too large");
    return rendered.html.replace('src="cid:clinic-logo"', `src="data:image/png;base64,${bytes.toString("base64")}"`);
  } catch {
    return rendered.html.replace(
      /<img\b[^>]*src="cid:clinic-logo"[^>]*>/g,
      '<div style="color:#596780;font-size:12px">Clinic logo unavailable in preview</div>'
    );
  }
}
var init_email_preview = __esm({
  "artifacts/api-server/src/lib/email-preview.ts"() {
    "use strict";
    init_logo_bytes();
  }
});

// artifacts/api-server/src/lib/notification-template-store.ts
import { eq as eq5, sql as sql6 } from "drizzle-orm";
import { accountRoleLabel } from "@workspace/api-zod/notification-variable-contract";
async function stored(event, clinicId, conn = db, recipient = defaultRecipient(event), channel = "email") {
  const [row] = await conn.select().from(settings).where(eq5(settings.id, key3(event, clinicId, recipient, channel)));
  return row?.data || { revision: 0 };
}
async function authorizedTemplateScope(user, clinicId, conn = db) {
  assert(["superAdmin", "clinicAdmin"].includes(user.role), 403, "Administrator access required");
  assert(!user.demo && user.demoFixture !== DEMO_FIXTURE, 403, "Demo accounts cannot change notification configuration");
  if (!clinicId) {
    assert(user.role === "superAdmin", 403, "Select a clinic you own");
    return null;
  }
  const clinic = await one(clinics, clinicId, conn);
  assert(user.role === "superAdmin" || clinic.adminId === user.id, 403, "Clinic outside your administration scope");
  return clinic;
}
async function resolvedTemplate(event, clinicId, conn = db, recipient = defaultRecipient(event), channel = "email") {
  const platform = await stored(event, void 0, conn, recipient, channel);
  const local = clinicId ? await stored(event, clinicId, conn, recipient, channel) : platform;
  const fallback = defaultTemplate(event, recipient);
  const content = local.published || platform.published || (channel === "sms" ? { ...isSecurityEvent(event) ? securityDefault(event, true) : fallback, enabled: requiredEvent(event) || appointmentNotificationTarget(event, recipient), body: isSecurityEvent(event) ? securityDefault(event, true).body : event === "booking_status_link" ? fallback.body : event === "patient_login_otp" ? patientLoginSmsBody : `${eventTitles[event]}: {{clinic_name}}
${fallback.body}`, prefix: "", footer: "", logoUrl: "", senderId: "", dltEntityId: "", dltTemplateId: "" } : fallback);
  const [activation] = appointmentNotificationTarget(event, recipient) ? await conn.select().from(settings).where(eq5(settings.id, appointmentActivationId)) : [];
  const effectiveContent = requiredEvent(event) && typeof platform.activationEnabled === "boolean" ? { ...content, enabled: platform.activationEnabled } : content;
  return {
    content: channel === "sms" ? smsTemplateContent.parse(effectiveContent) : templateContent.parse(effectiveContent),
    local,
    wordingPublished: !!(local.published || platform.published) && !(local.published ? local : platform).activationOnly,
    activatedAt: Math.max((local.published ? local : platform).activatedAt ?? 0, local.activatedAt ?? 0, activation?.data?.cutoff ?? 0),
    effectiveRevision: local.published ? local.publishedRevision ?? (local.draft ? void 0 : local.revision) : platform.published ? platform.publishedRevision ?? (platform.draft ? void 0 : platform.revision) : 0,
    source: local.published ? clinicId ? "clinic" : "platform" : platform.published ? "platform" : "default"
  };
}
async function templateCatalog(user, clinicId, recipient, channel = "email", conn = db) {
  if (channel === "sms") assert(user.role === "superAdmin", 403, "Superadmin access required");
  if (recipient === "superAdmin") assert(user.role === "superAdmin", 403, "Superadmin access required");
  const clinic = await authorizedTemplateScope(user, clinicId, conn);
  const values = {
    ...visitTemplateValues(
      { date: "2030-01-15", startTime: "09:00", endTime: "12:00", token: "Q-007", tokenNumber: 7 },
      clinic,
      "[Recipient name]",
      { date: "2030-01-14", startTime: "14:00", endTime: "17:00" }
    ),
    clinic_name: clinic?.name || "Example clinic",
    clinic_contact: [clinic?.email, clinic?.phone].filter(Boolean).join(" \xB7 "),
    patient_name: "[Patient name]",
    doctor_name: "[Doctor name]",
    clinic_admin_name: "[Onboarded Clinic Admin name]",
    appointment_details: "[Clinic-formatted visit details]",
    previous_details: "[Previous visit details]",
    reference: "[Booking reference]",
    timezone: "[Clinic location timezone]"
  };
  values.cancel_reason = "[Cancellation reason]";
  const previewValues = { ...values, booking_status_link: "https://example.invalid/patient/queue?appointment=fictional", booking_link: clinic ? values.booking_link || "[Clinic booking link unavailable]" : "https://example.invalid/example-clinic", otp: "123456", expiry_minutes: "10", setup_link: "https://example.invalid/set-password?token=fictional-preview-only", role_name: accountRoleLabel(recipient || "receptionist") };
  const items = [];
  for (const event of templateEvents) {
    if (!validTemplateTarget(event, recipient || defaultRecipient(event), channel) || requiredEvent(event) && clinicId) continue;
    const { content, local, source } = await resolvedTemplate(event, clinicId, conn, recipient || defaultRecipient(event), channel);
    const candidate = local.draft || content;
    const preview = validEventContent(event, candidate) ? channel === "sms" ? { subject: substitute(candidate.subject, previewValues), text: substitute(candidate.body, previewValues) } : renderNotification(candidate, previewValues, { event }) : { subject: "Template preparation unavailable", text: "This saved template uses variables incompatible with this event. Edit it explicitly or reset; saved wording has not been changed." };
    items.push({
      event,
      recipient: recipient || defaultRecipient(event),
      title: eventTitles[event],
      revision: local.revision,
      source,
      content,
      draft: local.draft,
      previewSubject: preview.subject,
      previewBody: preview.text,
      previewHtml: channel === "email" && "html" in preview ? await emailPreviewHtml(preview) : void 0,
      required: requiredEvent(event),
      delivery: event === "booking_status_link" ? "Manual only, after staff previews and confirms. Requires approved published wording and its own registration. Patient must sign in with the account owning the booking. Development never sends; acceptance is not delivery." : requiredEvent(event) ? "Platform security message controlled at System Default. Own activation applies; Optional Delivery and operational provider switches do not. SMS requires approved published wording and sender/DLT configuration. Provider acceptance is not delivery. Real codes and links never enter notification history." : event === "onboarding" ? "Clinic onboarding retains its own activation and recipient policy. Communication Settings and eligible recipient contact apply. Development never sends automatically." : "Appointment Email and SMS default on for patient, owning Clinic Admin and assigned Doctor. Published overrides and personal opt-outs still apply. Active membership and valid unique contact are rechecked. SMS uses existing provider-specific sender/DLT metadata. Reminders are one hour before session start in its timezone, not a consultation-time promise. Development never sends automatically; provider acceptance is not delivery."
    });
  }
  return { scopeName: clinic?.name || "Platform defaults", variables: [...templateVariables], items };
}
async function saveTemplate(user, input, conn = db, maintenance = {}) {
  const parsed = templateSave.safeParse(input);
  assert(parsed.success, 400, parsed.success ? "" : parsed.error.issues.slice(0, 5).map((issue) => `${issue.path.join(".") || "template"}: ${issue.message}`).join("; ") || "Invalid template");
  const body = parsed.data;
  if (body.channel === "sms") assert(user.role === "superAdmin", 403, "Superadmin access required");
  if (body.content) body.content = (body.channel === "sms" ? smsTemplateContent : templateContent).parse(body.content);
  assert(validTemplateTarget(body.event, body.recipient || defaultRecipient(body.event), body.channel), 400, "Invalid event, recipient or channel");
  if (body.recipient === "superAdmin" || requiredEvent(body.event)) assert(user.role === "superAdmin", 403, "Superadmin access required");
  assert(!requiredEvent(body.event) || !body.clinicId, 400, "Security templates are platform-scoped");
  if (body.content) assert(validEventContent(body.event, body.content), 400, "Use this event's supported variables, including required code and expiry placeholders.");
  if (body.content && isSecurityEvent(body.event) && body.channel === "email" && ["doctor_setup", "staff_setup"].includes(body.event))
    assert(/\{\{\s*setup_link\s*\}\}/.test(body.content.body), 400, "Setup email must include {{setup_link}}");
  if (body.content && isSecurityEvent(body.event) && body.channel === "sms")
    assert(!/\{\{\s*setup_link\s*\}\}/.test(body.content.body), 400, "SMS must not include a bearer setup link");
  await conn.transaction(async (tx) => {
    await authorizedTemplateScope(user, body.clinicId, tx);
    const id2 = key3(body.event, body.clinicId, body.recipient, body.channel);
    await tx.execute(sql6`select pg_advisory_xact_lock(hashtextextended(${id2}, 0))`);
    const current = await stored(body.event, body.clinicId, tx, body.recipient, body.channel);
    assert(current.revision === body.revision, 409, "This template changed. Reload it before saving.");
    const next = { revision: current.revision + 1 };
    if (body.mode === "reset") {
      const before = await resolvedTemplate(body.event, body.clinicId, tx, body.recipient || defaultRecipient(body.event), body.channel);
      const inherited = body.clinicId ? await resolvedTemplate(body.event, void 0, tx, body.recipient || defaultRecipient(body.event), body.channel) : { content: { enabled: body.channel === "email" ? defaultTemplate(body.event, body.recipient || defaultRecipient(body.event)).enabled : requiredEvent(body.event) || appointmentNotificationTarget(body.event, body.recipient || defaultRecipient(body.event)) } };
      if (requiredEvent(body.event)) next.activationEnabled = before.content.enabled;
      next.activatedAt = !requiredEvent(body.event) && inherited.content.enabled && !before.content.enabled ? Date.now() : before.activatedAt;
    }
    if (body.mode === "draft") Object.assign(next, { published: current.published, draft: body.content, activationOnly: current.activationOnly, activationEnabled: current.activationEnabled });
    if (body.mode === "publish") {
      const previous = await resolvedTemplate(body.event, body.clinicId, tx, body.recipient || defaultRecipient(body.event), body.channel);
      if (body.channel === "sms" && body.content?.enabled) {
        let cfg;
        try {
          cfg = notificationSmsConfig((await resolvedIntegration("notificationSms", tx)).env);
        } catch {
          assert(false, 400, "Configure notification SMS before activation");
        }
        const sms = body.content;
        assert(smsMetadataReady(cfg, sms), 400, cfg.provider === "keepInTouch" ? "Sender ID and this event's DLT Template ID are required for activation" : "Sender ID, DLT Entity ID and DLT Template ID are required for activation");
      }
      next.published = body.content;
      if (requiredEvent(body.event)) next.activationEnabled = body.content.enabled;
      next.publishedRevision = next.revision;
      next.activatedAt = body.content?.enabled && !previous.content.enabled ? Date.now() : previous.activatedAt;
      if (maintenance.preserveDraft && current.draft) next.draft = current.draft;
      if (maintenance.activatedAtFloor !== void 0)
        next.activatedAt = Math.max(next.activatedAt ?? 0, maintenance.activatedAtFloor);
    }
    if (body.mode === "draft") {
      next.activatedAt = current.activatedAt;
      next.publishedRevision = current.publishedRevision ?? (current.published && !current.draft ? current.revision : void 0);
    }
    await tx.insert(settings).values({ id: id2, data: next }).onConflictDoUpdate({ target: settings.id, set: { data: next } });
    await audit(user, `template_${body.mode}`, "notification_templates", { id: id2, clinicId: body.clinicId }, tx);
  });
  return templateCatalog(user, body.clinicId, body.recipient, body.channel, conn);
}
async function changeActivation(user, input, conn = db) {
  assert(templateEvents.includes(input.event), 400, "Unsupported notification event");
  assert(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"].includes(input.recipient), 400, "Unsupported recipient");
  if (requiredEvent(input.event)) {
    assert(user.role === "superAdmin", 403, "Superadmin access required");
    assert(!input.clinicId, 400, "Security messages are managed at System Default");
  }
  assert(validTemplateTarget(input.event, input.recipient, input.channel), 400, "Invalid event, recipient or channel");
  assert(user.role === "superAdmin" || user.role === "clinicAdmin" && !!input.clinicId && input.recipient !== "superAdmin", 403, "Activation requires System Admin access or an owned clinic and clinic recipient");
  await conn.transaction(async (tx) => {
    await authorizedTemplateScope(user, input.clinicId, tx);
    const id2 = key3(input.event, input.clinicId, input.recipient, input.channel);
    await tx.execute(sql6`select pg_advisory_xact_lock(hashtextextended(${id2},0))`);
    const effective = await resolvedTemplate(input.event, input.clinicId, tx, input.recipient, input.channel);
    assert(effective.local.revision === input.revision, 409, "Template changed. Refresh before changing activation.");
    if (input.channel === "sms" && input.enabled) {
      assert(!isSecurityEvent(input.event) || effective.wordingPublished, 400, "Publish approved security SMS wording before activation");
      let cfg;
      try {
        cfg = notificationSmsConfig((await resolvedIntegration("notificationSms", tx)).env);
      } catch {
        assert(false, 400, "Configure notification SMS before activation");
      }
      const content = effective.content;
      assert(smsMetadataReady(cfg, content), 400, cfg.provider === "keepInTouch" ? "Publish a valid DLT Template ID for this event and configure a valid Sender ID before enabling SMS. Use Edit to publish the template; saved drafts do not count. Keep in Touch does not require an Entity ID." : "Publish this event's DLT Template ID and configure Sender and DLT Entity IDs before enabling SMS. Use Edit to publish the template; saved drafts do not count.");
    }
    const data2 = {
      ...effective.local,
      ...requiredEvent(input.event) ? { activationEnabled: input.enabled } : {},
      activationOnly: !effective.wordingPublished,
      revision: effective.local.revision + 1,
      publishedRevision: effective.local.revision + 1,
      published: { ...effective.content, enabled: input.enabled },
      activatedAt: input.enabled && !effective.content.enabled ? Date.now() : effective.local.activatedAt
    };
    await tx.insert(settings).values({ id: id2, data: data2 }).onConflictDoUpdate({ target: settings.id, set: { data: data2 } });
    await audit(user, "template_activation", "notification_templates", { id: id2, clinicId: input.clinicId }, tx);
  });
}
var key3, notificationTemplateKey;
var init_notification_template_store = __esm({
  "artifacts/api-server/src/lib/notification-template-store.ts"() {
    "use strict";
    init_db();
    init_store();
    init_http();
    init_notification_templates();
    init_notification_templates();
    init_integration_vault();
    init_notification_sms_transport();
    init_demo_policy();
    init_notification_template_values();
    init_notification_templates();
    init_security_template_definitions();
    init_appointment_notification_scope();
    init_email_preview();
    key3 = (event, clinicId, recipient = defaultRecipient(event), channel = "email") => `${channel === "sms" ? "sms" : "notification"}-template:${clinicId || "platform"}:${event}${recipient === defaultRecipient(event) ? "" : `:${recipient}`}`;
    notificationTemplateKey = key3;
  }
});

// artifacts/api-server/src/lib/email-template.ts
function systemEmailTemplate(subject, body, action) {
  return {
    text: `${emailBrand}

${subject}

${body}

${emailSupportText}

${automatedFooter}`,
    html: emailShell(subject, `<div style="white-space:pre-wrap">${action ? emailText(body).replace(emailText(action.url), () => emailAction(action.url, action.label)) : emailText(body)}</div>`)
  };
}
var init_email_template = __esm({
  "artifacts/api-server/src/lib/email-template.ts"() {
    "use strict";
    init_email_presentation();
  }
});

// artifacts/api-server/src/lib/auth-email.ts
import nodemailer from "nodemailer";
async function sendAuthEmail(to, subject, text2, transport, rendered, files = [], savedEnv, beforeDispatch) {
  const cfg = smtpConfig(savedEnv || (await resolvedIntegration("smtp")).env);
  let dispatchStarted = false;
  try {
    const client = transport || nodemailer.createTransport(smtpTransportOptions(cfg));
    const attachments = [...files];
    if (rendered?.logoPath) {
      const { loadLogoBytes: loadLogoBytes2 } = await Promise.resolve().then(() => (init_logo_bytes(), logo_bytes_exports));
      try {
        attachments.push({ filename: "clinic-logo.png", content: await loadLogoBytes2(rendered.logoPath), contentType: "image/png", cid: "clinic-logo" });
      } catch {
        throw new HttpError(503, "Email preparation unavailable", "EMAIL_PRE_DISPATCH_FAILED");
      }
    }
    const message = {
      from: cfg.from,
      to,
      subject,
      ...rendered || systemEmailTemplate(subject, text2),
      attachments,
      disableFileAccess: true,
      disableUrlAccess: true
    };
    await beforeDispatch?.();
    dispatchStarted = true;
    const result = await client.sendMail(message);
    if (result && typeof result === "object") {
      const delivery = result;
      if (Array.isArray(delivery.accepted) && delivery.accepted.length === 0 || Array.isArray(delivery.rejected) && delivery.rejected.length > 0)
        throw new EmailRejectionError("recipient_rejected");
    }
  } catch (error) {
    if (error instanceof HttpError && ["EMAIL_REJECTED", "EMAIL_PRE_DISPATCH_FAILED", "SECURITY_DELIVERY_DISABLED"].includes(error.code)) throw error;
    if (!dispatchStarted) throw new HttpError(503, "Email preparation unavailable", "EMAIL_PRE_DISPATCH_FAILED");
    const command = typeof error?.command === "string" ? error.command.toUpperCase() : "";
    const rejected = Number(error?.responseCode) >= 500 && Number(error?.responseCode) < 600;
    if (error?.code === "EAUTH" || rejected && /^AUTH(?: |$)/.test(command))
      throw new EmailRejectionError("authentication_rejected");
    if ((error?.code === "EENVELOPE" || rejected) && /^MAIL FROM(?: |$)/.test(command))
      throw new EmailRejectionError("sender_rejected");
    if ((error?.code === "EENVELOPE" || rejected) && /^RCPT TO(?: |$)/.test(command))
      throw new EmailRejectionError("recipient_rejected");
    if (error?.code === "EAUTH" || error?.code === "EENVELOPE" || [530, 535, 550, 551, 552, 553, 554].includes(error?.responseCode))
      throw new HttpError(503, "Email provider rejected the message", "EMAIL_REJECTED");
    if (["EDNS", "ECONNECTION"].includes(error?.code)) throw new HttpError(503, "Email connection unavailable", "EMAIL_PRE_DISPATCH_FAILED");
    throw new HttpError(503, "Email delivery outcome is uncertain", "EMAIL_DELIVERY_FAILED");
  }
}
var EmailRejectionError;
var init_auth_email = __esm({
  "artifacts/api-server/src/lib/auth-email.ts"() {
    "use strict";
    init_http();
    init_integration_config();
    init_email_template();
    init_integration_vault();
    init_integration_config();
    EmailRejectionError = class extends HttpError {
      constructor(diagnostic) {
        super(503, "Email provider rejected the message", "EMAIL_REJECTED");
        this.diagnostic = diagnostic;
      }
      diagnostic;
    };
  }
});

// artifacts/api-server/src/lib/auth-config.ts
function sessionMode(env = process.env) {
  const mode = env.AUTH_SESSION_MODE ?? "native";
  if (mode !== "native" && mode !== "jwt")
    throw new HttpError(503, "Authentication session mode is invalid", "AUTH_SESSION_UNCONFIGURED");
  return mode;
}
function jwtSigningKey(env = process.env) {
  const key4 = env.JWT_SIGNING_KEY;
  if (!key4 || key4.trim() !== key4 || Buffer.byteLength(key4, "utf8") < 32)
    throw new HttpError(503, "JWT signing key is not configured correctly", "AUTH_SESSION_UNCONFIGURED");
  return new TextEncoder().encode(key4);
}
var SESSION_AGE_SECONDS, SESSION_AGE, JWT_ISSUER, JWT_AUDIENCE;
var init_auth_config = __esm({
  "artifacts/api-server/src/lib/auth-config.ts"() {
    "use strict";
    init_http();
    SESSION_AGE_SECONDS = 12 * 60 * 60;
    SESSION_AGE = SESSION_AGE_SECONDS * 1e3;
    JWT_ISSUER = "digiq-doctors";
    JWT_AUDIENCE = "digiq-doctors-session";
  }
});

// artifacts/api-server/src/lib/jwt-session.ts
import { randomUUID as randomUUID4 } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
async function signSessionJwt(userId, issuedAt = Math.floor(Date.now() / 1e3)) {
  if (!userId || userId.trim() !== userId) throw new Error("Invalid session subject");
  return new SignJWT({ purpose: PURPOSE }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer(JWT_ISSUER).setAudience(JWT_AUDIENCE).setSubject(userId).setJti(randomUUID4()).setIssuedAt(issuedAt).setExpirationTime(issuedAt + SESSION_AGE_SECONDS).sign(jwtSigningKey());
}
var PURPOSE;
var init_jwt_session = __esm({
  "artifacts/api-server/src/lib/jwt-session.ts"() {
    "use strict";
    init_auth_config();
    PURPOSE = "app-session";
  }
});

// artifacts/api-server/src/lib/native-auth.ts
import { createHash as createHash3, createHmac as createHmac3, randomBytes as randomBytes3, randomInt, timingSafeEqual as timingSafeEqual2 } from "node:crypto";
import argon2 from "argon2";
import { and, eq as eq6, gt, inArray, isNull, lt, sql as sql7 } from "drizzle-orm";
function challengeDigest(id2, purpose, raw2) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret, "utf8") < 32)
    throw new HttpError(503, "Authentication secret is not configured", "AUTH_SECRET_UNCONFIGURED");
  return createHmac3("sha256", secret).update(`${purpose}:${id2}:${raw2}`).digest("hex");
}
function passwordInput(password) {
  if (typeof password !== "string" || password.length < 8 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || Buffer.byteLength(password, "utf8") > 1024)
    throw new HttpError(400, "Password must contain at least 8 characters, including letters and numbers, and at most 1024 bytes", "INVALID_PASSWORD");
}
async function hashPassword(password) {
  passwordInput(password);
  return argon2.hash(password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 1 });
}
async function verifyPassword(hash, password) {
  if (typeof password !== "string" || Buffer.byteLength(password, "utf8") > 1024) return false;
  dummyHash ||= hashPassword(`a1${randomBytes3(32).toString("base64url")}`);
  try {
    const verified = await argon2.verify(hash || await dummyHash, password);
    return Boolean(hash && verified);
  } catch {
    return false;
  }
}
function safeEqual(a, b) {
  const left = Buffer.from(a), right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual2(left, right);
}
async function lockCredentials(tx, userId) {
  await tx.execute(sql7`select pg_advisory_xact_lock(hashtext(${"auth-credentials:" + userId}))`);
}
async function insertSession(tx, userId) {
  const mode = sessionMode();
  const issuedAt = Math.floor(Date.now() / 1e3);
  const token = mode === "jwt" ? await signSessionJwt(userId, issuedAt) : randomBytes3(32).toString("base64url");
  const expiresAt = new Date(mode === "jwt" ? issuedAt * 1e3 + SESSION_AGE : Date.now() + SESSION_AGE);
  await tx.insert(authSessions).values({ tokenHash: digest2(token), userId, expiresAt });
  return token;
}
async function consumeRateLimit(key4, max, windowMs = 6e5) {
  if (randomBytes3(1)[0] === 0)
    await db.delete(authRateLimits).where(lt(authRateLimits.expiresAt, /* @__PURE__ */ new Date()));
  const hash = digest2(key4);
  await db.transaction(async (tx) => {
    const result = await tx.execute(sql7`insert into auth_rate_limits ("key",attempts,expires_at)
      values (${hash},1,now() + (${windowMs} * interval '1 millisecond'))
      on conflict ("key") do update
      set attempts=case when auth_rate_limits.expires_at<now() then 1 else auth_rate_limits.attempts+1 end,
          expires_at=case when auth_rate_limits.expires_at<now() then now() + (${windowMs} * interval '1 millisecond') else auth_rate_limits.expires_at end
      returning attempts, greatest(1,ceil(extract(epoch from (expires_at-now()))))::int as retry_seconds`);
    if (Number(result.rows[0]?.attempts) > max) {
      const seconds = Number(result.rows[0]?.retry_seconds);
      throw new HttpError(429, `Too many attempts. Try again in ${seconds} seconds.`, "RATE_LIMITED");
    }
  });
}
async function createChallenge(input) {
  const id2 = randomBytes3(18).toString("base64url");
  await db.delete(authChallenges).where(lt(authChallenges.expiresAt, /* @__PURE__ */ new Date()));
  await db.transaction(async (tx) => {
    if (input.userId) await lockCredentials(tx, input.userId);
    if (input.userId && input.purpose === "patient-sms")
      await tx.update(authChallenges).set({ consumedAt: /* @__PURE__ */ new Date(), data: {} }).where(and(eq6(authChallenges.userId, input.userId), eq6(authChallenges.purpose, "patient-sms"), isNull(authChallenges.consumedAt)));
    await tx.insert(authChallenges).values({
      id: id2,
      userId: input.userId,
      email: input.email,
      purpose: input.purpose,
      tokenHash: challengeDigest(id2, input.purpose, input.secret),
      expiresAt: new Date(Date.now() + input.ttlMs),
      data: input.data || {}
    });
  });
  return id2;
}
async function consumeChallenge(id2, purpose, secret, transaction) {
  const consume = async (tx) => {
    const [challenge] = await tx.select().from(authChallenges).where(eq6(authChallenges.id, id2)).for("update");
    if (!challenge || challenge.purpose !== purpose || challenge.consumedAt || challenge.expiresAt <= /* @__PURE__ */ new Date() || challenge.attempts >= 5) return null;
    const matching = safeEqual(challenge.tokenHash, challengeDigest(id2, purpose, secret));
    await tx.update(authChallenges).set({
      attempts: challenge.attempts + 1,
      ...matching ? { consumedAt: /* @__PURE__ */ new Date(), data: {} } : {}
    }).where(eq6(authChallenges.id, id2));
    return matching ? challenge : null;
  };
  const row = transaction ? await consume(transaction) : await db.transaction(consume);
  if (!row) throw new HttpError(400, "Invalid or expired verification", "INVALID_VERIFICATION");
  return row;
}
var digest2, dummyHash;
var init_native_auth = __esm({
  "artifacts/api-server/src/lib/native-auth.ts"() {
    "use strict";
    init_db();
    init_http();
    init_auth_config();
    init_jwt_session();
    digest2 = (raw2) => createHash3("sha256").update(raw2).digest("hex");
  }
});

// artifacts/api-server/src/lib/staff-dispatch-barrier.ts
import { randomUUID as randomUUID5 } from "node:crypto";
import { eq as eq7, sql as sql8 } from "drizzle-orm";
async function withStaffDispatch(userIds, source, work, conn = db, isUncertain = () => false) {
  const ids = [...new Set(userIds.filter(Boolean))].sort();
  if (!ids.length) return work();
  const id2 = `staff-dispatch:${randomUUID5()}`, claimId = randomUUID5(), createdAt = Date.now();
  await conn.transaction(async (tx) => {
    for (const userId of ids) await lockCredentials(tx, userId);
    for (const userId of ids) {
      const [user] = await tx.select({ id: users.id, status: users.status, role: users.role }).from(users).where(eq7(users.id, userId)).for("share");
      assert(
        user && ["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(user.role),
        409,
        "Staff account is no longer available for this dispatch"
      );
    }
    await tx.insert(settings).values({ id: id2, data: { claimId, userIds: ids, source, state: "sending", createdAt } });
  });
  const finish = async (state) => {
    await conn.execute(sql8`update settings set data=data || ${JSON.stringify({ state, finishedAt: Date.now() })}::jsonb
      where id=${id2} and data->>'claimId'=${claimId} and data->>'state'='sending'`);
  };
  try {
    const value = await work();
    await finish(isUncertain(value) ? "delivery_unknown" : "completed");
    return value;
  } catch (error) {
    const knownNoUncertainSend = ["EMAIL_UNCONFIGURED", "EMAIL_PRE_DISPATCH_FAILED", "EMAIL_REJECTED"].includes(error?.code);
    try {
      await finish(knownNoUncertainSend ? "completed" : "delivery_unknown");
    } catch {
    }
    throw error;
  }
}
var init_staff_dispatch_barrier = __esm({
  "artifacts/api-server/src/lib/staff-dispatch-barrier.ts"() {
    "use strict";
    init_db();
    init_http();
    init_native_auth();
  }
});

// artifacts/api-server/src/lib/clinical-membership.ts
import { sql as sql11 } from "drizzle-orm";
function clinicalMembership(doctorId, branchId, clinicId) {
  return sql11`exists (
    select 1 from doctors cm_d
    join users cm_u on cm_u.id=cm_d.user_id and cm_u.status='active'
    join branches cm_b on cm_b.status='active'
    join clinics cm_c on cm_c.id=cm_b.clinic_id and cm_c.status='active'
    where cm_d.id=${doctorId} and cm_d.status='active'
      ${branchId ? sql11`and cm_b.id=${branchId}` : sql11``}
      ${clinicId ? sql11`and cm_c.id=${clinicId}` : sql11``}
      and (
        (cm_u.role='doctor' and exists (
          select 1 from assignments cm_a where cm_a.user_id=cm_d.user_id
          and cm_a.clinic_id=cm_b.clinic_id and cm_a.branch_id=cm_b.id
        ))
        or (cm_u.role='clinicAdmin' and cm_d.user_id=cm_d.owner_admin_id
          and cm_c.admin_id=cm_u.id
          and jsonb_typeof(cm_d.data->'branchIds')='array'
          and cm_d.data->'branchIds' ? cm_b.id
          and exists (select 1 from assignments cm_a where cm_a.user_id=cm_u.id
            and cm_a.clinic_id=cm_c.id and cm_a.branch_id is null))
      )
  )`;
}
function managedDoctorLinks(doctorId) {
  return sql11`select a.clinic_id, a.branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='doctor'
    join assignments a on a.user_id=md.user_id
    join clinics c on c.id=a.clinic_id and c.admin_id=md.owner_admin_id
    where md.id=${doctorId} and (a.branch_id is null or exists (
      select 1 from branches b where b.id=a.branch_id and b.clinic_id=c.id))
    union all
    select a.clinic_id, null::text as branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='clinicAdmin' and md.owner_admin_id=mu.id
    join assignments a on a.user_id=mu.id and a.branch_id is null
    join clinics c on c.id=a.clinic_id and c.admin_id=mu.id
    where md.id=${doctorId}
    union all
    select b.clinic_id, b.id as branch_id from doctors md
    join users mu on mu.id=md.user_id and mu.role='clinicAdmin' and md.owner_admin_id=mu.id
    join branches b on jsonb_typeof(md.data->'branchIds')='array' and md.data->'branchIds' ? b.id
    join clinics c on c.id=b.clinic_id and c.admin_id=mu.id
    join assignments a on a.user_id=mu.id and a.clinic_id=c.id and a.branch_id is null
    where md.id=${doctorId}`;
}
async function clinicalBranchIds(doctorId, conn = db) {
  const doctorRows = await all(doctors, conn), accountRows = await all(users, conn);
  const links2 = await all(assignments, conn), branchRows = await all(branches, conn), clinicRows = await all(clinics, conn);
  const doctor = doctorRows.find((d) => d.id === doctorId);
  const account2 = accountRows.find((u) => u.id === doctor?.userId);
  if (doctor?.status !== "active" || account2?.status !== "active") return [];
  const selected = doctor.branchIds;
  return branchRows.filter((branch) => {
    if (branch.status !== "active") return false;
    const clinic = clinicRows.find((c) => c.id === branch.clinicId);
    if (clinic?.status !== "active") return false;
    if (account2.role === "doctor") return links2.some((a) => a.userId === doctor.userId && a.clinicId === branch.clinicId && a.branchId === branch.id);
    return account2.role === "clinicAdmin" && doctor.userId === doctor.ownerAdminId && clinic.adminId === account2.id && Array.isArray(selected) && selected.includes(branch.id) && links2.some((a) => a.userId === account2.id && a.clinicId === clinic.id && !a.branchId);
  }).map((b) => b.id).sort();
}
async function isClinicalMember(doctorId, branchId, conn = db) {
  return (await clinicalBranchIds(doctorId, conn)).includes(branchId);
}
var init_clinical_membership = __esm({
  "artifacts/api-server/src/lib/clinical-membership.ts"() {
    "use strict";
    init_db();
    init_store();
  }
});

// artifacts/api-server/src/lib/reschedule-display-snapshot.ts
import { eq as eq10 } from "drizzle-orm";
var init_reschedule_display_snapshot = __esm({
  "artifacts/api-server/src/lib/reschedule-display-snapshot.ts"() {
    "use strict";
    init_db();
    init_store();
  }
});

// artifacts/api-server/src/lib/patient-registration-scope.ts
import { sql as sql12 } from "drizzle-orm";
function doctorRegistrationSql(user, clinic, branch) {
  return sql12`(${!!user.doctorId} and exists (
    select 1 from assignments pr_a
    join clinics pr_c on pr_c.id=pr_a.clinic_id and pr_c.status='active'
    left join branches pr_b on pr_b.id=pr_a.branch_id and pr_b.clinic_id=pr_c.id and pr_b.status='active'
    where pr_a.user_id=${user.id} and pr_a.clinic_id=${clinic}
      and (pr_a.branch_id is null or pr_b.id is not null)
      and (${branch} is null or pr_b.id=${branch})
  ))`;
}
var init_patient_registration_scope = __esm({
  "artifacts/api-server/src/lib/patient-registration-scope.ts"() {
    "use strict";
    init_db();
    init_store();
  }
});

// artifacts/api-server/src/lib/feature-policy.ts
function notificationKind(toStatus, booking = false) {
  if (booking) return "appointments";
  return QUEUE_STATUSES.has(toStatus) ? "queue" : "appointments";
}
function receivesSharedView(viewerRole, sharedRole) {
  if (!sharedRole) return false;
  return sharedRole === "staff" ? SHARED_STAFF_ROLES.has(viewerRole) : sharedRole === viewerRole;
}
function sanitizeSavedView(input) {
  if (!VIEW_TABLE_KEY.test(input.tableKey)) throw new Error("Invalid table");
  const name = String(input.name || "").trim().slice(0, 60);
  if (!name) throw new Error("Enter a view name");
  const filters2 = {};
  for (const [k, v] of Object.entries(input.filters || {}).slice(0, 30)) {
    if (UNSAFE_VIEW_KEYS.has(k) || !VIEW_FILTER_KEY.test(k)) continue;
    if (typeof v === "string" && VIEW_SAFE_VALUE.test(v)) filters2[k] = v;
  }
  const cols = (v) => Array.isArray(v) ? v.filter((x) => typeof x === "string" && COLUMN.test(x)).slice(0, 40) : [];
  const columns = input.columns ? { order: cols(input.columns.order), hidden: cols(input.columns.hidden), pinned: typeof input.columns.pinned === "string" && COLUMN.test(input.columns.pinned) ? input.columns.pinned : null } : void 0;
  return { tableKey: input.tableKey, name, filters: filters2, columns };
}
var QUEUE_STATUSES, VIEW_TABLE_KEY, VIEW_FILTER_KEY, VIEW_SAFE_VALUE, UNSAFE_VIEW_KEYS, COLUMN, SHARE_ROLES, SHARED_STAFF_ROLES, shareAudience, DOCUMENT_MAX_BYTES;
var init_feature_policy = __esm({
  "artifacts/api-server/src/lib/feature-policy.ts"() {
    "use strict";
    QUEUE_STATUSES = /* @__PURE__ */ new Set(["checkedIn", "waiting", "called", "inConsultation"]);
    VIEW_TABLE_KEY = /^[a-z][a-z0-9-]{0,59}$/;
    VIEW_FILTER_KEY = /^[a-zA-Z][a-zA-Z0-9]{0,39}$/;
    VIEW_SAFE_VALUE = /^[A-Za-z0-9_\-:.,]{1,80}$/;
    UNSAFE_VIEW_KEYS = /* @__PURE__ */ new Set(["search", "q", "page", "name", "fullName", "email", "mobile", "phone", "patientName", "reference"]);
    COLUMN = /^[a-zA-Z][a-zA-Z0-9_-]{0,59}$/;
    SHARE_ROLES = /* @__PURE__ */ new Set(["superAdmin", "clinicAdmin"]);
    SHARED_STAFF_ROLES = /* @__PURE__ */ new Set(["clinicAdmin", "doctor", "receptionist"]);
    shareAudience = (role) => role === "superAdmin" ? "superAdmin" : "staff";
    DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
  }
});

// artifacts/api-server/src/lib/retained-doctor-access.ts
import { sql as sql13 } from "drizzle-orm";
function retainedDoctorVisitSql(user, patient, appointment) {
  if (user.role !== "doctor" || !user.handoffHistoryInstalled || !user.doctorId || !user.clinicIds?.length || !user.branchIds?.length)
    return sql13`false`;
  const values = (ids) => sql13.join(ids.map((id2) => sql13`${id2}`), sql13.raw(","));
  return sql13`exists(select 1 from appointment_transitions ht where ht.patient_id=${patient}
    and ht.from_doctor_id=${user.doctorId} and ht.clinic_id in (${values(user.clinicIds)})
    and ht.from_branch_id in (${values(user.branchIds)}) ${appointment ? sql13`and ht.appointment_id=${appointment}` : sql13``})`;
}
var init_retained_doctor_access = __esm({
  "artifacts/api-server/src/lib/retained-doctor-access.ts"() {
    "use strict";
  }
});

// artifacts/api-server/src/lib/auth.ts
import { eq as eq11, sql as sql14 } from "drizzle-orm";
var init_auth = __esm({
  "artifacts/api-server/src/lib/auth.ts"() {
    "use strict";
    init_db();
    init_http();
    init_store();
    init_clinical_membership();
    init_patient_registration_scope();
    init_feature_policy();
    init_demo_policy();
    init_retained_doctor_access();
  }
});

// artifacts/api-server/src/lib/queue-order.ts
var pendingStatuses, statusGroups;
var init_queue_order = __esm({
  "artifacts/api-server/src/lib/queue-order.ts"() {
    "use strict";
    pendingStatuses = ["booked", "checkedIn", "waiting"];
    statusGroups = {
      active: [...pendingStatuses, "called", "inConsultation"],
      waiting: pendingStatuses,
      absent: ["noShow"],
      completed: ["completed"],
      cancelled: ["cancelled"]
    };
  }
});

// artifacts/api-server/src/lib/session-duration.ts
import { eq as eq12 } from "drizzle-orm";
var init_session_duration = __esm({
  "artifacts/api-server/src/lib/session-duration.ts"() {
    "use strict";
    init_db();
    init_store();
    init_queue_order();
  }
});

// artifacts/api-server/src/lib/availability.ts
import { eq as eq13 } from "drizzle-orm";
var init_availability = __esm({
  "artifacts/api-server/src/lib/availability.ts"() {
    "use strict";
    init_db();
    init_clinical_membership();
    init_session_duration();
    init_store();
    init_http();
    init_display_preferences();
  }
});

// artifacts/api-server/src/lib/presence.ts
import { eq as eq14 } from "drizzle-orm";
var init_presence = __esm({
  "artifacts/api-server/src/lib/presence.ts"() {
    "use strict";
    init_db();
    init_session_duration();
  }
});

// artifacts/api-server/src/lib/appointment-eligibility.ts
var init_appointment_eligibility = __esm({
  "artifacts/api-server/src/lib/appointment-eligibility.ts"() {
    "use strict";
    init_availability();
    init_availability();
    init_http();
    init_db();
    init_store();
  }
});

// artifacts/api-server/src/lib/booking-contact.ts
import { parsePhoneNumberFromString as parsePhoneNumberFromString4 } from "libphonenumber-js/max";
var init_booking_contact = __esm({
  "artifacts/api-server/src/lib/booking-contact.ts"() {
    "use strict";
    init_http();
  }
});

// artifacts/api-server/src/lib/custom-roles.ts
var custom_roles_exports = {};
__export(custom_roles_exports, {
  customRolesInput: () => customRolesInput,
  enforceCustomRoles: () => enforceCustomRoles,
  getCustomRoles: () => getCustomRoles,
  saveCustomRoles: () => saveCustomRoles
});
import { eq as eq15, sql as sql15, and as and2 } from "drizzle-orm";
import { z as z5 } from "zod";
async function getCustomRoles(conn = db) {
  const [row] = await conn.select().from(settings).where(eq15(settings.id, "custom-roles"));
  return row?.data || { revision: 0, roles: [], bindings: [] };
}
async function saveCustomRoles(actor, input) {
  assert(actor.role === "superAdmin", 403, "Super Admin access required");
  const parsed = customRolesInput.safeParse(input);
  assert(parsed.success, 400, "Invalid roles or assignments");
  const body = parsed.data;
  assert(new Set(body.roles.map((r) => r.id)).size === body.roles.length, 400, "Duplicate role identifier");
  assert(new Set(body.roles.map((r) => r.name.toLowerCase())).size === body.roles.length, 400, "Role names must be unique");
  assert(new Set(body.bindings.map((b) => `${b.userId}:${b.roleId}:${b.clinicId || ""}`)).size === body.bindings.length, 400, "Duplicate role assignment");
  return db.transaction(async (tx) => {
    await tx.execute(sql15`select pg_advisory_xact_lock(hashtext('custom-roles'))`);
    const current = await getCustomRoles(tx);
    assert(current.revision === body.revision, 409, "Roles changed. Reload before saving.");
    for (const binding of body.bindings) {
      const role = body.roles.find((r) => r.id === binding.roleId);
      const [user] = await tx.select().from(users).where(eq15(users.id, binding.userId));
      assert(role && user && user.role === role.baseRole && user.status === "active", 400, "Assign roles only to active staff with the matching base role");
      if (binding.clinicId) {
        const [clinic] = await tx.select().from(clinics).where(eq15(clinics.id, binding.clinicId));
        const links2 = await tx.select().from(assignments).where(and2(eq15(assignments.userId, user.id), eq15(assignments.clinicId, binding.clinicId)));
        assert(clinic && (clinic.adminId === user.id || links2.length > 0), 400, "The user must already belong to this clinic");
      }
    }
    const next = { ...body, revision: current.revision + 1 };
    await tx.insert(settings).values({ id: "custom-roles", data: next }).onConflictDoUpdate({ target: settings.id, set: { data: next } });
    await audit(actor, "configure", "custom_roles", { id: "custom-roles" }, tx);
    return next;
  });
}
async function enforceCustomRoles(user, req, module, action) {
  const config = await getCustomRoles();
  const relevant = config.bindings.filter((b) => b.userId === user.id).filter((b) => config.roles.some((r) => r.id === b.roleId && r.baseRole === user.role && r.denied.includes(`${module}:${action}`)));
  if (!relevant.length) return;
  assert(!relevant.some((b) => !b.clinicId), 403, "Your assigned role does not allow this action");
  const parts = req.path.split("/").filter(Boolean);
  let clinicId = req.body?.clinicId || req.query?.clinicId;
  const branchId = req.body?.branchId || req.query?.branchId;
  if (typeof branchId === "string") {
    const [branch] = await db.select().from(branches).where(eq15(branches.id, branchId));
    clinicId = branch?.clinicId;
  }
  const tables = { clinics, branches, appointments, doctors, patients, schedules, "availability-exceptions": availabilityExceptions, qrs };
  const table = tables[parts[0]];
  if (parts.length > 1 && !table && !["management", "queue"].includes(parts[0])) clinicId = void 0;
  if (table && parts[1] && !["public", "search"].includes(parts[1])) {
    const [record2] = await db.select().from(table).where(eq15(table.id, parts[1]));
    const row = record2 && { ...record2.data, ...record2 };
    clinicId = parts[0] === "clinics" ? row?.id : row?.clinicId;
    if (!clinicId && row?.branchId) {
      const [branch] = await db.select().from(branches).where(eq15(branches.id, row.branchId));
      clinicId = branch?.clinicId;
    }
  }
  assert(typeof clinicId === "string" && clinicId.length > 0, 403, "Select a clinic scope before using this operation with your assigned role");
  assert(!relevant.some((b) => b.clinicId === clinicId), 403, "Your assigned role does not allow this action in this clinic");
}
var capabilityKeys, roleSchema, bindingSchema, customRolesInput;
var init_custom_roles = __esm({
  "artifacts/api-server/src/lib/custom-roles.ts"() {
    "use strict";
    init_db();
    init_http();
    init_store();
    init_permission_policy();
    capabilityKeys = new Set(permissionModules.flatMap((m) => permissionActions.map((a) => `${m}:${a}`)));
    roleSchema = z5.object({
      id: z5.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
      name: z5.string().trim().min(1).max(80),
      baseRole: z5.enum(["clinicAdmin", "doctor", "receptionist"]),
      denied: z5.array(z5.string().refine((k) => capabilityKeys.has(k))).max(capabilityKeys.size)
    }).strict();
    bindingSchema = z5.object({ userId: z5.string().min(1), roleId: z5.string().min(1), clinicId: z5.string().min(1).optional() }).strict();
    customRolesInput = z5.object({ revision: z5.number().int().min(0), roles: z5.array(roleSchema).max(100), bindings: z5.array(bindingSchema).max(5e3) }).strict();
  }
});

// artifacts/api-server/src/lib/permission-policy.ts
import { eq as eq16 } from "drizzle-orm";
async function permissionPolicy(conn = db) {
  const [row] = await conn.select().from(settings).where(eq16(settings.id, "permission-policy"));
  return row?.data || { revision: 0, denied: [] };
}
async function enforcePermissionPolicy(user, req) {
  if (user.role === "superAdmin") return;
  const parts = req.path.split("/").filter(Boolean);
  let module = parts[0];
  if (module === "live-ticket-links") module = "appointments";
  if (module === "notifications" || module === "search" && parts[1] === "records") module = "appointments";
  if (module === "patient-documents") module = "patients";
  if (module === "clinic-registration") module = "clinics";
  if (module === "me" && parts[1] === "doctor-profile") module = "doctors";
  if (module === "management" && parts[1] === "templates") module = "templates";
  if (module === "clinic-settings") module = "clinics";
  if (!permissionModules.includes(module)) return;
  let action = req.method === "GET" ? "read" : req.method === "DELETE" ? "delete" : req.method === "POST" && parts.length === 1 ? "create" : "update";
  if (parts[0] === "live-ticket-links") action = "read";
  if (parts[0] === "notifications") action = "read";
  if (parts[0] === "me" && parts[1] === "doctor-profile" && req.method === "POST") action = "create";
  if (parts.includes("reschedule")) action = "reschedule";
  if (parts.includes("actions") && ["cancel", "complete"].includes(req.body?.action)) action = req.body.action;
  const policy = await permissionPolicy();
  assert(!policy.denied.includes(`${user.role}:${module}:${action}`), 403, "This operation is disabled by your administrator");
  const { enforceCustomRoles: enforceCustomRoles2 } = await Promise.resolve().then(() => (init_custom_roles(), custom_roles_exports));
  await enforceCustomRoles2(user, req, module, action);
}
var permissionModules, permissionActions;
var init_permission_policy = __esm({
  "artifacts/api-server/src/lib/permission-policy.ts"() {
    "use strict";
    init_db();
    init_http();
    permissionModules = ["clinics", "branches", "users", "doctors", "patients", "appointments", "queue", "schedules", "availability-exceptions", "qrs", "reports", "templates"];
    permissionActions = ["read", "create", "update", "delete", "cancel", "reschedule", "complete"];
  }
});

// artifacts/api-server/src/lib/appointment-booking-edit.ts
import { z as z6 } from "zod";
var bookingDetailsUpdate;
var init_appointment_booking_edit = __esm({
  "artifacts/api-server/src/lib/appointment-booking-edit.ts"() {
    "use strict";
    init_db();
    init_auth();
    init_http();
    init_store();
    init_appointments();
    init_booking_contact();
    init_permission_policy();
    init_custom_roles();
    bookingDetailsUpdate = z6.object({
      expectedRevision: z6.number().int().min(0),
      expectedBookingDetailsRevision: z6.number().int().min(0),
      bookingMobile: z6.string().max(16),
      notes: z6.string().max(1e3)
    }).strict();
  }
});

// artifacts/api-server/src/lib/arrival-estimate.ts
var init_arrival_estimate = __esm({
  "artifacts/api-server/src/lib/arrival-estimate.ts"() {
    "use strict";
    init_queue_order();
  }
});

// artifacts/api-server/src/lib/appointment-estimates.ts
import { sql as sql16 } from "drizzle-orm";
var init_appointment_estimates = __esm({
  "artifacts/api-server/src/lib/appointment-estimates.ts"() {
    "use strict";
    init_db();
    init_store();
    init_session_duration();
    init_presence();
    init_arrival_estimate();
    init_availability();
  }
});

// artifacts/api-server/src/lib/appointments.ts
import { sql as sql17 } from "drizzle-orm";
async function lockQueue(conn, doctorId, branchId, date2) {
  await conn.execute(sql17`select pg_advisory_xact_lock(hashtext(${"schedules:" + doctorId}))`);
  await conn.execute(sql17`select pg_advisory_xact_lock(hashtext(${`${doctorId}:${branchId}:${date2}`}))`);
}
var init_appointments = __esm({
  "artifacts/api-server/src/lib/appointments.ts"() {
    "use strict";
    init_db();
    init_reschedule_display_snapshot();
    init_store();
    init_http();
    init_auth();
    init_availability();
    init_queue_order();
    init_presence();
    init_session_duration();
    init_display_preferences();
    init_appointment_eligibility();
    init_appointment_booking_edit();
    init_appointment_estimates();
  }
});

// artifacts/api-server/src/lib/notification-preferences.ts
import { eq as eq17, sql as sql18 } from "drizzle-orm";
async function lockNotificationPreferences(conn) {
  await conn.execute(sql18`select pg_advisory_xact_lock(hashtext('notification-preference-barrier'))`);
}
async function personalPreferences(userId, conn = db) {
  const [row] = await conn.select().from(settings).where(eq17(settings.id, preferenceId(userId)));
  return { revision: 0, choices: {}, epochs: {}, ...row?.data };
}
async function recipientPreference(conn, userId, channel, event, capturedEpoch) {
  if (!userId || requiredEvent(event)) return { enabled: true, epoch: 0 };
  const preferences = await personalPreferences(userId, conn);
  const key4 = preferenceKey(channel, event), epoch = preferences.epochs[key4] || 0;
  return { enabled: preferences.choices[key4] !== false && (capturedEpoch === void 0 || capturedEpoch === epoch), epoch };
}
async function notificationRecipientUser(conn, data2) {
  if (data2.recipientUserId) return data2.recipientUserId;
  const patientId = data2.recipientPatientId || (data2.recipientGroup === "patient" ? data2.snapshot?.patientId : null);
  if (patientId) {
    const [patient] = await conn.select({ userId: patients.userId }).from(patients).where(eq17(patients.id, patientId));
    return patient?.userId || null;
  }
  if (data2.event === "onboarding" && data2.recipientGroup !== "superAdmin") {
    const [clinic] = await conn.select({ adminId: clinics.adminId }).from(clinics).where(eq17(clinics.id, data2.clinicId));
    return clinic?.adminId || null;
  }
  return null;
}
async function pendingPreferenceAllowed(conn, data2, channel) {
  const userId = await notificationRecipientUser(conn, data2);
  if (data2.preferenceUserId !== void 0 && (data2.preferenceUserId || null) !== userId) return false;
  return (await recipientPreference(conn, userId, channel, data2.event, data2.preferenceEpoch ?? 0)).enabled;
}
async function writePersonalPreferences(conn, userId, value) {
  await conn.insert(settings).values({ id: preferenceId(userId), data: value }).onConflictDoUpdate({ target: settings.id, set: { data: value } });
}
var preferenceId, preferenceKey;
var init_notification_preferences = __esm({
  "artifacts/api-server/src/lib/notification-preferences.ts"() {
    "use strict";
    init_db();
    init_security_template_definitions();
    preferenceId = (userId) => `notification-preferences:${userId}`;
    preferenceKey = (channel, event) => `${channel}:${event}`;
  }
});

// artifacts/api-server/src/lib/appointment-confirmation.ts
var appointment_confirmation_exports = {};
__export(appointment_confirmation_exports, {
  capturePatientConfirmation: () => capturePatientConfirmation,
  confirmAppointmentEmail: () => confirmAppointmentEmail,
  confirmationPresentation: () => confirmationPresentation,
  confirmationText: () => confirmationText,
  defaultConfirmationEmail: () => defaultConfirmationEmail,
  initialConfirmationEmail: () => initialConfirmationEmail
});
import { eq as eq18, sql as sql19 } from "drizzle-orm";
async function capturePatientConfirmation(conn, row) {
  await lockNotificationPreferences(conn);
  const entry = notificationEntry({ event: "booking", clinicId: row.clinicId, snapshot: row, recipientGroup: "patient" }, "email");
  try {
    const patient = await one(patients, row.patientId, conn);
    const preference = await recipientPreference(conn, patient.userId, "email", "booking");
    await conn.insert(settings).values({ id: `patient-confirmation-preference:${row.id}`, data: { userId: patient.userId || null, epoch: preference.epoch, enabled: preference.enabled } }).onConflictDoNothing();
    const template = await resolvedTemplate("booking", row.clinicId, conn);
    const env = (await resolvedIntegration("smtp", conn)).env;
    const recipient = await confirmationRecipient(patient, conn);
    let ready2 = true;
    try {
      smtpConfig(env);
    } catch {
      ready2 = false;
    }
    const status = !preference.enabled || !(await getSettings(conn, row.clinicId)).notificationsEnabled || !template.content.enabled || !emailNotificationsEnabled(env) ? "disabled" : !validEmailAddress(recipient) ? "no_recipient" : !ready2 ? "configuration_failed" : process.env.NODE_ENV === "development" ? "not_attempted" : "pending";
    await recordDecision(conn, `patient-booking:${row.id}`, entry, status, { ...templateSnapshot(template, "booking", "patient", "email"), recipient: recipient || void 0, provider: "smtp" });
  } catch {
    await recordDecision(conn, `patient-booking:${row.id}`, entry, "preparation_failed");
  }
}
async function confirmationRecipient(patient, conn) {
  const account2 = patient.userId ? await one(users, patient.userId, conn) : null;
  return String(account2?.email || patient.email || "").trim();
}
async function initialConfirmationEmail(patient, enabled, conn) {
  if (!enabled) return "disabled";
  if (!(await recipientPreference(conn, patient.userId, "email", "booking")).enabled) return "disabled";
  if (!validEmailAddress(await confirmationRecipient(patient, conn))) return "no_recipient";
  return void 0;
}
function confirmationText(row, clinic) {
  const { date: date2, start, end } = formatTemplateSession(row, clinic);
  return `Your appointment is confirmed.

${row.clinicName} \xB7 ${row.branchName}
Doctor: ${row.doctorName}
Date: ${date2}
Session: ${start || "Not recorded"}\u2013${end || "Not recorded"} (${row.timezone || "timezone unavailable"})
Reference: ${row.reference}
Token: ${row.token}
Clinic contact: ${[clinic.email, clinic.phone].filter(Boolean).join(" \xB7 ") || "Contact reception at the clinic"}

Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive.`;
}
function confirmationPresentation(row, clinic, introduction = "Your appointment is confirmed.") {
  const { date: date2, start, end } = formatTemplateSession(row, clinic);
  return {
    introduction,
    clinic: row.clinicName,
    location: row.branchName,
    doctor: row.doctorName,
    date: date2,
    start: start || "Not recorded",
    end: end || "Not recorded",
    timezone: row.timezone || "timezone unavailable",
    reference: row.reference,
    token: row.token,
    contact: [clinic.email, clinic.phone].filter(Boolean).join(" \xB7 ") || "Contact reception at the clinic",
    closing: "Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive."
  };
}
function defaultConfirmationEmail(row, clinic) {
  const subject = "Digi-Q \u2014 Appointment confirmation";
  const rendered = systemEmailTemplate(subject, confirmationText(row, clinic));
  return { subject, ...rendered, html: emailShell(subject, visitEmailCard(confirmationPresentation(row, clinic), ""), { label: "Booking confirmation" }) };
}
async function saveOutcome(conn, id2, outcome, dispatchOutcome) {
  await conn.update(appointments).set({ data: sql19`${appointments.data} || ${JSON.stringify({ confirmationEmail: outcome, ...dispatchOutcome ? { confirmationDispatchOutcome: dispatchOutcome } : {} })}::jsonb` }).where(eq18(appointments.id, id2));
}
async function lockConfirmation(conn, id2) {
  await conn.execute(sql19`select pg_advisory_xact_lock(hashtext(${"appointment-confirmation:" + id2}))`);
  const original = await one(appointments, id2, conn);
  await lockQueue(conn, original.doctorId, original.branchId, original.date);
  const row = await one(appointments, id2, conn);
  if (row.doctorId !== original.doctorId || row.branchId !== original.branchId || row.date !== original.date || row.startTime !== original.startTime)
    throw new Error("Appointment changed during notification preparation");
  return row;
}
async function confirmAppointmentEmail(id2, conn = db, send) {
  const sender = send || sendAuthEmail;
  let claimed;
  try {
    claimed = await conn.transaction(async (tx) => {
      const row = await lockConfirmation(tx, id2);
      await lockNotificationPreferences(tx);
      const [history] = await tx.select().from(settings).where(eq18(settings.id, historyId(`patient-booking:${id2}`)));
      const entry = history ? notificationEntry({ event: "booking", clinicId: row.clinicId, snapshot: row, recipientGroup: "patient" }, "email") : void 0;
      const log = async (state, preparationReason) => {
        if (entry) await recordNotification(tx, `patient-booking:${id2}`, { ...entry, preparationReason }, state);
      };
      if (row.confirmationEmail) {
        if (entry && !history.data.dispatchAt) await log(row.confirmationEmail === "unavailable" ? "configuration_failed" : row.confirmationEmail);
        return { outcome: row.confirmationEmail };
      }
      if (["completed", "cancelled", "noShow"].includes(row.status)) {
        await log("obsolete");
        await saveOutcome(tx, id2, "not_attempted");
        return { outcome: "not_attempted" };
      }
      const config = await getSettings(tx, row.clinicId);
      if (!config.notificationsEnabled) {
        await log("disabled");
        await saveOutcome(tx, id2, "disabled");
        return { outcome: "disabled" };
      }
      const patient = await one(patients, row.patientId, tx);
      const patientAccount = patient.userId ? await one(users, patient.userId, tx) : null;
      const [receipt] = await tx.select().from(settings).where(eq18(settings.id, `patient-confirmation-preference:${id2}`));
      const preference = await recipientPreference(tx, patient.userId, "email", "booking", receipt?.data.epoch ?? 0);
      if (!preference.enabled || receipt?.data.enabled === false || receipt && receipt.data.userId !== (patient.userId || null) || history && ["disabled", "not_attempted", "no_recipient", "configuration_failed", "preparation_failed", "obsolete"].includes(history.data.status)) {
        await log("disabled");
        await saveOutcome(tx, id2, "disabled");
        return { outcome: "disabled" };
      }
      if (patient.status !== "active" || patientAccount && patientAccount.status !== "active") {
        await log("obsolete");
        await saveOutcome(tx, id2, "not_attempted");
        return { outcome: "not_attempted" };
      }
      const recipient2 = await confirmationRecipient(patient, tx);
      if (!validEmailAddress(recipient2)) {
        await log("no_recipient");
        await saveOutcome(tx, id2, "no_recipient");
        return { outcome: "no_recipient" };
      }
      const clinic = await one(clinics, row.clinicId, tx);
      const template = await resolvedTemplate("booking", row.clinicId, tx);
      const env = (await resolvedIntegration("smtp", tx)).env;
      const capturedAt = history?.data.createdAt ?? (typeof row.createdAt === "number" ? row.createdAt : new Date(row.createdAt).getTime());
      if (!template.content.enabled || !emailNotificationsEnabled(env) || template.activatedAt && (!Number.isFinite(capturedAt) || template.activatedAt > capturedAt)) {
        await log("disabled");
        await saveOutcome(tx, id2, "disabled");
        return { outcome: "disabled" };
      }
      if (!send && process.env.NODE_ENV !== "production") {
        await log("not_attempted");
        await saveOutcome(tx, id2, "not_attempted", "pre_dispatch_failed");
        return { outcome: "not_attempted" };
      }
      const values = {
        ...visitTemplateValues(row, clinic, patient.fullName || patientAccount?.fullName || ""),
        appointment_details: appointmentSnapshotComplete(row) ? confirmationText(row, clinic) : "",
        reference: row.reference || "",
        timezone: row.timezone || "",
        previous_details: "",
        clinic_contact: [clinic.email, clinic.phone].filter(Boolean).join(" \xB7 ")
      };
      const missing = missingVisitVariables([template.content.subject, template.content.body, template.content.prefix, template.content.footer, "{{appointment_details}}"], values);
      if (!validEventContent("booking", template.content) || missing.length || !row.patientId || row.patientId !== patient.id || row.clinicId !== clinic.id) {
        await log("preparation_failed", !validEventContent("booking", template.content) ? "Published template uses variables incompatible with this event; edit explicitly or reset" : missing.length ? `Missing required template values: ${missing.join(", ")}` : "Booking snapshot identity does not match this event");
        await saveOutcome(tx, id2, "unavailable", "pre_dispatch_failed");
        return { outcome: "unavailable" };
      }
      const rendered = template.source === "default" ? defaultConfirmationEmail(row, clinic) : renderNotification({
        ...template.content,
        body: template.content.body + (/\{\{\s*appointment_details\s*\}\}/.test(template.content.body) ? "" : "\n\n{{appointment_details}}")
      }, values, { event: "booking", visit: confirmationPresentation(row, clinic) });
      let cfg;
      try {
        cfg = smtpConfig(env);
      } catch {
        await log("configuration_failed");
        await saveOutcome(tx, id2, "unavailable", "pre_dispatch_failed");
        return { outcome: "unavailable" };
      }
      if (entry) await recordNotification(tx, `patient-booking:${id2}`, entry, "sending", {
        sender: cfg.from,
        recipient: recipient2,
        subject: rendered?.subject || "Digi-Q \u2014 Appointment confirmation",
        message: rendered?.text || confirmationText(row, clinic),
        provider: "smtp",
        ...templateSnapshot(template, "booking", "patient", "email")
      }, [cfg.password]);
      await saveOutcome(tx, id2, "not_attempted", "delivery_unknown");
      return { outcome: "not_attempted", recipient: recipient2, text: confirmationText(row, clinic), rendered, env, historyEntry: entry, snapshot: row };
    });
  } catch {
    return "unavailable";
  }
  if (!claimed.recipient || !claimed.text) return claimed.outcome;
  const recipient = claimed.recipient, text2 = claimed.text;
  let outcome = "provider_accepted";
  let dispatchOutcome = "provider_accepted";
  try {
    const subjectIds = await notificationStaffSubjects(conn, { snapshot: claimed.snapshot, recipientGroup: "patient" });
    return await withStaffDispatch(subjectIds, "booking", async () => {
      try {
        if (sender === sendAuthEmail)
          await sendAuthEmail(recipient, claimed.rendered?.subject || "Digi-Q \u2014 Appointment confirmation", claimed.rendered?.text || text2, void 0, claimed.rendered, [], claimed.env);
        else await sender(recipient, claimed.rendered?.subject || "Digi-Q \u2014 Appointment confirmation", claimed.rendered?.text || text2);
      } catch (error) {
        outcome = "unavailable";
        dispatchOutcome = error?.code === "EMAIL_UNCONFIGURED" || error?.code === "EMAIL_PRE_DISPATCH_FAILED" ? "pre_dispatch_failed" : error?.code === "EMAIL_REJECTED" ? "provider_rejected" : "delivery_unknown";
      }
      try {
        await conn.transaction(async (tx) => {
          await lockConfirmation(tx, id2);
          await saveOutcome(tx, id2, outcome, dispatchOutcome);
        });
      } catch {
        return "not_attempted";
      }
      if (claimed.historyEntry) await recordNotification(conn, `patient-booking:${id2}`, claimed.historyEntry, dispatchOutcome);
      return outcome;
    }, conn, () => dispatchOutcome === "delivery_unknown");
  } catch {
    return "not_attempted";
  }
}
var init_appointment_confirmation = __esm({
  "artifacts/api-server/src/lib/appointment-confirmation.ts"() {
    "use strict";
    init_db();
    init_store();
    init_auth_email();
    init_staff_dispatch_barrier();
    init_notification_staff_subjects();
    init_integration_config();
    init_integration_vault();
    init_notification_history();
    init_notification_template_values();
    init_appointments();
    init_notification_template_store();
    init_notification_templates();
    init_notification_preferences();
    init_email_presentation();
    init_email_template();
  }
});

// artifacts/api-server/src/lib/appointment-notification-cutover.ts
function appointmentCaptureAfterCutover(event, recipient, cutoff, row, now = Date.now()) {
  if (!appointmentNotificationTarget(event, recipient) || !cutoff) return true;
  if (event !== "reminder") return now >= cutoff;
  if (!row.date || !row.startTime || !row.timezone) return false;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
      timeZone: row.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(new Date(cutoff + 36e5)).map((p) => [p.type, p.value]));
    return `${row.date}T${row.startTime}` > `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  } catch {
    return false;
  }
}
var init_appointment_notification_cutover = __esm({
  "artifacts/api-server/src/lib/appointment-notification-cutover.ts"() {
    "use strict";
    init_appointment_notification_scope();
  }
});

// artifacts/api-server/src/lib/public-website.ts
import { parsePublicOrigin as parsePublicOrigin2, publicWebsiteUrl as publicWebsiteUrl2 } from "@workspace/api-zod/public-website";
function publicOrigin() {
  const origin = parsePublicOrigin2(process.env.CLINICFLOW_PUBLIC_ORIGIN);
  if (!origin) throw new HttpError(503, "Public website links are not configured", "PUBLIC_ORIGIN_UNCONFIGURED");
  return origin;
}
function publicUrl(route) {
  return publicWebsiteUrl2(publicOrigin(), route);
}
var init_public_website = __esm({
  "artifacts/api-server/src/lib/public-website.ts"() {
    "use strict";
    init_http();
  }
});

// artifacts/api-server/src/lib/security-notifications.ts
import { parsePhoneNumberFromString as parsePhoneNumberFromString5 } from "libphonenumber-js";
function eligibleStaffMobile(value) {
  try {
    const phone = parsePhoneNumberFromString5(String(value || ""), "IN");
    return phone?.isValid() ? phone.number : void 0;
  } catch {
    return void 0;
  }
}
function maskedDestination(value) {
  if (value.includes("@")) {
    const [name, domain] = value.split("@");
    return `${name.slice(0, 1)}***@${domain}`;
  }
  return `***${value.slice(-4)}`;
}
function emailFailure(error) {
  return ["EMAIL_UNCONFIGURED", "EMAIL_PRE_DISPATCH_FAILED"].includes(error?.code) ? "pre_dispatch_failed" : error?.code === "EMAIL_REJECTED" ? "provider_rejected" : "delivery_unknown";
}
function securityEmailDiagnostic(error, prepared) {
  if (error?.code === "SECURITY_DELIVERY_DISABLED") return "disabled";
  if (!prepared) return "preparation_failed";
  if (error instanceof EmailRejectionError) return error.diagnostic;
  const categories = {
    EMAIL_REJECTED: "provider_rejected",
    EMAIL_UNCONFIGURED: "configuration_unavailable",
    EMAIL_PRE_DISPATCH_FAILED: "pre_dispatch_failed"
  };
  return categories[error?.code] || "delivery_unknown";
}
async function requireSecurityDelivery(event, recipient, channel, conn = db) {
  const template = await resolvedTemplate(event, void 0, conn, recipient, channel);
  if (!template.content.enabled) throw new HttpError(
    503,
    "Delivery for this action is unavailable. Verification is still required; contact the System Admin.",
    "SECURITY_DELIVERY_DISABLED"
  );
  return template;
}
async function securityEmail(event, recipient, to, values, send = sendAuthEmail, conn = db) {
  const destination = maskedDestination(to);
  let prepared = false;
  try {
    const template = await resolvedTemplate(event, void 0, conn, recipient, "email");
    if (!template.content.enabled) return { status: "disabled", destination };
    assert(validEventContent(event, template.content), 503, "Security email template is invalid");
    if (event === "doctor_setup" || event === "staff_setup")
      assert(/\{\{\s*setup_link\s*\}\}/.test(template.content.body), 503, "Setup link is required");
    assert(
      !missingVisitVariables([template.content.subject, template.content.body, template.content.prefix, template.content.footer], values).length,
      503,
      "Required security template values are missing"
    );
    const rendered = renderNotification(template.content, values, { event });
    await requireSecurityDelivery(event, recipient, "email", conn);
    prepared = true;
    await send(
      to,
      rendered.subject,
      rendered.text,
      void 0,
      rendered,
      [],
      void 0,
      async () => {
        await requireSecurityDelivery(event, recipient, "email", conn);
      }
    );
    return { status: "provider_accepted", destination };
  } catch (error) {
    logger.warn({ event, channel: "email", category: securityEmailDiagnostic(error, prepared) }, "Security email unsuccessful");
    return { status: error?.code === "SECURITY_DELIVERY_DISABLED" ? "disabled" : prepared ? emailFailure(error) : "pre_dispatch_failed", destination };
  }
}
async function securitySms(event, recipient, mobile, values, send = sendNotificationSms, conn = db) {
  if (!mobile) return { status: "not_requested" };
  const destination = maskedDestination(mobile);
  let env, content, message;
  try {
    await requireSecurityDelivery(event, recipient, "sms", conn);
    assert(/^\+[1-9]\d{6,14}$/.test(mobile), 400, "Invalid mobile");
    env = (await resolvedIntegration("notificationSms", conn)).env;
    const cfg = notificationSmsConfig(env);
    const template = await resolvedTemplate(event, void 0, conn, recipient, "sms");
    assert(template.wordingPublished, 503, "Publish approved security SMS content first");
    content = smsTemplateContent.parse(template.content);
    assert(validEventContent(event, content) && !/\{\{\s*setup_link\s*\}\}/.test(content.body), 503, "Invalid security SMS");
    assert(!missingVisitVariables([content.body], values).length, 503, "Required security template values are missing");
    message = substitute(content.body, values);
    smsPayload(cfg, mobile, message, content);
  } catch (error) {
    return { status: error?.code === "SECURITY_DELIVERY_DISABLED" ? "disabled" : "unavailable", destination };
  }
  try {
    await requireSecurityDelivery(event, recipient, "sms", conn);
  } catch (error) {
    return { status: error?.code === "SECURITY_DELIVERY_DISABLED" ? "disabled" : "unavailable", destination };
  }
  try {
    return { status: await send(env, mobile, message, content), destination };
  } catch {
    return { status: "delivery_unknown", destination };
  }
}
var init_security_notifications = __esm({
  "artifacts/api-server/src/lib/security-notifications.ts"() {
    "use strict";
    init_db();
    init_auth_email();
    init_integration_vault();
    init_notification_template_store();
    init_notification_templates();
    init_notification_sms_transport();
    init_http();
    init_notification_template_values();
    init_logger();
  }
});

// artifacts/api-server/src/lib/staff-account-notifications.ts
var staff_account_notifications_exports = {};
__export(staff_account_notifications_exports, {
  captureStaffCreated: () => captureStaffCreated,
  captureStaffWelcome: () => captureStaffWelcome,
  processStaffAccountNotifications: () => processStaffAccountNotifications,
  staffCreationNotice: () => staffCreationNotice,
  staffNoticeState: () => staffNoticeState,
  verifiedContact: () => verifiedContact
});
import { createHash as createHash6 } from "node:crypto";
import { eq as eq19, sql as sql20 } from "drizzle-orm";
import { accountRoleLabel as accountRoleLabel3 } from "@workspace/api-zod/notification-variable-contract";
function verifiedContact(account2, channel) {
  if (channel === "email") return account2.emailVerifiedAt ? account2.email : void 0;
  return account2.mobile && account2.data?.staffMobileProof?.contact === account2.mobile ? account2.mobile : void 0;
}
async function staffNoticeState(conn, event, staffId, channel) {
  const [notice] = await conn.select().from(settings).where(eq19(settings.id, `staff-account-notice:${event}:${staffId}:${channel}`));
  return notice?.data?.state || null;
}
async function staffCreationNotice(conn, actorId, staffId) {
  const [occurrence] = await conn.select().from(settings).where(eq19(settings.id, `staff-created:${staffId}`));
  if (occurrence?.data.actorId !== actorId) return void 0;
  return {
    email: await staffNoticeState(conn, "staff_created_admin", staffId, "email"),
    sms: await staffNoticeState(conn, "staff_created_admin", staffId, "sms")
  };
}
async function account(conn, id2) {
  return (await conn.select().from(users).where(eq19(users.id, id2)))[0];
}
async function permitted(conn, data2) {
  const recipient = await account(conn, data2.recipientId), subject = await account(conn, data2.staffId);
  if (!recipient || !subject || recipient.status !== "active" || subject.status !== "active") return void 0;
  const contact = verifiedContact(recipient, data2.channel);
  if (!contact || fingerprint(contact) !== data2.contactFingerprint) return void 0;
  if (!(await getSettings(conn, data2.clinicId)).notificationsEnabled) return void 0;
  const preference = await recipientPreference(conn, recipient.id, data2.channel, data2.event, data2.preferenceEpoch);
  if (!preference.enabled) return void 0;
  const template = await resolvedTemplate(data2.event, data2.clinicId, conn, recipient.role, data2.channel);
  if (!template.content.enabled || template.activatedAt > data2.createdAt) return void 0;
  const integration = await resolvedIntegration(data2.channel === "email" ? "smtp" : "notificationSms", conn);
  if (data2.channel === "email" ? !emailNotificationsEnabled(integration.env) : !notificationSmsEnabled(integration.env)) return void 0;
  return { recipient, subject, contact, template, env: integration.env };
}
async function capture(conn, event, staffId, recipientId, clinicId, channel) {
  const id2 = `staff-account-notice:${event}:${staffId}:${channel}`;
  const recipient = await account(conn, recipientId);
  const contact = recipient && verifiedContact(recipient, channel);
  const preference = await recipientPreference(conn, recipientId, channel, event);
  const data2 = {
    event,
    staffId,
    recipientId,
    clinicId,
    channel,
    createdAt: Date.now(),
    contactFingerprint: contact ? fingerprint(contact) : "",
    preferenceEpoch: preference.epoch,
    state: "skipped"
  };
  try {
    if (await conn.transaction((tx) => permitted(tx, data2))) data2.state = "pending";
  } catch {
  }
  await conn.insert(settings).values({ id: id2, data: data2 }).onConflictDoNothing();
}
async function captureStaffCreated(conn, actorId, staffId, clinicIds) {
  await lockNotificationPreferences(conn);
  await conn.insert(settings).values({ id: `staff-created:${staffId}`, data: { actorId, staffId, clinicId: clinicIds[0] || null, createdAt: Date.now() } }).onConflictDoNothing();
  for (const channel of ["email", "sms"])
    await capture(conn, "staff_created_admin", staffId, actorId, clinicIds[0], channel);
}
async function captureStaffWelcome(conn, staffId, channel) {
  const [created2] = await conn.select().from(settings).where(eq19(settings.id, `staff-created:${staffId}`));
  if (!created2) return;
  await lockNotificationPreferences(conn);
  await capture(conn, "staff_welcome", staffId, staffId, created2.data.clinicId || void 0, channel);
}
async function processStaffAccountNotifications(conn = db, email = sendAuthEmail, sms = sendNotificationSms) {
  const rows = await conn.select().from(settings).where(sql20`${settings.id} like 'staff-account-notice:%' and ${settings.data}->>'state'='pending'`).limit(100);
  for (const row of rows) {
    const claim = await conn.transaction(async (tx) => {
      await lockNotificationPreferences(tx);
      await tx.execute(sql20`select pg_advisory_xact_lock(hashtext(${row.id}))`);
      const [current] = await tx.select().from(settings).where(eq19(settings.id, row.id));
      if (current?.data.state !== "pending") return void 0;
      let ready2;
      try {
        ready2 = await permitted(tx, current.data);
      } catch {
      }
      const data2 = { ...current.data, state: ready2 ? "sending" : "skipped" };
      await tx.update(settings).set({ data: data2 }).where(eq19(settings.id, row.id));
      return ready2 ? { data: data2, ready: ready2 } : void 0;
    });
    if (!claim) continue;
    let state = "pre_dispatch_failed";
    try {
      state = await withStaffDispatch([claim.data.staffId, claim.data.recipientId], "notification", async () => {
        const ready2 = await permitted(conn, claim.data);
        if (!ready2) return "skipped";
        const owned = claim.data.clinicId ? (await conn.select().from(clinics).where(eq19(clinics.id, claim.data.clinicId)))[0] : void 0;
        const mappings = await conn.select({ name: branches.data }).from(assignments).innerJoin(branches, eq19(assignments.branchId, branches.id)).where(eq19(assignments.userId, ready2.subject.id));
        const values = {
          recipient_name: ready2.recipient.fullName,
          staff_name: ready2.subject.fullName,
          role_name: accountRoleLabel3(ready2.subject.role),
          clinic_name: owned?.data.name || "",
          location_names: mappings.map((m) => m.name?.name || "").filter(Boolean).join(", "),
          sign_in_link: publicUrl("/sign-in")
        };
        if (!validEventContent(claim.data.event, ready2.template.content)) return "pre_dispatch_failed";
        const rendered = renderNotification(ready2.template.content, values, { event: claim.data.event });
        if (claim.data.channel === "email") {
          try {
            await email(
              ready2.contact,
              rendered.subject,
              rendered.text,
              void 0,
              rendered,
              [],
              void 0,
              async () => {
                if (!await permitted(conn, claim.data)) throw Object.assign(new Error("No longer eligible"), { code: "EMAIL_PRE_DISPATCH_FAILED" });
              }
            );
            return "provider_accepted";
          } catch (error) {
            return emailFailure(error);
          }
        }
        if (!ready2.template.wordingPublished) return "pre_dispatch_failed";
        const content = smsTemplateContent.parse(ready2.template.content);
        try {
          smsPayload(notificationSmsConfig(ready2.env), ready2.contact, rendered.text, content);
        } catch {
          return "pre_dispatch_failed";
        }
        return sms(ready2.env, ready2.contact, rendered.text, content);
      }, conn);
    } catch {
      state = "delivery_unknown";
    }
    await conn.update(settings).set({ data: { ...claim.data, state, completedAt: Date.now() } }).where(eq19(settings.id, row.id));
  }
}
var fingerprint;
var init_staff_account_notifications = __esm({
  "artifacts/api-server/src/lib/staff-account-notifications.ts"() {
    "use strict";
    init_db();
    init_store();
    init_public_website();
    init_notification_template_store();
    init_notification_templates();
    init_notification_preferences();
    init_integration_vault();
    init_integration_config();
    init_auth_email();
    init_notification_sms_transport();
    init_security_notifications();
    init_staff_dispatch_barrier();
    fingerprint = (value) => createHash6("sha256").update(value).digest("hex");
  }
});

// artifacts/api-server/src/lib/notification-outbox.ts
import { eq as eq20, sql as sql21 } from "drizzle-orm";
import { createHash as createHash7 } from "node:crypto";
async function listOwnerBookingMailOutcomes(user, clinicId, page = 1, pageSize = 20, conn = db) {
  assert(user.role === "clinicAdmin", 403, "Only the owning Clinic Admin can view booking email outcomes");
  const [clinic] = await conn.select({ id: clinics.id }).from(clinics).where(sql21`${clinics.id} = ${clinicId} and ${clinics.adminId} = ${user.id}`);
  assert(
    clinic && user.clinicIds.includes(clinicId) && (!user.activeClinicId || user.activeClinicId === clinicId),
    403,
    "You are not the current owner of this clinic workspace"
  );
  const result = await conn.execute(sql21`
    select s.data->'snapshot'->>'reference' as reference, s.data->>'state' as status,
      s.data->>'createdAt' as "createdAt"
    from settings s join clinics c on c.id = s.data->>'clinicId' and c.admin_id = ${user.id}
    where c.id = ${clinicId} and s.id like 'mail-outbox:booking:%'
      and s.data->>'event' = 'booking' and s.data->>'recipientGroup' = 'clinicAdmin'
    order by (s.data->>'createdAt')::bigint desc nulls last, s.id desc
    limit ${pageSize + 1} offset ${(page - 1) * pageSize}`);
  const statuses = /* @__PURE__ */ new Set([
    "pending",
    "sending",
    "provider_accepted",
    "provider_rejected",
    "pre_dispatch_failed",
    "delivery_unknown",
    "configuration_failed",
    "preparation_failed",
    "disabled",
    "obsolete",
    "no_recipient"
  ]);
  return {
    items: result.rows.slice(0, pageSize).map((row) => ({
      reference: row.reference || null,
      status: statuses.has(row.status) ? row.status : "unknown",
      createdAt: row.createdAt && Number.isSafeInteger(Number(row.createdAt)) ? Number(row.createdAt) : null
    })),
    hasMore: result.rows.length > pageSize
  };
}
async function enqueueEvent(conn, event, row, previousDetails = "") {
  if (event === "booking_status_link") return;
  if (requiredEvent(event)) return;
  await lockNotificationPreferences(conn);
  if (event === "booking") {
    const { capturePatientConfirmation: capturePatientConfirmation2 } = await Promise.resolve().then(() => (init_appointment_confirmation(), appointment_confirmation_exports));
    await capturePatientConfirmation2(conn, row);
  }
  if (process.env.NODE_ENV === "development") {
    for (const channel of ["email", "sms"]) {
      if (channel === "sms" && appointmentNotificationEvents.includes(event)) continue;
      if (!await claimNotificationOccurrence(conn, channel, event, row)) continue;
      for (const group of templateRecipients) {
        if (!validTemplateTarget(event, group, channel) || channel === "email" && event === "booking" && group === "patient") continue;
        await recordDecision(conn, `${channel}-decision:${event}:${row.id}:${row.revision || 0}:${group}:development`, notificationEntry({ event, clinicId: row.clinicId, snapshot: row, recipientGroup: group }, channel), "not_attempted");
      }
    }
    if (!appointmentNotificationEvents.includes(event)) return;
  }
  const previousSession = previousSessionSnapshot(previousDetails);
  if (previousSession) previousDetails = confirmationText(previousDetails, await one(clinics, row.clinicId, conn)).replace("Your appointment is confirmed.", "Previous visit details:");
  try {
    const { enqueueSmsEvent: enqueueSmsEvent2 } = await Promise.resolve().then(() => (init_notification_sms_outbox(), notification_sms_outbox_exports));
    await conn.transaction((tx) => enqueueSmsEvent2(tx, event, row, previousDetails, previousSession));
  } catch {
    logger.warn("SMS event preparation unavailable; visit and email retained");
    await conn.transaction((tx) => claimNotificationOccurrence(tx, "sms", event, row)).catch(() => false);
    for (const group of templateRecipients) if (validTemplateTarget(event, group, "sms"))
      await recordDecision(conn, `sms-decision:${event}:${row.id}:${row.revision || 0}:${group}:preparation`, notificationEntry({ event, clinicId: row.clinicId, snapshot: row, recipientGroup: group }, "sms"), "preparation_failed");
  }
  if (process.env.NODE_ENV === "development") return;
  try {
    await conn.transaction((tx) => enqueueEmailEvent(tx, event, row, previousDetails, previousSession));
  } catch {
    logger.warn("Email event preparation unavailable; visit and SMS retained");
    await conn.transaction((tx) => claimNotificationOccurrence(tx, "email", event, row)).catch(() => false);
    for (const group of templateRecipients) if (validTemplateTarget(event, group, "email") && (event !== "booking" || group !== "patient"))
      await recordDecision(conn, `email-decision:${event}:${row.id}:${row.revision || 0}:${group}:preparation`, notificationEntry({ event, clinicId: row.clinicId, snapshot: row, recipientGroup: group }, "email"), "preparation_failed");
  }
}
async function enqueueEmailEvent(conn, event, row, previousDetails, previousSession) {
  if (event === "patient_login_otp") return;
  if (!await claimNotificationOccurrence(conn, "email", event, row)) return;
  const env = (await resolvedIntegration("smtp", conn)).env;
  const gate = (await getSettings(conn, row.clinicId)).notificationsEnabled;
  let configured = true;
  try {
    smtpConfig(env);
  } catch {
    configured = false;
  }
  const usedEmails = /* @__PURE__ */ new Set();
  if (row.patientId && (await resolvedTemplate(event, row.clinicId, conn, "patient")).content.enabled) {
    const patient = await one(patients, row.patientId, conn);
    const account2 = patient.userId ? await one(users, patient.userId, conn) : null;
    usedEmails.add(String(account2?.email || patient.email || "").trim().toLowerCase());
  }
  for (const group of templateRecipients) {
    if (!validTemplateTarget(event, group, "email")) continue;
    if (event === "booking" && group === "patient") continue;
    const template = await resolvedTemplate(event, row.clinicId, conn, group);
    const primary = group === defaultRecipient(event);
    let targets = [null];
    if (!primary) {
      if (group === "superAdmin") targets = await conn.select().from(users).where(eq20(users.role, "superAdmin"));
      if (group === "clinicAdmin") targets = [await one(users, (await one(clinics, row.clinicId, conn)).adminId, conn)];
      if (group === "doctor") targets = row.doctorId ? [await one(users, (await one(doctors, row.doctorId, conn)).userId, conn)] : [];
      if (group === "receptionist") {
        const links2 = await conn.select().from(assignments).where(eq20(assignments.clinicId, row.clinicId));
        targets = [];
        for (const link of links2) if (!link.branchId || link.branchId === row.branchId) {
          const account2 = await one(users, link.userId, conn);
          if (account2.role === "receptionist") targets.push(account2);
        }
      }
    }
    for (const target of targets.length ? targets : [null]) {
      let email = "";
      let preferenceUserId = target?.id || null;
      let active = true;
      if (target) {
        email = String(target.email || "").trim().toLowerCase();
      } else if (primary) {
        if (row.patientId) {
          const patient = await one(patients, row.patientId, conn);
          const account2 = patient.userId ? await one(users, patient.userId, conn) : null;
          preferenceUserId = account2?.id || null;
          email = String(account2?.email || patient.email || "").trim().toLowerCase();
          active = patient.status === "active" && (!account2 || account2.status === "active");
        } else {
          const owner = await one(users, (await one(clinics, row.clinicId, conn)).adminId, conn);
          preferenceUserId = owner.id;
          email = String(owner.email || "").trim().toLowerCase();
          active = owner.status === "active" && owner.role === "clinicAdmin";
        }
      }
      const preference = await recipientPreference(conn, preferenceUserId, "email", event);
      const decision = `email-decision:${event}:${row.id}:${row.revision || 0}:${group}:${target?.id || "primary"}`;
      const entry = notificationEntry({ event, clinicId: row.clinicId, snapshot: row, recipientGroup: group }, "email");
      const status = !preference.enabled || !gate || !emailNotificationsEnabled(env) || !template.content.enabled || !appointmentCaptureAfterCutover(event, group, template.activatedAt, row) ? "disabled" : !configured ? "configuration_failed" : !active || target && target.status !== "active" || !validEmailAddress(email) ? "no_recipient" : target && usedEmails.has(email) ? "not_attempted" : null;
      if (status) {
        await recordDecision(conn, decision, entry, status, { ...templateSnapshot(template, event, group, "email"), recipient: email || void 0, provider: "smtp" });
        continue;
      }
      usedEmails.add(email);
      const id2 = `mail-outbox:${event}:${row.id}:${row.revision || 0}`;
      const createdAt = Date.now();
      await conn.insert(settings).values({ id: primary ? id2 : `${id2}:recipient:${emailKey(target.email)}`, data: {
        historyKey: decision,
        preferenceUserId,
        preferenceEpoch: preference.epoch,
        recipientGroup: group,
        recipientUserId: target?.id || (event === "onboarding" && primary ? preferenceUserId : void 0),
        recipientEmailKey: target ? emailKey(target.email) : event === "onboarding" && primary ? emailKey(email) : void 0,
        event,
        appointmentId: event === "onboarding" ? void 0 : row.id,
        clinicId: row.clinicId,
        previousDetails,
        previousSession,
        snapshot: row,
        state: "pending",
        attempts: 0,
        dueAt: createdAt,
        createdAt
      } }).onConflictDoNothing();
      await recordDecision(conn, decision, { ...entry, createdAt, dueAt: createdAt }, "pending");
    }
  }
}
function reminderDue(row, now = Date.now()) {
  if (!row.date || !row.startTime || !row.timezone || !["waiting", "booked"].includes(row.status) || row.checkedInAt) return false;
  const local = (instant) => {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: row.timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant)).map((p) => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
  };
  const target = `${row.date}T${row.startTime}`;
  for (let minute = 59; minute <= 60; minute++) if (local(now + minute * 6e4) === target) return true;
  return false;
}
function reminderDispatchEligible(row, now = Date.now()) {
  for (let delay = 0; delay <= 5; delay++) if (reminderDue(row, now - delay * 6e4)) return true;
  return false;
}
async function captureReminderNotifications(conn, now, previewStartedAt) {
  return conn.transaction(async (tx) => {
    const scheduler = previewStartedAt === void 0 ? "notification-scheduler" : "notification-scheduler:preview-sms";
    const lock = await tx.execute(sql21`select pg_try_advisory_xact_lock(hashtext(${scheduler})) as acquired`);
    if (!lock.rows[0]?.acquired) return false;
    const from = new Date(now - 864e5).toISOString().slice(0, 10), to = new Date(now + 1728e5).toISOString().slice(0, 10);
    const rows = await tx.select().from(appointments).where(sql21`${appointments.status} in ('waiting','booked') and ${appointments.date} between ${from} and ${to}
      ${previewStartedAt === void 0 ? sql21`` : sql21`and ${appointments.createdAt} >= ${new Date(previewStartedAt).toISOString()}::timestamptz`}`);
    for (const raw2 of rows) {
      const row = { ...raw2.data, ...raw2 };
      let due = false;
      try {
        due = reminderDue(row, now);
      } catch {
        logger.warn("Reminder skipped: invalid session timing");
      }
      if (due) await enqueueEvent(tx, "reminder", row);
    }
    return true;
  });
}
async function processNotifications(conn = db, send = sendAuthEmail, now = Date.now()) {
  const acquired = await captureReminderNotifications(conn, now);
  if (!acquired) return;
  const candidates = await conn.select().from(settings).where(sql21`${settings.id} like 'mail-outbox:%' and ${settings.data}->>'state' = 'pending' and (${settings.data}->>'dueAt')::bigint <= ${now}`).limit(100);
  for (const record2 of candidates) {
    try {
      const claimed = await conn.transaction(async (tx) => {
        await lockNotificationPreferences(tx);
        await tx.execute(sql21`select pg_advisory_xact_lock(hashtext(${record2.id}))`);
        const [fresh] = await tx.select().from(settings).where(eq20(settings.id, record2.id));
        const data2 = fresh.data;
        if (data2.state !== "pending" || data2.dueAt > now) return null;
        const update = async (patch) => {
          await tx.update(settings).set({ data: { ...data2, ...patch } }).where(eq20(settings.id, record2.id));
          if (patch.state) await recordNotification(tx, data2.historyKey || record2.id, { ...notificationEntry(data2, "email"), preparationReason: patch.preparationReason }, patch.state, void 0, [], now);
        };
        if (!await pendingPreferenceAllowed(tx, data2, "email")) {
          await update({ state: "disabled" });
          return null;
        }
        if (!(await getSettings(tx, data2.clinicId)).notificationsEnabled || !emailNotificationsEnabled((await resolvedIntegration("smtp", tx)).env)) {
          await update({ state: "disabled" });
          return null;
        }
        const clinic = await one(clinics, data2.clinicId, tx);
        const current = data2.appointmentId ? await one(appointments, data2.appointmentId, tx) : null;
        if (data2.appointmentId && !current) {
          await update({ state: "obsolete" });
          return null;
        }
        if (current && ((current.revision || 0) !== (data2.snapshot.revision || 0) || (data2.event === "cancelled" ? current.status !== "cancelled" : data2.event === "completed" ? current.status !== "completed" : !["waiting", "booked"].includes(current.status)))) {
          await update({ state: "obsolete" });
          return null;
        }
        if (data2.event === "reminder" && (!current || !reminderDispatchEligible(current, now) || current.revision !== data2.snapshot.revision)) {
          await update({ state: "obsolete" });
          return null;
        }
        let recipient, recipientName = "", patient = null;
        if (current) {
          patient = await one(patients, current.patientId, tx);
          const account2 = patient.userId ? await one(users, patient.userId, tx) : null;
          if (patient.status !== "active" || account2 && account2.status !== "active") {
            await update({ state: "obsolete" });
            return null;
          }
          recipient = account2?.email || patient.email || "";
          recipientName = patient.fullName || account2?.fullName || "";
        } else {
          const account2 = await one(users, clinic.adminId, tx);
          if (!data2.recipientUserId && (account2.status !== "active" || account2.role !== "clinicAdmin")) {
            await update({ state: "no_recipient" });
            return null;
          }
          recipient = account2.email || "";
          recipientName = account2.fullName || "";
        }
        if (data2.recipientUserId) {
          const account2 = await one(users, data2.recipientUserId, tx);
          let member = data2.recipientGroup === "clinicAdmin" && clinic.adminId === account2.id;
          if (data2.recipientGroup === "superAdmin") member = data2.event === "onboarding" && account2.role === "superAdmin";
          if (data2.recipientGroup === "doctor" && current?.doctorId) {
            const doctor = await one(doctors, current.doctorId, tx);
            member = doctor.userId === account2.id && doctor.ownerAdminId === clinic.adminId && !!current.branchId && await isClinicalMember(doctor.id, current.branchId, tx);
          }
          if (data2.recipientGroup === "receptionist") {
            const links2 = await tx.select().from(assignments).where(eq20(assignments.userId, account2.id));
            member = account2.role === "receptionist" && links2.some((l) => l.clinicId === data2.clinicId && (!l.branchId || l.branchId === current?.branchId));
          }
          if (!member || account2.status !== "active") {
            await update({ state: "obsolete" });
            return null;
          }
          recipient = account2.email || "";
          recipientName = account2.fullName || "";
          if (data2.recipientEmailKey && emailKey(recipient) !== data2.recipientEmailKey) {
            await update({ state: "obsolete" });
            return null;
          }
        }
        if (!validEmailAddress(recipient)) {
          await update({ state: "no_recipient" });
          return null;
        }
        const template = await resolvedTemplate(data2.event, data2.clinicId, tx, data2.recipientGroup || defaultRecipient(data2.event));
        if (!template.content.enabled || template.activatedAt > data2.createdAt) {
          await update({ state: "disabled" });
          return null;
        }
        const row = data2.snapshot;
        if (current && !snapshotIdentityMatches(row, current, clinic)) {
          await update({ state: "preparation_failed", preparationReason: "Booking snapshot identity does not match this event" });
          return null;
        }
        const values = {
          ...data2.event === "onboarding" ? onboardingTemplateValues(row, clinic, recipientName) : visitTemplateValues(current ? row : null, clinic, recipientName, data2.previousSession),
          appointment_details: current && appointmentSnapshotComplete(row) ? confirmationText(row, clinic).replace("Your appointment is confirmed.", "Visit details:") : "",
          previous_details: data2.previousSession?.detailsAvailable ? data2.previousDetails || "" : "",
          reference: row.reference || "",
          timezone: row.timezone || "",
          clinic_contact: [clinic.email, clinic.phone].filter(Boolean).join(" \xB7 ")
        };
        if (!validEventContent(data2.event, template.content)) {
          await update({ state: "preparation_failed", preparationReason: "Published template uses variables incompatible with this event; edit explicitly or reset" });
          return null;
        }
        const missing = missingVisitVariables([template.content.subject, template.content.body, template.content.prefix, template.content.footer], values);
        if (missing.length) {
          await update({ state: "preparation_failed", preparationReason: `Missing required template values: ${missing.join(", ")}` });
          return null;
        }
        const rendered = renderNotification(template.content, values, {
          event: data2.event,
          visit: current && appointmentSnapshotComplete(row) ? confirmationPresentation(row, clinic, "Visit details:") : void 0
        });
        const env = (await resolvedIntegration("smtp", tx)).env;
        let cfg;
        try {
          cfg = smtpConfig(env);
        } catch {
          await update({ state: "configuration_failed" });
          return null;
        }
        await recordNotification(tx, data2.historyKey || record2.id, notificationEntry(data2, "email"), "sending", {
          sender: cfg.from,
          recipient,
          subject: rendered.subject,
          message: rendered.text,
          provider: "smtp",
          ...templateSnapshot(template, data2.event, data2.recipientGroup || defaultRecipient(data2.event), "email")
        }, [cfg.password], now);
        await update({ state: "sending", claimedAt: now, attempts: data2.attempts + 1 });
        return { recipient, rendered, data: data2, env };
      });
      if (!claimed) continue;
      const subjectIds = await notificationStaffSubjects(conn, claimed.data);
      await withStaffDispatch(subjectIds, "notification", async () => {
        let state = "provider_accepted";
        try {
          await send(claimed.recipient, claimed.rendered.subject, claimed.rendered.text, void 0, claimed.rendered, [], claimed.env);
        } catch (error) {
          state = error?.code === "EMAIL_REJECTED" ? "provider_rejected" : error?.code === "EMAIL_PRE_DISPATCH_FAILED" ? "pre_dispatch_failed" : error?.code === "EMAIL_UNCONFIGURED" ? claimed.data.attempts < 4 ? "pending" : "configuration_failed" : "delivery_unknown";
        }
        const completed = { ...claimed.data, state, claimedAt: now, attempts: claimed.data.attempts + 1, dueAt: now + 6e4 * 2 ** claimed.data.attempts, finishedAt: Date.now() };
        const saved = await conn.update(settings).set({ data: completed }).where(sql21`${settings.id}=${record2.id} and ${settings.data}->>'state'='sending' and ${settings.data}->>'claimedAt'=${String(now)}`).returning({ id: settings.id });
        if (saved.length) await recordNotification(conn, claimed.data.historyKey || record2.id, notificationEntry(completed, "email"), state);
        return state;
      }, conn, (state) => state === "delivery_unknown");
    } catch {
      logger.warn("Notification item failed; durable dispatch state retained");
      await conn.transaction(async (tx) => {
        await tx.execute(sql21`select pg_advisory_xact_lock(hashtext(${record2.id}))`);
        const [latest] = await tx.select().from(settings).where(eq20(settings.id, record2.id));
        if (latest?.data.state !== "pending") return;
        const attempts = (latest.data.attempts || 0) + 1;
        const next = { ...latest.data, attempts, state: attempts >= 5 ? "preparation_failed" : "pending", dueAt: now + 6e4 * 2 ** attempts };
        await tx.update(settings).set({ data: next }).where(eq20(settings.id, record2.id));
        await recordNotification(tx, latest.data.historyKey || record2.id, notificationEntry(latest.data, "email"), "preparation_failed");
        if (attempts < 5) await recordNotification(tx, latest.data.historyKey || record2.id, notificationEntry(next, "email"), "pending");
      });
    }
  }
}
function startNotificationWorker() {
  const production = process.env.NODE_ENV === "production";
  const preview = process.env.NODE_ENV === "development";
  if (!production && !preview) return;
  const startedAt = Date.now();
  let previewStartedAt;
  let busy = false, smsBusy = false, staffBusy = false;
  const tick = () => {
    if (production && !staffBusy) {
      staffBusy = true;
      void Promise.resolve().then(() => (init_staff_account_notifications(), staff_account_notifications_exports)).then((m) => m.processStaffAccountNotifications()).catch(() => logger.warn("Staff account notice worker failed")).finally(() => {
        staffBusy = false;
      });
    }
    if (production && !busy) {
      busy = true;
      void processNotifications().catch(() => logger.warn("Email worker failed; pending work retained")).finally(() => {
        busy = false;
      });
    }
    if (!smsBusy) {
      smsBusy = true;
      void (async () => {
        if (preview) {
          if (previewStartedAt === void 0) {
            const id2 = "notification-preview-sms-start";
            await db.insert(settings).values({ id: id2, data: { startedAt } }).onConflictDoNothing();
            const [record2] = await db.select().from(settings).where(eq20(settings.id, id2));
            const cutoff = record2?.data.startedAt;
            if (typeof cutoff !== "number" || !Number.isSafeInteger(cutoff) || cutoff <= 0)
              throw new Error("Preview SMS start boundary unavailable");
            previewStartedAt = cutoff;
          }
          await captureReminderNotifications(db, Date.now(), previewStartedAt).catch(() => logger.warn("Preview SMS reminder scheduling failed; existing SMS jobs retained"));
        }
        const { processSmsNotifications: processSmsNotifications2 } = await Promise.resolve().then(() => (init_notification_sms_outbox(), notification_sms_outbox_exports));
        await processSmsNotifications2(db, void 0, Date.now(), previewStartedAt);
      })().catch(() => logger.warn("SMS worker failed; pending work retained")).finally(() => {
        smsBusy = false;
      });
    }
  };
  const timer = setInterval(() => void tick(), 3e4);
  timer.unref();
}
var emailKey;
var init_notification_outbox = __esm({
  "artifacts/api-server/src/lib/notification-outbox.ts"() {
    "use strict";
    init_db();
    init_store();
    init_notification_templates();
    init_clinical_membership();
    init_notification_template_store();
    init_auth_email();
    init_appointment_confirmation();
    init_integration_config();
    init_notification_history();
    init_logger();
    init_integration_vault();
    init_http();
    init_notification_template_values();
    init_notification_templates();
    init_notification_templates();
    init_staff_dispatch_barrier();
    init_notification_staff_subjects();
    init_notification_preferences();
    init_appointment_notification_cutover();
    init_appointment_notification_scope();
    emailKey = (email) => createHash7("sha256").update(email.trim().toLowerCase()).digest("hex");
  }
});

// artifacts/api-server/src/lib/notification-sms-outbox.ts
var notification_sms_outbox_exports = {};
__export(notification_sms_outbox_exports, {
  enqueueSmsEvent: () => enqueueSmsEvent,
  notificationPhone: () => notificationPhone,
  processSmsNotifications: () => processSmsNotifications
});
import { eq as eq21, sql as sql22 } from "drizzle-orm";
import { createHash as createHash8 } from "node:crypto";
import { parsePhoneNumberFromString as parsePhoneNumberFromString6 } from "libphonenumber-js";
function notificationPhone(value) {
  const raw2 = String(value || "").trim();
  if (!raw2) return "";
  try {
    const phone = parsePhoneNumberFromString6(raw2, "IN");
    return phone?.isValid() ? phone.number : "";
  } catch {
    return "";
  }
}
async function targetAccounts(conn, group, row, clinic) {
  if (group === "superAdmin") return conn.select().from(users).where(eq21(users.role, "superAdmin"));
  if (group === "clinicAdmin") return [await one(users, clinic.adminId, conn)];
  if (group === "doctor") {
    if (!row.doctorId) return [];
    const doctor = await one(doctors, row.doctorId, conn);
    if (doctor.ownerAdminId !== clinic.adminId || !row.branchId || !await isClinicalMember(doctor.id, row.branchId, conn)) return [];
    return [await one(users, doctor.userId, conn)];
  }
  if (group === "patient") {
    if (!row.patientId) return [];
    const patient = await one(patients, row.patientId, conn);
    const account2 = patient.userId ? await one(users, patient.userId, conn) : null;
    return [{
      ...patient,
      preferenceUserId: account2?.id || null,
      mobile: account2?.mobile || patient.mobile,
      targetPatientId: patient.id,
      status: patient.status === "active" && (!account2 || account2.status === "active") ? "active" : "inactive"
    }];
  }
  const links2 = await conn.select().from(assignments).where(eq21(assignments.clinicId, row.clinicId));
  const targets = [];
  for (const link of links2) if (!link.branchId || link.branchId === row.branchId) {
    const account2 = await one(users, link.userId, conn);
    if (account2.role === "receptionist") targets.push(account2);
  }
  return targets;
}
async function enqueueSmsEvent(conn, event, row, previousDetails = "", previousSession) {
  if (event === "booking_status_link") return;
  if (requiredEvent(event)) return;
  await lockNotificationPreferences(conn);
  if (!await claimNotificationOccurrence(conn, "sms", event, row)) return;
  const env = (await resolvedIntegration("notificationSms", conn)).env;
  const gate = (await getSettings(conn, row.clinicId)).notificationsEnabled;
  const clinic = await one(clinics, row.clinicId, conn);
  const used = /* @__PURE__ */ new Set();
  for (const group of templateRecipients) {
    if (!validTemplateTarget(event, group, "sms")) continue;
    const template = await resolvedTemplate(event, row.clinicId, conn, group, "sms");
    const targets = await targetAccounts(conn, group, row, clinic);
    for (const account2 of targets.length ? targets : [null]) {
      const preferenceUserId = account2?.targetPatientId ? account2.preferenceUserId : account2?.id || null;
      const preference = await recipientPreference(conn, preferenceUserId, "sms", event);
      const decision = `sms-decision:${event}:${row.id}:${row.revision || 0}:${group}:${account2?.id || "missing"}`;
      const entry = notificationEntry({ event, clinicId: row.clinicId, snapshot: row, recipientGroup: group }, "sms");
      const status = !preference.enabled || !gate || !notificationSmsEnabled(env) || !template.content.enabled || !appointmentCaptureAfterCutover(event, group, template.activatedAt, row) ? "disabled" : !notificationSmsReadiness(env).ready || appointmentNotificationTarget(event, group) && !smsMetadataReady(notificationSmsConfig(env), template.content) ? "configuration_failed" : !account2 || account2.status !== "active" || !notificationPhone(account2.mobile) ? "no_recipient" : used.has(notificationPhone(account2.mobile)) ? "not_attempted" : null;
      if (status) {
        await recordDecision(conn, decision, entry, status, { ...templateSnapshot(template, event, group, "sms"), recipient: notificationPhone(account2?.mobile) || void 0, dltTemplateId: template.content.dltTemplateId });
        continue;
      }
      const phone = notificationPhone(account2.mobile);
      used.add(phone);
      const id2 = `sms-outbox:${event}:${row.id}:${row.revision || 0}:${phoneKey(phone)}`;
      const createdAt = Date.now();
      await conn.insert(settings).values({ id: id2, data: {
        event,
        clinicId: row.clinicId,
        appointmentId: event === "onboarding" ? void 0 : row.id,
        historyKey: decision,
        preferenceUserId,
        preferenceEpoch: preference.epoch,
        recipientGroup: group,
        recipientUserId: account2.targetPatientId ? void 0 : account2.id,
        recipientPatientId: account2.targetPatientId,
        recipientPhoneKey: phoneKey(phone),
        snapshot: row,
        previousDetails,
        previousSession,
        state: "pending",
        createdAt,
        dueAt: createdAt,
        attempts: 0
      } }).onConflictDoNothing();
      await recordDecision(conn, decision, { ...entry, createdAt, dueAt: createdAt }, "pending");
    }
  }
}
async function processSmsNotifications(conn = db, send = sendNotificationSms, now = Date.now(), previewStartedAt) {
  const candidates = await conn.select().from(settings).where(sql22`${settings.id} like 'sms-outbox:%' and ${settings.data}->>'state' = 'pending' and (${settings.data}->>'dueAt')::bigint <= ${now}
    ${previewStartedAt === void 0 ? sql22`` : sql22`and (${settings.data}->>'createdAt')::bigint >= ${previewStartedAt}
      and ${settings.data}->>'event' in ('booking','rescheduled','cancelled','completed','reminder')`}`).limit(100);
  for (const record2 of candidates) {
    try {
      const claim = await conn.transaction(async (tx) => {
        await lockNotificationPreferences(tx);
        await tx.execute(sql22`select pg_advisory_xact_lock(hashtext(${record2.id}))`);
        const [fresh] = await tx.select().from(settings).where(eq21(settings.id, record2.id));
        const data2 = fresh.data;
        if (data2.state !== "pending" || data2.dueAt > now) return null;
        const update = async (state, preparationReason) => {
          await tx.update(settings).set({ data: { ...data2, state, preparationReason, finishedAt: now } }).where(eq21(settings.id, record2.id));
          await recordNotification(tx, data2.historyKey || record2.id, { ...notificationEntry(data2, "sms"), preparationReason }, state, void 0, [], now);
        };
        if (!await pendingPreferenceAllowed(tx, data2, "sms")) {
          await update("disabled");
          return null;
        }
        if (!(await getSettings(tx, data2.clinicId)).notificationsEnabled) {
          await update("disabled");
          return null;
        }
        const clinic = await one(clinics, data2.clinicId, tx);
        const current = data2.appointmentId ? flatten((await tx.select().from(appointments).where(eq21(appointments.id, data2.appointmentId)))[0]) : null;
        const snapshot = data2.snapshot;
        const mismatch = current && (current.revision || 0) !== (snapshot.revision || 0);
        const invalidStatus = current && (data2.event === "cancelled" ? current.status !== "cancelled" : data2.event === "completed" ? current.status !== "completed" : data2.event === "reminder" ? !reminderDispatchEligible(current, now) : !["waiting", "booked"].includes(current.status));
        if (data2.appointmentId && (!current || mismatch || invalidStatus)) {
          await update("obsolete");
          return null;
        }
        const template = await resolvedTemplate(data2.event, data2.clinicId, tx, data2.recipientGroup, "sms");
        if (!template.content.enabled || template.activatedAt > data2.createdAt) {
          await update("disabled");
          return null;
        }
        const env = (await resolvedIntegration("notificationSms", tx)).env;
        if (!notificationSmsEnabled(env)) {
          await update("disabled");
          return null;
        }
        if (!notificationSmsReadiness(env).ready) {
          await update("configuration_failed");
          return null;
        }
        const targets = await targetAccounts(tx, data2.recipientGroup, current || snapshot, clinic);
        const target = targets.find((a) => data2.recipientPatientId ? a.targetPatientId === data2.recipientPatientId : a.id === data2.recipientUserId);
        const phone = notificationPhone(target?.mobile);
        if (!target || target.status !== "active" || !phone || phoneKey(phone) !== data2.recipientPhoneKey) {
          await update("no_recipient");
          return null;
        }
        if (current && !snapshotIdentityMatches(snapshot, current, clinic)) {
          await update("preparation_failed", "Booking snapshot identity does not match this event");
          return null;
        }
        const values = {
          ...data2.event === "onboarding" ? onboardingTemplateValues(snapshot, clinic, target.fullName || "") : visitTemplateValues(data2.appointmentId ? snapshot : null, clinic, target.fullName || "", data2.previousSession),
          appointment_details: current && appointmentSnapshotComplete(snapshot) ? confirmationText(snapshot, clinic).replace("Your appointment is confirmed.", "Visit details:") : "",
          previous_details: data2.previousSession?.detailsAvailable ? data2.previousDetails || "" : "",
          reference: snapshot.reference || "",
          timezone: snapshot.timezone || "",
          clinic_contact: [clinic.email, clinic.phone].filter(Boolean).join(" \xB7 ")
        };
        const content = template.content;
        if (!validEventContent(data2.event, content)) {
          await update("preparation_failed", "Published template uses variables incompatible with this event; edit explicitly or reset");
          return null;
        }
        const missing = missingVisitVariables([content.body], values);
        if (missing.length) {
          await update("preparation_failed", `Missing required template values: ${missing.join(", ")}`);
          return null;
        }
        const message = substitute(content.body, values);
        if (message.length > 1600) {
          await update("preparation_failed");
          return null;
        }
        const cfg = notificationSmsConfig(env);
        if (appointmentNotificationTarget(data2.event, data2.recipientGroup) && !smsMetadataReady(cfg, content)) {
          await update("configuration_failed");
          return null;
        }
        await recordNotification(tx, data2.historyKey || record2.id, notificationEntry(data2, "sms"), "sending", {
          sender: content.senderId || cfg.senderId,
          recipient: phone,
          message,
          provider: cfg.provider,
          ...templateSnapshot(template, data2.event, data2.recipientGroup, "sms"),
          dltTemplateId: content.dltTemplateId
        }, [cfg.key, cfg.bearerToken], now);
        await tx.update(settings).set({ data: { ...data2, state: "sending", claimedAt: now, attempts: data2.attempts + 1 } }).where(eq21(settings.id, record2.id));
        return { data: data2, env, phone, message, content };
      });
      if (!claim) continue;
      const subjectIds = await notificationStaffSubjects(conn, claim.data);
      await withStaffDispatch(subjectIds, "notification", async () => {
        let state = "delivery_unknown";
        let httpStatus;
        try {
          state = await send(claim.env, claim.phone, claim.message, claim.content, (code) => {
            httpStatus = code;
          });
        } catch {
        }
        const saved = await conn.update(settings).set({ data: { ...claim.data, state, claimedAt: now, attempts: claim.data.attempts + 1, finishedAt: Date.now() } }).where(sql22`${settings.id}=${record2.id} and ${settings.data}->>'state'='sending' and ${settings.data}->>'claimedAt'=${String(now)}`).returning({ id: settings.id });
        if (saved.length) await recordNotification(conn, claim.data.historyKey || record2.id, notificationEntry(claim.data, "sms"), state, void 0, [], Date.now(), httpStatus);
        return state;
      }, conn, (state) => state === "delivery_unknown");
    } catch {
      logger.warn("SMS notification preparation failed; durable dispatch state retained");
      await conn.transaction(async (tx) => {
        await tx.execute(sql22`select pg_advisory_xact_lock(hashtext(${record2.id}))`);
        const [fresh] = await tx.select().from(settings).where(eq21(settings.id, record2.id));
        if (fresh?.data.state !== "pending") return;
        const attempts = (fresh.data.attempts || 0) + 1;
        const next = { ...fresh.data, attempts, state: attempts >= 5 ? "preparation_failed" : "pending", dueAt: now + 6e4 * 2 ** attempts };
        await tx.update(settings).set({ data: next }).where(eq21(settings.id, record2.id));
        await recordNotification(tx, fresh.data.historyKey || record2.id, notificationEntry(fresh.data, "sms"), "preparation_failed");
        if (attempts < 5) await recordNotification(tx, fresh.data.historyKey || record2.id, notificationEntry(next, "sms"), "pending");
      });
    }
  }
}
var phoneKey;
var init_notification_sms_outbox = __esm({
  "artifacts/api-server/src/lib/notification-sms-outbox.ts"() {
    "use strict";
    init_db();
    init_store();
    init_clinical_membership();
    init_notification_templates();
    init_notification_template_store();
    init_integration_vault();
    init_notification_sms_transport();
    init_notification_history();
    init_logger();
    init_appointment_confirmation();
    init_notification_outbox();
    init_notification_template_values();
    init_notification_templates();
    init_staff_dispatch_barrier();
    init_notification_staff_subjects();
    init_notification_preferences();
    init_appointment_notification_cutover();
    init_appointment_notification_scope();
    phoneKey = (phone) => createHash8("sha256").update(phone).digest("hex");
  }
});

// <stdin>
init_notification_sms_transport();
init_integration_vault();
init_integration_config();
init_notification_templates();
init_notification_template_store();

// artifacts/api-server/src/lib/notification-controls.ts
init_db();
import { z as z4 } from "zod";

// artifacts/api-server/src/lib/notification-test-dispatch.ts
init_db();
init_http();
init_notification_history();
init_integration_vault();
init_integration_config();
init_notification_sms_transport();
init_auth_email();
init_notification_sms_diagnostics();
init_staff_dispatch_barrier();
import { createHash as createHash5, randomUUID as randomUUID7 } from "node:crypto";
import { eq as eq9, sql as sql10 } from "drizzle-orm";
import { parsePhoneNumberFromString as parsePhoneNumberFromString3 } from "libphonenumber-js";

// artifacts/api-server/src/lib/smtp-test-receipt.ts
init_db();
init_http();
init_integration_vault();
init_integration_config();
import { createHash as createHash4, randomUUID as randomUUID6 } from "node:crypto";
import { eq as eq8, sql as sql9 } from "drizzle-orm";
function smtpTestFingerprint(env) {
  return createHash4("sha256").update(JSON.stringify(smtpFields.map((key4) => [key4, env[key4] ?? null]))).digest("hex");
}
async function latestSmtpTestReceipt(actor, conn = db) {
  const prefix2 = `notification-test:${actor}:`;
  const [row] = await conn.select().from(settings).where(sql9`
    left(${settings.id}, ${prefix2.length}) = ${prefix2}
    and ${settings.data}->>'receiptKind' = 'smtp_provider_test'
  `).orderBy(sql9`(${settings.data}->>'createdAt')::bigint desc`, settings.id).limit(1);
  if (!row) return { test: null };
  let currentConfiguration = false;
  try {
    currentConfiguration = row.data.smtpFingerprint === smtpTestFingerprint((await resolvedIntegration("smtp", conn)).env);
  } catch {
  }
  return { test: {
    requestId: row.id.slice(prefix2.length),
    sentAt: new Date(row.data.createdAt).toISOString(),
    status: row.data.finishedAt ? row.data.status : "sending",
    currentConfiguration,
    receivedAt: row.data.receivedAt ?? null
  } };
}
async function confirmSmtpReceipt(actor, requestId, conn = db) {
  const id2 = `notification-test:${actor}:${requestId}`;
  await conn.transaction(async (tx) => {
    const [row] = await tx.select().from(settings).where(eq8(settings.id, id2)).for("update");
    assert(row?.data.receiptKind === "smtp_provider_test", 409, "This SMTP test is not available for confirmation.");
    assert(
      row.data.finishedAt && ["provider_accepted", "delivery_unknown"].includes(row.data.status),
      409,
      "Only a completed, dispatched test can be confirmed."
    );
    const fingerprint2 = smtpTestFingerprint((await resolvedIntegration("smtp", tx)).env);
    assert(row.data.smtpFingerprint === fingerprint2, 409, "Saved SMTP settings changed. This receipt belongs to an earlier configuration.");
    if (row.data.receivedAt) return;
    const receivedAt = (/* @__PURE__ */ new Date()).toISOString();
    await tx.update(settings).set({ data: { ...row.data, receivedAt } }).where(eq8(settings.id, id2));
    await tx.insert(auditLogs).values({
      id: randomUUID6(),
      actorId: actor,
      action: "smtp_test_receipt",
      entityType: "integration",
      entityId: "smtp",
      summary: "Superadmin manually confirmed receipt of an SMTP test email; not automatic delivery verification."
    });
  });
  return latestSmtpTestReceipt(actor, conn);
}

// artifacts/api-server/src/lib/notification-test-dispatch.ts
async function dispatchNotificationTest(actor, input, conn = db, smsSend = sendNotificationSms, emailSend = sendAuthEmail, onDiagnostic) {
  assert(input.confirmed && /^[a-f0-9-]{36}$/i.test(input.requestId), 400, "Confirm the test and provide a request ID");
  const ids = /* @__PURE__ */ new Set([actor]);
  const accounts = await conn.select({ id: users.id, role: users.role, email: users.email, mobile: users.mobile }).from(users);
  const phone = (value) => {
    try {
      return parsePhoneNumberFromString3(String(value || ""), "IN")?.number || "";
    } catch {
      return "";
    }
  };
  for (const account2 of accounts) {
    if (!["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(account2.role)) continue;
    if (input.channel === "email" ? account2.email.toLowerCase() === input.recipient.toLowerCase() : Boolean(phone(input.recipient)) && phone(account2.mobile) === phone(input.recipient)) ids.add(account2.id);
  }
  return withStaffDispatch(
    [...ids],
    "test",
    () => dispatchNotificationTestInternal(actor, input, conn, smsSend, emailSend, onDiagnostic),
    conn,
    (outcome) => outcome === "delivery_unknown"
  );
}
async function dispatchNotificationTestInternal(actor, input, conn, smsSend, emailSend, onDiagnostic) {
  const reportDiagnostic = (diagnostic2) => {
    try {
      onDiagnostic?.(diagnostic2);
    } catch {
    }
  };
  assert(input.confirmed && /^[a-f0-9-]{36}$/i.test(input.requestId), 400, "Confirm the test and provide a request ID");
  const id2 = `notification-test:${actor}:${input.requestId}`;
  const digest3 = createHash5("sha256").update(JSON.stringify(input)).digest("hex");
  const entry = {
    channel: input.channel,
    event: input.event,
    recipientGroup: input.recipientGroup,
    clinicId: input.clinicId,
    source: "test",
    occurrence: input.requestId,
    _sourceInput: { snapshot: { actorId: actor } }
  };
  const claim = await conn.transaction(async (tx) => {
    await tx.execute(sql10`select pg_advisory_xact_lock(hashtext(${id2}))`);
    const [prior] = await tx.select().from(settings).where(eq9(settings.id, id2));
    if (prior) {
      assert(prior.data.digest === digest3, 409, "Request ID already used for a different test");
      return { replay: prior.data.status, diagnostic: storedSmsDiagnostic(prior.data.diagnosticCode, prior.data.httpStatus) };
    }
    let env, sender, provider, secrets;
    try {
      env = (await resolvedIntegration(input.channel === "sms" ? "notificationSms" : "smtp", tx)).env;
      if (input.channel === "sms") {
        const cfg = notificationSmsConfig(env);
        smsPayload(cfg, input.recipient, input.message, input.content || {});
        sender = input.content?.senderId || cfg.senderId;
        provider = cfg.provider;
        secrets = [cfg.key, cfg.bearerToken];
      } else {
        const cfg = smtpConfig(env);
        sender = cfg.from;
        provider = "smtp";
        secrets = [cfg.password];
      }
    } catch {
      await tx.insert(settings).values({ id: id2, data: { digest: digest3, status: "pre_dispatch_failed", createdAt: Date.now() } });
      await recordDecision(tx, id2, entry, "configuration_failed");
      return { replay: "pre_dispatch_failed" };
    }
    await tx.insert(settings).values({ id: id2, data: {
      digest: digest3,
      status: "delivery_unknown",
      createdAt: Date.now(),
      claimedAt: Date.now(),
      ...input.channel === "email" && input.event === "provider_test" ? { receiptKind: "smtp_provider_test", smtpFingerprint: smtpTestFingerprint(env) } : {}
    } });
    await tx.insert(auditLogs).values({
      id: randomUUID7(),
      actorId: actor,
      action: "notification_test",
      entityType: "notification_templates",
      entityId: input.channel,
      summary: `${input.channel} ${input.event} ${input.recipientGroup} test requested`
    });
    await recordNotification(tx, id2, entry, "sending", {
      sender,
      provider,
      recipient: input.recipient,
      subject: input.subject,
      message: input.message,
      templateId: input.templateId,
      templateScope: input.templateScope,
      templateRevision: input.templateRevision,
      dltTemplateId: input.content?.dltTemplateId
    }, secrets);
    return { env };
  });
  if (claim.replay) {
    if (claim.replay === "provider_rejected" && "diagnostic" in claim && claim.diagnostic) reportDiagnostic(claim.diagnostic);
    return claim.replay;
  }
  let status = "delivery_unknown", httpStatus;
  let diagnostic;
  try {
    if (input.channel === "sms") status = await smsSend(
      claim.env,
      input.recipient,
      input.message,
      input.content || {},
      (code) => {
        httpStatus = code;
      },
      (info) => {
        diagnostic = storedSmsDiagnostic(info.code, httpStatus);
      }
    );
    else {
      await emailSend(input.recipient, input.subject, input.message, void 0, input.rendered, [], claim.env);
      status = "provider_accepted";
    }
  } catch (error) {
    status = error?.code === "EMAIL_REJECTED" ? "provider_rejected" : ["EMAIL_UNCONFIGURED", "EMAIL_PRE_DISPATCH_FAILED"].includes(error?.code) ? "pre_dispatch_failed" : "delivery_unknown";
  }
  if (status !== "provider_rejected") diagnostic = void 0;
  try {
    await conn.update(settings).set({ data: sql10`${settings.data} || ${JSON.stringify({
      digest: digest3,
      status,
      finishedAt: Date.now(),
      ...diagnostic ? { diagnosticCode: diagnostic.code, httpStatus: diagnostic.httpStatus } : {}
    })}::jsonb` }).where(eq9(settings.id, id2));
    await recordNotification(conn, id2, entry, status, void 0, [], Date.now(), httpStatus);
  } catch {
  }
  if (diagnostic) reportDiagnostic(diagnostic);
  return status;
}

// artifacts/api-server/src/lib/notification-controls.ts
init_http();
init_notification_template_store();
init_notification_templates();
init_integration_vault();
init_notification_sms_transport();
init_integration_config();
init_auth_email();
init_store();
init_demo_policy();
init_notification_templates();
init_security_template_definitions();
import { accountRoleLabel as accountRoleLabel2 } from "@workspace/api-zod/notification-variable-contract";
var eventControlInput = z4.object({
  channel: z4.enum(["email", "sms"]),
  event: z4.enum(templateEvents),
  recipient: z4.enum(templateRecipients),
  clinicId: z4.string().min(1).max(100).optional(),
  revision: z4.number().int().min(0),
  enabled: z4.boolean(),
  confirmed: z4.literal(true)
}).strict();
async function eventControls(user, clinicId) {
  assert(user.role === "superAdmin" && !user.demo && user.demoFixture !== DEMO_FIXTURE, 403, "Real Superadmin access required");
  const clinic = await authorizedTemplateScope(user, clinicId);
  return deliveryControlCatalog(db, clinicId, clinic);
}
async function deliveryControlCatalog(conn, clinicId, clinic) {
  const readiness = await integrationSettings(conn);
  const gate = (await getSettings(conn, clinicId)).notificationsEnabled;
  let smsConfig;
  try {
    smsConfig = notificationSmsConfig((await resolvedIntegration("notificationSms", conn)).env);
  } catch {
  }
  const items = [];
  for (const channel of ["email", "sms"]) for (const recipient of templateRecipients) for (const event of templateEvents) {
    if (!validTemplateTarget(event, recipient, channel) || requiredEvent(event) && clinicId) continue;
    const template = await resolvedTemplate(event, clinicId, conn, recipient, channel);
    const reasons = [];
    if (event === "booking_status_link" && (!template.wordingPublished || !template.content.dltTemplateId))
      reasons.push("Publish the approved manual booking-status link wording and its own registration before use");
    if (!(channel === "sms" ? readiness.notificationSms : readiness.smtp).ready) reasons.push(`Configure ${channel === "sms" ? "SMS API" : "SMTP"} on the ${channel === "sms" ? "SMS" : "Email"} page`);
    if (channel === "sms" && !requiredEvent(event) && readiness.notificationSms.notificationsEnabled === false) reasons.push("SMS notifications are disabled in Communication Settings");
    if (channel === "email" && !requiredEvent(event) && readiness.smtp.notificationsEnabled === false) reasons.push("Email notifications are disabled in Communication Settings");
    if (channel === "sms" && isSecurityEvent(event) && !template.wordingPublished) reasons.push("Publish approved security SMS wording before use");
    const sms = template.content;
    if (channel === "sms" && smsConfig && !smsMetadataReady(smsConfig, sms)) reasons.push(smsConfig.provider === "keepInTouch" ? "Publish a DLT Template ID for this event; Keep in Touch uses Sender ID but no Entity ID" : "Configure Sender and Entity IDs, and publish a DLT Template ID for this event");
    if (gate === false && !requiredEvent(event)) reasons.push(clinicId ? "Clinic notification gate is off" : "Platform default notification gate is off; clinics may have explicit overrides");
    if (!template.content.enabled) reasons.push("Published activation is off");
    items.push({
      channel,
      event,
      recipient,
      required: requiredEvent(event),
      revision: template.local.revision,
      enabled: template.content.enabled,
      source: template.source,
      ready: reasons.length === 0,
      blockedReasons: reasons,
      timing: event === "booking_status_link" ? "Manual only, after staff previews the eligible patient recipient and approved message and explicitly confirms. Never sent by automatic booking events." : requiredEvent(event) ? "Platform security message sent on its authentication action when enabled at System Default. Optional Delivery does not apply. Disabling verification or setup delivery can prevent that action; SMS setup advisories do not replace the emailed link." : event === "staff_created_admin" ? "After the staff account commits, only to the creating administrator's matching verified contact. Failed creation sends no notice." : event === "staff_welcome" ? "Once per new account and channel, after that contact is verified. Email verification never authorizes SMS, or the reverse. Past skips are not replayed." : event === "reminder" ? "One hour before the session start in the session timezone; not an exact consultation time" : event === "onboarding" ? recipient === "superAdmin" ? "After clinic registration commits, to active System Admins" : "After clinic registration commits, to the owning Clinic Admin" : "After the corresponding visit change commits; current contact and membership rechecked"
    });
  }
  return {
    scopeName: clinic?.name || "Platform defaults",
    notificationsEnabled: gate,
    gateDescription: clinicId ? `Clinic notification gate is ${gate ? "on" : "off"}. This page never changes it.` : "Platform defaults are inherited only when a clinic has no published override. Each clinic's notification gate still applies.",
    items
  };
}
var eventTestInput = z4.object({
  channel: z4.enum(["email", "sms"]),
  event: z4.enum(templateEvents),
  recipientGroup: z4.enum(templateRecipients),
  clinicId: z4.string().min(1).max(100).optional(),
  revision: z4.number().int().min(0),
  content: z4.union([templateContent, smsTemplateContent]),
  values: z4.record(z4.string(), z4.string().max(1500)),
  recipient: z4.string().max(254).optional(),
  confirmed: z4.boolean().optional(),
  requestId: z4.string().uuid().optional()
}).strict();
var outcomeMessages = {
  provider_accepted: "The provider accepted the message. Handset or inbox delivery is not confirmed.",
  provider_rejected: "The provider explicitly rejected the message. Check configuration and recipient.",
  pre_dispatch_failed: "The message was not dispatched. Check channel configuration and required template fields.",
  delivery_unknown: "Dispatch outcome is uncertain. Do not automatically resend; verify with the provider first."
};
async function prepareTemplateTest(user, input) {
  assert(user.role === "superAdmin" && !user.demo && user.demoFixture !== DEMO_FIXTURE, 403, "Real Superadmin access required");
  const body = eventTestInput.parse(input);
  await authorizedTemplateScope(user, body.clinicId);
  assert(validTemplateTarget(body.event, body.recipientGroup, body.channel), 400, "Invalid event recipient or channel");
  assert(!requiredEvent(body.event) || !body.clinicId, 400, "Security messages are platform-scoped");
  const effective = await resolvedTemplate(body.event, body.clinicId, db, body.recipientGroup, body.channel);
  assert(effective.local.revision === body.revision, 409, "Template changed. Refresh before testing.");
  const content = (body.channel === "sms" ? smsTemplateContent : templateContent).parse(body.content);
  assert(validEventContent(body.event, content), 400, "Use this event's supported variables, including required code and expiry placeholders.");
  if (isSecurityEvent(body.event)) {
    assert(body.channel !== "email" || !["doctor_setup", "staff_setup"].includes(body.event) || /\{\{\s*setup_link\s*\}\}/.test(content.body), 400, "Setup email must include {{setup_link}}");
    assert(body.channel !== "sms" || !/\{\{\s*setup_link\s*\}\}/.test(content.body), 400, "SMS cannot include setup links");
  }
  const texts = body.channel === "sms" ? [content.body] : [content.subject, content.body, content.prefix, content.footer];
  const used = new Set(texts.flatMap((text2) => [...text2.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)].map((m) => m[1])));
  assert(Object.keys(body.values).length === used.size && Object.keys(body.values).every((k) => used.has(k)) && [...used].every((k) => k === "clinic_contact" || body.values[k]?.trim()), 400, "Provide exactly the placeholders used by this template (clinic contact is optional)");
  const sample = { otp: "123456", expiry_minutes: "10", setup_link: "https://example.invalid/set-password?token=fictional-preview-only", recipient_name: "Example Recipient", role_name: accountRoleLabel2(body.recipientGroup) };
  const values = requiredEvent(body.event) ? sample : body.values;
  const rendered = body.channel === "sms" ? { subject: "", text: substitute(content.body, values) } : renderNotification(content, values, { event: body.event });
  assert(rendered.text.length <= (body.channel === "sms" ? 1600 : 24e3), 400, "Rendered message is too long");
  return { body, content, rendered };
}
async function testTemplate(user, prepared, smsSend = sendNotificationSms, emailSend = sendAuthEmail) {
  const { body, content, rendered } = prepared;
  assert(!requiredEvent(body.event), 400, "Security templates support fictional previews only. Verify real authentication delivery only with separate authorization.");
  assert(body.confirmed === true && body.requestId, 400, "Confirm one real test send and provide a request ID");
  assert(body.recipient && (body.channel === "sms" ? /^\+[1-9]\d{6,14}$/.test(body.recipient) : validEmailAddress(body.recipient)), 400, "Enter one valid explicit recipient");
  let diagnostic;
  const status = await dispatchNotificationTest(user.id, {
    channel: body.channel,
    event: body.event,
    recipientGroup: body.recipientGroup,
    clinicId: body.clinicId,
    recipient: body.recipient,
    subject: rendered.subject,
    message: rendered.text,
    confirmed: true,
    requestId: body.requestId,
    templateId: `${body.channel}:${body.event}:${body.recipientGroup}`,
    templateRevision: body.revision,
    templateScope: "test_draft",
    content: body.channel === "sms" ? content : void 0,
    rendered: body.channel === "email" ? rendered : void 0
  }, db, smsSend, emailSend, (info) => {
    diagnostic = info;
  });
  const message = diagnostic ? `${diagnostic.httpStatus ? `HTTP ${diagnostic.httpStatus}. ` : ""}${diagnostic.message}` : outcomeMessages[status];
  return { status, message, subject: rendered.subject, body: rendered.text };
}

// <stdin>
init_notification_sms_outbox();
init_notification_outbox();
init_store();
init_db();
init_notification_history();
init_appointment_confirmation();
init_notification_preferences();

// artifacts/api-server/src/lib/personal-notification-settings.ts
init_db();
init_http();
init_store();
init_notification_templates();
init_security_template_definitions();
init_notification_template_store();
init_integration_vault();
init_integration_config();
init_notification_sms_transport();
init_notification_sms_outbox();
init_notification_preferences();
init_notification_history();
init_demo_policy();
init_permission_policy();
import { eq as eq22, sql as sql23 } from "drizzle-orm";
async function personalContext(user, conn) {
  const [raw2] = await conn.select().from(users).where(eq22(users.id, user.id));
  assert(raw2, 401, "Account unavailable");
  const account2 = flatten(raw2);
  const patientProfiles = account2.role === "patient" ? await conn.select().from(patients).where(eq22(patients.userId, user.id)) : [];
  const groups = /* @__PURE__ */ new Set([account2.role]);
  if ((await conn.select({ id: doctors.id }).from(doctors).where(eq22(doctors.userId, user.id))).length) groups.add("doctor");
  const scope2 = account2.role === "patient" ? await conn.select({ id: clinics.id, data: clinics.data }).from(clinics).where(sql23`${clinics.id} in (select clinic_id from appointments where patient_id in (select id from patients where user_id = ${user.id}))
        or ${clinics.id} in (select clinic_id from patients where user_id = ${user.id})`) : account2.role === "superAdmin" ? await conn.select({ id: clinics.id, data: clinics.data }).from(clinics) : await conn.select({ id: clinics.id, data: clinics.data }).from(clinics).where(sql23`${clinics.adminId} = ${user.id} or ${clinics.id} in (select clinic_id from assignments where user_id = ${user.id})`);
  const owned = account2.role === "clinicAdmin" ? await conn.select().from(clinics).where(eq22(clinics.adminId, user.id)) : [];
  return { account: account2, groups, scope: scope2, owned, patientProfiles };
}
async function personalNotificationSettings(user, conn = db) {
  const { account: account2, groups, scope: scope2, owned, patientProfiles } = await personalContext(user, conn);
  const prefs = await personalPreferences(user.id, conn);
  const items = [];
  const emailEnv = (await resolvedIntegration("smtp", conn)).env;
  const smsEnv = (await resolvedIntegration("notificationSms", conn)).env;
  let emailReady = true;
  try {
    smtpConfig(emailEnv);
  } catch {
    emailReady = false;
  }
  let smsConfig;
  try {
    smsConfig = notificationSmsConfig(smsEnv);
  } catch {
  }
  for (const channel of ["email", "sms"]) for (const event of templateEvents) {
    if (![...groups].some((group) => validTemplateTarget(event, group, channel))) continue;
    const mandatory = requiredEvent(event);
    const key4 = preferenceKey(channel, event), saved = prefs.choices[key4] ?? null, selected = mandatory || saved !== false;
    const reasons = [];
    if (!mandatory) {
      if (account2.status !== "active") reasons.push("Your account is inactive");
      const contacts = patientProfiles.length ? patientProfiles.map((p) => ({
        email: account2.email || p.data?.email,
        mobile: account2.mobile || p.mobile
      })) : [account2];
      if (!contacts.some((contact) => channel === "email" ? validEmailAddress(contact.email) : notificationPhone(contact.mobile)))
        reasons.push(`No eligible ${channel === "email" ? "email address" : "mobile number"} on your account or linked patient profile`);
      if (channel === "email" ? !emailNotificationsEnabled(emailEnv) : !notificationSmsEnabled(smsEnv)) reasons.push(`${channel === "email" ? "Email" : "SMS"} provider notifications are disabled`);
      if (channel === "email" ? !emailReady : !notificationSmsReadiness(smsEnv).ready) reasons.push(`${channel === "email" ? "Email" : "SMS"} provider is not ready`);
      const scopes = scope2.length ? scope2 : [{ id: void 0, data: { name: "Platform defaults" } }];
      let eligible = false;
      const scopeReasons = [];
      for (const clinic of scopes) {
        const name = String(clinic.data?.name || "Clinic");
        const gate = (await getSettings(conn, clinic.id)).notificationsEnabled;
        const targetReasons = [];
        if (!gate) targetReasons.push("notification gate is off");
        let published = false, metadata2 = false;
        for (const group of groups) {
          if (!validTemplateTarget(event, group, channel)) continue;
          const template = await resolvedTemplate(event, clinic.id, conn, group, channel);
          if (template.content.enabled) {
            published = true;
            if (channel === "email" || smsConfig && smsMetadataReady(smsConfig, template.content)) metadata2 = true;
          }
        }
        if (!published) targetReasons.push("published event activation is off");
        if (published && !metadata2) targetReasons.push("published SMS sender/template metadata is not ready");
        if (!clinic.id && account2.role !== "superAdmin") targetReasons.push("no current clinic recipient context; membership is checked on each event");
        if (!targetReasons.length) eligible = true;
        else scopeReasons.push(`${name}: ${targetReasons.join("; ")}`);
      }
      if (!eligible) reasons.push(...scopeReasons);
      else if (scopeReasons.length) reasons.push(`Other clinics remain restricted: ${scopeReasons.join(" | ")}`);
      const blocked2 = !eligible || reasons.some((r) => !r.startsWith("Other clinics remain restricted:"));
      items.push({ key: key4, event, channel, saved, inherited: saved === null, selected, state: !selected ? "Off" : blocked2 ? "On but blocked" : "On", reasons });
    } else items.push({ key: key4, event, channel, saved: null, inherited: true, selected: true, state: "Required", reasons: ["Account-security messages cannot be disabled. Optional delivery and inbox choices do not apply."] });
  }
  let inboxAvailable = true;
  try {
    await enforcePermissionPolicy({ ...user, role: account2.role }, { method: "GET", path: "/notifications" });
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 403) throw error;
    inboxAvailable = false;
  }
  for (const category of ["appointments", "queue", ...["superAdmin", "clinicAdmin"].includes(account2.role) ? ["system"] : []]) {
    const key4 = preferenceKey("inApp", category), saved = prefs.choices[key4] ?? null;
    items.push({
      key: key4,
      event: category,
      channel: "inApp",
      saved,
      inherited: saved === null,
      selected: saved !== false,
      state: !inboxAvailable ? "Unavailable" : saved === false ? "Off" : "On",
      reasons: [inboxAvailable ? "Only records you are authorized to see appear. Hiding a category preserves history and read markers." : "Inbox access is disabled by your administrator. Preferences cannot grant access."]
    });
  }
  const canManage = ["superAdmin", "clinicAdmin"].includes(account2.role) && !user.demo && user.demoFixture !== DEMO_FIXTURE;
  return {
    revision: prefs.revision,
    items,
    canManage,
    clinics: canManage ? owned.map((c) => ({ id: c.id, name: String(c.data?.name || "Clinic") })) : [],
    activeClinicId: owned.some((c) => c.id === user.activeClinicId) ? user.activeClinicId : null
  };
}
async function savePersonalNotificationSettings(user, input, conn = db) {
  await conn.transaction(async (tx) => {
    await lockNotificationPreferences(tx);
    const supported = await personalNotificationSettings(user, tx);
    const allowed = new Set(supported.items.filter((r) => r.state !== "Required" && r.state !== "Unavailable").map((r) => r.key));
    assert(new Set(input.choices.map((c) => c.key)).size === input.choices.length, 400, "Duplicate notification choice");
    assert(input.choices.every((c) => allowed.has(c.key)), 400, "Unsupported or required notification choice");
    const prefs = await personalPreferences(user.id, tx);
    assert(prefs.revision === input.revision, 409, "Notification choices changed. Reload before saving.");
    const next = { revision: prefs.revision + 1, choices: { ...prefs.choices }, epochs: { ...prefs.epochs } };
    for (const choice of input.choices) {
      if (choice.enabled === null) delete next.choices[choice.key];
      else next.choices[choice.key] = choice.enabled;
      if (choice.enabled === false) next.epochs[choice.key] = (next.epochs[choice.key] || 0) + 1;
    }
    await writePersonalPreferences(tx, user.id, next);
    const pending = await tx.select().from(settings).where(sql23`(${settings.id} like 'mail-outbox:%' or ${settings.id} like 'sms-outbox:%') and ${settings.data}->>'state' = 'pending'`);
    for (const job of pending) {
      const channel = job.id.startsWith("sms-") ? "sms" : "email";
      if (!await pendingPreferenceAllowed(tx, job.data, channel)) {
        await tx.update(settings).set({ data: { ...job.data, state: "disabled", finishedAt: Date.now() } }).where(eq22(settings.id, job.id));
        await recordNotification(tx, job.data.historyKey || job.id, notificationEntry(job.data, channel), "disabled");
      }
    }
    if (input.choices.some((c) => c.key === "email:booking" && c.enabled === false)) {
      const receipts = await tx.select().from(settings).where(sql23`${settings.id} like 'patient-confirmation-preference:%' and ${settings.data}->>'userId' = ${user.id}`);
      for (const receipt of receipts) {
        const bookingId = receipt.id.slice("patient-confirmation-preference:".length);
        const [history] = await tx.select().from(settings).where(eq22(settings.id, historyId(`patient-booking:${bookingId}`)));
        if (history?.data.status === "pending" && !history.data.dispatchAt)
          await recordNotification(tx, `patient-booking:${bookingId}`, { channel: "email", event: "booking", recipientGroup: "patient" }, "disabled");
      }
    }
  });
  return personalNotificationSettings(user, conn);
}

// artifacts/api-server/src/lib/managed-notification-settings.ts
init_db();
init_notification_template_store();
import { eq as eq23, sql as sql24 } from "drizzle-orm";
init_notification_preferences();
init_store();
init_http();
init_notification_templates();
init_security_template_definitions();
init_notification_history();
var revisionId = (clinicId) => `notification-policy-revision:${clinicId || "platform"}`;
async function policyRevision(conn, clinicId) {
  const [row] = await conn.select().from(settings).where(eq23(settings.id, revisionId(clinicId)));
  const stored2 = row?.data?.revision || 0;
  return stored2 * 2 + ((await getSettings(conn, clinicId)).notificationsEnabled ? 1 : 0);
}
async function managedNotificationSettings(user, clinicId, conn = db) {
  const clinic = await authorizedTemplateScope(user, clinicId, conn);
  const catalog = await deliveryControlCatalog(conn, clinicId, clinic);
  const canActivate = user.role === "superAdmin" || user.role === "clinicAdmin" && !!clinicId;
  const [platform] = await conn.select().from(settings).where(eq23(settings.id, "platform"));
  const inherited = clinicId ? typeof clinic?.policies?.notificationsEnabled !== "boolean" : typeof platform?.data?.notificationsEnabled !== "boolean";
  return {
    revision: await policyRevision(conn, clinicId),
    scopeName: catalog.scopeName,
    notificationsEnabled: !!catalog.notificationsEnabled,
    inherited,
    canActivate,
    events: templateEvents.map((id2, order) => ({
      id: id2,
      label: id2 === "onboarding" ? "Clinic Onboarding" : eventTitles[id2],
      order,
      clinicApplicable: !requiredEvent(id2),
      explanation: requiredEvent(id2) ? "Platform authentication and security delivery is controlled by Superadmin at System Default, not per clinic." : ""
    })),
    // Activation does not grant wording or provider access. No platform security
    // rows or Superadmin recipients are disclosed to clinic administrators.
    items: catalog.items.filter((r) => user.role === "superAdmin" || !r.required && r.recipient !== "superAdmin").map((r) => ({
      ...r,
      canActivate,
      canEdit: user.role === "superAdmin" || r.channel === "email" && !r.required && r.recipient !== "superAdmin",
      blockedReasons: user.role === "superAdmin" ? r.blockedReasons : [...new Set(r.blockedReasons.map((reason) => /SMTP|SMS|Communication|DLT|Sender|Entity/.test(reason) ? "Delivery setup requires the System Admin; contact them to review provider and approved wording readiness." : reason))]
    }))
  };
}
async function saveManagedNotificationSettings(user, input, conn = db) {
  await conn.transaction(async (tx) => {
    await lockNotificationPreferences(tx);
    const clinic = await authorizedTemplateScope(user, input.clinicId, tx);
    assert(await policyRevision(tx, input.clinicId) === input.revision, 409, "Notification policy changed. Reload before saving.");
    assert(new Set(input.changes.map((c) => `${c.channel}:${c.event}:${c.recipient}`)).size === input.changes.length, 400, "Duplicate event activation");
    if (clinic) await tx.execute(sql24`select id from clinics where id = ${clinic.id} for update`);
    else {
      await tx.insert(settings).values({ id: "platform", data: {} }).onConflictDoNothing();
      await tx.execute(sql24`select id from settings where id = 'platform' for update`);
    }
    await authorizedTemplateScope(user, input.clinicId, tx);
    assert(await policyRevision(tx, input.clinicId) === input.revision, 409, "Notification policy changed. Reload before saving.");
    const gate = (await getSettings(tx, input.clinicId)).notificationsEnabled;
    const activating = input.notificationsEnabled === true && !gate || input.changes.some((c) => c.enabled);
    assert(!activating || input.confirmed === true, 400, "Confirm activation for this scope");
    for (const change2 of [...input.changes].sort((a, b) => `${a.channel}:${a.event}:${a.recipient}`.localeCompare(`${b.channel}:${b.event}:${b.recipient}`))) {
      await changeActivation(user, { ...change2, event: change2.event, recipient: change2.recipient, clinicId: input.clinicId }, tx);
    }
    if (input.notificationsEnabled !== void 0) {
      if (clinic) {
        await tx.execute(sql24`update clinics set data = jsonb_set(data, '{policies}', coalesce(data->'policies','{}'::jsonb) || ${JSON.stringify({ notificationsEnabled: input.notificationsEnabled })}::jsonb)
          where id = ${clinic.id}`);
      } else {
        await tx.insert(settings).values({ id: "platform", data: {} }).onConflictDoNothing();
        await tx.execute(sql24`update settings set data = data || ${JSON.stringify({ notificationsEnabled: input.notificationsEnabled })}::jsonb where id = 'platform'`);
      }
      await audit(user, "notification_gate", "notification_policy", { id: input.clinicId || "platform", clinicId: input.clinicId }, tx);
    }
    const revision = Math.floor(input.revision / 2) + 1, id2 = revisionId(input.clinicId);
    await tx.insert(settings).values({ id: id2, data: { revision } }).onConflictDoUpdate({ target: settings.id, set: { data: { revision } } });
    const pending = await tx.select().from(settings).where(sql24`(${settings.id} like 'mail-outbox:%' or ${settings.id} like 'sms-outbox:%')
      and ${settings.data}->>'state' = 'pending' and (${input.clinicId || null}::text is null or ${settings.data}->>'clinicId' = ${input.clinicId || null})`);
    for (const job of pending) {
      const channel = job.id.startsWith("sms-") ? "sms" : "email";
      const gateOn = (await getSettings(tx, job.data.clinicId)).notificationsEnabled;
      const template = await resolvedTemplate(job.data.event, job.data.clinicId, tx, job.data.recipientGroup, channel);
      if (!gateOn || !template.content.enabled) {
        await tx.update(settings).set({ data: { ...job.data, state: "disabled", finishedAt: Date.now() } }).where(eq23(settings.id, job.id));
        await recordNotification(tx, job.data.historyKey || job.id, notificationEntry(job.data, channel), "disabled");
      }
    }
    const receipts = await tx.execute(sql24`select s.id, s.data, a.clinic_id as "clinicId" from settings s
      join appointments a on s.id = 'patient-confirmation-preference:' || a.id
      where (${input.clinicId || null}::text is null or a.clinic_id = ${input.clinicId || null})`);
    for (const receipt of receipts.rows) {
      const bookingId = receipt.id.slice("patient-confirmation-preference:".length);
      const [history] = await tx.select().from(settings).where(eq23(settings.id, historyId(`patient-booking:${bookingId}`)));
      if (history?.data.status !== "pending" || history.data.dispatchAt) continue;
      if (!(await getSettings(tx, receipt.clinicId)).notificationsEnabled || !(await resolvedTemplate("booking", receipt.clinicId, tx, "patient", "email")).content.enabled) {
        await tx.update(settings).set({ data: { ...receipt.data, enabled: false } }).where(eq23(settings.id, receipt.id));
        await recordNotification(tx, `patient-booking:${bookingId}`, { channel: "email", event: "booking", recipientGroup: "patient" }, "disabled");
      }
    }
  });
  return managedNotificationSettings(user, input.clinicId, conn);
}

// <stdin>
init_security_template_definitions();
init_security_notifications();

// artifacts/api-server/src/lib/patient-login-sms.ts
init_db();
init_http();
init_native_auth();
init_integration_vault();
init_notification_template_store();
init_notification_templates();
init_notification_sms_transport();
init_security_notifications();
import { eq as eq24, sql as sql25 } from "drizzle-orm";
import { randomInt as randomInt2 } from "node:crypto";
function patientLoginPhone(value) {
  assert(typeof value === "string" && /^\+[1-9]\d{6,14}$/.test(value.trim()), 400, "Enter a mobile number with country code");
  return value.trim();
}
async function patientAccountsForPhone(mobile, conn = db) {
  return conn.select().from(users).where(sql25`
    ${users.role} = 'patient' and ${users.status} = 'active' and
    regexp_replace(coalesce(${users.mobile}, ''), '[^0-9]', '', 'g') = ${mobile.slice(1)}`).limit(2);
}
async function sendPatientLoginSms(mobile, otp, expirySeconds, conn = db, send = sendNotificationSms) {
  assert(/^\d{6}$/.test(otp) && Number.isFinite(expirySeconds) && expirySeconds > 0, 503, "Login code or expiry is unavailable");
  await requireSecurityDelivery("patient_login_otp", "patient", "sms", conn);
  const { env } = await resolvedIntegration("notificationSms", conn);
  const cfg = notificationSmsConfig(env);
  const template = await resolvedTemplate("patient_login_otp", void 0, conn, "patient", "sms");
  const content = smsTemplateContent.parse(template.content);
  assert(validEventContent("patient_login_otp", content), 503, "Patient login SMS template is not configured");
  const message = substitute(content.body, { otp, expiry_minutes: String(Math.ceil(expirySeconds / 60)) });
  smsPayload(cfg, mobile, message, content);
  await requireSecurityDelivery("patient_login_otp", "patient", "sms", conn);
  const outcome = await send(env, mobile, message, content);
  if (outcome !== "provider_accepted") throw new HttpError(
    503,
    "The login SMS could not be confirmed. Wait before requesting a new code, or use email login.",
    "PATIENT_SMS_DELIVERY_FAILED"
  );
}
async function startPatientSmsLogin(mobile, conn = db, deliver = sendPatientLoginSms) {
  const matches = await patientAccountsForPhone(mobile, conn);
  if (matches.length !== 1) throw new HttpError(
    400,
    "No patient account eligible for SMS login was found for this mobile. Choose Email OTP to sign in or register, or check the mobile saved on your patient account.",
    "PATIENT_SMS_NOT_REGISTERED"
  );
  await requireSecurityDelivery("patient_login_otp", "patient", "sms", conn);
  const cfg = notificationSmsConfig((await resolvedIntegration("notificationSms", conn)).env);
  const template = await resolvedTemplate("patient_login_otp", void 0, conn, "patient", "sms");
  assert(validEventContent("patient_login_otp", template.content), 503, "Patient login SMS template is not configured");
  smsPayload(cfg, mobile, substitute(template.content.body, { otp: "000000", expiry_minutes: "10" }), smsTemplateContent.parse(template.content));
  const account2 = matches[0], otp = String(randomInt2(1e5, 1e6));
  const challengeId = await createChallenge({
    userId: account2.id,
    email: account2.email,
    purpose: "patient-sms",
    secret: otp,
    ttlMs: 10 * 6e4,
    data: { mobile }
  });
  try {
    await deliver(mobile, otp, 600, conn);
  } catch (error) {
    await conn.update(authChallenges).set({ consumedAt: /* @__PURE__ */ new Date(), data: {} }).where(eq24(authChallenges.id, challengeId));
    throw error;
  }
  return challengeId;
}
async function verifyPatientSmsLogin(challengeId, otp, conn = db) {
  const challenge = await consumeChallenge(challengeId, "patient-sms", otp);
  assert(challenge.userId, 400, "Invalid or expired verification");
  const userId = challenge.userId;
  return conn.transaction(async (tx) => {
    await lockCredentials(tx, userId);
    const mobile = patientLoginPhone(challenge.data?.mobile);
    const matches = await patientAccountsForPhone(mobile, tx);
    assert(matches.length === 1 && matches[0].id === challenge.userId, 401, "Invalid or expired verification");
    const account2 = matches[0];
    assert(account2.email === challenge.email, 401, "Invalid or expired verification");
    await tx.update(users).set({ data: { ...account2.data, mobileVerified: true } }).where(eq24(users.id, account2.id));
    return insertSession(tx, account2.id);
  });
}

// artifacts/api-server/src/routes/workspace-features.ts
init_db();
import { Router } from "express";
import { and as and3, eq as eq25, inArray as inArray2, sql as sql27 } from "drizzle-orm";

// lib/api-zod/src/generated/api.ts
import * as zod from "zod";
var issueLiveTicketLinkBodyReceiptSecretRegExp = new RegExp("^[a-f0-9]{64}$");
var IssueLiveTicketLinkBody = zod.object({
  "appointmentId": zod.string().optional(),
  "receiptSecret": zod.string().regex(issueLiveTicketLinkBodyReceiptSecretRegExp).optional()
});
var IssueLiveTicketLinkResponse = zod.object({
  "url": zod.string(),
  "expiresAt": zod.string()
});
var readLiveTicketBodyCapabilityRegExp = new RegExp("^[a-f0-9]{64}$");
var ReadLiveTicketBody = zod.object({
  "capability": zod.string().regex(readLiveTicketBodyCapabilityRegExp)
});
var readLiveTicketResponseAppointmentOneNotesMax = 1e3;
var readLiveTicketResponseAppointmentTwoBookingDetailsRevisionMin = 0;
var ReadLiveTicketResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "clinicName": zod.string(),
  "doctorName": zod.string(),
  "branchName": zod.string(),
  "branchAddress": zod.string().nullish(),
  "date": zod.string(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "timezone": zod.string().nullish(),
  "status": zod.string(),
  "token": zod.string(),
  "presence": zod.string(),
  "updatedAt": zod.string(),
  "estimate": zod.object({
    "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
    "basis": zod.enum(["sessionStart", "remainingQueue"]),
    "asOf": zod.string(),
    "patientsAhead": zod.number().int().nullable(),
    "waitMinutes": zod.number().int().nullable(),
    "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
    "beyondSessionEnd": zod.boolean(),
    "guidance": zod.string()
  }),
  "appointment": zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(readLiveTicketResponseAppointmentOneNotesMax).optional()
  }).and(zod.object({
    "estimate": zod.object({
      "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
      "basis": zod.enum(["sessionStart", "remainingQueue"]),
      "asOf": zod.string(),
      "patientsAhead": zod.number().int().nullable(),
      "waitMinutes": zod.number().int().nullable(),
      "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
      "beyondSessionEnd": zod.boolean(),
      "guidance": zod.string()
    }).optional(),
    "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
    "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "privatePatient": zod.union([zod.object({
      "fullName": zod.string().nullish(),
      "code": zod.string().nullish(),
      "gender": zod.string().nullish(),
      "dateOfBirth": zod.string().nullish(),
      "age": zod.number().int().nullish(),
      "ageReferenceDate": zod.string().nullish(),
      "mobile": zod.string().nullish(),
      "email": zod.string().nullish(),
      "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
    }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
    "canReschedule": zod.boolean().optional(),
    "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
    "bookingDetailsRevision": zod.number().int().min(readLiveTicketResponseAppointmentTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
    "movementReason": zod.string().nullish(),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
      "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
      "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional(),
    "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
  })).optional()
});
var RevokeLiveTicketLinksParams = zod.object({
  "id": zod.coerce.string()
});
var RevokeLiveTicketLinksResponse = zod.void();
var GetStaffVerificationResponse = zod.object({
  "email": zod.string(),
  "mobile": zod.string().nullable(),
  "emailVerified": zod.boolean(),
  "mobileVerified": zod.boolean(),
  "promptRequired": zod.boolean(),
  "welcomeEmailStatus": zod.string().optional(),
  "welcomeSmsStatus": zod.string().optional()
});
var RequestStaffContactCodeBody = zod.object({
  "channel": zod.enum(["email", "sms"])
});
var RequestStaffContactCodeResponse = zod.object({
  "challengeId": zod.string(),
  "expiresAt": zod.coerce.date(),
  "resendAfterSeconds": zod.number().int()
});
var confirmStaffContactCodeBodyChallengeIdMax = 100;
var confirmStaffContactCodeBodyCodeRegExp = new RegExp("^\\d{6}$");
var ConfirmStaffContactCodeBody = zod.object({
  "channel": zod.enum(["email", "sms"]),
  "challengeId": zod.string().max(confirmStaffContactCodeBodyChallengeIdMax),
  "code": zod.string().regex(confirmStaffContactCodeBodyCodeRegExp)
});
var ConfirmStaffContactCodeResponse = zod.object({
  "verified": zod.boolean()
});
var DeferStaffVerificationResponse = zod.object({
  "ok": zod.boolean()
});
var GetPublicWebsiteConfigResponse = zod.object({
  "publicOrigin": zod.string().url()
});
var GetMyNotificationSettingsResponse = zod.object({
  "revision": zod.number().int(),
  "items": zod.array(zod.object({
    "key": zod.string(),
    "event": zod.string(),
    "channel": zod.enum(["email", "sms", "inApp"]),
    "saved": zod.boolean().nullable(),
    "inherited": zod.boolean(),
    "selected": zod.boolean(),
    "state": zod.enum(["Off", "On", "On but blocked", "Required", "Unavailable"]),
    "reasons": zod.array(zod.string())
  })),
  "clinics": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  })),
  "canManage": zod.boolean(),
  "activeClinicId": zod.string().nullable()
});
var saveMyNotificationSettingsBodyRevisionMin = 0;
var saveMyNotificationSettingsBodyChoicesItemKeyMax = 100;
var saveMyNotificationSettingsBodyChoicesMax = 100;
var SaveMyNotificationSettingsBody = zod.object({
  "revision": zod.number().int().min(saveMyNotificationSettingsBodyRevisionMin),
  "choices": zod.array(zod.object({
    "key": zod.string().max(saveMyNotificationSettingsBodyChoicesItemKeyMax),
    "enabled": zod.boolean().nullable()
  })).max(saveMyNotificationSettingsBodyChoicesMax)
});
var SaveMyNotificationSettingsResponse = zod.object({
  "revision": zod.number().int(),
  "items": zod.array(zod.object({
    "key": zod.string(),
    "event": zod.string(),
    "channel": zod.enum(["email", "sms", "inApp"]),
    "saved": zod.boolean().nullable(),
    "inherited": zod.boolean(),
    "selected": zod.boolean(),
    "state": zod.enum(["Off", "On", "On but blocked", "Required", "Unavailable"]),
    "reasons": zod.array(zod.string())
  })),
  "clinics": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  })),
  "canManage": zod.boolean(),
  "activeClinicId": zod.string().nullable()
});
var GetManagedNotificationSettingsQueryParams = zod.object({
  "clinicId": zod.coerce.string().optional()
});
var GetManagedNotificationSettingsResponse = zod.object({
  "revision": zod.number().int(),
  "scopeName": zod.string(),
  "notificationsEnabled": zod.boolean(),
  "inherited": zod.boolean(),
  "canActivate": zod.boolean(),
  "events": zod.array(zod.object({
    "id": zod.string(),
    "label": zod.string(),
    "order": zod.number().int(),
    "clinicApplicable": zod.boolean(),
    "explanation": zod.string()
  })),
  "items": zod.array(zod.object({
    "canActivate": zod.boolean().optional(),
    "canEdit": zod.boolean().optional(),
    "channel": zod.enum(["email", "sms"]),
    "event": zod.string(),
    "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"]),
    "revision": zod.number().int(),
    "enabled": zod.boolean(),
    "source": zod.string(),
    "ready": zod.boolean(),
    "required": zod.boolean().optional().describe("Security event policy; independent from optional communication gates. Does not certify provider or DLT approval."),
    "blockedReasons": zod.array(zod.string()),
    "timing": zod.string()
  }))
});
var saveManagedNotificationSettingsBodyClinicIdMax = 100;
var saveManagedNotificationSettingsBodyRevisionMin = 0;
var saveManagedNotificationSettingsBodyChangesItemRevisionMin = 0;
var saveManagedNotificationSettingsBodyChangesMax = 200;
var SaveManagedNotificationSettingsBody = zod.object({
  "clinicId": zod.string().min(1).max(saveManagedNotificationSettingsBodyClinicIdMax).optional(),
  "revision": zod.number().int().min(saveManagedNotificationSettingsBodyRevisionMin),
  "notificationsEnabled": zod.boolean().optional(),
  "confirmed": zod.boolean().optional(),
  "changes": zod.array(zod.object({
    "channel": zod.enum(["email", "sms"]),
    "event": zod.string(),
    "recipient": zod.string(),
    "revision": zod.number().int().min(saveManagedNotificationSettingsBodyChangesItemRevisionMin),
    "enabled": zod.boolean()
  })).max(saveManagedNotificationSettingsBodyChangesMax)
});
var SaveManagedNotificationSettingsResponse = zod.object({
  "revision": zod.number().int(),
  "scopeName": zod.string(),
  "notificationsEnabled": zod.boolean(),
  "inherited": zod.boolean(),
  "canActivate": zod.boolean(),
  "events": zod.array(zod.object({
    "id": zod.string(),
    "label": zod.string(),
    "order": zod.number().int(),
    "clinicApplicable": zod.boolean(),
    "explanation": zod.string()
  })),
  "items": zod.array(zod.object({
    "canActivate": zod.boolean().optional(),
    "canEdit": zod.boolean().optional(),
    "channel": zod.enum(["email", "sms"]),
    "event": zod.string(),
    "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"]),
    "revision": zod.number().int(),
    "enabled": zod.boolean(),
    "source": zod.string(),
    "ready": zod.boolean(),
    "required": zod.boolean().optional().describe("Security event policy; independent from optional communication gates. Does not certify provider or DLT approval."),
    "blockedReasons": zod.array(zod.string()),
    "timing": zod.string()
  }))
});
var searchGeographyQuerySearchMax = 100;
var searchGeographyQueryCountryMax = 100;
var searchGeographyQueryStateMax = 100;
var searchGeographyQueryCityMax = 100;
var SearchGeographyQueryParams = zod.object({
  "kind": zod.enum(["country", "state", "city"]),
  "search": zod.coerce.string().max(searchGeographyQuerySearchMax).optional(),
  "country": zod.coerce.string().max(searchGeographyQueryCountryMax).optional().describe("ISO-2 code or English country name scoping states and cities"),
  "state": zod.coerce.string().max(searchGeographyQueryStateMax).optional().describe("State/UT name scoping cities"),
  "city": zod.coerce.string().max(searchGeographyQueryCityMax).optional().describe("When given with kind=city, the response includes a compatible flag")
});
var SearchGeographyResponse = zod.object({
  "items": zod.array(zod.string()),
  "compatible": zod.boolean().optional().describe("Whether the given city belongs to the given state; true when the directory cannot judge")
});
var searchPublicGeographyQuerySearchMax = 100;
var searchPublicGeographyQueryCountryMax = 100;
var searchPublicGeographyQueryStateMax = 100;
var searchPublicGeographyQueryCityMax = 100;
var SearchPublicGeographyQueryParams = zod.object({
  "kind": zod.enum(["country", "state", "city"]),
  "search": zod.coerce.string().max(searchPublicGeographyQuerySearchMax).optional(),
  "country": zod.coerce.string().max(searchPublicGeographyQueryCountryMax).optional(),
  "state": zod.coerce.string().max(searchPublicGeographyQueryStateMax).optional(),
  "city": zod.coerce.string().max(searchPublicGeographyQueryCityMax).optional()
});
var SearchPublicGeographyResponse = zod.object({
  "items": zod.array(zod.string()),
  "compatible": zod.boolean().optional().describe("Whether the given city belongs to the given state; true when the directory cannot judge")
});
var lookupPublicPincodePathPinRegExp = new RegExp("^[1-9][0-9]{5}$");
var LookupPublicPincodeParams = zod.object({
  "pin": zod.coerce.string().regex(lookupPublicPincodePathPinRegExp)
});
var LookupPublicPincodeResponse = zod.object({
  "pincode": zod.string(),
  "available": zod.boolean().describe("False when the offline dataset is unavailable; manual entry continues."),
  "attribution": zod.string(),
  "items": zod.array(zod.object({
    "locality": zod.string(),
    "district": zod.string(),
    "state": zod.string()
  }))
});
var CheckIntegrationConnectionParams = zod.object({
  "provider": zod.enum(["smtp", "sms", "storage"])
});
var CheckIntegrationConnectionResponse = zod.object({
  "provider": zod.string(),
  "source": zod.string(),
  "checkedAt": zod.string(),
  "checks": zod.array(zod.object({
    "name": zod.string(),
    "status": zod.enum(["passed", "failed", "not_verified"]),
    "message": zod.string()
  }))
});
var GetStorageConfigurationResponse = zod.object({
  "provider": zod.string(),
  "source": zod.string(),
  "publicPath": zod.string(),
  "configured": zod.boolean()
});
var GetSystemUsersQueryParams = zod.object({
  "page": zod.coerce.number().int().optional(),
  "search": zod.coerce.string().optional(),
  "role": zod.coerce.string().optional(),
  "status": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional()
});
var GetSystemUsersResponse = zod.object({
  "data": zod.array(zod.object({
    "id": zod.string(),
    "fullName": zod.string(),
    "email": zod.string(),
    "role": zod.string(),
    "status": zod.string(),
    "clinics": zod.array(zod.object({
      "id": zod.string(),
      "name": zod.string()
    }))
  })),
  "total": zod.number().int(),
  "page": zod.number().int(),
  "pageSize": zod.number().int()
});
var GetStaffDeletionImpactParams = zod.object({
  "id": zod.coerce.string()
});
var getStaffDeletionImpactResponseGroupsItemCountMin = 0;
var GetStaffDeletionImpactResponse = zod.object({
  "target": zod.object({
    "id": zod.string(),
    "fullName": zod.string(),
    "email": zod.string(),
    "role": zod.string(),
    "status": zod.string()
  }),
  "version": zod.string(),
  "groups": zod.array(zod.object({
    "source": zod.string(),
    "action": zod.string(),
    "ids": zod.array(zod.string()),
    "count": zod.number().int().min(getStaffDeletionImpactResponseGroupsItemCountMin)
  })),
  "blockers": zod.array(zod.object({
    "code": zod.string(),
    "message": zod.string(),
    "source": zod.string().optional(),
    "ids": zod.array(zod.string()).optional()
  })),
  "warnings": zod.array(zod.string()),
  "ready": zod.boolean(),
  "reviewToken": zod.string().nullable(),
  "operationId": zod.string().nullable()
});
var GetStaffHistoryReviewParams = zod.object({
  "id": zod.coerce.string()
});
var GetStaffHistoryReviewResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "version": zod.string(),
    "channel": zod.string(),
    "event": zod.string(),
    "envelopeCount": zod.number().int(),
    "status": zod.enum(["blocked", "unresolved"]),
    "unresolvedReason": zod.string().nullable(),
    "reviewedAt": zod.number().int().nullable().describe("Unix time in milliseconds")
  })),
  "nextCursor": zod.string().nullable(),
  "scannedCount": zod.number().int()
});
var ScanStaffHistoryReviewParams = zod.object({
  "id": zod.coerce.string()
});
var ScanStaffHistoryReviewBody = zod.object({
  "cursor": zod.string()
});
var ScanStaffHistoryReviewResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "version": zod.string(),
    "channel": zod.string(),
    "event": zod.string(),
    "envelopeCount": zod.number().int(),
    "status": zod.enum(["blocked", "unresolved"]),
    "unresolvedReason": zod.string().nullable(),
    "reviewedAt": zod.number().int().nullable().describe("Unix time in milliseconds")
  })),
  "nextCursor": zod.string().nullable(),
  "scannedCount": zod.number().int()
});
var PreviewStaffHistoryEvidenceParams = zod.object({
  "id": zod.coerce.string()
});
var previewStaffHistoryEvidenceBodyEvidenceMax = 1e5;
var PreviewStaffHistoryEvidenceBody = zod.object({
  "historyId": zod.string(),
  "version": zod.string(),
  "evidence": zod.string().max(previewStaffHistoryEvidenceBodyEvidenceMax).describe("Original signed archive JSON: {id,data}, or an array of such records. Never a freshly signed copy of current metadata.")
});
var PreviewStaffHistoryEvidenceResponse = zod.object({
  "status": zod.enum(["eligible", "unresolved"]),
  "historyId": zod.string(),
  "version": zod.string(),
  "reason": zod.string(),
  "ownership": zod.enum(["includes_target", "excludes_target", "unknown"]),
  "envelopeCount": zod.number().int(),
  "sourceCount": zod.number().int(),
  "subjectCount": zod.number().int(),
  "reviewToken": zod.string().nullable()
});
var RestoreStaffHistoryEvidenceParams = zod.object({
  "id": zod.coerce.string()
});
var restoreStaffHistoryEvidenceBodyEvidenceMax = 1e5;
var RestoreStaffHistoryEvidenceBody = zod.object({
  "historyId": zod.string(),
  "version": zod.string(),
  "evidence": zod.string().max(restoreStaffHistoryEvidenceBodyEvidenceMax),
  "reviewToken": zod.string(),
  "confirmation": zod.enum(["restore"])
});
var RestoreStaffHistoryEvidenceResponse = zod.object({
  "status": zod.enum(["verified", "unresolved"]),
  "historyId": zod.string(),
  "message": zod.string()
});
var MarkStaffHistoryUnresolvedParams = zod.object({
  "id": zod.coerce.string()
});
var MarkStaffHistoryUnresolvedBody = zod.object({
  "historyId": zod.string(),
  "version": zod.string(),
  "reason": zod.enum(["original_missing", "incomplete_evidence", "conflicting_sources", "unreadable_archive"])
});
var MarkStaffHistoryUnresolvedResponse = zod.object({
  "status": zod.enum(["verified", "unresolved"]),
  "historyId": zod.string(),
  "message": zod.string()
});
var PermanentlyRemoveStaffParams = zod.object({
  "id": zod.coerce.string()
});
var permanentlyRemoveStaffBodyVersionRegExp = new RegExp("^[a-f0-9]{64}$");
var permanentlyRemoveStaffBodyReviewTokenMax = 4096;
var PermanentlyRemoveStaffBody = zod.object({
  "version": zod.string().regex(permanentlyRemoveStaffBodyVersionRegExp),
  "reviewToken": zod.string().max(permanentlyRemoveStaffBodyReviewTokenMax),
  "confirmation": zod.enum(["delete"])
});
var permanentlyRemoveStaffResponseFilesMin = 0;
var permanentlyRemoveStaffResponseVerifiedFilesMin = 0;
var PermanentlyRemoveStaffResponse = zod.object({
  "operationId": zod.string(),
  "accountRemoved": zod.literal(true),
  "state": zod.enum(["complete", "cleanup_pending"]),
  "files": zod.number().int().min(permanentlyRemoveStaffResponseFilesMin),
  "verifiedFiles": zod.number().int().min(permanentlyRemoveStaffResponseVerifiedFilesMin),
  "pendingReasons": zod.array(zod.string())
});
var GetStaffRemovalReceiptParams = zod.object({
  "operationId": zod.coerce.string().uuid()
});
var getStaffRemovalReceiptResponseFilesMin = 0;
var getStaffRemovalReceiptResponseVerifiedFilesMin = 0;
var GetStaffRemovalReceiptResponse = zod.object({
  "operationId": zod.string(),
  "accountRemoved": zod.literal(true),
  "state": zod.enum(["complete", "cleanup_pending"]),
  "files": zod.number().int().min(getStaffRemovalReceiptResponseFilesMin),
  "verifiedFiles": zod.number().int().min(getStaffRemovalReceiptResponseVerifiedFilesMin),
  "pendingReasons": zod.array(zod.string())
});
var RetryStaffRemovalCleanupParams = zod.object({
  "operationId": zod.coerce.string().uuid()
});
var retryStaffRemovalCleanupResponseFilesMin = 0;
var retryStaffRemovalCleanupResponseVerifiedFilesMin = 0;
var RetryStaffRemovalCleanupResponse = zod.object({
  "operationId": zod.string(),
  "accountRemoved": zod.literal(true),
  "state": zod.enum(["complete", "cleanup_pending"]),
  "files": zod.number().int().min(retryStaffRemovalCleanupResponseFilesMin),
  "verifiedFiles": zod.number().int().min(retryStaffRemovalCleanupResponseVerifiedFilesMin),
  "pendingReasons": zod.array(zod.string())
});
var GetStaffHandoffOptionsParams = zod.object({
  "id": zod.coerce.string()
});
var GetStaffHandoffOptionsResponse = zod.object({
  "doctors": zod.array(zod.record(zod.string(), zod.unknown())),
  "admins": zod.array(zod.record(zod.string(), zod.unknown())),
  "visits": zod.array(zod.record(zod.string(), zod.unknown()))
});
var ReviewStaffHandoffParams = zod.object({
  "id": zod.coerce.string()
});
var reviewStaffHandoffBodyOneMovesItemDateRegExp = new RegExp("^\\d{4}-\\d{2}-\\d{2}$");
var reviewStaffHandoffBodyOneMovesItemExpectedRevisionMin = 0;
var reviewStaffHandoffBodyOneMovesItemStartTimeRegExp = new RegExp("^\\d{2}:\\d{2}$");
var reviewStaffHandoffBodyOneMovesItemReasonMax = 500;
var reviewStaffHandoffBodyOneMovesMax = 50;
var ReviewStaffHandoffBody = zod.union([zod.object({
  "kind": zod.enum(["visits"]),
  "moves": zod.array(zod.object({
    "appointmentId": zod.string(),
    "doctorId": zod.string(),
    "branchId": zod.string(),
    "date": zod.string().regex(reviewStaffHandoffBodyOneMovesItemDateRegExp),
    "expectedRevision": zod.number().int().min(reviewStaffHandoffBodyOneMovesItemExpectedRevisionMin),
    "sessionId": zod.string().optional(),
    "startTime": zod.string().regex(reviewStaffHandoffBodyOneMovesItemStartTimeRegExp).optional(),
    "reason": zod.string().max(reviewStaffHandoffBodyOneMovesItemReasonMax).optional()
  })).min(1).max(reviewStaffHandoffBodyOneMovesMax)
}), zod.object({
  "kind": zod.enum(["clinic-responsibilities"]),
  "replacementId": zod.string()
})]);
var ReviewStaffHandoffResponse = zod.object({
  "kind": zod.enum(["visits", "clinic-responsibilities"]),
  "operationId": zod.string(),
  "version": zod.string().optional(),
  "proposal": zod.record(zod.string(), zod.unknown()),
  "reviewToken": zod.string(),
  "visits": zod.array(zod.record(zod.string(), zod.unknown())).optional()
});
var CommitStaffHandoffParams = zod.object({
  "id": zod.coerce.string()
});
var commitStaffHandoffBodyReviewTokenMax = 4096;
var CommitStaffHandoffBody = zod.object({
  "kind": zod.enum(["visits", "clinic-responsibilities"]),
  "proposal": zod.record(zod.string(), zod.unknown()),
  "reviewToken": zod.string().max(commitStaffHandoffBodyReviewTokenMax)
});
var CommitStaffHandoffResponse = zod.object({
  "operationId": zod.string(),
  "count": zod.number().int().optional(),
  "appointmentIds": zod.array(zod.string()).optional(),
  "clinicCount": zod.number().int().optional(),
  "staffCount": zod.number().int().optional(),
  "doctorCount": zod.number().int().optional(),
  "accountRemoved": zod.boolean().optional()
});
var GetCustomRolesResponse = zod.object({
  "revision": zod.number().int(),
  "roles": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string(),
    "baseRole": zod.enum(["clinicAdmin", "doctor", "receptionist"]),
    "denied": zod.array(zod.string())
  })),
  "bindings": zod.array(zod.object({
    "userId": zod.string(),
    "roleId": zod.string(),
    "clinicId": zod.string().optional()
  }))
});
var SaveCustomRolesBody = zod.object({
  "revision": zod.number().int(),
  "roles": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string(),
    "baseRole": zod.enum(["clinicAdmin", "doctor", "receptionist"]),
    "denied": zod.array(zod.string())
  })),
  "bindings": zod.array(zod.object({
    "userId": zod.string(),
    "roleId": zod.string(),
    "clinicId": zod.string().optional()
  }))
});
var SaveCustomRolesResponse = zod.object({
  "revision": zod.number().int(),
  "roles": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string(),
    "baseRole": zod.enum(["clinicAdmin", "doctor", "receptionist"]),
    "denied": zod.array(zod.string())
  })),
  "bindings": zod.array(zod.object({
    "userId": zod.string(),
    "roleId": zod.string(),
    "clinicId": zod.string().optional()
  }))
});
var GetPermissionPolicyResponse = zod.object({
  "revision": zod.number().int(),
  "denied": zod.array(zod.string())
}).and(zod.object({
  "modules": zod.array(zod.string()),
  "actions": zod.array(zod.string()),
  "roles": zod.array(zod.string())
}));
var SavePermissionPolicyBody = zod.object({
  "revision": zod.number().int(),
  "denied": zod.array(zod.string())
});
var SavePermissionPolicyResponse = zod.object({
  "revision": zod.number().int(),
  "denied": zod.array(zod.string())
}).and(zod.object({
  "modules": zod.array(zod.string()),
  "actions": zod.array(zod.string()),
  "roles": zod.array(zod.string())
}));
var RequestLogoUploadBody = zod.object({
  "name": zod.string(),
  "size": zod.number().int(),
  "contentType": zod.string(),
  "clinicId": zod.string().optional()
});
var RequestLogoUploadResponse = zod.object({
  "id": zod.string(),
  "uploadUrl": zod.string()
});
var UploadLocalLogoParams = zod.object({
  "id": zod.coerce.string()
});
var UploadLocalLogoResponse = zod.void();
var CompleteLogoUploadParams = zod.object({
  "id": zod.coerce.string()
});
var CompleteLogoUploadResponse = zod.object({
  "logoUrl": zod.string()
});
var GetNotificationTemplatesQueryParams = zod.object({
  "clinicId": zod.coerce.string().optional(),
  "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"]).optional(),
  "channel": zod.enum(["email", "sms"]).optional()
});
var getNotificationTemplatesResponseItemsItemContentSenderIdMax = 50;
var getNotificationTemplatesResponseItemsItemContentDltEntityIdMax = 50;
var getNotificationTemplatesResponseItemsItemContentDltTemplateIdMax = 50;
var getNotificationTemplatesResponseItemsItemContentSubjectMax = 180;
var getNotificationTemplatesResponseItemsItemContentBodyMax = 8e3;
var getNotificationTemplatesResponseItemsItemContentPrefixMax = 60;
var getNotificationTemplatesResponseItemsItemContentFooterMax = 500;
var getNotificationTemplatesResponseItemsItemContentLogoUrlMax = 1e3;
var getNotificationTemplatesResponseItemsItemDraftSenderIdMax = 50;
var getNotificationTemplatesResponseItemsItemDraftDltEntityIdMax = 50;
var getNotificationTemplatesResponseItemsItemDraftDltTemplateIdMax = 50;
var getNotificationTemplatesResponseItemsItemDraftSubjectMax = 180;
var getNotificationTemplatesResponseItemsItemDraftBodyMax = 8e3;
var getNotificationTemplatesResponseItemsItemDraftPrefixMax = 60;
var getNotificationTemplatesResponseItemsItemDraftFooterMax = 500;
var getNotificationTemplatesResponseItemsItemDraftLogoUrlMax = 1e3;
var GetNotificationTemplatesResponse = zod.object({
  "scopeName": zod.string(),
  "variables": zod.array(zod.string()),
  "items": zod.array(zod.object({
    "event": zod.string(),
    "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"]).optional(),
    "title": zod.string(),
    "revision": zod.number().int(),
    "source": zod.string(),
    "content": zod.object({
      "enabled": zod.boolean().optional(),
      "senderId": zod.string().max(getNotificationTemplatesResponseItemsItemContentSenderIdMax).optional(),
      "dltEntityId": zod.string().max(getNotificationTemplatesResponseItemsItemContentDltEntityIdMax).optional(),
      "dltTemplateId": zod.string().max(getNotificationTemplatesResponseItemsItemContentDltTemplateIdMax).optional(),
      "subject": zod.string().min(1).max(getNotificationTemplatesResponseItemsItemContentSubjectMax),
      "body": zod.string().min(1).max(getNotificationTemplatesResponseItemsItemContentBodyMax),
      "prefix": zod.string().max(getNotificationTemplatesResponseItemsItemContentPrefixMax),
      "footer": zod.string().max(getNotificationTemplatesResponseItemsItemContentFooterMax),
      "logoUrl": zod.string().max(getNotificationTemplatesResponseItemsItemContentLogoUrlMax)
    }).describe("SMS uses body and sender/DLT metadata; email branding fields retain their existing semantics."),
    "draft": zod.object({
      "enabled": zod.boolean().optional(),
      "senderId": zod.string().max(getNotificationTemplatesResponseItemsItemDraftSenderIdMax).optional(),
      "dltEntityId": zod.string().max(getNotificationTemplatesResponseItemsItemDraftDltEntityIdMax).optional(),
      "dltTemplateId": zod.string().max(getNotificationTemplatesResponseItemsItemDraftDltTemplateIdMax).optional(),
      "subject": zod.string().min(1).max(getNotificationTemplatesResponseItemsItemDraftSubjectMax),
      "body": zod.string().min(1).max(getNotificationTemplatesResponseItemsItemDraftBodyMax),
      "prefix": zod.string().max(getNotificationTemplatesResponseItemsItemDraftPrefixMax),
      "footer": zod.string().max(getNotificationTemplatesResponseItemsItemDraftFooterMax),
      "logoUrl": zod.string().max(getNotificationTemplatesResponseItemsItemDraftLogoUrlMax)
    }).optional().describe("SMS uses body and sender/DLT metadata; email branding fields retain their existing semantics."),
    "previewSubject": zod.string(),
    "previewBody": zod.string(),
    "previewHtml": zod.string().optional().describe("Email-only HTML rendered with fictional sample values, for a sandboxed preview."),
    "delivery": zod.string(),
    "required": zod.boolean().optional()
  }))
});
var saveNotificationTemplateBodyRevisionMin = 0;
var saveNotificationTemplateBodyContentSenderIdMax = 50;
var saveNotificationTemplateBodyContentDltEntityIdMax = 50;
var saveNotificationTemplateBodyContentDltTemplateIdMax = 50;
var saveNotificationTemplateBodyContentSubjectMax = 180;
var saveNotificationTemplateBodyContentBodyMax = 8e3;
var saveNotificationTemplateBodyContentPrefixMax = 60;
var saveNotificationTemplateBodyContentFooterMax = 500;
var saveNotificationTemplateBodyContentLogoUrlMax = 1e3;
var SaveNotificationTemplateBody = zod.object({
  "channel": zod.enum(["email", "sms"]).optional(),
  "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"]).optional(),
  "clinicId": zod.string().optional(),
  "event": zod.enum(["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "booking_status_link", "patient_login_otp", "clinic_registration_otp", "patient_email_otp", "registration_mobile_otp", "doctor_setup", "staff_setup", "password_setup_complete", "staff_email_otp", "staff_mobile_otp", "staff_created_admin", "staff_welcome"]),
  "revision": zod.number().int().min(saveNotificationTemplateBodyRevisionMin),
  "mode": zod.enum(["draft", "publish", "reset"]),
  "content": zod.object({
    "enabled": zod.boolean().optional(),
    "senderId": zod.string().max(saveNotificationTemplateBodyContentSenderIdMax).optional(),
    "dltEntityId": zod.string().max(saveNotificationTemplateBodyContentDltEntityIdMax).optional(),
    "dltTemplateId": zod.string().max(saveNotificationTemplateBodyContentDltTemplateIdMax).optional(),
    "subject": zod.string().min(1).max(saveNotificationTemplateBodyContentSubjectMax),
    "body": zod.string().min(1).max(saveNotificationTemplateBodyContentBodyMax),
    "prefix": zod.string().max(saveNotificationTemplateBodyContentPrefixMax),
    "footer": zod.string().max(saveNotificationTemplateBodyContentFooterMax),
    "logoUrl": zod.string().max(saveNotificationTemplateBodyContentLogoUrlMax)
  }).optional().describe("SMS uses body and sender/DLT metadata; email branding fields retain their existing semantics.")
});
var saveNotificationTemplateResponseItemsItemContentSenderIdMax = 50;
var saveNotificationTemplateResponseItemsItemContentDltEntityIdMax = 50;
var saveNotificationTemplateResponseItemsItemContentDltTemplateIdMax = 50;
var saveNotificationTemplateResponseItemsItemContentSubjectMax = 180;
var saveNotificationTemplateResponseItemsItemContentBodyMax = 8e3;
var saveNotificationTemplateResponseItemsItemContentPrefixMax = 60;
var saveNotificationTemplateResponseItemsItemContentFooterMax = 500;
var saveNotificationTemplateResponseItemsItemContentLogoUrlMax = 1e3;
var saveNotificationTemplateResponseItemsItemDraftSenderIdMax = 50;
var saveNotificationTemplateResponseItemsItemDraftDltEntityIdMax = 50;
var saveNotificationTemplateResponseItemsItemDraftDltTemplateIdMax = 50;
var saveNotificationTemplateResponseItemsItemDraftSubjectMax = 180;
var saveNotificationTemplateResponseItemsItemDraftBodyMax = 8e3;
var saveNotificationTemplateResponseItemsItemDraftPrefixMax = 60;
var saveNotificationTemplateResponseItemsItemDraftFooterMax = 500;
var saveNotificationTemplateResponseItemsItemDraftLogoUrlMax = 1e3;
var SaveNotificationTemplateResponse = zod.object({
  "scopeName": zod.string(),
  "variables": zod.array(zod.string()),
  "items": zod.array(zod.object({
    "event": zod.string(),
    "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"]).optional(),
    "title": zod.string(),
    "revision": zod.number().int(),
    "source": zod.string(),
    "content": zod.object({
      "enabled": zod.boolean().optional(),
      "senderId": zod.string().max(saveNotificationTemplateResponseItemsItemContentSenderIdMax).optional(),
      "dltEntityId": zod.string().max(saveNotificationTemplateResponseItemsItemContentDltEntityIdMax).optional(),
      "dltTemplateId": zod.string().max(saveNotificationTemplateResponseItemsItemContentDltTemplateIdMax).optional(),
      "subject": zod.string().min(1).max(saveNotificationTemplateResponseItemsItemContentSubjectMax),
      "body": zod.string().min(1).max(saveNotificationTemplateResponseItemsItemContentBodyMax),
      "prefix": zod.string().max(saveNotificationTemplateResponseItemsItemContentPrefixMax),
      "footer": zod.string().max(saveNotificationTemplateResponseItemsItemContentFooterMax),
      "logoUrl": zod.string().max(saveNotificationTemplateResponseItemsItemContentLogoUrlMax)
    }).describe("SMS uses body and sender/DLT metadata; email branding fields retain their existing semantics."),
    "draft": zod.object({
      "enabled": zod.boolean().optional(),
      "senderId": zod.string().max(saveNotificationTemplateResponseItemsItemDraftSenderIdMax).optional(),
      "dltEntityId": zod.string().max(saveNotificationTemplateResponseItemsItemDraftDltEntityIdMax).optional(),
      "dltTemplateId": zod.string().max(saveNotificationTemplateResponseItemsItemDraftDltTemplateIdMax).optional(),
      "subject": zod.string().min(1).max(saveNotificationTemplateResponseItemsItemDraftSubjectMax),
      "body": zod.string().min(1).max(saveNotificationTemplateResponseItemsItemDraftBodyMax),
      "prefix": zod.string().max(saveNotificationTemplateResponseItemsItemDraftPrefixMax),
      "footer": zod.string().max(saveNotificationTemplateResponseItemsItemDraftFooterMax),
      "logoUrl": zod.string().max(saveNotificationTemplateResponseItemsItemDraftLogoUrlMax)
    }).optional().describe("SMS uses body and sender/DLT metadata; email branding fields retain their existing semantics."),
    "previewSubject": zod.string(),
    "previewBody": zod.string(),
    "previewHtml": zod.string().optional().describe("Email-only HTML rendered with fictional sample values, for a sandboxed preview."),
    "delivery": zod.string(),
    "required": zod.boolean().optional()
  }))
});
var previewEventTemplateBodyRevisionMin = 0;
var previewEventTemplateBodyContentSenderIdMax = 50;
var previewEventTemplateBodyContentDltEntityIdMax = 50;
var previewEventTemplateBodyContentDltTemplateIdMax = 50;
var previewEventTemplateBodyContentSubjectMax = 180;
var previewEventTemplateBodyContentBodyMax = 8e3;
var previewEventTemplateBodyContentPrefixMax = 60;
var previewEventTemplateBodyContentFooterMax = 500;
var previewEventTemplateBodyContentLogoUrlMax = 1e3;
var previewEventTemplateBodyValuesMaxOne = 1500;
var previewEventTemplateBodyRecipientMax = 254;
var PreviewEventTemplateBody = zod.object({
  "channel": zod.enum(["email", "sms"]),
  "event": zod.enum(["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "booking_status_link", "patient_login_otp", "clinic_registration_otp", "patient_email_otp", "registration_mobile_otp", "doctor_setup", "staff_setup", "password_setup_complete", "staff_email_otp", "staff_mobile_otp", "staff_created_admin", "staff_welcome"]),
  "recipientGroup": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"]),
  "clinicId": zod.string().optional(),
  "revision": zod.number().int().min(previewEventTemplateBodyRevisionMin),
  "content": zod.object({
    "enabled": zod.boolean().optional(),
    "senderId": zod.string().max(previewEventTemplateBodyContentSenderIdMax).optional(),
    "dltEntityId": zod.string().max(previewEventTemplateBodyContentDltEntityIdMax).optional(),
    "dltTemplateId": zod.string().max(previewEventTemplateBodyContentDltTemplateIdMax).optional(),
    "subject": zod.string().min(1).max(previewEventTemplateBodyContentSubjectMax),
    "body": zod.string().min(1).max(previewEventTemplateBodyContentBodyMax),
    "prefix": zod.string().max(previewEventTemplateBodyContentPrefixMax),
    "footer": zod.string().max(previewEventTemplateBodyContentFooterMax),
    "logoUrl": zod.string().max(previewEventTemplateBodyContentLogoUrlMax)
  }).describe("SMS uses body and sender/DLT metadata; email branding fields retain their existing semantics."),
  "values": zod.record(zod.string(), zod.string().max(previewEventTemplateBodyValuesMaxOne)),
  "recipient": zod.string().max(previewEventTemplateBodyRecipientMax).optional(),
  "confirmed": zod.boolean().optional(),
  "requestId": zod.string().uuid().optional()
});
var PreviewEventTemplateResponse = zod.object({
  "status": zod.enum(["preview", "provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown"]),
  "message": zod.string(),
  "subject": zod.string(),
  "body": zod.string(),
  "html": zod.string().optional().describe("Email-only sending HTML with internal logo CIDs resolved for the isolated preview. Not included for SMS or real test-send results.")
});
var testEventTemplateBodyRevisionMin = 0;
var testEventTemplateBodyContentSenderIdMax = 50;
var testEventTemplateBodyContentDltEntityIdMax = 50;
var testEventTemplateBodyContentDltTemplateIdMax = 50;
var testEventTemplateBodyContentSubjectMax = 180;
var testEventTemplateBodyContentBodyMax = 8e3;
var testEventTemplateBodyContentPrefixMax = 60;
var testEventTemplateBodyContentFooterMax = 500;
var testEventTemplateBodyContentLogoUrlMax = 1e3;
var testEventTemplateBodyValuesMaxOne = 1500;
var testEventTemplateBodyRecipientMax = 254;
var TestEventTemplateBody = zod.object({
  "channel": zod.enum(["email", "sms"]),
  "event": zod.enum(["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "booking_status_link", "patient_login_otp", "clinic_registration_otp", "patient_email_otp", "registration_mobile_otp", "doctor_setup", "staff_setup", "password_setup_complete", "staff_email_otp", "staff_mobile_otp", "staff_created_admin", "staff_welcome"]),
  "recipientGroup": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"]),
  "clinicId": zod.string().optional(),
  "revision": zod.number().int().min(testEventTemplateBodyRevisionMin),
  "content": zod.object({
    "enabled": zod.boolean().optional(),
    "senderId": zod.string().max(testEventTemplateBodyContentSenderIdMax).optional(),
    "dltEntityId": zod.string().max(testEventTemplateBodyContentDltEntityIdMax).optional(),
    "dltTemplateId": zod.string().max(testEventTemplateBodyContentDltTemplateIdMax).optional(),
    "subject": zod.string().min(1).max(testEventTemplateBodyContentSubjectMax),
    "body": zod.string().min(1).max(testEventTemplateBodyContentBodyMax),
    "prefix": zod.string().max(testEventTemplateBodyContentPrefixMax),
    "footer": zod.string().max(testEventTemplateBodyContentFooterMax),
    "logoUrl": zod.string().max(testEventTemplateBodyContentLogoUrlMax)
  }).describe("SMS uses body and sender/DLT metadata; email branding fields retain their existing semantics."),
  "values": zod.record(zod.string(), zod.string().max(testEventTemplateBodyValuesMaxOne)),
  "recipient": zod.string().max(testEventTemplateBodyRecipientMax).optional(),
  "confirmed": zod.boolean().optional(),
  "requestId": zod.string().uuid().optional()
});
var TestEventTemplateResponse = zod.object({
  "status": zod.enum(["preview", "provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown"]),
  "message": zod.string(),
  "subject": zod.string(),
  "body": zod.string(),
  "html": zod.string().optional().describe("Email-only sending HTML with internal logo CIDs resolved for the isolated preview. Not included for SMS or real test-send results.")
});
var GetEventControlsQueryParams = zod.object({
  "clinicId": zod.coerce.string().optional()
});
var GetEventControlsResponse = zod.object({
  "scopeName": zod.string(),
  "notificationsEnabled": zod.boolean().optional(),
  "gateDescription": zod.string(),
  "items": zod.array(zod.object({
    "canActivate": zod.boolean().optional(),
    "canEdit": zod.boolean().optional(),
    "channel": zod.enum(["email", "sms"]),
    "event": zod.string(),
    "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"]),
    "revision": zod.number().int(),
    "enabled": zod.boolean(),
    "source": zod.string(),
    "ready": zod.boolean(),
    "required": zod.boolean().optional().describe("Security event policy; independent from optional communication gates. Does not certify provider or DLT approval."),
    "blockedReasons": zod.array(zod.string()),
    "timing": zod.string()
  }))
});
var updateEventControlBodyRevisionMin = 0;
var UpdateEventControlBody = zod.object({
  "channel": zod.enum(["email", "sms"]),
  "event": zod.enum(["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "booking_status_link", "patient_login_otp", "clinic_registration_otp", "patient_email_otp", "registration_mobile_otp", "doctor_setup", "staff_setup", "password_setup_complete", "staff_email_otp", "staff_mobile_otp", "staff_created_admin", "staff_welcome"]),
  "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"]),
  "clinicId": zod.string().optional(),
  "revision": zod.number().int().min(updateEventControlBodyRevisionMin),
  "enabled": zod.boolean(),
  "confirmed": zod.boolean()
});
var UpdateEventControlResponse = zod.object({
  "scopeName": zod.string(),
  "notificationsEnabled": zod.boolean().optional(),
  "gateDescription": zod.string(),
  "items": zod.array(zod.object({
    "canActivate": zod.boolean().optional(),
    "canEdit": zod.boolean().optional(),
    "channel": zod.enum(["email", "sms"]),
    "event": zod.string(),
    "recipient": zod.enum(["patient", "clinicAdmin", "doctor", "receptionist", "superAdmin"]),
    "revision": zod.number().int(),
    "enabled": zod.boolean(),
    "source": zod.string(),
    "ready": zod.boolean(),
    "required": zod.boolean().optional().describe("Security event policy; independent from optional communication gates. Does not certify provider or DLT approval."),
    "blockedReasons": zod.array(zod.string()),
    "timing": zod.string()
  }))
});
var updateIntegrationSettingsBodyCurrentPasswordMax = 1024;
var updateIntegrationSettingsBodyValuesMaxOne = 8192;
var UpdateIntegrationSettingsBody = zod.object({
  "provider": zod.enum(["smtp", "sms", "notificationSms"]),
  "mode": zod.enum(["database", "environment"]),
  "revision": zod.string().nullable(),
  "currentPassword": zod.string().min(1).max(updateIntegrationSettingsBodyCurrentPasswordMax),
  "values": zod.record(zod.string(), zod.string().max(updateIntegrationSettingsBodyValuesMaxOne))
});
var UpdateIntegrationSettingsResponse = zod.object({
  "editable": zod.boolean().optional(),
  "smtp": zod.object({
    "source": zod.enum(["environment", "database"]).optional(),
    "revision": zod.string().nullish(),
    "ready": zod.boolean(),
    "notificationsEnabled": zod.boolean().optional(),
    "apiUrl": zod.string().optional(),
    "statusApiUrl": zod.string().optional(),
    "smsProvider": zod.enum(["generic", "keepInTouch"]).optional(),
    "countryCodeFormat": zod.enum(["digits", "plus"]).optional(),
    "customApiUrl": zod.string().optional(),
    "keepInTouchApiUrl": zod.string().optional(),
    "smtpHost": zod.string().optional(),
    "smtpPort": zod.number().int().optional(),
    "fromEmail": zod.string().optional(),
    "fromName": zod.string().optional(),
    "useTls": zod.boolean().optional(),
    "useSsl": zod.boolean().optional(),
    "keys": zod.array(zod.object({
      "key": zod.string(),
      "status": zod.enum(["configured", "missing", "invalid", "default"])
    }))
  }),
  "sms": zod.object({
    "source": zod.enum(["environment", "database"]).optional(),
    "revision": zod.string().nullish(),
    "ready": zod.boolean(),
    "notificationsEnabled": zod.boolean().optional(),
    "apiUrl": zod.string().optional(),
    "statusApiUrl": zod.string().optional(),
    "smsProvider": zod.enum(["generic", "keepInTouch"]).optional(),
    "countryCodeFormat": zod.enum(["digits", "plus"]).optional(),
    "customApiUrl": zod.string().optional(),
    "keepInTouchApiUrl": zod.string().optional(),
    "smtpHost": zod.string().optional(),
    "smtpPort": zod.number().int().optional(),
    "fromEmail": zod.string().optional(),
    "fromName": zod.string().optional(),
    "useTls": zod.boolean().optional(),
    "useSsl": zod.boolean().optional(),
    "keys": zod.array(zod.object({
      "key": zod.string(),
      "status": zod.enum(["configured", "missing", "invalid", "default"])
    }))
  }),
  "notificationSms": zod.object({
    "source": zod.enum(["environment", "database"]).optional(),
    "revision": zod.string().nullish(),
    "ready": zod.boolean(),
    "notificationsEnabled": zod.boolean().optional(),
    "apiUrl": zod.string().optional(),
    "statusApiUrl": zod.string().optional(),
    "smsProvider": zod.enum(["generic", "keepInTouch"]).optional(),
    "countryCodeFormat": zod.enum(["digits", "plus"]).optional(),
    "customApiUrl": zod.string().optional(),
    "keepInTouchApiUrl": zod.string().optional(),
    "smtpHost": zod.string().optional(),
    "smtpPort": zod.number().int().optional(),
    "fromEmail": zod.string().optional(),
    "fromName": zod.string().optional(),
    "useTls": zod.boolean().optional(),
    "useSsl": zod.boolean().optional(),
    "keys": zod.array(zod.object({
      "key": zod.string(),
      "status": zod.enum(["configured", "missing", "invalid", "default"])
    }))
  }).optional()
});
var GetIntegrationSettingsResponse = zod.object({
  "editable": zod.boolean().optional(),
  "smtp": zod.object({
    "source": zod.enum(["environment", "database"]).optional(),
    "revision": zod.string().nullish(),
    "ready": zod.boolean(),
    "notificationsEnabled": zod.boolean().optional(),
    "apiUrl": zod.string().optional(),
    "statusApiUrl": zod.string().optional(),
    "smsProvider": zod.enum(["generic", "keepInTouch"]).optional(),
    "countryCodeFormat": zod.enum(["digits", "plus"]).optional(),
    "customApiUrl": zod.string().optional(),
    "keepInTouchApiUrl": zod.string().optional(),
    "smtpHost": zod.string().optional(),
    "smtpPort": zod.number().int().optional(),
    "fromEmail": zod.string().optional(),
    "fromName": zod.string().optional(),
    "useTls": zod.boolean().optional(),
    "useSsl": zod.boolean().optional(),
    "keys": zod.array(zod.object({
      "key": zod.string(),
      "status": zod.enum(["configured", "missing", "invalid", "default"])
    }))
  }),
  "sms": zod.object({
    "source": zod.enum(["environment", "database"]).optional(),
    "revision": zod.string().nullish(),
    "ready": zod.boolean(),
    "notificationsEnabled": zod.boolean().optional(),
    "apiUrl": zod.string().optional(),
    "statusApiUrl": zod.string().optional(),
    "smsProvider": zod.enum(["generic", "keepInTouch"]).optional(),
    "countryCodeFormat": zod.enum(["digits", "plus"]).optional(),
    "customApiUrl": zod.string().optional(),
    "keepInTouchApiUrl": zod.string().optional(),
    "smtpHost": zod.string().optional(),
    "smtpPort": zod.number().int().optional(),
    "fromEmail": zod.string().optional(),
    "fromName": zod.string().optional(),
    "useTls": zod.boolean().optional(),
    "useSsl": zod.boolean().optional(),
    "keys": zod.array(zod.object({
      "key": zod.string(),
      "status": zod.enum(["configured", "missing", "invalid", "default"])
    }))
  }),
  "notificationSms": zod.object({
    "source": zod.enum(["environment", "database"]).optional(),
    "revision": zod.string().nullish(),
    "ready": zod.boolean(),
    "notificationsEnabled": zod.boolean().optional(),
    "apiUrl": zod.string().optional(),
    "statusApiUrl": zod.string().optional(),
    "smsProvider": zod.enum(["generic", "keepInTouch"]).optional(),
    "countryCodeFormat": zod.enum(["digits", "plus"]).optional(),
    "customApiUrl": zod.string().optional(),
    "keepInTouchApiUrl": zod.string().optional(),
    "smtpHost": zod.string().optional(),
    "smtpPort": zod.number().int().optional(),
    "fromEmail": zod.string().optional(),
    "fromName": zod.string().optional(),
    "useTls": zod.boolean().optional(),
    "useSsl": zod.boolean().optional(),
    "keys": zod.array(zod.object({
      "key": zod.string(),
      "status": zod.enum(["configured", "missing", "invalid", "default"])
    }))
  }).optional()
});
var GetSmtpTestReceiptResponse = zod.object({
  "test": zod.object({
    "requestId": zod.string(),
    "sentAt": zod.string(),
    "status": zod.string(),
    "currentConfiguration": zod.boolean(),
    "receivedAt": zod.string().nullable()
  }).nullable()
});
var ConfirmSmtpTestReceiptBody = zod.object({
  "requestId": zod.string().uuid(),
  "received": zod.literal(true)
});
var ConfirmSmtpTestReceiptResponse = zod.object({
  "test": zod.object({
    "requestId": zod.string(),
    "sentAt": zod.string(),
    "status": zod.string(),
    "currentConfiguration": zod.boolean(),
    "receivedAt": zod.string().nullable()
  }).nullable()
});
var sendSmtpTestEmailBodyRecipientMax = 254;
var SendSmtpTestEmailBody = zod.object({
  "confirmed": zod.literal(true),
  "requestId": zod.string().uuid(),
  "recipient": zod.string().email().max(sendSmtpTestEmailBodyRecipientMax)
});
var SendSmtpTestEmailResponse = zod.object({
  "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown"]),
  "message": zod.string()
});
var sendNotificationSmsTestMessageBodyRecipientMax = 16;
var sendNotificationSmsTestMessageBodyRecipientRegExp = new RegExp("^\\+[1-9][0-9]{6,14}$");
var sendNotificationSmsTestMessageBodyMessageMax = 1600;
var sendNotificationSmsTestMessageBodySenderIdMax = 50;
var sendNotificationSmsTestMessageBodyDltEntityIdMax = 50;
var sendNotificationSmsTestMessageBodyDltTemplateIdMax = 50;
var SendNotificationSmsTestMessageBody = zod.object({
  "confirmed": zod.literal(true),
  "requestId": zod.string().uuid(),
  "recipient": zod.string().max(sendNotificationSmsTestMessageBodyRecipientMax).regex(sendNotificationSmsTestMessageBodyRecipientRegExp),
  "message": zod.string().min(1).max(sendNotificationSmsTestMessageBodyMessageMax),
  "senderId": zod.string().max(sendNotificationSmsTestMessageBodySenderIdMax).optional(),
  "dltEntityId": zod.string().max(sendNotificationSmsTestMessageBodyDltEntityIdMax).optional(),
  "dltTemplateId": zod.string().max(sendNotificationSmsTestMessageBodyDltTemplateIdMax).optional()
});
var SendNotificationSmsTestMessageResponse = zod.object({
  "status": zod.enum(["provider_accepted", "provider_rejected", "delivery_unknown", "not_dispatched"]),
  "message": zod.string()
});
var demoLoginBodyPasswordMax = 200;
var DemoLoginBody = zod.object({
  "password": zod.string().min(1).max(demoLoginBodyPasswordMax)
});
var DemoLoginResponse = zod.object({
  "authenticated": zod.boolean(),
  "channels": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional()
});
var GetDemoSetupResponse = zod.object({
  "configured": zod.boolean(),
  "enabled": zod.boolean(),
  "clinicName": zod.string().optional(),
  "clinicSlug": zod.string().optional(),
  "branchSlug": zod.string().optional(),
  "doctorName": zod.string().optional(),
  "username": zod.string().optional(),
  "loginPath": zod.string().optional(),
  "bookingPath": zod.string().optional(),
  "clinicPath": zod.string().optional(),
  "alreadyExists": zod.boolean().optional(),
  "password": zod.string().optional().describe("One-time secret only on creation or rotation")
});
var CreateDemoSetupResponse = zod.object({
  "configured": zod.boolean(),
  "enabled": zod.boolean(),
  "clinicName": zod.string().optional(),
  "clinicSlug": zod.string().optional(),
  "branchSlug": zod.string().optional(),
  "doctorName": zod.string().optional(),
  "username": zod.string().optional(),
  "loginPath": zod.string().optional(),
  "bookingPath": zod.string().optional(),
  "clinicPath": zod.string().optional(),
  "alreadyExists": zod.boolean().optional(),
  "password": zod.string().optional().describe("One-time secret only on creation or rotation")
});
var UpdateDemoSetupBody = zod.object({
  "action": zod.enum(["enable", "disable", "rotate-password"])
});
var UpdateDemoSetupResponse = zod.object({
  "configured": zod.boolean(),
  "enabled": zod.boolean(),
  "clinicName": zod.string().optional(),
  "clinicSlug": zod.string().optional(),
  "branchSlug": zod.string().optional(),
  "doctorName": zod.string().optional(),
  "username": zod.string().optional(),
  "loginPath": zod.string().optional(),
  "bookingPath": zod.string().optional(),
  "clinicPath": zod.string().optional(),
  "alreadyExists": zod.boolean().optional(),
  "password": zod.string().optional().describe("One-time secret only on creation or rotation")
});
var listQueueSessionsQuerySearchMax = 200;
var listQueueSessionsQueryPageDefault = 1;
var listQueueSessionsQueryPageMax = 1e5;
var listQueueSessionsQueryPageSizeDefault = 20;
var listQueueSessionsQueryPageSizeMax = 100;
var ListQueueSessionsQueryParams = zod.object({
  "date": zod.date(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "search": zod.coerce.string().max(listQueueSessionsQuerySearchMax).optional(),
  "page": zod.coerce.number().int().min(1).max(listQueueSessionsQueryPageMax).default(listQueueSessionsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listQueueSessionsQueryPageSizeMax).default(listQueueSessionsQueryPageSizeDefault)
});
var ListQueueSessionsResponse = zod.object({
  "items": zod.array(zod.object({
    "clinicId": zod.string(),
    "clinicName": zod.string(),
    "branchId": zod.string(),
    "branchName": zod.string(),
    "doctorId": zod.string(),
    "doctorName": zod.string(),
    "date": zod.coerce.date(),
    "timezone": zod.string(),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "sessionId": zod.string().nullable(),
    "startTime": zod.string().nullable(),
    "endTime": zod.string().nullable(),
    "snapshotOnly": zod.boolean(),
    "available": zod.boolean().describe("Open session template only; not booking availability or action authority"),
    "total": zod.number().int(),
    "waiting": zod.number().int(),
    "inConsultation": zod.number().int(),
    "completed": zod.number().int(),
    "cancelled": zod.number().int()
  })),
  "total": zod.number().int(),
  "page": zod.number().int(),
  "pageSize": zod.number().int()
});
var GetSessionContextsQueryParams = zod.object({
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string(),
  "date": zod.date()
});
var GetSessionContextsResponseItem = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "hoursWarning": zod.string().nullish().describe("Present when the session extends beyond ordinary location hours; the session remains bookable."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "available": zod.boolean(),
  "reason": zod.string().nullish(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().optional(),
  "maxTokens": zod.number().int(),
  "bookedTokens": zod.number().int(),
  "remainingTokens": zod.number().int(),
  "consultationMinutes": zod.number().int().optional(),
  "tokenPrefix": zod.string().optional(),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional(),
  "queueOpenTime": zod.string().optional(),
  "queueCloseTime": zod.string().optional()
}).and(zod.object({
  "snapshotOnly": zod.boolean()
}));
var GetSessionContextsResponse = zod.array(GetSessionContextsResponseItem);
var GetRegistrationOptionsResponse = zod.object({
  "categories": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  })),
  "specialities": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  })),
  "qualifications": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  }))
});
var registerClinicBodyFullNameMax = 150;
var registerClinicBodyPasswordMax = 1024;
var registerClinicBodyClinicSlugMin = 3;
var registerClinicBodyClinicSlugMax = 63;
var registerClinicBodyClinicCustomCategoryMax = 100;
var registerClinicBodyClinicCustomSpecialitiesItemMax = 100;
var registerClinicBodyClinicCustomSpecialitiesMax = 30;
var registerClinicBodyClinicReferralCodeMax = 100;
var registerClinicBodyBranchesItemSlugMin = 3;
var registerClinicBodyBranchesItemSlugMax = 63;
var registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var registerClinicBodyBranchesItemOpeningHoursMax = 28;
var registerClinicBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var registerClinicBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var registerClinicBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var registerClinicBodyBranchesMax = 30;
var registerClinicBodyPoliciesBookingHorizonDaysMax = 365;
var registerClinicBodyPoliciesCancellationCutoffMinutesMin = 0;
var registerClinicBodyPoliciesCancellationCutoffMinutesMax = 10080;
var registerClinicBodyOwnDoctorDefault = false;
var registerClinicBodyOwnerScheduleMaxTokensMax = 1e3;
var registerClinicBodyOwnerScheduleConsultationMinutesMax = 240;
var registerClinicBodyOwnerScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var registerClinicBodyOwnerCustomScheduleMaxTokensMax = 1e3;
var registerClinicBodyOwnerCustomScheduleConsultationMinutesMax = 240;
var registerClinicBodyOwnerCustomScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var registerClinicBodyOwnerCustomScheduleSessionsItemBranchIndexMin = 0;
var registerClinicBodyOwnerCustomScheduleSessionsItemBranchIndexMax = 49;
var registerClinicBodyOwnerCustomScheduleSessionsItemDayOfWeekMin = 0;
var registerClinicBodyOwnerCustomScheduleSessionsItemDayOfWeekMax = 6;
var registerClinicBodyOwnerCustomScheduleSessionsItemStartTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var registerClinicBodyOwnerCustomScheduleSessionsItemEndTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var registerClinicBodyOwnerCustomScheduleSessionsItemMaxTokensMax = 1e3;
var registerClinicBodyOwnerCustomScheduleSessionsItemConsultationMinutesMax = 240;
var registerClinicBodyOwnerCustomScheduleSessionsItemTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var registerClinicBodyOwnerCustomScheduleSessionsItemBufferMinutesMin = 0;
var registerClinicBodyOwnerCustomScheduleSessionsItemBufferMinutesMax = 1440;
var registerClinicBodyOwnerCustomScheduleSessionsItemBreakStartRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var registerClinicBodyOwnerCustomScheduleSessionsItemBreakEndRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var registerClinicBodyOwnerCustomScheduleSessionsItemQueueOpenTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var registerClinicBodyOwnerCustomScheduleSessionsItemQueueCloseTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var registerClinicBodyOwnerCustomScheduleSessionsMax = 500;
var RegisterClinicBody = zod.object({
  "requestId": zod.string().uuid().optional().describe("Stable non-secret retry identity; changed payloads cannot replay a committed request."),
  "fullName": zod.string().min(1).max(registerClinicBodyFullNameMax),
  "mobile": zod.string().optional(),
  "password": zod.string().min(1).max(registerClinicBodyPasswordMax),
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "name": zod.string().min(1).optional(),
    "address": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "slug": zod.string().min(registerClinicBodyClinicSlugMin).max(registerClinicBodyClinicSlugMax).optional(),
    "categoryId": zod.string().nullish(),
    "customCategory": zod.string().max(registerClinicBodyClinicCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
    "customSpecialities": zod.array(zod.string().min(1).max(registerClinicBodyClinicCustomSpecialitiesItemMax)).max(registerClinicBodyClinicCustomSpecialitiesMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(registerClinicBodyClinicReferralCodeMax).nullish()
  }),
  "branches": zod.array(zod.object({
    "id": zod.string().optional(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "country": zod.string().optional(),
    "timezone": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "slug": zod.string().min(registerClinicBodyBranchesItemSlugMin).max(registerClinicBodyBranchesItemSlugMax).optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(registerClinicBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(registerClinicBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(registerClinicBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(registerClinicBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(registerClinicBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).min(1).max(registerClinicBodyBranchesMax),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(registerClinicBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(registerClinicBodyPoliciesCancellationCutoffMinutesMin).max(registerClinicBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional(),
  "ownDoctor": zod.boolean().default(registerClinicBodyOwnDoctorDefault),
  "ownerSchedule": zod.object({
    "maxTokens": zod.number().int().min(1).max(registerClinicBodyOwnerScheduleMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1).max(registerClinicBodyOwnerScheduleConsultationMinutesMax),
    "tokenPrefix": zod.string().regex(registerClinicBodyOwnerScheduleTokenPrefixRegExp),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"])
  }).optional(),
  "ownerCustomSchedule": zod.object({
    "maxTokens": zod.number().int().min(1).max(registerClinicBodyOwnerCustomScheduleMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1).max(registerClinicBodyOwnerCustomScheduleConsultationMinutesMax),
    "tokenPrefix": zod.string().regex(registerClinicBodyOwnerCustomScheduleTokenPrefixRegExp),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]),
    "sessions": zod.array(zod.object({
      "branchIndex": zod.number().int().min(registerClinicBodyOwnerCustomScheduleSessionsItemBranchIndexMin).max(registerClinicBodyOwnerCustomScheduleSessionsItemBranchIndexMax),
      "dayOfWeek": zod.number().int().min(registerClinicBodyOwnerCustomScheduleSessionsItemDayOfWeekMin).max(registerClinicBodyOwnerCustomScheduleSessionsItemDayOfWeekMax),
      "startTime": zod.string().regex(registerClinicBodyOwnerCustomScheduleSessionsItemStartTimeRegExp),
      "endTime": zod.string().regex(registerClinicBodyOwnerCustomScheduleSessionsItemEndTimeRegExp),
      "timezone": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(registerClinicBodyOwnerCustomScheduleSessionsItemMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(registerClinicBodyOwnerCustomScheduleSessionsItemConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(registerClinicBodyOwnerCustomScheduleSessionsItemTokenPrefixRegExp).optional(),
      "bufferMinutes": zod.number().int().min(registerClinicBodyOwnerCustomScheduleSessionsItemBufferMinutesMin).max(registerClinicBodyOwnerCustomScheduleSessionsItemBufferMinutesMax).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional(),
      "breakStart": zod.string().regex(registerClinicBodyOwnerCustomScheduleSessionsItemBreakStartRegExp).nullish(),
      "breakEnd": zod.string().regex(registerClinicBodyOwnerCustomScheduleSessionsItemBreakEndRegExp).nullish(),
      "queueOpenTime": zod.string().regex(registerClinicBodyOwnerCustomScheduleSessionsItemQueueOpenTimeRegExp).nullish(),
      "queueCloseTime": zod.string().regex(registerClinicBodyOwnerCustomScheduleSessionsItemQueueCloseTimeRegExp).nullish()
    })).min(1).max(registerClinicBodyOwnerCustomScheduleSessionsMax)
  }).optional().describe("Custom weekly consultation intervals entered once during onboarding/registration with the shared weekly editor. Saved in the same transaction after the owner's doctor profile is created. Mutually exclusive with ownerSchedule (linked)."),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional()
});
var registerClinicResponseClinicOneSlugMin = 3;
var registerClinicResponseClinicOneSlugMax = 63;
var registerClinicResponseClinicOneReferralCodeMax = 100;
var registerClinicResponseClinicOneCustomCategoryMax = 100;
var registerClinicResponseClinicOneCustomSpecialitiesItemMax = 100;
var registerClinicResponseClinicOneCustomSpecialitiesMax = 30;
var registerClinicResponseBranchesItemOneSlugMin = 3;
var registerClinicResponseBranchesItemOneSlugMax = 63;
var registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var registerClinicResponseBranchesItemOneOpeningHoursMax = 28;
var registerClinicResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var registerClinicResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var registerClinicResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var registerClinicResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var registerClinicResponsePoliciesBookingHorizonDaysMax = 365;
var registerClinicResponsePoliciesCancellationCutoffMinutesMin = 0;
var registerClinicResponsePoliciesCancellationCutoffMinutesMax = 10080;
var RegisterClinicResponse = zod.object({
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(registerClinicResponseClinicOneSlugMin).max(registerClinicResponseClinicOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(registerClinicResponseClinicOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "customCategory": zod.string().max(registerClinicResponseClinicOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
    "customSpecialities": zod.array(zod.string().min(1).max(registerClinicResponseClinicOneCustomSpecialitiesItemMax)).max(registerClinicResponseClinicOneCustomSpecialitiesMax).optional(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "categoryName": zod.string().nullish(),
    "specialityNames": zod.array(zod.string()).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  })),
  "branches": zod.array(zod.object({
    "slug": zod.string().min(registerClinicResponseBranchesItemOneSlugMin).max(registerClinicResponseBranchesItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(registerClinicResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(registerClinicResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(registerClinicResponseBranchesItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(registerClinicResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(registerClinicResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(registerClinicResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  }))),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(registerClinicResponsePoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(registerClinicResponsePoliciesCancellationCutoffMinutesMin).max(registerClinicResponsePoliciesCancellationCutoffMinutesMax).optional()
  }),
  "doctorId": zod.string().nullish()
});
var GetClinicRegistrationCompletionQueryParams = zod.object({
  "requestId": zod.coerce.string().uuid()
});
var getClinicRegistrationCompletionResponseResultOneClinicOneSlugMin = 3;
var getClinicRegistrationCompletionResponseResultOneClinicOneSlugMax = 63;
var getClinicRegistrationCompletionResponseResultOneClinicOneReferralCodeMax = 100;
var getClinicRegistrationCompletionResponseResultOneClinicOneCustomCategoryMax = 100;
var getClinicRegistrationCompletionResponseResultOneClinicOneCustomSpecialitiesItemMax = 100;
var getClinicRegistrationCompletionResponseResultOneClinicOneCustomSpecialitiesMax = 30;
var getClinicRegistrationCompletionResponseResultOneBranchesItemOneSlugMin = 3;
var getClinicRegistrationCompletionResponseResultOneBranchesItemOneSlugMax = 63;
var getClinicRegistrationCompletionResponseResultOneBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var getClinicRegistrationCompletionResponseResultOneBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var getClinicRegistrationCompletionResponseResultOneBranchesItemOneOpeningHoursMax = 28;
var getClinicRegistrationCompletionResponseResultOneBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var getClinicRegistrationCompletionResponseResultOneBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var getClinicRegistrationCompletionResponseResultOneBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var getClinicRegistrationCompletionResponseResultOneBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var getClinicRegistrationCompletionResponseResultOnePoliciesBookingHorizonDaysMax = 365;
var getClinicRegistrationCompletionResponseResultOnePoliciesCancellationCutoffMinutesMin = 0;
var getClinicRegistrationCompletionResponseResultOnePoliciesCancellationCutoffMinutesMax = 10080;
var GetClinicRegistrationCompletionResponse = zod.object({
  "result": zod.union([zod.object({
    "clinic": zod.object({
      "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
      "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
      "slug": zod.string().min(getClinicRegistrationCompletionResponseResultOneClinicOneSlugMin).max(getClinicRegistrationCompletionResponseResultOneClinicOneSlugMax).optional(),
      "specialityIds": zod.array(zod.string()).optional(),
      "referralCode": zod.string().max(getClinicRegistrationCompletionResponseResultOneClinicOneReferralCodeMax).nullish(),
      "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
      "name": zod.string().min(1),
      "address": zod.string(),
      "country": zod.string().optional(),
      "state": zod.string().optional(),
      "city": zod.string().optional(),
      "area": zod.string().optional(),
      "pincode": zod.string().optional(),
      "phone": zod.string().nullish(),
      "email": zod.string().email().nullish(),
      "description": zod.string().optional(),
      "clinicTypeId": zod.string().optional(),
      "categoryId": zod.string().nullish(),
      "customCategory": zod.string().max(getClinicRegistrationCompletionResponseResultOneClinicOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
      "customSpecialities": zod.array(zod.string().min(1).max(getClinicRegistrationCompletionResponseResultOneClinicOneCustomSpecialitiesItemMax)).max(getClinicRegistrationCompletionResponseResultOneClinicOneCustomSpecialitiesMax).optional(),
      "status": zod.enum(["active", "inactive"])
    }).and(zod.object({
      "id": zod.string(),
      "code": zod.string(),
      "adminName": zod.string(),
      "categoryName": zod.string().nullish(),
      "specialityNames": zod.array(zod.string()).optional(),
      "createdAt": zod.coerce.date().nullable(),
      "doctorCount": zod.number().int().optional(),
      "branchCount": zod.number().int().optional()
    })),
    "branches": zod.array(zod.object({
      "slug": zod.string().min(getClinicRegistrationCompletionResponseResultOneBranchesItemOneSlugMin).max(getClinicRegistrationCompletionResponseResultOneBranchesItemOneSlugMax).optional(),
      "email": zod.string().email().nullish(),
      "inheritEmail": zod.boolean().optional(),
      "inheritPhone": zod.boolean().optional(),
      "openingHours": zod.array(zod.object({
        "dayOfWeek": zod.number().int().min(getClinicRegistrationCompletionResponseResultOneBranchesItemOneOpeningHoursItemDayOfWeekMin).max(getClinicRegistrationCompletionResponseResultOneBranchesItemOneOpeningHoursItemDayOfWeekMax),
        "startTime": zod.string(),
        "endTime": zod.string()
      })).max(getClinicRegistrationCompletionResponseResultOneBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
      "clinicId": zod.string(),
      "name": zod.string().min(1),
      "address": zod.string(),
      "city": zod.string().optional(),
      "state": zod.string().optional(),
      "pincode": zod.string().optional(),
      "phone": zod.string().nullish(),
      "timezone": zod.string().default(getClinicRegistrationCompletionResponseResultOneBranchesItemOneTimezoneDefault),
      "status": zod.enum(["active", "inactive"])
    }).and(zod.object({
      "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
      "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
      "linkedSchedule": zod.object({
        "enabled": zod.boolean(),
        "doctorId": zod.string().optional(),
        "maxTokens": zod.number().int().min(1).max(getClinicRegistrationCompletionResponseResultOneBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
        "consultationMinutes": zod.number().int().min(1).max(getClinicRegistrationCompletionResponseResultOneBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
        "tokenPrefix": zod.string().regex(getClinicRegistrationCompletionResponseResultOneBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
        "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
      }).optional(),
      "effectiveEmail": zod.string().nullish(),
      "effectivePhone": zod.string().nullish(),
      "id": zod.string(),
      "code": zod.string(),
      "clinicName": zod.string().optional(),
      "createdAt": zod.coerce.date().nullable()
    }))),
    "policies": zod.object({
      "bookingHorizonDays": zod.number().int().min(1).max(getClinicRegistrationCompletionResponseResultOnePoliciesBookingHorizonDaysMax).optional(),
      "cancellationCutoffMinutes": zod.number().int().min(getClinicRegistrationCompletionResponseResultOnePoliciesCancellationCutoffMinutesMin).max(getClinicRegistrationCompletionResponseResultOnePoliciesCancellationCutoffMinutesMax).optional()
    }),
    "doctorId": zod.string().nullish()
  }), zod.null()])
});
var GetClinicAdminSetupCompletionQueryParams = zod.object({
  "requestId": zod.coerce.string().uuid()
});
var getClinicAdminSetupCompletionResponseResultOneBranchesItemOneSlugMin = 3;
var getClinicAdminSetupCompletionResponseResultOneBranchesItemOneSlugMax = 63;
var getClinicAdminSetupCompletionResponseResultOneBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var getClinicAdminSetupCompletionResponseResultOneBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var getClinicAdminSetupCompletionResponseResultOneBranchesItemOneOpeningHoursMax = 28;
var getClinicAdminSetupCompletionResponseResultOneBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var getClinicAdminSetupCompletionResponseResultOneBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var getClinicAdminSetupCompletionResponseResultOneBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var getClinicAdminSetupCompletionResponseResultOneBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var getClinicAdminSetupCompletionResponseResultOneAdminOnePasswordMin = 8;
var getClinicAdminSetupCompletionResponseResultOneAdminOnePasswordMax = 1024;
var getClinicAdminSetupCompletionResponseResultOneAdminOneConfirmPasswordMax = 1024;
var getClinicAdminSetupCompletionResponseResultOneAdminOneCountryMax = 100;
var getClinicAdminSetupCompletionResponseResultOneAdminOneStateMax = 100;
var getClinicAdminSetupCompletionResponseResultOneAdminOneCityMax = 100;
var getClinicAdminSetupCompletionResponseResultOneAdminOnePincodeMax = 12;
var getClinicAdminSetupCompletionResponseResultOneAdminOneAddressMax = 500;
var getClinicAdminSetupCompletionResponseResultOneClinicOneSlugMin = 3;
var getClinicAdminSetupCompletionResponseResultOneClinicOneSlugMax = 63;
var getClinicAdminSetupCompletionResponseResultOneClinicOneReferralCodeMax = 100;
var getClinicAdminSetupCompletionResponseResultOneClinicOneCustomCategoryMax = 100;
var getClinicAdminSetupCompletionResponseResultOneClinicOneCustomSpecialitiesItemMax = 100;
var getClinicAdminSetupCompletionResponseResultOneClinicOneCustomSpecialitiesMax = 30;
var GetClinicAdminSetupCompletionResponse = zod.object({
  "result": zod.union([zod.object({
    "branches": zod.array(zod.object({
      "slug": zod.string().min(getClinicAdminSetupCompletionResponseResultOneBranchesItemOneSlugMin).max(getClinicAdminSetupCompletionResponseResultOneBranchesItemOneSlugMax).optional(),
      "email": zod.string().email().nullish(),
      "inheritEmail": zod.boolean().optional(),
      "inheritPhone": zod.boolean().optional(),
      "openingHours": zod.array(zod.object({
        "dayOfWeek": zod.number().int().min(getClinicAdminSetupCompletionResponseResultOneBranchesItemOneOpeningHoursItemDayOfWeekMin).max(getClinicAdminSetupCompletionResponseResultOneBranchesItemOneOpeningHoursItemDayOfWeekMax),
        "startTime": zod.string(),
        "endTime": zod.string()
      })).max(getClinicAdminSetupCompletionResponseResultOneBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
      "clinicId": zod.string(),
      "name": zod.string().min(1),
      "address": zod.string(),
      "city": zod.string().optional(),
      "state": zod.string().optional(),
      "pincode": zod.string().optional(),
      "phone": zod.string().nullish(),
      "timezone": zod.string().default(getClinicAdminSetupCompletionResponseResultOneBranchesItemOneTimezoneDefault),
      "status": zod.enum(["active", "inactive"])
    }).and(zod.object({
      "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
      "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
      "linkedSchedule": zod.object({
        "enabled": zod.boolean(),
        "doctorId": zod.string().optional(),
        "maxTokens": zod.number().int().min(1).max(getClinicAdminSetupCompletionResponseResultOneBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
        "consultationMinutes": zod.number().int().min(1).max(getClinicAdminSetupCompletionResponseResultOneBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
        "tokenPrefix": zod.string().regex(getClinicAdminSetupCompletionResponseResultOneBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
        "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
      }).optional(),
      "effectiveEmail": zod.string().nullish(),
      "effectivePhone": zod.string().nullish(),
      "id": zod.string(),
      "code": zod.string(),
      "clinicName": zod.string().optional(),
      "createdAt": zod.coerce.date().nullable()
    }))).optional(),
    "doctorId": zod.string().nullish(),
    "admin": zod.object({
      "requestId": zod.string().uuid().optional(),
      "password": zod.string().min(getClinicAdminSetupCompletionResponseResultOneAdminOnePasswordMin).max(getClinicAdminSetupCompletionResponseResultOneAdminOnePasswordMax).optional(),
      "confirmPassword": zod.string().max(getClinicAdminSetupCompletionResponseResultOneAdminOneConfirmPasswordMax).optional(),
      "country": zod.string().max(getClinicAdminSetupCompletionResponseResultOneAdminOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
      "state": zod.string().max(getClinicAdminSetupCompletionResponseResultOneAdminOneStateMax).optional(),
      "city": zod.string().max(getClinicAdminSetupCompletionResponseResultOneAdminOneCityMax).optional(),
      "pincode": zod.string().max(getClinicAdminSetupCompletionResponseResultOneAdminOnePincodeMax).optional(),
      "address": zod.string().max(getClinicAdminSetupCompletionResponseResultOneAdminOneAddressMax).optional(),
      "fullName": zod.string().min(1),
      "email": zod.string().email(),
      "mobile": zod.string().optional(),
      "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
      "status": zod.enum(["active", "inactive"]),
      "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
      "branchIds": zod.array(zod.string()),
      "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
    }).and(zod.object({
      "id": zod.string(),
      "managingAdminId": zod.string().nullable(),
      "managingAdminName": zod.string().nullable(),
      "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
      "setupNotificationOutcomes": zod.object({
        "email": zod.object({
          "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
          "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
        }).optional(),
        "sms": zod.object({
          "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
          "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
        }).optional()
      }).optional(),
      "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
      "staffCreationNotice": zod.object({
        "email": zod.string().nullish(),
        "sms": zod.string().nullish()
      }).optional(),
      "createdAt": zod.coerce.date().nullable(),
      "lastLoginAt": zod.coerce.date().nullish()
    })),
    "clinic": zod.object({
      "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
      "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
      "slug": zod.string().min(getClinicAdminSetupCompletionResponseResultOneClinicOneSlugMin).max(getClinicAdminSetupCompletionResponseResultOneClinicOneSlugMax).optional(),
      "specialityIds": zod.array(zod.string()).optional(),
      "referralCode": zod.string().max(getClinicAdminSetupCompletionResponseResultOneClinicOneReferralCodeMax).nullish(),
      "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
      "name": zod.string().min(1),
      "address": zod.string(),
      "country": zod.string().optional(),
      "state": zod.string().optional(),
      "city": zod.string().optional(),
      "area": zod.string().optional(),
      "pincode": zod.string().optional(),
      "phone": zod.string().nullish(),
      "email": zod.string().email().nullish(),
      "description": zod.string().optional(),
      "clinicTypeId": zod.string().optional(),
      "categoryId": zod.string().nullish(),
      "customCategory": zod.string().max(getClinicAdminSetupCompletionResponseResultOneClinicOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
      "customSpecialities": zod.array(zod.string().min(1).max(getClinicAdminSetupCompletionResponseResultOneClinicOneCustomSpecialitiesItemMax)).max(getClinicAdminSetupCompletionResponseResultOneClinicOneCustomSpecialitiesMax).optional(),
      "status": zod.enum(["active", "inactive"])
    }).and(zod.object({
      "id": zod.string(),
      "code": zod.string(),
      "adminName": zod.string(),
      "categoryName": zod.string().nullish(),
      "specialityNames": zod.array(zod.string()).optional(),
      "createdAt": zod.coerce.date().nullable(),
      "doctorCount": zod.number().int().optional(),
      "branchCount": zod.number().int().optional()
    }))
  }), zod.null()])
});
var GetClinicSettingsParams = zod.object({
  "id": zod.coerce.string()
});
var getClinicSettingsResponseClinicOneSlugMin = 3;
var getClinicSettingsResponseClinicOneSlugMax = 63;
var getClinicSettingsResponseClinicOneReferralCodeMax = 100;
var getClinicSettingsResponseClinicOneCustomCategoryMax = 100;
var getClinicSettingsResponseClinicOneCustomSpecialitiesItemMax = 100;
var getClinicSettingsResponseClinicOneCustomSpecialitiesMax = 30;
var getClinicSettingsResponseBranchesItemOneSlugMin = 3;
var getClinicSettingsResponseBranchesItemOneSlugMax = 63;
var getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var getClinicSettingsResponseBranchesItemOneOpeningHoursMax = 28;
var getClinicSettingsResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var getClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var getClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var getClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var getClinicSettingsResponsePoliciesBookingHorizonDaysMax = 365;
var getClinicSettingsResponsePoliciesCancellationCutoffMinutesMin = 0;
var getClinicSettingsResponsePoliciesCancellationCutoffMinutesMax = 10080;
var GetClinicSettingsResponse = zod.object({
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(getClinicSettingsResponseClinicOneSlugMin).max(getClinicSettingsResponseClinicOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(getClinicSettingsResponseClinicOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "customCategory": zod.string().max(getClinicSettingsResponseClinicOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
    "customSpecialities": zod.array(zod.string().min(1).max(getClinicSettingsResponseClinicOneCustomSpecialitiesItemMax)).max(getClinicSettingsResponseClinicOneCustomSpecialitiesMax).optional(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "categoryName": zod.string().nullish(),
    "specialityNames": zod.array(zod.string()).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  })),
  "branches": zod.array(zod.object({
    "slug": zod.string().min(getClinicSettingsResponseBranchesItemOneSlugMin).max(getClinicSettingsResponseBranchesItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(getClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(getClinicSettingsResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(getClinicSettingsResponseBranchesItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(getClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(getClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(getClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  }))),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(getClinicSettingsResponsePoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(getClinicSettingsResponsePoliciesCancellationCutoffMinutesMin).max(getClinicSettingsResponsePoliciesCancellationCutoffMinutesMax).optional()
  }),
  "doctorId": zod.string().nullish()
});
var UpdateClinicSettingsParams = zod.object({
  "id": zod.coerce.string()
});
var updateClinicSettingsBodyClinicSlugMin = 3;
var updateClinicSettingsBodyClinicSlugMax = 63;
var updateClinicSettingsBodyClinicCustomCategoryMax = 100;
var updateClinicSettingsBodyClinicCustomSpecialitiesItemMax = 100;
var updateClinicSettingsBodyClinicCustomSpecialitiesMax = 30;
var updateClinicSettingsBodyClinicReferralCodeMax = 100;
var updateClinicSettingsBodyBranchesItemSlugMin = 3;
var updateClinicSettingsBodyBranchesItemSlugMax = 63;
var updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var updateClinicSettingsBodyBranchesItemOpeningHoursMax = 28;
var updateClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var updateClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var updateClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var updateClinicSettingsBodyBranchesMax = 30;
var updateClinicSettingsBodyPoliciesBookingHorizonDaysMax = 365;
var updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMin = 0;
var updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMax = 10080;
var UpdateClinicSettingsBody = zod.object({
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "name": zod.string().min(1).optional(),
    "address": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "slug": zod.string().min(updateClinicSettingsBodyClinicSlugMin).max(updateClinicSettingsBodyClinicSlugMax).optional(),
    "categoryId": zod.string().nullish(),
    "customCategory": zod.string().max(updateClinicSettingsBodyClinicCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
    "customSpecialities": zod.array(zod.string().min(1).max(updateClinicSettingsBodyClinicCustomSpecialitiesItemMax)).max(updateClinicSettingsBodyClinicCustomSpecialitiesMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(updateClinicSettingsBodyClinicReferralCodeMax).nullish()
  }).optional(),
  "branches": zod.array(zod.object({
    "id": zod.string().optional(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "country": zod.string().optional(),
    "timezone": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "slug": zod.string().min(updateClinicSettingsBodyBranchesItemSlugMin).max(updateClinicSettingsBodyBranchesItemSlugMax).optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(updateClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(updateClinicSettingsBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(updateClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(updateClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(updateClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).max(updateClinicSettingsBodyBranchesMax).optional(),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(updateClinicSettingsBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMin).max(updateClinicSettingsBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional()
});
var updateClinicSettingsResponseClinicOneSlugMin = 3;
var updateClinicSettingsResponseClinicOneSlugMax = 63;
var updateClinicSettingsResponseClinicOneReferralCodeMax = 100;
var updateClinicSettingsResponseClinicOneCustomCategoryMax = 100;
var updateClinicSettingsResponseClinicOneCustomSpecialitiesItemMax = 100;
var updateClinicSettingsResponseClinicOneCustomSpecialitiesMax = 30;
var updateClinicSettingsResponseBranchesItemOneSlugMin = 3;
var updateClinicSettingsResponseBranchesItemOneSlugMax = 63;
var updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var updateClinicSettingsResponseBranchesItemOneOpeningHoursMax = 28;
var updateClinicSettingsResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var updateClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var updateClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var updateClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var updateClinicSettingsResponsePoliciesBookingHorizonDaysMax = 365;
var updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMin = 0;
var updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMax = 10080;
var UpdateClinicSettingsResponse = zod.object({
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(updateClinicSettingsResponseClinicOneSlugMin).max(updateClinicSettingsResponseClinicOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(updateClinicSettingsResponseClinicOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "customCategory": zod.string().max(updateClinicSettingsResponseClinicOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
    "customSpecialities": zod.array(zod.string().min(1).max(updateClinicSettingsResponseClinicOneCustomSpecialitiesItemMax)).max(updateClinicSettingsResponseClinicOneCustomSpecialitiesMax).optional(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "categoryName": zod.string().nullish(),
    "specialityNames": zod.array(zod.string()).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  })),
  "branches": zod.array(zod.object({
    "slug": zod.string().min(updateClinicSettingsResponseBranchesItemOneSlugMin).max(updateClinicSettingsResponseBranchesItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(updateClinicSettingsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(updateClinicSettingsResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(updateClinicSettingsResponseBranchesItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(updateClinicSettingsResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(updateClinicSettingsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(updateClinicSettingsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  }))),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(updateClinicSettingsResponsePoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMin).max(updateClinicSettingsResponsePoliciesCancellationCutoffMinutesMax).optional()
  }),
  "doctorId": zod.string().nullish()
});
var PreviewClinicSettingsParams = zod.object({
  "id": zod.coerce.string()
});
var previewClinicSettingsBodyClinicSlugMin = 3;
var previewClinicSettingsBodyClinicSlugMax = 63;
var previewClinicSettingsBodyClinicCustomCategoryMax = 100;
var previewClinicSettingsBodyClinicCustomSpecialitiesItemMax = 100;
var previewClinicSettingsBodyClinicCustomSpecialitiesMax = 30;
var previewClinicSettingsBodyClinicReferralCodeMax = 100;
var previewClinicSettingsBodyBranchesItemSlugMin = 3;
var previewClinicSettingsBodyBranchesItemSlugMax = 63;
var previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var previewClinicSettingsBodyBranchesItemOpeningHoursMax = 28;
var previewClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var previewClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var previewClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var previewClinicSettingsBodyBranchesMax = 30;
var previewClinicSettingsBodyPoliciesBookingHorizonDaysMax = 365;
var previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMin = 0;
var previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMax = 10080;
var PreviewClinicSettingsBody = zod.object({
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "name": zod.string().min(1).optional(),
    "address": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "slug": zod.string().min(previewClinicSettingsBodyClinicSlugMin).max(previewClinicSettingsBodyClinicSlugMax).optional(),
    "categoryId": zod.string().nullish(),
    "customCategory": zod.string().max(previewClinicSettingsBodyClinicCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
    "customSpecialities": zod.array(zod.string().min(1).max(previewClinicSettingsBodyClinicCustomSpecialitiesItemMax)).max(previewClinicSettingsBodyClinicCustomSpecialitiesMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(previewClinicSettingsBodyClinicReferralCodeMax).nullish()
  }).optional(),
  "branches": zod.array(zod.object({
    "id": zod.string().optional(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "country": zod.string().optional(),
    "timezone": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "slug": zod.string().min(previewClinicSettingsBodyBranchesItemSlugMin).max(previewClinicSettingsBodyBranchesItemSlugMax).optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(previewClinicSettingsBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(previewClinicSettingsBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(previewClinicSettingsBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(previewClinicSettingsBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(previewClinicSettingsBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).max(previewClinicSettingsBodyBranchesMax).optional(),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(previewClinicSettingsBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMin).max(previewClinicSettingsBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional()
});
var PreviewClinicSettingsResponse = zod.object({
  "allowed": zod.boolean(),
  "conflicts": zod.array(zod.string()),
  "impacts": zod.array(zod.object({
    "branchId": zod.string(),
    "create": zod.number().int(),
    "update": zod.number().int(),
    "retire": zod.number().int(),
    "unlink": zod.boolean()
  }))
});
var attachOwnDoctorProfileBodyBranchIdsMax = 30;
var AttachOwnDoctorProfileBody = zod.object({
  "branchIds": zod.array(zod.string()).max(attachOwnDoctorProfileBodyBranchIdsMax),
  "recoverMissingOnly": zod.boolean().optional().describe("Explicit booking recovery. Reuse an active same-account profile without changing its locations; reject conflicting scope."),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "about": zod.string().optional()
});
var attachOwnDoctorProfileResponseOnePasswordMin = 8;
var attachOwnDoctorProfileResponseOnePasswordMax = 1024;
var attachOwnDoctorProfileResponseOneConfirmPasswordMax = 1024;
var attachOwnDoctorProfileResponseOneCountryMax = 100;
var attachOwnDoctorProfileResponseOneStateMax = 100;
var attachOwnDoctorProfileResponseOneCityMax = 100;
var attachOwnDoctorProfileResponseOnePincodeMax = 12;
var attachOwnDoctorProfileResponseOneAddressMax = 500;
var attachOwnDoctorProfileResponseOneExperienceYearsMin = 0;
var attachOwnDoctorProfileResponseOneConsultationFeeMin = 0;
var AttachOwnDoctorProfileResponse = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(attachOwnDoctorProfileResponseOnePasswordMin).max(attachOwnDoctorProfileResponseOnePasswordMax).optional(),
  "confirmPassword": zod.string().max(attachOwnDoctorProfileResponseOneConfirmPasswordMax).optional(),
  "country": zod.string().max(attachOwnDoctorProfileResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(attachOwnDoctorProfileResponseOneStateMax).optional(),
  "city": zod.string().max(attachOwnDoctorProfileResponseOneCityMax).optional(),
  "pincode": zod.string().max(attachOwnDoctorProfileResponseOnePincodeMax).optional(),
  "address": zod.string().max(attachOwnDoctorProfileResponseOneAddressMax).optional(),
  "ownerAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(attachOwnDoctorProfileResponseOneExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(attachOwnDoctorProfileResponseOneConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "userId": zod.string(),
  "code": zod.string(),
  "staffCreationNotice": zod.object({
    "email": zod.string().nullish(),
    "sms": zod.string().nullish()
  }).optional(),
  "managingAdminId": zod.string(),
  "managingAdminName": zod.string(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "setupNotificationOutcomes": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "specializationName": zod.string().optional(),
  "qualificationNames": zod.array(zod.string()).optional()
}));
var checkSlugAvailabilityQuerySlugMin = 3;
var checkSlugAvailabilityQuerySlugMax = 63;
var CheckSlugAvailabilityQueryParams = zod.object({
  "slug": zod.coerce.string().min(checkSlugAvailabilityQuerySlugMin).max(checkSlugAvailabilityQuerySlugMax),
  "clinicId": zod.coerce.string().optional()
});
var CheckSlugAvailabilityResponse = zod.object({
  "available": zod.boolean(),
  "slug": zod.string()
});
var ResolveClinicSlugParams = zod.object({
  "clinicSlug": zod.coerce.string()
});
var resolveClinicSlugQueryPageMax = 1e6;
var resolveClinicSlugQuerySearchMax = 200;
var ResolveClinicSlugQueryParams = zod.object({
  "directory": zod.coerce.boolean().optional().describe("Opt in to scoped server pagination; omitted preserves the legacy context arrays."),
  "page": zod.coerce.number().int().min(1).max(resolveClinicSlugQueryPageMax).optional(),
  "pageSize": zod.union([zod.literal(10), zod.literal(25), zod.literal(50), zod.literal(100)]).optional(),
  "search": zod.coerce.string().max(resolveClinicSlugQuerySearchMax).optional().describe("Matches public clinic name/address/city or doctor name/specialization only."),
  "sort": zod.enum(["name", "-name"]).optional().describe("Public name with optional minus prefix; sorting never uses private fields.")
});
var resolveClinicSlugResponseDirectoryPaginationTotalMin = 0;
var resolveClinicSlugResponseBranchCountMin = 0;
var resolveClinicSlugResponseBranchDoctorCountMin = 0;
var resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMin = 0;
var resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMax = 6;
var ResolveClinicSlugResponse = zod.object({
  "directoryPagination": zod.object({
    "total": zod.number().int().min(resolveClinicSlugResponseDirectoryPaginationTotalMin),
    "page": zod.number().int(),
    "pageSize": zod.number().int(),
    "totalPages": zod.number().int().optional()
  }).optional(),
  "branchCount": zod.number().int().min(resolveClinicSlugResponseBranchCountMin).optional().describe("Active clinic count before directory search."),
  "branchDoctorCount": zod.number().int().min(resolveClinicSlugResponseBranchDoctorCountMin).optional().describe("Active doctors at the resolved clinic before directory search."),
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "doctorCount": zod.number().int().optional(),
    "averageConsultationMinutes": zod.number().nullish(),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string(),
    "address": zod.string().nullish(),
    "email": zod.string().nullish(),
    "phone": zod.string().nullish()
  }),
  "branches": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string().nullish(),
    "address": zod.string().nullish(),
    "city": zod.string().nullish(),
    "timezone": zod.string().optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin).max(resolveClinicSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).nullish()
  })),
  "branch": zod.union([zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string().nullish(),
    "address": zod.string().nullish(),
    "city": zod.string().nullish(),
    "timezone": zod.string().optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMin).max(resolveClinicSlugResponseBranchOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).nullish()
  }), zod.null()]),
  "qrReference": zod.string().nullable(),
  "doctors": zod.array(zod.object({
    "averageConsultationMinutes": zod.number().nullish().describe("Actual mean of valid completed consultation timestamps"),
    "expectedDurationMinutes": zod.number().int().nullish().describe("Explicit clinic duration configuration"),
    "id": zod.string(),
    "fullName": zod.string(),
    "photoUrl": zod.string().optional(),
    "specializationName": zod.string().optional(),
    "qualificationNames": zod.array(zod.string()).optional(),
    "about": zod.string().optional(),
    "experienceYears": zod.number().int().optional(),
    "consultationFee": zod.number().optional(),
    "clinicIds": zod.array(zod.string()),
    "branchIds": zod.array(zod.string())
  }))
});
var ResolveBranchSlugParams = zod.object({
  "clinicSlug": zod.coerce.string(),
  "branchSlug": zod.coerce.string()
});
var resolveBranchSlugQueryPageMax = 1e6;
var resolveBranchSlugQuerySearchMax = 200;
var ResolveBranchSlugQueryParams = zod.object({
  "directory": zod.coerce.boolean().optional().describe("Opt in to scoped server pagination; omitted preserves the legacy context arrays."),
  "page": zod.coerce.number().int().min(1).max(resolveBranchSlugQueryPageMax).optional(),
  "pageSize": zod.union([zod.literal(10), zod.literal(25), zod.literal(50), zod.literal(100)]).optional(),
  "search": zod.coerce.string().max(resolveBranchSlugQuerySearchMax).optional().describe("Matches public clinic name/address/city or doctor name/specialization only."),
  "sort": zod.enum(["name", "-name"]).optional().describe("Public name with optional minus prefix; sorting never uses private fields.")
});
var resolveBranchSlugResponseDirectoryPaginationTotalMin = 0;
var resolveBranchSlugResponseBranchCountMin = 0;
var resolveBranchSlugResponseBranchDoctorCountMin = 0;
var resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMin = 0;
var resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMax = 6;
var ResolveBranchSlugResponse = zod.object({
  "directoryPagination": zod.object({
    "total": zod.number().int().min(resolveBranchSlugResponseDirectoryPaginationTotalMin),
    "page": zod.number().int(),
    "pageSize": zod.number().int(),
    "totalPages": zod.number().int().optional()
  }).optional(),
  "branchCount": zod.number().int().min(resolveBranchSlugResponseBranchCountMin).optional().describe("Active clinic count before directory search."),
  "branchDoctorCount": zod.number().int().min(resolveBranchSlugResponseBranchDoctorCountMin).optional().describe("Active doctors at the resolved clinic before directory search."),
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "doctorCount": zod.number().int().optional(),
    "averageConsultationMinutes": zod.number().nullish(),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string(),
    "address": zod.string().nullish(),
    "email": zod.string().nullish(),
    "phone": zod.string().nullish()
  }),
  "branches": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string().nullish(),
    "address": zod.string().nullish(),
    "city": zod.string().nullish(),
    "timezone": zod.string().optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMin).max(resolveBranchSlugResponseBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).nullish()
  })),
  "branch": zod.union([zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "name": zod.string(),
    "slug": zod.string().nullish(),
    "address": zod.string().nullish(),
    "city": zod.string().nullish(),
    "timezone": zod.string().optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMin).max(resolveBranchSlugResponseBranchOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).nullish()
  }), zod.null()]),
  "qrReference": zod.string().nullable(),
  "doctors": zod.array(zod.object({
    "averageConsultationMinutes": zod.number().nullish().describe("Actual mean of valid completed consultation timestamps"),
    "expectedDurationMinutes": zod.number().int().nullish().describe("Explicit clinic duration configuration"),
    "id": zod.string(),
    "fullName": zod.string(),
    "photoUrl": zod.string().optional(),
    "specializationName": zod.string().optional(),
    "qualificationNames": zod.array(zod.string()).optional(),
    "about": zod.string().optional(),
    "experienceYears": zod.number().int().optional(),
    "consultationFee": zod.number().optional(),
    "clinicIds": zod.array(zod.string()),
    "branchIds": zod.array(zod.string())
  }))
});
var GetDoctorPresenceParams = zod.object({
  "id": zod.coerce.string()
});
var GetDoctorPresenceQueryParams = zod.object({
  "branchId": zod.coerce.string(),
  "date": zod.date(),
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional()
});
var GetDoctorPresenceResponse = zod.object({
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "status": zod.enum(["available", "onBreak", "away"])
}).and(zod.object({
  "doctorId": zod.string(),
  "updatedAt": zod.coerce.date().nullable()
}));
var UpdateDoctorPresenceParams = zod.object({
  "id": zod.coerce.string()
});
var UpdateDoctorPresenceBody = zod.object({
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "status": zod.enum(["available", "onBreak", "away"])
});
var UpdateDoctorPresenceResponse = zod.object({
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "status": zod.enum(["available", "onBreak", "away"])
}).and(zod.object({
  "doctorId": zod.string(),
  "updatedAt": zod.coerce.date().nullable()
}));
var GetBookingScheduleAccessQueryParams = zod.object({
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string()
});
var GetBookingScheduleAccessResponse = zod.object({
  "allowed": zod.boolean()
});
var GetPublicBookingContextQueryParams = zod.object({
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string()
});
var getPublicBookingContextResponseCancellationCutoffMinutesMin = 0;
var GetPublicBookingContextResponse = zod.object({
  "timezone": zod.string(),
  "today": zod.coerce.date(),
  "lastBookableDate": zod.coerce.date(),
  "requireMobileVerification": zod.boolean().optional().describe("Applies to account-linked patient verification. Guest bookings require mobile contact without claiming account verification."),
  "cancellationCutoffMinutes": zod.number().int().min(getPublicBookingContextResponseCancellationCutoffMinutesMin).optional()
});
var GetPublicAvailabilitySessionsQueryParams = zod.object({
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string(),
  "date": zod.date()
});
var GetPublicAvailabilitySessionsResponseItem = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "hoursWarning": zod.string().nullish().describe("Present when the session extends beyond ordinary location hours; the session remains bookable."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "available": zod.boolean(),
  "reason": zod.string().nullish(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().optional(),
  "maxTokens": zod.number().int(),
  "bookedTokens": zod.number().int(),
  "remainingTokens": zod.number().int(),
  "consultationMinutes": zod.number().int().optional(),
  "tokenPrefix": zod.string().optional(),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional(),
  "queueOpenTime": zod.string().optional(),
  "queueCloseTime": zod.string().optional()
});
var GetPublicAvailabilitySessionsResponse = zod.array(GetPublicAvailabilitySessionsResponseItem);
var createGuestRequestBodyQrReferenceMax = 200;
var createGuestRequestBodyFullNameMax = 150;
var createGuestRequestBodyEmailMax = 254;
var createGuestRequestBodyMobileMax = 16;
var createGuestRequestBodyMobileRegExp = new RegExp("^\\+[1-9][0-9]{7,14}$");
var createGuestRequestBodyBranchIdMax = 100;
var createGuestRequestBodyDoctorIdMax = 100;
var createGuestRequestBodyDateRegExp = new RegExp("^\\d{4}-\\d{2}-\\d{2}$");
var createGuestRequestBodyReceiptSecretRegExp = new RegExp("^[a-f0-9]{64}$");
var CreateGuestRequestBody = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "qrReference": zod.string().min(1).max(createGuestRequestBodyQrReferenceMax),
  "fullName": zod.string().min(1).max(createGuestRequestBodyFullNameMax),
  "email": zod.string().email().max(createGuestRequestBodyEmailMax).nullish(),
  "mobile": zod.string().max(createGuestRequestBodyMobileMax).regex(createGuestRequestBodyMobileRegExp),
  "branchId": zod.string().min(1).max(createGuestRequestBodyBranchIdMax),
  "doctorId": zod.string().min(1).max(createGuestRequestBodyDoctorIdMax),
  "date": zod.string().regex(createGuestRequestBodyDateRegExp),
  "requestId": zod.string().uuid(),
  "receiptSecret": zod.string().regex(createGuestRequestBodyReceiptSecretRegExp)
});
var CreateGuestRequestResponse = zod.object({
  "estimate": zod.object({
    "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
    "basis": zod.enum(["sessionStart", "remainingQueue"]),
    "asOf": zod.string(),
    "patientsAhead": zod.number().int().nullable(),
    "waitMinutes": zod.number().int().nullable(),
    "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
    "beyondSessionEnd": zod.boolean(),
    "guidance": zod.string()
  }).optional(),
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "id": zod.string(),
  "status": zod.enum(["pending", "confirmed", "rejected"]),
  "fullName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "doctorName": zod.string(),
  "date": zod.string(),
  "startTime": zod.string().nullable(),
  "endTime": zod.string().nullable(),
  "timezone": zod.string(),
  "token": zod.string().nullable(),
  "reason": zod.string().nullable(),
  "appointmentId": zod.string().nullable(),
  "reference": zod.string().nullable(),
  "branchAddress": zod.string().nullable(),
  "appointmentStatus": zod.string().nullable(),
  "revision": zod.number().int().nullable(),
  "checkInUrl": zod.string().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
});
var getGuestReceiptBodyReceiptSecretRegExp = new RegExp("^[a-f0-9]{64}$");
var GetGuestReceiptBody = zod.object({
  "receiptSecret": zod.string().regex(getGuestReceiptBodyReceiptSecretRegExp)
});
var GetGuestReceiptResponse = zod.object({
  "estimate": zod.object({
    "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
    "basis": zod.enum(["sessionStart", "remainingQueue"]),
    "asOf": zod.string(),
    "patientsAhead": zod.number().int().nullable(),
    "waitMinutes": zod.number().int().nullable(),
    "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
    "beyondSessionEnd": zod.boolean(),
    "guidance": zod.string()
  }).optional(),
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "id": zod.string(),
  "status": zod.enum(["pending", "confirmed", "rejected"]),
  "fullName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "doctorName": zod.string(),
  "date": zod.string(),
  "startTime": zod.string().nullable(),
  "endTime": zod.string().nullable(),
  "timezone": zod.string(),
  "token": zod.string().nullable(),
  "reason": zod.string().nullable(),
  "appointmentId": zod.string().nullable(),
  "reference": zod.string().nullable(),
  "branchAddress": zod.string().nullable(),
  "appointmentStatus": zod.string().nullable(),
  "revision": zod.number().int().nullable(),
  "checkInUrl": zod.string().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
});
var listGuestRequestsQuerySearchMax = 200;
var listGuestRequestsQuerySortDefault = `-createdAt`;
var listGuestRequestsQueryPageMax = 1e5;
var listGuestRequestsQueryPageSizeMax = 100;
var ListGuestRequestsQueryParams = zod.object({
  "search": zod.coerce.string().max(listGuestRequestsQuerySearchMax).optional(),
  "sort": zod.enum(["createdAt", "-createdAt", "fullName", "-fullName", "date", "-date"]).default(listGuestRequestsQuerySortDefault),
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "date": zod.date().optional(),
  "status": zod.enum(["pending", "confirmed", "rejected"]).optional(),
  "page": zod.coerce.number().int().min(1).max(listGuestRequestsQueryPageMax).optional(),
  "pageSize": zod.coerce.number().int().min(1).max(listGuestRequestsQueryPageSizeMax).optional()
});
var ListGuestRequestsResponse = zod.object({
  "items": zod.array(zod.object({
    "estimate": zod.object({
      "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
      "basis": zod.enum(["sessionStart", "remainingQueue"]),
      "asOf": zod.string(),
      "patientsAhead": zod.number().int().nullable(),
      "waitMinutes": zod.number().int().nullable(),
      "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
      "beyondSessionEnd": zod.boolean(),
      "guidance": zod.string()
    }).optional(),
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "sessionId": zod.string().nullish(),
    "id": zod.string(),
    "status": zod.enum(["pending", "confirmed", "rejected"]),
    "fullName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "doctorName": zod.string(),
    "date": zod.string(),
    "startTime": zod.string().nullable(),
    "endTime": zod.string().nullable(),
    "timezone": zod.string(),
    "token": zod.string().nullable(),
    "reason": zod.string().nullable(),
    "appointmentId": zod.string().nullable(),
    "reference": zod.string().nullable(),
    "branchAddress": zod.string().nullable(),
    "appointmentStatus": zod.string().nullable(),
    "revision": zod.number().int().nullable(),
    "checkInUrl": zod.string().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
  }).and(zod.object({
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "doctorId": zod.string(),
    "email": zod.string().nullable(),
    "mobile": zod.string().nullable(),
    "appointmentId": zod.string().nullable(),
    "createdAt": zod.coerce.date()
  }))),
  "total": zod.number().int(),
  "page": zod.number().int(),
  "pageSize": zod.number().int()
});
var DecideGuestRequestParams = zod.object({
  "id": zod.coerce.string()
});
var decideGuestRequestBodyReasonMax = 500;
var DecideGuestRequestBody = zod.object({
  "action": zod.enum(["confirm", "reject"]),
  "reason": zod.string().min(1).max(decideGuestRequestBodyReasonMax)
});
var DecideGuestRequestResponse = zod.object({
  "estimate": zod.object({
    "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
    "basis": zod.enum(["sessionStart", "remainingQueue"]),
    "asOf": zod.string(),
    "patientsAhead": zod.number().int().nullable(),
    "waitMinutes": zod.number().int().nullable(),
    "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
    "beyondSessionEnd": zod.boolean(),
    "guidance": zod.string()
  }).optional(),
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "id": zod.string(),
  "status": zod.enum(["pending", "confirmed", "rejected"]),
  "fullName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "doctorName": zod.string(),
  "date": zod.string(),
  "startTime": zod.string().nullable(),
  "endTime": zod.string().nullable(),
  "timezone": zod.string(),
  "token": zod.string().nullable(),
  "reason": zod.string().nullable(),
  "appointmentId": zod.string().nullable(),
  "reference": zod.string().nullable(),
  "branchAddress": zod.string().nullable(),
  "appointmentStatus": zod.string().nullable(),
  "revision": zod.number().int().nullable(),
  "checkInUrl": zod.string().nullable().describe("Personal signed check-in QR URL. Keep private like receiptSecret; only returned via booking or receipt capability.")
}).and(zod.object({
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "doctorId": zod.string(),
  "email": zod.string().nullable(),
  "mobile": zod.string().nullable(),
  "appointmentId": zod.string().nullable(),
  "createdAt": zod.coerce.date()
}));
var HealthCheckResponse = zod.object({
  "status": zod.string()
});
var GetAuthCsrfResponse = zod.object({
  "csrfToken": zod.string()
});
var nativeStaffLoginBodyPasswordMax = 1024;
var NativeStaffLoginBody = zod.object({
  "email": zod.string().email(),
  "password": zod.string().min(1).max(nativeStaffLoginBodyPasswordMax)
});
var NativeStaffLoginResponse = zod.object({
  "authenticated": zod.literal(true),
  "user": zod.object({
    "id": zod.string(),
    "email": zod.string().email(),
    "fullName": zod.string(),
    "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist"]),
    "status": zod.enum(["active"])
  })
});
var verifyStaffDeviceBodyCodeMin = 6;
var verifyStaffDeviceBodyCodeMax = 6;
var VerifyStaffDeviceBody = zod.object({
  "challengeId": zod.string(),
  "code": zod.string().min(verifyStaffDeviceBodyCodeMin).max(verifyStaffDeviceBodyCodeMax)
});
var VerifyStaffDeviceResponse = zod.void();
var startPatientEmailBodyOneMobileRegExp = new RegExp("^\\+[1-9][0-9]{6,14}$");
var startPatientEmailBodyTwoMobileRegExp = new RegExp("^\\+[1-9][0-9]{6,14}$");
var StartPatientEmailBody = zod.union([zod.object({
  "channel": zod.enum(["email"]).optional(),
  "email": zod.string().email(),
  "mobile": zod.string().regex(startPatientEmailBodyOneMobileRegExp).optional().describe("Optional mobile for new email registration. Separate SMS proof never replaces email proof or updates an existing account.")
}), zod.object({
  "channel": zod.enum(["sms"]),
  "mobile": zod.string().regex(startPatientEmailBodyTwoMobileRegExp)
})]);
var StartPatientEmailResponse = zod.object({
  "challengeId": zod.string(),
  "requiresVerification": zod.boolean().optional(),
  "channels": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional()
});
var ResendPatientEmailCodeBody = zod.object({
  "challengeId": zod.string()
});
var ResendPatientEmailCodeResponse = zod.object({
  "challengeId": zod.string(),
  "requiresVerification": zod.boolean().optional(),
  "channels": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional()
});
var verifyPatientEmailBodyChannelDefault = `email`;
var VerifyPatientEmailBody = zod.object({
  "channel": zod.enum(["email", "sms"]).default(verifyPatientEmailBodyChannelDefault),
  "challengeId": zod.string(),
  "code": zod.string()
});
var VerifyPatientEmailResponse = zod.object({
  "authenticated": zod.boolean(),
  "channels": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional()
});
var RequestRegistrationMobileCodeBody = zod.object({
  "challengeId": zod.string()
});
var RequestRegistrationMobileCodeResponse = zod.object({
  "sms": zod.object({
    "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
    "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
  })
});
var verifyRegistrationMobileCodeBodyCodeMin = 6;
var verifyRegistrationMobileCodeBodyCodeMax = 6;
var VerifyRegistrationMobileCodeBody = zod.object({
  "challengeId": zod.string(),
  "code": zod.string().min(verifyRegistrationMobileCodeBodyCodeMin).max(verifyRegistrationMobileCodeBodyCodeMax)
});
var VerifyRegistrationMobileCodeResponse = zod.object({
  "mobileVerified": zod.boolean()
});
var startClinicRegistrationBodyFullNameMax = 200;
var startClinicRegistrationBodyMobileRegExp = new RegExp("^\\+[1-9][0-9]{6,14}$");
var startClinicRegistrationBodyPasswordMin = 8;
var startClinicRegistrationBodyPasswordMax = 1024;
var startClinicRegistrationBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var StartClinicRegistrationBody = zod.object({
  "email": zod.string().email(),
  "fullName": zod.string().min(1).max(startClinicRegistrationBodyFullNameMax),
  "mobile": zod.string().regex(startClinicRegistrationBodyMobileRegExp).optional(),
  "password": zod.string().min(startClinicRegistrationBodyPasswordMin).max(startClinicRegistrationBodyPasswordMax).regex(startClinicRegistrationBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var StartClinicRegistrationResponse = zod.object({
  "challengeId": zod.string(),
  "requiresVerification": zod.boolean().optional(),
  "channels": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional()
});
var ResendClinicRegistrationBody = zod.object({
  "challengeId": zod.string()
});
var ResendClinicRegistrationResponse = zod.object({
  "challengeId": zod.string()
});
var ResumeClinicRegistrationBody = zod.object({
  "email": zod.string().email(),
  "fullName": zod.string()
});
var ResumeClinicRegistrationResponse = zod.object({
  "challengeId": zod.string().nullable(),
  "mobilePending": zod.boolean().optional().describe("The cookie-bound pending intent has an optional mobile; never exposes the number.")
});
var verifyClinicRegistrationBodyCodeMin = 6;
var verifyClinicRegistrationBodyCodeMax = 6;
var VerifyClinicRegistrationBody = zod.object({
  "challengeId": zod.string(),
  "code": zod.string().min(verifyClinicRegistrationBodyCodeMin).max(verifyClinicRegistrationBodyCodeMax)
});
var VerifyClinicRegistrationResponse = zod.object({
  "authenticated": zod.boolean(),
  "channels": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional()
});
var requestPasswordRecoveryBodyEmailMax = 254;
var RequestPasswordRecoveryBody = zod.object({
  "email": zod.string().email().max(requestPasswordRecoveryBodyEmailMax)
});
var RequestPasswordRecoveryResponse = zod.object({
  "sent": zod.boolean()
});
var resetNativePasswordBodyPasswordMin = 8;
var resetNativePasswordBodyPasswordMax = 1024;
var resetNativePasswordBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var ResetNativePasswordBody = zod.object({
  "token": zod.string(),
  "password": zod.string().min(resetNativePasswordBodyPasswordMin).max(resetNativePasswordBodyPasswordMax).regex(resetNativePasswordBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var ResetNativePasswordResponse = zod.object({
  "reset": zod.boolean()
});
var acceptStaffInvitationBodyPasswordMin = 8;
var acceptStaffInvitationBodyPasswordMax = 1024;
var acceptStaffInvitationBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var AcceptStaffInvitationBody = zod.object({
  "token": zod.string(),
  "password": zod.string().min(acceptStaffInvitationBodyPasswordMin).max(acceptStaffInvitationBodyPasswordMax).regex(acceptStaffInvitationBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var AcceptStaffInvitationResponse = zod.object({
  "authenticated": zod.boolean(),
  "channels": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional()
});
var changeNativePasswordBodyPasswordMin = 8;
var changeNativePasswordBodyPasswordMax = 1024;
var changeNativePasswordBodyPasswordRegExp = new RegExp("^(?=[\\s\\S]*[A-Za-z])(?=[\\s\\S]*[0-9])[\\s\\S]*$");
var ChangeNativePasswordBody = zod.object({
  "currentPassword": zod.string(),
  "password": zod.string().min(changeNativePasswordBodyPasswordMin).max(changeNativePasswordBodyPasswordMax).regex(changeNativePasswordBodyPasswordRegExp).describe("Requires letters and numbers; maximum 1024 UTF-8 bytes, enforced by server.")
});
var ChangeNativePasswordResponse = zod.object({
  "changed": zod.boolean()
});
var LogoutNativeSessionResponse = zod.object({
  "authenticated": zod.boolean()
});
var GetAuthStatusResponse = zod.object({
  "role": zod.string().nullable(),
  "staffPasswordVerified": zod.boolean(),
  "staffDirectoryRevision": zod.string().optional().describe("Opaque staff-removal revision for invalidating signed-in directory and historical attribution caches."),
  "requiresStaffPassword": zod.boolean()
});
var GetProfileFieldAccessParams = zod.object({
  "profileKind": zod.enum(["patients", "doctors", "users"]),
  "profileId": zod.coerce.string()
});
var GetProfileFieldAccessResponse = zod.object({
  "fields": zod.array(zod.string())
});
var CompleteProfileFieldsParams = zod.object({
  "profileKind": zod.enum(["patients", "doctors", "users"]),
  "profileId": zod.coerce.string()
});
var CompleteProfileFieldsBody = zod.object({
  "values": zod.record(zod.string(), zod.unknown()),
  "baseline": zod.record(zod.string(), zod.unknown())
});
var completeProfileFieldsResponseOneOneCountryMax = 100;
var completeProfileFieldsResponseOneOneStateMax = 100;
var completeProfileFieldsResponseOneOneCityMax = 100;
var completeProfileFieldsResponseOneOnePincodeMax = 12;
var completeProfileFieldsResponseOneOneAgeMin = 0;
var completeProfileFieldsResponseOneOneAgeMax = 130;
var completeProfileFieldsResponseTwoOnePasswordMin = 8;
var completeProfileFieldsResponseTwoOnePasswordMax = 1024;
var completeProfileFieldsResponseTwoOneConfirmPasswordMax = 1024;
var completeProfileFieldsResponseTwoOneCountryMax = 100;
var completeProfileFieldsResponseTwoOneStateMax = 100;
var completeProfileFieldsResponseTwoOneCityMax = 100;
var completeProfileFieldsResponseTwoOnePincodeMax = 12;
var completeProfileFieldsResponseTwoOneAddressMax = 500;
var completeProfileFieldsResponseTwoOneExperienceYearsMin = 0;
var completeProfileFieldsResponseTwoOneConsultationFeeMin = 0;
var completeProfileFieldsResponseThreeOnePasswordMin = 8;
var completeProfileFieldsResponseThreeOnePasswordMax = 1024;
var completeProfileFieldsResponseThreeOneConfirmPasswordMax = 1024;
var completeProfileFieldsResponseThreeOneCountryMax = 100;
var completeProfileFieldsResponseThreeOneStateMax = 100;
var completeProfileFieldsResponseThreeOneCityMax = 100;
var completeProfileFieldsResponseThreeOnePincodeMax = 12;
var completeProfileFieldsResponseThreeOneAddressMax = 500;
var CompleteProfileFieldsResponse = zod.union([zod.object({
  "country": zod.string().max(completeProfileFieldsResponseOneOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(completeProfileFieldsResponseOneOneStateMax).optional(),
  "city": zod.string().max(completeProfileFieldsResponseOneOneCityMax).optional(),
  "pincode": zod.string().max(completeProfileFieldsResponseOneOnePincodeMax).optional(),
  "fullName": zod.string().min(1),
  "mobile": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "age": zod.number().int().min(completeProfileFieldsResponseOneOneAgeMin).max(completeProfileFieldsResponseOneOneAgeMax).optional(),
  "ageReferenceDate": zod.coerce.date().nullish().describe("Date an approximate age was entered; absent on legacy estimates. Never an exact DOB."),
  "gender": zod.string().optional(),
  "address": zod.string().optional(),
  "emergencyContactName": zod.string().optional(),
  "emergencyContactPhone": zod.string().optional(),
  "clinicId": zod.string().optional(),
  "branchId": zod.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "userId": zod.string().nullish(),
  "mobileVerified": zod.boolean(),
  "createdAt": zod.coerce.date()
})), zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(completeProfileFieldsResponseTwoOnePasswordMin).max(completeProfileFieldsResponseTwoOnePasswordMax).optional(),
  "confirmPassword": zod.string().max(completeProfileFieldsResponseTwoOneConfirmPasswordMax).optional(),
  "country": zod.string().max(completeProfileFieldsResponseTwoOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(completeProfileFieldsResponseTwoOneStateMax).optional(),
  "city": zod.string().max(completeProfileFieldsResponseTwoOneCityMax).optional(),
  "pincode": zod.string().max(completeProfileFieldsResponseTwoOnePincodeMax).optional(),
  "address": zod.string().max(completeProfileFieldsResponseTwoOneAddressMax).optional(),
  "ownerAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(completeProfileFieldsResponseTwoOneExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(completeProfileFieldsResponseTwoOneConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "userId": zod.string(),
  "code": zod.string(),
  "staffCreationNotice": zod.object({
    "email": zod.string().nullish(),
    "sms": zod.string().nullish()
  }).optional(),
  "managingAdminId": zod.string(),
  "managingAdminName": zod.string(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "setupNotificationOutcomes": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "specializationName": zod.string().optional(),
  "qualificationNames": zod.array(zod.string()).optional()
})), zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(completeProfileFieldsResponseThreeOnePasswordMin).max(completeProfileFieldsResponseThreeOnePasswordMax).optional(),
  "confirmPassword": zod.string().max(completeProfileFieldsResponseThreeOneConfirmPasswordMax).optional(),
  "country": zod.string().max(completeProfileFieldsResponseThreeOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(completeProfileFieldsResponseThreeOneStateMax).optional(),
  "city": zod.string().max(completeProfileFieldsResponseThreeOneCityMax).optional(),
  "pincode": zod.string().max(completeProfileFieldsResponseThreeOnePincodeMax).optional(),
  "address": zod.string().max(completeProfileFieldsResponseThreeOneAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]),
  "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()),
  "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(zod.object({
  "id": zod.string(),
  "managingAdminId": zod.string().nullable(),
  "managingAdminName": zod.string().nullable(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "setupNotificationOutcomes": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional(),
  "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
  "staffCreationNotice": zod.object({
    "email": zod.string().nullish(),
    "sms": zod.string().nullish()
  }).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "lastLoginAt": zod.coerce.date().nullish()
}))]);
var getMeResponseUserOneOnePasswordMin = 8;
var getMeResponseUserOneOnePasswordMax = 1024;
var getMeResponseUserOneOneConfirmPasswordMax = 1024;
var getMeResponseUserOneOneCountryMax = 100;
var getMeResponseUserOneOneStateMax = 100;
var getMeResponseUserOneOneCityMax = 100;
var getMeResponseUserOneOnePincodeMax = 12;
var getMeResponseUserOneOneAddressMax = 500;
var GetMeResponse = zod.object({
  "userId": zod.string(),
  "user": zod.union([zod.object({
    "requestId": zod.string().uuid().optional(),
    "password": zod.string().min(getMeResponseUserOneOnePasswordMin).max(getMeResponseUserOneOnePasswordMax).optional(),
    "confirmPassword": zod.string().max(getMeResponseUserOneOneConfirmPasswordMax).optional(),
    "country": zod.string().max(getMeResponseUserOneOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(getMeResponseUserOneOneStateMax).optional(),
    "city": zod.string().max(getMeResponseUserOneOneCityMax).optional(),
    "pincode": zod.string().max(getMeResponseUserOneOnePincodeMax).optional(),
    "address": zod.string().max(getMeResponseUserOneOneAddressMax).optional(),
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional(),
    "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": zod.enum(["active", "inactive"]),
    "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": zod.array(zod.string()),
    "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(zod.object({
    "id": zod.string(),
    "managingAdminId": zod.string().nullable(),
    "managingAdminName": zod.string().nullable(),
    "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
    "setupNotificationOutcomes": zod.object({
      "email": zod.object({
        "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
        "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
      }).optional(),
      "sms": zod.object({
        "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
        "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
      }).optional()
    }).optional(),
    "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
    "staffCreationNotice": zod.object({
      "email": zod.string().nullish(),
      "sms": zod.string().nullish()
    }).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "lastLoginAt": zod.coerce.date().nullish()
  })), zod.null()]),
  "doctorId": zod.string().nullish(),
  "patientId": zod.string().nullish(),
  "needsOnboarding": zod.boolean()
});
var UpdateMeBody = zod.object({
  "fullName": zod.string().min(1).optional(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional()
});
var updateMeResponseOnePasswordMin = 8;
var updateMeResponseOnePasswordMax = 1024;
var updateMeResponseOneConfirmPasswordMax = 1024;
var updateMeResponseOneCountryMax = 100;
var updateMeResponseOneStateMax = 100;
var updateMeResponseOneCityMax = 100;
var updateMeResponseOnePincodeMax = 12;
var updateMeResponseOneAddressMax = 500;
var UpdateMeResponse = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(updateMeResponseOnePasswordMin).max(updateMeResponseOnePasswordMax).optional(),
  "confirmPassword": zod.string().max(updateMeResponseOneConfirmPasswordMax).optional(),
  "country": zod.string().max(updateMeResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updateMeResponseOneStateMax).optional(),
  "city": zod.string().max(updateMeResponseOneCityMax).optional(),
  "pincode": zod.string().max(updateMeResponseOnePincodeMax).optional(),
  "address": zod.string().max(updateMeResponseOneAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]),
  "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()),
  "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(zod.object({
  "id": zod.string(),
  "managingAdminId": zod.string().nullable(),
  "managingAdminName": zod.string().nullable(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "setupNotificationOutcomes": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional(),
  "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
  "staffCreationNotice": zod.object({
    "email": zod.string().nullish(),
    "sms": zod.string().nullish()
  }).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "lastLoginAt": zod.coerce.date().nullish()
}));
var onboardBodyIntentDefault = `patient`;
var OnboardBody = zod.object({
  "intent": zod.enum(["patient"]).default(onboardBodyIntentDefault),
  "fullName": zod.string().min(1),
  "mobile": zod.string().optional().describe("Cannot introduce or replace a phone. Only the already-saved signup phone is retained; omit this field or leave it empty to preserve that phone."),
  "termsAccepted": zod.boolean().describe("Must be true to consent to appointment management and complete the patient profile.")
});
var onboardResponseUserOneOnePasswordMin = 8;
var onboardResponseUserOneOnePasswordMax = 1024;
var onboardResponseUserOneOneConfirmPasswordMax = 1024;
var onboardResponseUserOneOneCountryMax = 100;
var onboardResponseUserOneOneStateMax = 100;
var onboardResponseUserOneOneCityMax = 100;
var onboardResponseUserOneOnePincodeMax = 12;
var onboardResponseUserOneOneAddressMax = 500;
var OnboardResponse = zod.object({
  "userId": zod.string(),
  "user": zod.union([zod.object({
    "requestId": zod.string().uuid().optional(),
    "password": zod.string().min(onboardResponseUserOneOnePasswordMin).max(onboardResponseUserOneOnePasswordMax).optional(),
    "confirmPassword": zod.string().max(onboardResponseUserOneOneConfirmPasswordMax).optional(),
    "country": zod.string().max(onboardResponseUserOneOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(onboardResponseUserOneOneStateMax).optional(),
    "city": zod.string().max(onboardResponseUserOneOneCityMax).optional(),
    "pincode": zod.string().max(onboardResponseUserOneOnePincodeMax).optional(),
    "address": zod.string().max(onboardResponseUserOneOneAddressMax).optional(),
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional(),
    "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": zod.enum(["active", "inactive"]),
    "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": zod.array(zod.string()),
    "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(zod.object({
    "id": zod.string(),
    "managingAdminId": zod.string().nullable(),
    "managingAdminName": zod.string().nullable(),
    "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
    "setupNotificationOutcomes": zod.object({
      "email": zod.object({
        "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
        "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
      }).optional(),
      "sms": zod.object({
        "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
        "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
      }).optional()
    }).optional(),
    "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
    "staffCreationNotice": zod.object({
      "email": zod.string().nullish(),
      "sms": zod.string().nullish()
    }).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "lastLoginAt": zod.coerce.date().nullish()
  })), zod.null()]),
  "doctorId": zod.string().nullish(),
  "patientId": zod.string().nullish(),
  "needsOnboarding": zod.boolean()
});
var requestOtpBodyMobileRegExp = new RegExp("^\\+[1-9][0-9]{7,14}$");
var RequestOtpBody = zod.object({
  "mobile": zod.string().regex(requestOtpBodyMobileRegExp)
});
var RequestOtpResponse = zod.object({
  "challengeId": zod.string(),
  "expiresAt": zod.coerce.date(),
  "resendAfterSeconds": zod.number().int(),
  "provider": zod.enum(["sms", "development"]),
  "developmentCode": zod.string().optional().describe("Returned only by the explicitly enabled development provider when NODE_ENV=development. Never present in production.")
});
var verifyOtpBodyCodeRegExp = new RegExp("^[0-9]{4,8}$");
var VerifyOtpBody = zod.object({
  "challengeId": zod.string(),
  "code": zod.string().regex(verifyOtpBodyCodeRegExp)
});
var VerifyOtpResponse = zod.object({
  "verified": zod.boolean(),
  "mobile": zod.string(),
  "verifiedAt": zod.coerce.date().optional()
});
var listPublicClinicsQuerySelectedIdsMax = 1e4;
var listPublicClinicsQueryPageDefault = 1;
var listPublicClinicsQueryPageSizeDefault = 20;
var listPublicClinicsQueryPageSizeMax = 100;
var ListPublicClinicsQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listPublicClinicsQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "search": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listPublicClinicsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listPublicClinicsQueryPageSizeMax).default(listPublicClinicsQueryPageSizeDefault)
});
var listPublicClinicsResponseOneTotalMin = 0;
var listPublicClinicsResponseTwoItemsItemOneSlugMin = 3;
var listPublicClinicsResponseTwoItemsItemOneSlugMax = 63;
var listPublicClinicsResponseTwoItemsItemOneReferralCodeMax = 100;
var listPublicClinicsResponseTwoItemsItemOneCustomCategoryMax = 100;
var listPublicClinicsResponseTwoItemsItemOneCustomSpecialitiesItemMax = 100;
var listPublicClinicsResponseTwoItemsItemOneCustomSpecialitiesMax = 30;
var ListPublicClinicsResponse = zod.object({
  "total": zod.number().int().min(listPublicClinicsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(listPublicClinicsResponseTwoItemsItemOneSlugMin).max(listPublicClinicsResponseTwoItemsItemOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(listPublicClinicsResponseTwoItemsItemOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "customCategory": zod.string().max(listPublicClinicsResponseTwoItemsItemOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
    "customSpecialities": zod.array(zod.string().min(1).max(listPublicClinicsResponseTwoItemsItemOneCustomSpecialitiesItemMax)).max(listPublicClinicsResponseTwoItemsItemOneCustomSpecialitiesMax).optional(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "categoryName": zod.string().nullish(),
    "specialityNames": zod.array(zod.string()).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  })))
}));
var listPublicBranchesQuerySelectedIdsMax = 1e4;
var listPublicBranchesQueryPageDefault = 1;
var listPublicBranchesQueryPageSizeDefault = 20;
var listPublicBranchesQueryPageSizeMax = 100;
var ListPublicBranchesQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listPublicBranchesQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "search": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listPublicBranchesQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listPublicBranchesQueryPageSizeMax).default(listPublicBranchesQueryPageSizeDefault)
});
var listPublicBranchesResponseOneTotalMin = 0;
var listPublicBranchesResponseTwoItemsItemOneSlugMin = 3;
var listPublicBranchesResponseTwoItemsItemOneSlugMax = 63;
var listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin = 0;
var listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax = 6;
var listPublicBranchesResponseTwoItemsItemOneOpeningHoursMax = 28;
var listPublicBranchesResponseTwoItemsItemOneTimezoneDefault = `Asia/Kolkata`;
var listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax = 1e3;
var listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax = 240;
var listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var ListPublicBranchesResponse = zod.object({
  "total": zod.number().int().min(listPublicBranchesResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "slug": zod.string().min(listPublicBranchesResponseTwoItemsItemOneSlugMin).max(listPublicBranchesResponseTwoItemsItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin).max(listPublicBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(listPublicBranchesResponseTwoItemsItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(listPublicBranchesResponseTwoItemsItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(listPublicBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  })))
}));
var listPublicDoctorsQuerySelectedIdsMax = 1e4;
var listPublicDoctorsQueryPageDefault = 1;
var listPublicDoctorsQueryPageSizeDefault = 20;
var listPublicDoctorsQueryPageSizeMax = 100;
var ListPublicDoctorsQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listPublicDoctorsQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "search": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "specializationId": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listPublicDoctorsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listPublicDoctorsQueryPageSizeMax).default(listPublicDoctorsQueryPageSizeDefault)
});
var listPublicDoctorsResponseOneTotalMin = 0;
var ListPublicDoctorsResponse = zod.object({
  "total": zod.number().int().min(listPublicDoctorsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "averageConsultationMinutes": zod.number().nullish().describe("Actual mean of valid completed consultation timestamps"),
    "expectedDurationMinutes": zod.number().int().nullish().describe("Explicit clinic duration configuration"),
    "id": zod.string(),
    "fullName": zod.string(),
    "photoUrl": zod.string().optional(),
    "specializationName": zod.string().optional(),
    "qualificationNames": zod.array(zod.string()).optional(),
    "about": zod.string().optional(),
    "experienceYears": zod.number().int().optional(),
    "consultationFee": zod.number().optional(),
    "clinicIds": zod.array(zod.string()),
    "branchIds": zod.array(zod.string())
  }))
}));
var GetPublicAvailabilityQueryParams = zod.object({
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string(),
  "date": zod.date()
});
var GetPublicAvailabilityResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "hoursWarning": zod.string().nullish().describe("Present when the session extends beyond ordinary location hours; the session remains bookable."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "available": zod.boolean(),
  "reason": zod.string().nullish(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().optional(),
  "maxTokens": zod.number().int(),
  "bookedTokens": zod.number().int(),
  "remainingTokens": zod.number().int(),
  "consultationMinutes": zod.number().int().optional(),
  "tokenPrefix": zod.string().optional(),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional(),
  "queueOpenTime": zod.string().optional(),
  "queueCloseTime": zod.string().optional()
});
var GetPublicDisplayParams = zod.object({
  "reference": zod.coerce.string()
});
var GetPublicDisplayResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "clinic": zod.object({
    "name": zod.string()
  }),
  "branch": zod.object({
    "name": zod.string(),
    "address": zod.string().nullable(),
    "city": zod.string().nullable(),
    "timezone": zod.string()
  }),
  "date": zod.coerce.date(),
  "updatedAt": zod.coerce.date(),
  "sessions": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "sessionId": zod.string().nullish(),
    "presence": zod.enum(["available", "onBreak", "away"]).optional(),
    "doctorId": zod.string(),
    "doctorName": zod.string(),
    "startTime": zod.string().nullable(),
    "endTime": zod.string().nullable(),
    "currentToken": zod.string().nullable(),
    "currentStatus": zod.union([zod.literal("called"), zod.literal("inConsultation"), zod.literal(null)]).nullable(),
    "nextToken": zod.string().nullable(),
    "waitingTokens": zod.array(zod.string()),
    "waitingCount": zod.number().int(),
    "completedCount": zod.number().int()
  }))
});
var ResolveQrParams = zod.object({
  "reference": zod.coerce.string()
});
var ResolveQrResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "reference": zod.string(),
  "clinicId": zod.string(),
  "clinicName": zod.string(),
  "clinicAddress": zod.string().nullish(),
  "branchAddress": zod.string().nullish(),
  "branchCity": zod.string().nullish(),
  "branchTimezone": zod.string().nullish(),
  "branchId": zod.string().nullish(),
  "branchName": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "doctorName": zod.string().nullish()
});
var listClinicsQuerySelectedIdsMax = 1e4;
var listClinicsQueryPageDefault = 1;
var listClinicsQueryPageSizeDefault = 20;
var listClinicsQueryPageSizeMax = 100;
var ListClinicsQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listClinicsQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "doctorId": zod.coerce.string().optional(),
  "search": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "adminId": zod.coerce.string().optional(),
  "city": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listClinicsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listClinicsQueryPageSizeMax).default(listClinicsQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listClinicsResponseOneTotalMin = 0;
var listClinicsResponseTwoItemsItemOneSlugMin = 3;
var listClinicsResponseTwoItemsItemOneSlugMax = 63;
var listClinicsResponseTwoItemsItemOneReferralCodeMax = 100;
var listClinicsResponseTwoItemsItemOneCustomCategoryMax = 100;
var listClinicsResponseTwoItemsItemOneCustomSpecialitiesItemMax = 100;
var listClinicsResponseTwoItemsItemOneCustomSpecialitiesMax = 30;
var ListClinicsResponse = zod.object({
  "total": zod.number().int().min(listClinicsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(listClinicsResponseTwoItemsItemOneSlugMin).max(listClinicsResponseTwoItemsItemOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(listClinicsResponseTwoItemsItemOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "customCategory": zod.string().max(listClinicsResponseTwoItemsItemOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
    "customSpecialities": zod.array(zod.string().min(1).max(listClinicsResponseTwoItemsItemOneCustomSpecialitiesItemMax)).max(listClinicsResponseTwoItemsItemOneCustomSpecialitiesMax).optional(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "categoryName": zod.string().nullish(),
    "specialityNames": zod.array(zod.string()).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  })))
}));
var createClinicBodySlugMin = 3;
var createClinicBodySlugMax = 63;
var createClinicBodyReferralCodeMax = 100;
var createClinicBodyCustomCategoryMax = 100;
var createClinicBodyCustomSpecialitiesItemMax = 100;
var createClinicBodyCustomSpecialitiesMax = 30;
var CreateClinicBody = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": zod.string().min(createClinicBodySlugMin).max(createClinicBodySlugMax).optional(),
  "specialityIds": zod.array(zod.string()).optional(),
  "referralCode": zod.string().max(createClinicBodyReferralCodeMax).nullish(),
  "adminId": zod.string().optional().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": zod.string().min(1),
  "address": zod.string(),
  "country": zod.string().optional(),
  "state": zod.string().optional(),
  "city": zod.string().optional(),
  "area": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "description": zod.string().optional(),
  "clinicTypeId": zod.string().optional(),
  "categoryId": zod.string().nullish(),
  "customCategory": zod.string().max(createClinicBodyCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
  "customSpecialities": zod.array(zod.string().min(1).max(createClinicBodyCustomSpecialitiesItemMax)).max(createClinicBodyCustomSpecialitiesMax).optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var createClinicResponseOneSlugMin = 3;
var createClinicResponseOneSlugMax = 63;
var createClinicResponseOneReferralCodeMax = 100;
var createClinicResponseOneCustomCategoryMax = 100;
var createClinicResponseOneCustomSpecialitiesItemMax = 100;
var createClinicResponseOneCustomSpecialitiesMax = 30;
var CreateClinicResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": zod.string().min(createClinicResponseOneSlugMin).max(createClinicResponseOneSlugMax).optional(),
  "specialityIds": zod.array(zod.string()).optional(),
  "referralCode": zod.string().max(createClinicResponseOneReferralCodeMax).nullish(),
  "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": zod.string().min(1),
  "address": zod.string(),
  "country": zod.string().optional(),
  "state": zod.string().optional(),
  "city": zod.string().optional(),
  "area": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "description": zod.string().optional(),
  "clinicTypeId": zod.string().optional(),
  "categoryId": zod.string().nullish(),
  "customCategory": zod.string().max(createClinicResponseOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
  "customSpecialities": zod.array(zod.string().min(1).max(createClinicResponseOneCustomSpecialitiesItemMax)).max(createClinicResponseOneCustomSpecialitiesMax).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "adminName": zod.string(),
  "categoryName": zod.string().nullish(),
  "specialityNames": zod.array(zod.string()).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "doctorCount": zod.number().int().optional(),
  "branchCount": zod.number().int().optional()
}));
var GetClinicParams = zod.object({
  "id": zod.coerce.string()
});
var getClinicResponseOneSlugMin = 3;
var getClinicResponseOneSlugMax = 63;
var getClinicResponseOneReferralCodeMax = 100;
var getClinicResponseOneCustomCategoryMax = 100;
var getClinicResponseOneCustomSpecialitiesItemMax = 100;
var getClinicResponseOneCustomSpecialitiesMax = 30;
var GetClinicResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": zod.string().min(getClinicResponseOneSlugMin).max(getClinicResponseOneSlugMax).optional(),
  "specialityIds": zod.array(zod.string()).optional(),
  "referralCode": zod.string().max(getClinicResponseOneReferralCodeMax).nullish(),
  "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": zod.string().min(1),
  "address": zod.string(),
  "country": zod.string().optional(),
  "state": zod.string().optional(),
  "city": zod.string().optional(),
  "area": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "description": zod.string().optional(),
  "clinicTypeId": zod.string().optional(),
  "categoryId": zod.string().nullish(),
  "customCategory": zod.string().max(getClinicResponseOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
  "customSpecialities": zod.array(zod.string().min(1).max(getClinicResponseOneCustomSpecialitiesItemMax)).max(getClinicResponseOneCustomSpecialitiesMax).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "adminName": zod.string(),
  "categoryName": zod.string().nullish(),
  "specialityNames": zod.array(zod.string()).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "doctorCount": zod.number().int().optional(),
  "branchCount": zod.number().int().optional()
}));
var UpdateClinicParams = zod.object({
  "id": zod.coerce.string()
});
var updateClinicBodySlugMin = 3;
var updateClinicBodySlugMax = 63;
var updateClinicBodyReferralCodeMax = 100;
var updateClinicBodyCustomCategoryMax = 100;
var updateClinicBodyCustomSpecialitiesItemMax = 100;
var updateClinicBodyCustomSpecialitiesMax = 30;
var UpdateClinicBody = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": zod.string().min(updateClinicBodySlugMin).max(updateClinicBodySlugMax).optional(),
  "specialityIds": zod.array(zod.string()).optional(),
  "referralCode": zod.string().max(updateClinicBodyReferralCodeMax).nullish(),
  "adminId": zod.string().optional().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": zod.string().min(1),
  "address": zod.string(),
  "country": zod.string().optional(),
  "state": zod.string().optional(),
  "city": zod.string().optional(),
  "area": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "description": zod.string().optional(),
  "clinicTypeId": zod.string().optional(),
  "categoryId": zod.string().nullish(),
  "customCategory": zod.string().max(updateClinicBodyCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
  "customSpecialities": zod.array(zod.string().min(1).max(updateClinicBodyCustomSpecialitiesItemMax)).max(updateClinicBodyCustomSpecialitiesMax).optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var updateClinicResponseOneSlugMin = 3;
var updateClinicResponseOneSlugMax = 63;
var updateClinicResponseOneReferralCodeMax = 100;
var updateClinicResponseOneCustomCategoryMax = 100;
var updateClinicResponseOneCustomSpecialitiesItemMax = 100;
var updateClinicResponseOneCustomSpecialitiesMax = 30;
var UpdateClinicResponse = zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "slug": zod.string().min(updateClinicResponseOneSlugMin).max(updateClinicResponseOneSlugMax).optional(),
  "specialityIds": zod.array(zod.string()).optional(),
  "referralCode": zod.string().max(updateClinicResponseOneReferralCodeMax).nullish(),
  "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
  "name": zod.string().min(1),
  "address": zod.string(),
  "country": zod.string().optional(),
  "state": zod.string().optional(),
  "city": zod.string().optional(),
  "area": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "description": zod.string().optional(),
  "clinicTypeId": zod.string().optional(),
  "categoryId": zod.string().nullish(),
  "customCategory": zod.string().max(updateClinicResponseOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
  "customSpecialities": zod.array(zod.string().min(1).max(updateClinicResponseOneCustomSpecialitiesItemMax)).max(updateClinicResponseOneCustomSpecialitiesMax).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "adminName": zod.string(),
  "categoryName": zod.string().nullish(),
  "specialityNames": zod.array(zod.string()).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "doctorCount": zod.number().int().optional(),
  "branchCount": zod.number().int().optional()
}));
var DeleteClinicParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteClinicResponse = zod.void();
var listBranchesQuerySelectedIdsMax = 1e4;
var listBranchesQueryPageDefault = 1;
var listBranchesQueryPageSizeDefault = 20;
var listBranchesQueryPageSizeMax = 100;
var ListBranchesQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listBranchesQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "doctorId": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "search": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "page": zod.coerce.number().int().min(1).default(listBranchesQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listBranchesQueryPageSizeMax).default(listBranchesQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listBranchesResponseOneTotalMin = 0;
var listBranchesResponseTwoItemsItemOneSlugMin = 3;
var listBranchesResponseTwoItemsItemOneSlugMax = 63;
var listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin = 0;
var listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax = 6;
var listBranchesResponseTwoItemsItemOneOpeningHoursMax = 28;
var listBranchesResponseTwoItemsItemOneTimezoneDefault = `Asia/Kolkata`;
var listBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax = 1e3;
var listBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax = 240;
var listBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var ListBranchesResponse = zod.object({
  "total": zod.number().int().min(listBranchesResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "slug": zod.string().min(listBranchesResponseTwoItemsItemOneSlugMin).max(listBranchesResponseTwoItemsItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMin).max(listBranchesResponseTwoItemsItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(listBranchesResponseTwoItemsItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(listBranchesResponseTwoItemsItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(listBranchesResponseTwoItemsItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(listBranchesResponseTwoItemsItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(listBranchesResponseTwoItemsItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  })))
}));
var createBranchBodySlugMin = 3;
var createBranchBodySlugMax = 63;
var createBranchBodyOpeningHoursItemDayOfWeekMin = 0;
var createBranchBodyOpeningHoursItemDayOfWeekMax = 6;
var createBranchBodyOpeningHoursMax = 28;
var createBranchBodyTimezoneDefault = `Asia/Kolkata`;
var CreateBranchBody = zod.object({
  "slug": zod.string().min(createBranchBodySlugMin).max(createBranchBodySlugMax).optional(),
  "email": zod.string().email().nullish(),
  "inheritEmail": zod.boolean().optional(),
  "inheritPhone": zod.boolean().optional(),
  "openingHours": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(createBranchBodyOpeningHoursItemDayOfWeekMin).max(createBranchBodyOpeningHoursItemDayOfWeekMax),
    "startTime": zod.string(),
    "endTime": zod.string()
  })).max(createBranchBodyOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": zod.string(),
  "name": zod.string().min(1),
  "address": zod.string(),
  "city": zod.string().optional(),
  "state": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "timezone": zod.string().default(createBranchBodyTimezoneDefault),
  "status": zod.enum(["active", "inactive"]).optional()
});
var createBranchResponseOneSlugMin = 3;
var createBranchResponseOneSlugMax = 63;
var createBranchResponseOneOpeningHoursItemDayOfWeekMin = 0;
var createBranchResponseOneOpeningHoursItemDayOfWeekMax = 6;
var createBranchResponseOneOpeningHoursMax = 28;
var createBranchResponseOneTimezoneDefault = `Asia/Kolkata`;
var createBranchResponseTwoLinkedScheduleMaxTokensMax = 1e3;
var createBranchResponseTwoLinkedScheduleConsultationMinutesMax = 240;
var createBranchResponseTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var CreateBranchResponse = zod.object({
  "slug": zod.string().min(createBranchResponseOneSlugMin).max(createBranchResponseOneSlugMax).optional(),
  "email": zod.string().email().nullish(),
  "inheritEmail": zod.boolean().optional(),
  "inheritPhone": zod.boolean().optional(),
  "openingHours": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(createBranchResponseOneOpeningHoursItemDayOfWeekMin).max(createBranchResponseOneOpeningHoursItemDayOfWeekMax),
    "startTime": zod.string(),
    "endTime": zod.string()
  })).max(createBranchResponseOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": zod.string(),
  "name": zod.string().min(1),
  "address": zod.string(),
  "city": zod.string().optional(),
  "state": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "timezone": zod.string().default(createBranchResponseOneTimezoneDefault),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "linkedSchedule": zod.object({
    "enabled": zod.boolean(),
    "doctorId": zod.string().optional(),
    "maxTokens": zod.number().int().min(1).max(createBranchResponseTwoLinkedScheduleMaxTokensMax).optional(),
    "consultationMinutes": zod.number().int().min(1).max(createBranchResponseTwoLinkedScheduleConsultationMinutesMax).optional(),
    "tokenPrefix": zod.string().regex(createBranchResponseTwoLinkedScheduleTokenPrefixRegExp).optional(),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
  }).optional(),
  "effectiveEmail": zod.string().nullish(),
  "effectivePhone": zod.string().nullish(),
  "id": zod.string(),
  "code": zod.string(),
  "clinicName": zod.string().optional(),
  "createdAt": zod.coerce.date().nullable()
}));
var GetBranchParams = zod.object({
  "id": zod.coerce.string()
});
var getBranchResponseOneSlugMin = 3;
var getBranchResponseOneSlugMax = 63;
var getBranchResponseOneOpeningHoursItemDayOfWeekMin = 0;
var getBranchResponseOneOpeningHoursItemDayOfWeekMax = 6;
var getBranchResponseOneOpeningHoursMax = 28;
var getBranchResponseOneTimezoneDefault = `Asia/Kolkata`;
var getBranchResponseTwoLinkedScheduleMaxTokensMax = 1e3;
var getBranchResponseTwoLinkedScheduleConsultationMinutesMax = 240;
var getBranchResponseTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var GetBranchResponse = zod.object({
  "slug": zod.string().min(getBranchResponseOneSlugMin).max(getBranchResponseOneSlugMax).optional(),
  "email": zod.string().email().nullish(),
  "inheritEmail": zod.boolean().optional(),
  "inheritPhone": zod.boolean().optional(),
  "openingHours": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(getBranchResponseOneOpeningHoursItemDayOfWeekMin).max(getBranchResponseOneOpeningHoursItemDayOfWeekMax),
    "startTime": zod.string(),
    "endTime": zod.string()
  })).max(getBranchResponseOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": zod.string(),
  "name": zod.string().min(1),
  "address": zod.string(),
  "city": zod.string().optional(),
  "state": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "timezone": zod.string().default(getBranchResponseOneTimezoneDefault),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "linkedSchedule": zod.object({
    "enabled": zod.boolean(),
    "doctorId": zod.string().optional(),
    "maxTokens": zod.number().int().min(1).max(getBranchResponseTwoLinkedScheduleMaxTokensMax).optional(),
    "consultationMinutes": zod.number().int().min(1).max(getBranchResponseTwoLinkedScheduleConsultationMinutesMax).optional(),
    "tokenPrefix": zod.string().regex(getBranchResponseTwoLinkedScheduleTokenPrefixRegExp).optional(),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
  }).optional(),
  "effectiveEmail": zod.string().nullish(),
  "effectivePhone": zod.string().nullish(),
  "id": zod.string(),
  "code": zod.string(),
  "clinicName": zod.string().optional(),
  "createdAt": zod.coerce.date().nullable()
}));
var UpdateBranchParams = zod.object({
  "id": zod.coerce.string()
});
var updateBranchBodySlugMin = 3;
var updateBranchBodySlugMax = 63;
var updateBranchBodyOpeningHoursItemDayOfWeekMin = 0;
var updateBranchBodyOpeningHoursItemDayOfWeekMax = 6;
var updateBranchBodyOpeningHoursMax = 28;
var updateBranchBodyTimezoneDefault = `Asia/Kolkata`;
var UpdateBranchBody = zod.object({
  "slug": zod.string().min(updateBranchBodySlugMin).max(updateBranchBodySlugMax).optional(),
  "email": zod.string().email().nullish(),
  "inheritEmail": zod.boolean().optional(),
  "inheritPhone": zod.boolean().optional(),
  "openingHours": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(updateBranchBodyOpeningHoursItemDayOfWeekMin).max(updateBranchBodyOpeningHoursItemDayOfWeekMax),
    "startTime": zod.string(),
    "endTime": zod.string()
  })).max(updateBranchBodyOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": zod.string(),
  "name": zod.string().min(1),
  "address": zod.string(),
  "city": zod.string().optional(),
  "state": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "timezone": zod.string().default(updateBranchBodyTimezoneDefault),
  "status": zod.enum(["active", "inactive"]).optional()
});
var updateBranchResponseOneSlugMin = 3;
var updateBranchResponseOneSlugMax = 63;
var updateBranchResponseOneOpeningHoursItemDayOfWeekMin = 0;
var updateBranchResponseOneOpeningHoursItemDayOfWeekMax = 6;
var updateBranchResponseOneOpeningHoursMax = 28;
var updateBranchResponseOneTimezoneDefault = `Asia/Kolkata`;
var updateBranchResponseTwoLinkedScheduleMaxTokensMax = 1e3;
var updateBranchResponseTwoLinkedScheduleConsultationMinutesMax = 240;
var updateBranchResponseTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var UpdateBranchResponse = zod.object({
  "slug": zod.string().min(updateBranchResponseOneSlugMin).max(updateBranchResponseOneSlugMax).optional(),
  "email": zod.string().email().nullish(),
  "inheritEmail": zod.boolean().optional(),
  "inheritPhone": zod.boolean().optional(),
  "openingHours": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(updateBranchResponseOneOpeningHoursItemDayOfWeekMin).max(updateBranchResponseOneOpeningHoursItemDayOfWeekMax),
    "startTime": zod.string(),
    "endTime": zod.string()
  })).max(updateBranchResponseOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
  "clinicId": zod.string(),
  "name": zod.string().min(1),
  "address": zod.string(),
  "city": zod.string().optional(),
  "state": zod.string().optional(),
  "pincode": zod.string().optional(),
  "phone": zod.string().nullish(),
  "timezone": zod.string().default(updateBranchResponseOneTimezoneDefault),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "linkedSchedule": zod.object({
    "enabled": zod.boolean(),
    "doctorId": zod.string().optional(),
    "maxTokens": zod.number().int().min(1).max(updateBranchResponseTwoLinkedScheduleMaxTokensMax).optional(),
    "consultationMinutes": zod.number().int().min(1).max(updateBranchResponseTwoLinkedScheduleConsultationMinutesMax).optional(),
    "tokenPrefix": zod.string().regex(updateBranchResponseTwoLinkedScheduleTokenPrefixRegExp).optional(),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
  }).optional(),
  "effectiveEmail": zod.string().nullish(),
  "effectivePhone": zod.string().nullish(),
  "id": zod.string(),
  "code": zod.string(),
  "clinicName": zod.string().optional(),
  "createdAt": zod.coerce.date().nullable()
}));
var DeleteBranchParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteBranchResponse = zod.void();
var listDoctorsQuerySelectedIdsMax = 1e4;
var listDoctorsQueryPageDefault = 1;
var listDoctorsQueryPageSizeDefault = 20;
var listDoctorsQueryPageSizeMax = 100;
var ListDoctorsQueryParams = zod.object({
  "selectedIds": zod.coerce.string().max(listDoctorsQuerySelectedIdsMax).optional().describe("Comma-separated exact IDs within existing scope (maximum 100)."),
  "search": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "managingAdminId": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "specializationId": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listDoctorsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listDoctorsQueryPageSizeMax).default(listDoctorsQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listDoctorsResponseOneTotalMin = 0;
var listDoctorsResponseTwoItemsItemOnePasswordMin = 8;
var listDoctorsResponseTwoItemsItemOnePasswordMax = 1024;
var listDoctorsResponseTwoItemsItemOneConfirmPasswordMax = 1024;
var listDoctorsResponseTwoItemsItemOneCountryMax = 100;
var listDoctorsResponseTwoItemsItemOneStateMax = 100;
var listDoctorsResponseTwoItemsItemOneCityMax = 100;
var listDoctorsResponseTwoItemsItemOnePincodeMax = 12;
var listDoctorsResponseTwoItemsItemOneAddressMax = 500;
var listDoctorsResponseTwoItemsItemOneExperienceYearsMin = 0;
var listDoctorsResponseTwoItemsItemOneConsultationFeeMin = 0;
var ListDoctorsResponse = zod.object({
  "total": zod.number().int().min(listDoctorsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "requestId": zod.string().uuid().optional(),
    "password": zod.string().min(listDoctorsResponseTwoItemsItemOnePasswordMin).max(listDoctorsResponseTwoItemsItemOnePasswordMax).optional(),
    "confirmPassword": zod.string().max(listDoctorsResponseTwoItemsItemOneConfirmPasswordMax).optional(),
    "country": zod.string().max(listDoctorsResponseTwoItemsItemOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(listDoctorsResponseTwoItemsItemOneStateMax).optional(),
    "city": zod.string().max(listDoctorsResponseTwoItemsItemOneCityMax).optional(),
    "pincode": zod.string().max(listDoctorsResponseTwoItemsItemOnePincodeMax).optional(),
    "address": zod.string().max(listDoctorsResponseTwoItemsItemOneAddressMax).optional(),
    "ownerAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional(),
    "photoUrl": zod.string().optional(),
    "gender": zod.string().optional(),
    "dateOfBirth": zod.coerce.date().nullish(),
    "specializationId": zod.string().optional(),
    "qualificationIds": zod.array(zod.string()).optional(),
    "registrationNumber": zod.string().optional(),
    "experienceYears": zod.number().int().min(listDoctorsResponseTwoItemsItemOneExperienceYearsMin).optional(),
    "about": zod.string().optional(),
    "consultationFee": zod.number().min(listDoctorsResponseTwoItemsItemOneConsultationFeeMin).optional(),
    "languages": zod.array(zod.string()).optional(),
    "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
    "branchIds": zod.array(zod.string()).optional(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "userId": zod.string(),
    "code": zod.string(),
    "staffCreationNotice": zod.object({
      "email": zod.string().nullish(),
      "sms": zod.string().nullish()
    }).optional(),
    "managingAdminId": zod.string(),
    "managingAdminName": zod.string(),
    "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
    "setupNotificationOutcomes": zod.object({
      "email": zod.object({
        "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
        "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
      }).optional(),
      "sms": zod.object({
        "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
        "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
      }).optional()
    }).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "specializationName": zod.string().optional(),
    "qualificationNames": zod.array(zod.string()).optional()
  })))
}));
var createDoctorBodyPasswordMin = 8;
var createDoctorBodyPasswordMax = 1024;
var createDoctorBodyConfirmPasswordMax = 1024;
var createDoctorBodyCountryMax = 100;
var createDoctorBodyStateMax = 100;
var createDoctorBodyCityMax = 100;
var createDoctorBodyPincodeMax = 12;
var createDoctorBodyAddressMax = 500;
var createDoctorBodyExperienceYearsMin = 0;
var createDoctorBodyConsultationFeeMin = 0;
var CreateDoctorBody = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(createDoctorBodyPasswordMin).max(createDoctorBodyPasswordMax).optional(),
  "confirmPassword": zod.string().max(createDoctorBodyConfirmPasswordMax).optional(),
  "country": zod.string().max(createDoctorBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createDoctorBodyStateMax).optional(),
  "city": zod.string().max(createDoctorBodyCityMax).optional(),
  "pincode": zod.string().max(createDoctorBodyPincodeMax).optional(),
  "address": zod.string().max(createDoctorBodyAddressMax).optional(),
  "ownerAdminId": zod.string().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(createDoctorBodyExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(createDoctorBodyConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var createDoctorResponseOnePasswordMin = 8;
var createDoctorResponseOnePasswordMax = 1024;
var createDoctorResponseOneConfirmPasswordMax = 1024;
var createDoctorResponseOneCountryMax = 100;
var createDoctorResponseOneStateMax = 100;
var createDoctorResponseOneCityMax = 100;
var createDoctorResponseOnePincodeMax = 12;
var createDoctorResponseOneAddressMax = 500;
var createDoctorResponseOneExperienceYearsMin = 0;
var createDoctorResponseOneConsultationFeeMin = 0;
var CreateDoctorResponse = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(createDoctorResponseOnePasswordMin).max(createDoctorResponseOnePasswordMax).optional(),
  "confirmPassword": zod.string().max(createDoctorResponseOneConfirmPasswordMax).optional(),
  "country": zod.string().max(createDoctorResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createDoctorResponseOneStateMax).optional(),
  "city": zod.string().max(createDoctorResponseOneCityMax).optional(),
  "pincode": zod.string().max(createDoctorResponseOnePincodeMax).optional(),
  "address": zod.string().max(createDoctorResponseOneAddressMax).optional(),
  "ownerAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(createDoctorResponseOneExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(createDoctorResponseOneConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "userId": zod.string(),
  "code": zod.string(),
  "staffCreationNotice": zod.object({
    "email": zod.string().nullish(),
    "sms": zod.string().nullish()
  }).optional(),
  "managingAdminId": zod.string(),
  "managingAdminName": zod.string(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "setupNotificationOutcomes": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "specializationName": zod.string().optional(),
  "qualificationNames": zod.array(zod.string()).optional()
}));
var GetDoctorParams = zod.object({
  "id": zod.coerce.string()
});
var getDoctorResponseOnePasswordMin = 8;
var getDoctorResponseOnePasswordMax = 1024;
var getDoctorResponseOneConfirmPasswordMax = 1024;
var getDoctorResponseOneCountryMax = 100;
var getDoctorResponseOneStateMax = 100;
var getDoctorResponseOneCityMax = 100;
var getDoctorResponseOnePincodeMax = 12;
var getDoctorResponseOneAddressMax = 500;
var getDoctorResponseOneExperienceYearsMin = 0;
var getDoctorResponseOneConsultationFeeMin = 0;
var GetDoctorResponse = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(getDoctorResponseOnePasswordMin).max(getDoctorResponseOnePasswordMax).optional(),
  "confirmPassword": zod.string().max(getDoctorResponseOneConfirmPasswordMax).optional(),
  "country": zod.string().max(getDoctorResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(getDoctorResponseOneStateMax).optional(),
  "city": zod.string().max(getDoctorResponseOneCityMax).optional(),
  "pincode": zod.string().max(getDoctorResponseOnePincodeMax).optional(),
  "address": zod.string().max(getDoctorResponseOneAddressMax).optional(),
  "ownerAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(getDoctorResponseOneExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(getDoctorResponseOneConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "userId": zod.string(),
  "code": zod.string(),
  "staffCreationNotice": zod.object({
    "email": zod.string().nullish(),
    "sms": zod.string().nullish()
  }).optional(),
  "managingAdminId": zod.string(),
  "managingAdminName": zod.string(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "setupNotificationOutcomes": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "specializationName": zod.string().optional(),
  "qualificationNames": zod.array(zod.string()).optional()
}));
var UpdateDoctorParams = zod.object({
  "id": zod.coerce.string()
});
var updateDoctorBodyPasswordMin = 8;
var updateDoctorBodyPasswordMax = 1024;
var updateDoctorBodyConfirmPasswordMax = 1024;
var updateDoctorBodyCountryMax = 100;
var updateDoctorBodyStateMax = 100;
var updateDoctorBodyCityMax = 100;
var updateDoctorBodyPincodeMax = 12;
var updateDoctorBodyAddressMax = 500;
var updateDoctorBodyExperienceYearsMin = 0;
var updateDoctorBodyConsultationFeeMin = 0;
var UpdateDoctorBody = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(updateDoctorBodyPasswordMin).max(updateDoctorBodyPasswordMax).optional(),
  "confirmPassword": zod.string().max(updateDoctorBodyConfirmPasswordMax).optional(),
  "country": zod.string().max(updateDoctorBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updateDoctorBodyStateMax).optional(),
  "city": zod.string().max(updateDoctorBodyCityMax).optional(),
  "pincode": zod.string().max(updateDoctorBodyPincodeMax).optional(),
  "address": zod.string().max(updateDoctorBodyAddressMax).optional(),
  "ownerAdminId": zod.string().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(updateDoctorBodyExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(updateDoctorBodyConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var updateDoctorResponseOnePasswordMin = 8;
var updateDoctorResponseOnePasswordMax = 1024;
var updateDoctorResponseOneConfirmPasswordMax = 1024;
var updateDoctorResponseOneCountryMax = 100;
var updateDoctorResponseOneStateMax = 100;
var updateDoctorResponseOneCityMax = 100;
var updateDoctorResponseOnePincodeMax = 12;
var updateDoctorResponseOneAddressMax = 500;
var updateDoctorResponseOneExperienceYearsMin = 0;
var updateDoctorResponseOneConsultationFeeMin = 0;
var UpdateDoctorResponse = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(updateDoctorResponseOnePasswordMin).max(updateDoctorResponseOnePasswordMax).optional(),
  "confirmPassword": zod.string().max(updateDoctorResponseOneConfirmPasswordMax).optional(),
  "country": zod.string().max(updateDoctorResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updateDoctorResponseOneStateMax).optional(),
  "city": zod.string().max(updateDoctorResponseOneCityMax).optional(),
  "pincode": zod.string().max(updateDoctorResponseOnePincodeMax).optional(),
  "address": zod.string().max(updateDoctorResponseOneAddressMax).optional(),
  "ownerAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server."),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "photoUrl": zod.string().optional(),
  "gender": zod.string().optional(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "registrationNumber": zod.string().optional(),
  "experienceYears": zod.number().int().min(updateDoctorResponseOneExperienceYearsMin).optional(),
  "about": zod.string().optional(),
  "consultationFee": zod.number().min(updateDoctorResponseOneConsultationFeeMin).optional(),
  "languages": zod.array(zod.string()).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for doctor assignment."),
  "branchIds": zod.array(zod.string()).optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "userId": zod.string(),
  "code": zod.string(),
  "staffCreationNotice": zod.object({
    "email": zod.string().nullish(),
    "sms": zod.string().nullish()
  }).optional(),
  "managingAdminId": zod.string(),
  "managingAdminName": zod.string(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "setupNotificationOutcomes": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "specializationName": zod.string().optional(),
  "qualificationNames": zod.array(zod.string()).optional()
}));
var DeleteDoctorParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteDoctorResponse = zod.void();
var listUsersQueryPageDefault = 1;
var listUsersQueryPageSizeDefault = 20;
var listUsersQueryPageSizeMax = 100;
var ListUsersQueryParams = zod.object({
  "linkedOnly": zod.coerce.boolean().optional(),
  "search": zod.coerce.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]).optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "managingAdminId": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "page": zod.coerce.number().int().min(1).default(listUsersQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listUsersQueryPageSizeMax).default(listUsersQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listUsersResponseOneTotalMin = 0;
var listUsersResponseTwoItemsItemOnePasswordMin = 8;
var listUsersResponseTwoItemsItemOnePasswordMax = 1024;
var listUsersResponseTwoItemsItemOneConfirmPasswordMax = 1024;
var listUsersResponseTwoItemsItemOneCountryMax = 100;
var listUsersResponseTwoItemsItemOneStateMax = 100;
var listUsersResponseTwoItemsItemOneCityMax = 100;
var listUsersResponseTwoItemsItemOnePincodeMax = 12;
var listUsersResponseTwoItemsItemOneAddressMax = 500;
var ListUsersResponse = zod.object({
  "total": zod.number().int().min(listUsersResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "requestId": zod.string().uuid().optional(),
    "password": zod.string().min(listUsersResponseTwoItemsItemOnePasswordMin).max(listUsersResponseTwoItemsItemOnePasswordMax).optional(),
    "confirmPassword": zod.string().max(listUsersResponseTwoItemsItemOneConfirmPasswordMax).optional(),
    "country": zod.string().max(listUsersResponseTwoItemsItemOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(listUsersResponseTwoItemsItemOneStateMax).optional(),
    "city": zod.string().max(listUsersResponseTwoItemsItemOneCityMax).optional(),
    "pincode": zod.string().max(listUsersResponseTwoItemsItemOnePincodeMax).optional(),
    "address": zod.string().max(listUsersResponseTwoItemsItemOneAddressMax).optional(),
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional(),
    "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": zod.enum(["active", "inactive"]),
    "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": zod.array(zod.string()),
    "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(zod.object({
    "id": zod.string(),
    "managingAdminId": zod.string().nullable(),
    "managingAdminName": zod.string().nullable(),
    "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
    "setupNotificationOutcomes": zod.object({
      "email": zod.object({
        "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
        "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
      }).optional(),
      "sms": zod.object({
        "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
        "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
      }).optional()
    }).optional(),
    "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
    "staffCreationNotice": zod.object({
      "email": zod.string().nullish(),
      "sms": zod.string().nullish()
    }).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "lastLoginAt": zod.coerce.date().nullish()
  })))
}));
var createUserBodyPasswordMin = 8;
var createUserBodyPasswordMax = 1024;
var createUserBodyConfirmPasswordMax = 1024;
var createUserBodyCountryMax = 100;
var createUserBodyStateMax = 100;
var createUserBodyCityMax = 100;
var createUserBodyPincodeMax = 12;
var createUserBodyAddressMax = 500;
var CreateUserBody = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(createUserBodyPasswordMin).max(createUserBodyPasswordMax).optional(),
  "confirmPassword": zod.string().max(createUserBodyConfirmPasswordMax).optional(),
  "country": zod.string().max(createUserBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createUserBodyStateMax).optional(),
  "city": zod.string().max(createUserBodyCityMax).optional(),
  "pincode": zod.string().max(createUserBodyPincodeMax).optional(),
  "address": zod.string().max(createUserBodyAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()).optional(),
  "managingAdminId": zod.string().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
});
var createUserResponseOnePasswordMin = 8;
var createUserResponseOnePasswordMax = 1024;
var createUserResponseOneConfirmPasswordMax = 1024;
var createUserResponseOneCountryMax = 100;
var createUserResponseOneStateMax = 100;
var createUserResponseOneCityMax = 100;
var createUserResponseOnePincodeMax = 12;
var createUserResponseOneAddressMax = 500;
var CreateUserResponse = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(createUserResponseOnePasswordMin).max(createUserResponseOnePasswordMax).optional(),
  "confirmPassword": zod.string().max(createUserResponseOneConfirmPasswordMax).optional(),
  "country": zod.string().max(createUserResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createUserResponseOneStateMax).optional(),
  "city": zod.string().max(createUserResponseOneCityMax).optional(),
  "pincode": zod.string().max(createUserResponseOnePincodeMax).optional(),
  "address": zod.string().max(createUserResponseOneAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]),
  "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()),
  "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(zod.object({
  "id": zod.string(),
  "managingAdminId": zod.string().nullable(),
  "managingAdminName": zod.string().nullable(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "setupNotificationOutcomes": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional(),
  "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
  "staffCreationNotice": zod.object({
    "email": zod.string().nullish(),
    "sms": zod.string().nullish()
  }).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "lastLoginAt": zod.coerce.date().nullish()
}));
var onboardClinicAdminBodyBranchesItemSlugMin = 3;
var onboardClinicAdminBodyBranchesItemSlugMax = 63;
var onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMin = 0;
var onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMax = 6;
var onboardClinicAdminBodyBranchesItemOpeningHoursMax = 28;
var onboardClinicAdminBodyBranchesItemLinkedScheduleMaxTokensMax = 1e3;
var onboardClinicAdminBodyBranchesItemLinkedScheduleConsultationMinutesMax = 240;
var onboardClinicAdminBodyBranchesItemLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminBodyBranchesMax = 30;
var onboardClinicAdminBodyPoliciesBookingHorizonDaysMax = 365;
var onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMin = 0;
var onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMax = 10080;
var onboardClinicAdminBodyOwnerScheduleMaxTokensMax = 1e3;
var onboardClinicAdminBodyOwnerScheduleConsultationMinutesMax = 240;
var onboardClinicAdminBodyOwnerScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminBodyOwnerCustomScheduleMaxTokensMax = 1e3;
var onboardClinicAdminBodyOwnerCustomScheduleConsultationMinutesMax = 240;
var onboardClinicAdminBodyOwnerCustomScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBranchIndexMin = 0;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBranchIndexMax = 49;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemDayOfWeekMin = 0;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemDayOfWeekMax = 6;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemStartTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemEndTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemMaxTokensMax = 1e3;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemConsultationMinutesMax = 240;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBufferMinutesMin = 0;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBufferMinutesMax = 1440;
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBreakStartRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBreakEndRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemQueueOpenTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var onboardClinicAdminBodyOwnerCustomScheduleSessionsItemQueueCloseTimeRegExp = new RegExp("^([01][0-9]|2[0-3]):[0-5][0-9]$");
var onboardClinicAdminBodyOwnerCustomScheduleSessionsMax = 500;
var onboardClinicAdminBodyAdminPasswordMin = 8;
var onboardClinicAdminBodyAdminPasswordMax = 1024;
var onboardClinicAdminBodyAdminConfirmPasswordMax = 1024;
var onboardClinicAdminBodyClinicSlugMin = 3;
var onboardClinicAdminBodyClinicSlugMax = 63;
var onboardClinicAdminBodyClinicCustomCategoryMax = 100;
var onboardClinicAdminBodyClinicCustomSpecialitiesItemMax = 100;
var onboardClinicAdminBodyClinicCustomSpecialitiesMax = 30;
var onboardClinicAdminBodyClinicReferralCodeMax = 100;
var onboardClinicAdminBodyClinicTimezoneDefault = `Asia/Kolkata`;
var OnboardClinicAdminBody = zod.object({
  "requestId": zod.string().uuid().optional(),
  "branches": zod.array(zod.object({
    "id": zod.string().optional(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "country": zod.string().optional(),
    "timezone": zod.string().optional(),
    "email": zod.string().email().nullish(),
    "phone": zod.string().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "slug": zod.string().min(onboardClinicAdminBodyBranchesItemSlugMin).max(onboardClinicAdminBodyBranchesItemSlugMax).optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMin).max(onboardClinicAdminBodyBranchesItemOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(onboardClinicAdminBodyBranchesItemOpeningHoursMax).nullish().describe("Null or absent preserves legacy unrestricted hours. An explicit empty array closes all days."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(onboardClinicAdminBodyBranchesItemLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(onboardClinicAdminBodyBranchesItemLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(onboardClinicAdminBodyBranchesItemLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional()
  })).max(onboardClinicAdminBodyBranchesMax).optional(),
  "policies": zod.object({
    "bookingHorizonDays": zod.number().int().min(1).max(onboardClinicAdminBodyPoliciesBookingHorizonDaysMax).optional(),
    "cancellationCutoffMinutes": zod.number().int().min(onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMin).max(onboardClinicAdminBodyPoliciesCancellationCutoffMinutesMax).optional()
  }).optional(),
  "ownDoctor": zod.boolean().optional(),
  "ownerSchedule": zod.object({
    "maxTokens": zod.number().int().min(1).max(onboardClinicAdminBodyOwnerScheduleMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1).max(onboardClinicAdminBodyOwnerScheduleConsultationMinutesMax),
    "tokenPrefix": zod.string().regex(onboardClinicAdminBodyOwnerScheduleTokenPrefixRegExp),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"])
  }).optional(),
  "ownerCustomSchedule": zod.object({
    "maxTokens": zod.number().int().min(1).max(onboardClinicAdminBodyOwnerCustomScheduleMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1).max(onboardClinicAdminBodyOwnerCustomScheduleConsultationMinutesMax),
    "tokenPrefix": zod.string().regex(onboardClinicAdminBodyOwnerCustomScheduleTokenPrefixRegExp),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]),
    "sessions": zod.array(zod.object({
      "branchIndex": zod.number().int().min(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBranchIndexMin).max(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBranchIndexMax),
      "dayOfWeek": zod.number().int().min(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemDayOfWeekMin).max(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemDayOfWeekMax),
      "startTime": zod.string().regex(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemStartTimeRegExp),
      "endTime": zod.string().regex(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemEndTimeRegExp),
      "timezone": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemTokenPrefixRegExp).optional(),
      "bufferMinutes": zod.number().int().min(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBufferMinutesMin).max(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBufferMinutesMax).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional(),
      "breakStart": zod.string().regex(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBreakStartRegExp).nullish(),
      "breakEnd": zod.string().regex(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemBreakEndRegExp).nullish(),
      "queueOpenTime": zod.string().regex(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemQueueOpenTimeRegExp).nullish(),
      "queueCloseTime": zod.string().regex(onboardClinicAdminBodyOwnerCustomScheduleSessionsItemQueueCloseTimeRegExp).nullish()
    })).min(1).max(onboardClinicAdminBodyOwnerCustomScheduleSessionsMax)
  }).optional().describe("Custom weekly consultation intervals entered once during onboarding/registration with the shared weekly editor. Saved in the same transaction after the owner's doctor profile is created. Mutually exclusive with ownerSchedule (linked)."),
  "specializationId": zod.string().optional(),
  "qualificationIds": zod.array(zod.string()).optional(),
  "admin": zod.object({
    "password": zod.string().min(onboardClinicAdminBodyAdminPasswordMin).max(onboardClinicAdminBodyAdminPasswordMax).optional(),
    "confirmPassword": zod.string().max(onboardClinicAdminBodyAdminConfirmPasswordMax).optional(),
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional()
  }),
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(onboardClinicAdminBodyClinicSlugMin).max(onboardClinicAdminBodyClinicSlugMax).optional(),
    "categoryId": zod.string().optional(),
    "customCategory": zod.string().max(onboardClinicAdminBodyClinicCustomCategoryMax).nullish(),
    "customSpecialities": zod.array(zod.string().min(1).max(onboardClinicAdminBodyClinicCustomSpecialitiesItemMax)).max(onboardClinicAdminBodyClinicCustomSpecialitiesMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(onboardClinicAdminBodyClinicReferralCodeMax).nullish(),
    "name": zod.string().min(1),
    "code": zod.string().optional(),
    "phone": zod.string().optional(),
    "email": zod.string().email().optional(),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "timezone": zod.string().default(onboardClinicAdminBodyClinicTimezoneDefault)
  })
});
var onboardClinicAdminResponseBranchesItemOneSlugMin = 3;
var onboardClinicAdminResponseBranchesItemOneSlugMax = 63;
var onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var onboardClinicAdminResponseBranchesItemOneOpeningHoursMax = 28;
var onboardClinicAdminResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var onboardClinicAdminResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var onboardClinicAdminResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var onboardClinicAdminResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var onboardClinicAdminResponseAdminOnePasswordMin = 8;
var onboardClinicAdminResponseAdminOnePasswordMax = 1024;
var onboardClinicAdminResponseAdminOneConfirmPasswordMax = 1024;
var onboardClinicAdminResponseAdminOneCountryMax = 100;
var onboardClinicAdminResponseAdminOneStateMax = 100;
var onboardClinicAdminResponseAdminOneCityMax = 100;
var onboardClinicAdminResponseAdminOnePincodeMax = 12;
var onboardClinicAdminResponseAdminOneAddressMax = 500;
var onboardClinicAdminResponseClinicOneSlugMin = 3;
var onboardClinicAdminResponseClinicOneSlugMax = 63;
var onboardClinicAdminResponseClinicOneReferralCodeMax = 100;
var onboardClinicAdminResponseClinicOneCustomCategoryMax = 100;
var onboardClinicAdminResponseClinicOneCustomSpecialitiesItemMax = 100;
var onboardClinicAdminResponseClinicOneCustomSpecialitiesMax = 30;
var OnboardClinicAdminResponse = zod.object({
  "branches": zod.array(zod.object({
    "slug": zod.string().min(onboardClinicAdminResponseBranchesItemOneSlugMin).max(onboardClinicAdminResponseBranchesItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(onboardClinicAdminResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(onboardClinicAdminResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(onboardClinicAdminResponseBranchesItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(onboardClinicAdminResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(onboardClinicAdminResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(onboardClinicAdminResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  }))).optional(),
  "doctorId": zod.string().nullish(),
  "admin": zod.object({
    "requestId": zod.string().uuid().optional(),
    "password": zod.string().min(onboardClinicAdminResponseAdminOnePasswordMin).max(onboardClinicAdminResponseAdminOnePasswordMax).optional(),
    "confirmPassword": zod.string().max(onboardClinicAdminResponseAdminOneConfirmPasswordMax).optional(),
    "country": zod.string().max(onboardClinicAdminResponseAdminOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(onboardClinicAdminResponseAdminOneStateMax).optional(),
    "city": zod.string().max(onboardClinicAdminResponseAdminOneCityMax).optional(),
    "pincode": zod.string().max(onboardClinicAdminResponseAdminOnePincodeMax).optional(),
    "address": zod.string().max(onboardClinicAdminResponseAdminOneAddressMax).optional(),
    "fullName": zod.string().min(1),
    "email": zod.string().email(),
    "mobile": zod.string().optional(),
    "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
    "status": zod.enum(["active", "inactive"]),
    "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
    "branchIds": zod.array(zod.string()),
    "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
  }).and(zod.object({
    "id": zod.string(),
    "managingAdminId": zod.string().nullable(),
    "managingAdminName": zod.string().nullable(),
    "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
    "setupNotificationOutcomes": zod.object({
      "email": zod.object({
        "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
        "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
      }).optional(),
      "sms": zod.object({
        "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
        "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
      }).optional()
    }).optional(),
    "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
    "staffCreationNotice": zod.object({
      "email": zod.string().nullish(),
      "sms": zod.string().nullish()
    }).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "lastLoginAt": zod.coerce.date().nullish()
  })),
  "clinic": zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(onboardClinicAdminResponseClinicOneSlugMin).max(onboardClinicAdminResponseClinicOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(onboardClinicAdminResponseClinicOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "customCategory": zod.string().max(onboardClinicAdminResponseClinicOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
    "customSpecialities": zod.array(zod.string().min(1).max(onboardClinicAdminResponseClinicOneCustomSpecialitiesItemMax)).max(onboardClinicAdminResponseClinicOneCustomSpecialitiesMax).optional(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "categoryName": zod.string().nullish(),
    "specialityNames": zod.array(zod.string()).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  }))
});
var GetUserParams = zod.object({
  "id": zod.coerce.string()
});
var getUserResponseOnePasswordMin = 8;
var getUserResponseOnePasswordMax = 1024;
var getUserResponseOneConfirmPasswordMax = 1024;
var getUserResponseOneCountryMax = 100;
var getUserResponseOneStateMax = 100;
var getUserResponseOneCityMax = 100;
var getUserResponseOnePincodeMax = 12;
var getUserResponseOneAddressMax = 500;
var GetUserResponse = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(getUserResponseOnePasswordMin).max(getUserResponseOnePasswordMax).optional(),
  "confirmPassword": zod.string().max(getUserResponseOneConfirmPasswordMax).optional(),
  "country": zod.string().max(getUserResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(getUserResponseOneStateMax).optional(),
  "city": zod.string().max(getUserResponseOneCityMax).optional(),
  "pincode": zod.string().max(getUserResponseOnePincodeMax).optional(),
  "address": zod.string().max(getUserResponseOneAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]),
  "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()),
  "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(zod.object({
  "id": zod.string(),
  "managingAdminId": zod.string().nullable(),
  "managingAdminName": zod.string().nullable(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "setupNotificationOutcomes": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional(),
  "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
  "staffCreationNotice": zod.object({
    "email": zod.string().nullish(),
    "sms": zod.string().nullish()
  }).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "lastLoginAt": zod.coerce.date().nullish()
}));
var UpdateUserParams = zod.object({
  "id": zod.coerce.string()
});
var updateUserBodyPasswordMin = 8;
var updateUserBodyPasswordMax = 1024;
var updateUserBodyConfirmPasswordMax = 1024;
var updateUserBodyCountryMax = 100;
var updateUserBodyStateMax = 100;
var updateUserBodyCityMax = 100;
var updateUserBodyPincodeMax = 12;
var updateUserBodyAddressMax = 500;
var UpdateUserBody = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(updateUserBodyPasswordMin).max(updateUserBodyPasswordMax).optional(),
  "confirmPassword": zod.string().max(updateUserBodyConfirmPasswordMax).optional(),
  "country": zod.string().max(updateUserBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updateUserBodyStateMax).optional(),
  "city": zod.string().max(updateUserBodyCityMax).optional(),
  "pincode": zod.string().max(updateUserBodyPincodeMax).optional(),
  "address": zod.string().max(updateUserBodyAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]).optional(),
  "clinicIds": zod.array(zod.string()).min(1).optional().describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()).optional(),
  "managingAdminId": zod.string().optional().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
});
var updateUserResponseOnePasswordMin = 8;
var updateUserResponseOnePasswordMax = 1024;
var updateUserResponseOneConfirmPasswordMax = 1024;
var updateUserResponseOneCountryMax = 100;
var updateUserResponseOneStateMax = 100;
var updateUserResponseOneCityMax = 100;
var updateUserResponseOnePincodeMax = 12;
var updateUserResponseOneAddressMax = 500;
var UpdateUserResponse = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(updateUserResponseOnePasswordMin).max(updateUserResponseOnePasswordMax).optional(),
  "confirmPassword": zod.string().max(updateUserResponseOneConfirmPasswordMax).optional(),
  "country": zod.string().max(updateUserResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updateUserResponseOneStateMax).optional(),
  "city": zod.string().max(updateUserResponseOneCityMax).optional(),
  "pincode": zod.string().max(updateUserResponseOnePincodeMax).optional(),
  "address": zod.string().max(updateUserResponseOneAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]),
  "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()),
  "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(zod.object({
  "id": zod.string(),
  "managingAdminId": zod.string().nullable(),
  "managingAdminName": zod.string().nullable(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "setupNotificationOutcomes": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional(),
  "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
  "staffCreationNotice": zod.object({
    "email": zod.string().nullish(),
    "sms": zod.string().nullish()
  }).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "lastLoginAt": zod.coerce.date().nullish()
}));
var DeleteUserParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteUserResponse = zod.void();
var RequestUserPasswordResetParams = zod.object({
  "id": zod.coerce.string()
});
var RequestUserPasswordResetResponse = zod.object({
  "message": zod.string()
});
var ResendUserInvitationParams = zod.object({
  "id": zod.coerce.string()
});
var resendUserInvitationResponseOnePasswordMin = 8;
var resendUserInvitationResponseOnePasswordMax = 1024;
var resendUserInvitationResponseOneConfirmPasswordMax = 1024;
var resendUserInvitationResponseOneCountryMax = 100;
var resendUserInvitationResponseOneStateMax = 100;
var resendUserInvitationResponseOneCityMax = 100;
var resendUserInvitationResponseOnePincodeMax = 12;
var resendUserInvitationResponseOneAddressMax = 500;
var ResendUserInvitationResponse = zod.object({
  "requestId": zod.string().uuid().optional(),
  "password": zod.string().min(resendUserInvitationResponseOnePasswordMin).max(resendUserInvitationResponseOnePasswordMax).optional(),
  "confirmPassword": zod.string().max(resendUserInvitationResponseOneConfirmPasswordMax).optional(),
  "country": zod.string().max(resendUserInvitationResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(resendUserInvitationResponseOneStateMax).optional(),
  "city": zod.string().max(resendUserInvitationResponseOneCityMax).optional(),
  "pincode": zod.string().max(resendUserInvitationResponseOnePincodeMax).optional(),
  "address": zod.string().max(resendUserInvitationResponseOneAddressMax).optional(),
  "fullName": zod.string().min(1),
  "email": zod.string().email(),
  "mobile": zod.string().optional(),
  "role": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]),
  "status": zod.enum(["active", "inactive"]),
  "clinicIds": zod.array(zod.string()).min(1).describe("Required by the server for clinic-scoped roles."),
  "branchIds": zod.array(zod.string()),
  "managingAdminId": zod.string().describe("Backward-compatible only. If supplied it must match the managing admin derived by the server.")
}).and(zod.object({
  "id": zod.string(),
  "managingAdminId": zod.string().nullable(),
  "managingAdminName": zod.string().nullable(),
  "invitationStatus": zod.enum(["sent", "failed", "notRequired"]),
  "setupNotificationOutcomes": zod.object({
    "email": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional(),
    "sms": zod.object({
      "status": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "unavailable", "disabled", "not_requested", "not_reported"]),
      "destination": zod.string().optional().describe("Masked destination only. Acceptance is not receipt.")
    }).optional()
  }).optional(),
  "passwordEnabled": zod.boolean().optional().describe("Whether this staff record has a local password configured."),
  "staffCreationNotice": zod.object({
    "email": zod.string().nullish(),
    "sms": zod.string().nullish()
  }).optional(),
  "createdAt": zod.coerce.date().nullable(),
  "lastLoginAt": zod.coerce.date().nullish()
}));
var getStaffAssignmentOptionsQuerySortDefault = `name`;
var getStaffAssignmentOptionsQueryPageDefault = 1;
var getStaffAssignmentOptionsQueryPageSizeDefault = 20;
var getStaffAssignmentOptionsQueryPageSizeMax = 100;
var getStaffAssignmentOptionsQuerySelectedIdsMax = 1e4;
var GetStaffAssignmentOptionsQueryParams = zod.object({
  "targetRole": zod.enum(["doctor", "receptionist"]),
  "sort": zod.enum(["name", "-name", "createdAt", "-createdAt"]).default(getStaffAssignmentOptionsQuerySortDefault).describe("Server ordering within each authorized clinic and branch catalog. ID in the selected direction breaks ties."),
  "doctorId": zod.coerce.string().optional().describe("Existing doctor being edited."),
  "userId": zod.coerce.string().optional().describe("Existing receptionist being edited."),
  "managingAdminId": zod.coerce.string().optional().describe("Narrows the catalog owner; cannot override an actor or edited staff owner."),
  "search": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(getStaffAssignmentOptionsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(getStaffAssignmentOptionsQueryPageSizeMax).default(getStaffAssignmentOptionsQueryPageSizeDefault),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "selectedIds": zod.coerce.string().max(getStaffAssignmentOptionsQuerySelectedIdsMax).optional().describe("Comma-separated IDs to resolve within the authorized catalog (maximum 100).")
});
var getStaffAssignmentOptionsResponseClinicsItemOneSlugMin = 3;
var getStaffAssignmentOptionsResponseClinicsItemOneSlugMax = 63;
var getStaffAssignmentOptionsResponseClinicsItemOneReferralCodeMax = 100;
var getStaffAssignmentOptionsResponseClinicsItemOneCustomCategoryMax = 100;
var getStaffAssignmentOptionsResponseClinicsItemOneCustomSpecialitiesItemMax = 100;
var getStaffAssignmentOptionsResponseClinicsItemOneCustomSpecialitiesMax = 30;
var getStaffAssignmentOptionsResponseBranchesItemOneSlugMin = 3;
var getStaffAssignmentOptionsResponseBranchesItemOneSlugMax = 63;
var getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin = 0;
var getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax = 6;
var getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursMax = 28;
var getStaffAssignmentOptionsResponseBranchesItemOneTimezoneDefault = `Asia/Kolkata`;
var getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleMaxTokensMax = 1e3;
var getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax = 240;
var getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp = new RegExp("^[A-Za-z0-9]{1,8}$");
var getStaffAssignmentOptionsResponsePaginationClinicsTotalMin = 0;
var getStaffAssignmentOptionsResponsePaginationBranchesTotalMin = 0;
var GetStaffAssignmentOptionsResponse = zod.object({
  "clinics": zod.array(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "slug": zod.string().min(getStaffAssignmentOptionsResponseClinicsItemOneSlugMin).max(getStaffAssignmentOptionsResponseClinicsItemOneSlugMax).optional(),
    "specialityIds": zod.array(zod.string()).optional(),
    "referralCode": zod.string().max(getStaffAssignmentOptionsResponseClinicsItemOneReferralCodeMax).nullish(),
    "adminId": zod.string().describe("Super admins may select the owning clinic administrator; other roles are assigned by the server."),
    "name": zod.string().min(1),
    "address": zod.string(),
    "country": zod.string().optional(),
    "state": zod.string().optional(),
    "city": zod.string().optional(),
    "area": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "description": zod.string().optional(),
    "clinicTypeId": zod.string().optional(),
    "categoryId": zod.string().nullish(),
    "customCategory": zod.string().max(getStaffAssignmentOptionsResponseClinicsItemOneCustomCategoryMax).nullish().describe("Clinic-owned text; mutually exclusive with categoryId. Null clears."),
    "customSpecialities": zod.array(zod.string().min(1).max(getStaffAssignmentOptionsResponseClinicsItemOneCustomSpecialitiesItemMax)).max(getStaffAssignmentOptionsResponseClinicsItemOneCustomSpecialitiesMax).optional(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "adminName": zod.string(),
    "categoryName": zod.string().nullish(),
    "specialityNames": zod.array(zod.string()).optional(),
    "createdAt": zod.coerce.date().nullable(),
    "doctorCount": zod.number().int().optional(),
    "branchCount": zod.number().int().optional()
  }))),
  "branches": zod.array(zod.object({
    "slug": zod.string().min(getStaffAssignmentOptionsResponseBranchesItemOneSlugMin).max(getStaffAssignmentOptionsResponseBranchesItemOneSlugMax).optional(),
    "email": zod.string().email().nullish(),
    "inheritEmail": zod.boolean().optional(),
    "inheritPhone": zod.boolean().optional(),
    "openingHours": zod.array(zod.object({
      "dayOfWeek": zod.number().int().min(getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMin).max(getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursItemDayOfWeekMax),
      "startTime": zod.string(),
      "endTime": zod.string()
    })).max(getStaffAssignmentOptionsResponseBranchesItemOneOpeningHoursMax).nullish().describe("Null or absent is legacy unrestricted; empty array means closed all days."),
    "clinicId": zod.string(),
    "name": zod.string().min(1),
    "address": zod.string(),
    "city": zod.string().optional(),
    "state": zod.string().optional(),
    "pincode": zod.string().optional(),
    "phone": zod.string().nullish(),
    "timezone": zod.string().default(getStaffAssignmentOptionsResponseBranchesItemOneTimezoneDefault),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "linkedSchedule": zod.object({
      "enabled": zod.boolean(),
      "doctorId": zod.string().optional(),
      "maxTokens": zod.number().int().min(1).max(getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleMaxTokensMax).optional(),
      "consultationMinutes": zod.number().int().min(1).max(getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleConsultationMinutesMax).optional(),
      "tokenPrefix": zod.string().regex(getStaffAssignmentOptionsResponseBranchesItemTwoLinkedScheduleTokenPrefixRegExp).optional(),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).optional()
    }).optional(),
    "effectiveEmail": zod.string().nullish(),
    "effectivePhone": zod.string().nullish(),
    "id": zod.string(),
    "code": zod.string(),
    "clinicName": zod.string().optional(),
    "createdAt": zod.coerce.date().nullable()
  }))),
  "managingAdmins": zod.array(zod.object({
    "id": zod.string(),
    "fullName": zod.string()
  })),
  "pagination": zod.object({
    "clinics": zod.object({
      "total": zod.number().int().min(getStaffAssignmentOptionsResponsePaginationClinicsTotalMin),
      "page": zod.number().int(),
      "pageSize": zod.number().int(),
      "totalPages": zod.number().int().optional()
    }).optional(),
    "branches": zod.object({
      "total": zod.number().int().min(getStaffAssignmentOptionsResponsePaginationBranchesTotalMin),
      "page": zod.number().int(),
      "pageSize": zod.number().int(),
      "totalPages": zod.number().int().optional()
    }).optional()
  }).optional()
});
var listPatientsQueryPageDefault = 1;
var listPatientsQueryPageSizeDefault = 20;
var listPatientsQueryPageSizeMax = 100;
var ListPatientsQueryParams = zod.object({
  "search": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "gender": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listPatientsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listPatientsQueryPageSizeMax).default(listPatientsQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listPatientsResponseOneTotalMin = 0;
var listPatientsResponseTwoItemsItemOneCountryMax = 100;
var listPatientsResponseTwoItemsItemOneStateMax = 100;
var listPatientsResponseTwoItemsItemOneCityMax = 100;
var listPatientsResponseTwoItemsItemOnePincodeMax = 12;
var listPatientsResponseTwoItemsItemOneAgeMin = 0;
var listPatientsResponseTwoItemsItemOneAgeMax = 130;
var ListPatientsResponse = zod.object({
  "total": zod.number().int().min(listPatientsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "country": zod.string().max(listPatientsResponseTwoItemsItemOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
    "state": zod.string().max(listPatientsResponseTwoItemsItemOneStateMax).optional(),
    "city": zod.string().max(listPatientsResponseTwoItemsItemOneCityMax).optional(),
    "pincode": zod.string().max(listPatientsResponseTwoItemsItemOnePincodeMax).optional(),
    "fullName": zod.string().min(1),
    "mobile": zod.string().nullish(),
    "email": zod.string().email().nullish(),
    "dateOfBirth": zod.coerce.date().nullish(),
    "age": zod.number().int().min(listPatientsResponseTwoItemsItemOneAgeMin).max(listPatientsResponseTwoItemsItemOneAgeMax).optional(),
    "ageReferenceDate": zod.coerce.date().nullish().describe("Date an approximate age was entered; absent on legacy estimates. Never an exact DOB."),
    "gender": zod.string().optional(),
    "address": zod.string().optional(),
    "emergencyContactName": zod.string().optional(),
    "emergencyContactPhone": zod.string().optional(),
    "clinicId": zod.string().optional(),
    "branchId": zod.string().optional(),
    "status": zod.enum(["active", "inactive"]).optional()
  }).and(zod.object({
    "id": zod.string(),
    "code": zod.string(),
    "userId": zod.string().nullish(),
    "mobileVerified": zod.boolean(),
    "createdAt": zod.coerce.date()
  })))
}));
var createPatientBodyCountryMax = 100;
var createPatientBodyStateMax = 100;
var createPatientBodyCityMax = 100;
var createPatientBodyPincodeMax = 12;
var createPatientBodyAgeMin = 0;
var createPatientBodyAgeMax = 130;
var CreatePatientBody = zod.object({
  "country": zod.string().max(createPatientBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createPatientBodyStateMax).optional(),
  "city": zod.string().max(createPatientBodyCityMax).optional(),
  "pincode": zod.string().max(createPatientBodyPincodeMax).optional(),
  "fullName": zod.string().min(1),
  "mobile": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "age": zod.number().int().min(createPatientBodyAgeMin).max(createPatientBodyAgeMax).optional(),
  "gender": zod.string().optional(),
  "address": zod.string().optional(),
  "emergencyContactName": zod.string().optional(),
  "emergencyContactPhone": zod.string().optional(),
  "clinicId": zod.string().optional(),
  "branchId": zod.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var createPatientResponseOneCountryMax = 100;
var createPatientResponseOneStateMax = 100;
var createPatientResponseOneCityMax = 100;
var createPatientResponseOnePincodeMax = 12;
var createPatientResponseOneAgeMin = 0;
var createPatientResponseOneAgeMax = 130;
var CreatePatientResponse = zod.object({
  "country": zod.string().max(createPatientResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(createPatientResponseOneStateMax).optional(),
  "city": zod.string().max(createPatientResponseOneCityMax).optional(),
  "pincode": zod.string().max(createPatientResponseOnePincodeMax).optional(),
  "fullName": zod.string().min(1),
  "mobile": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "age": zod.number().int().min(createPatientResponseOneAgeMin).max(createPatientResponseOneAgeMax).optional(),
  "ageReferenceDate": zod.coerce.date().nullish().describe("Date an approximate age was entered; absent on legacy estimates. Never an exact DOB."),
  "gender": zod.string().optional(),
  "address": zod.string().optional(),
  "emergencyContactName": zod.string().optional(),
  "emergencyContactPhone": zod.string().optional(),
  "clinicId": zod.string().optional(),
  "branchId": zod.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "userId": zod.string().nullish(),
  "mobileVerified": zod.boolean(),
  "createdAt": zod.coerce.date()
}));
var GetPatientParams = zod.object({
  "id": zod.coerce.string()
});
var getPatientResponseOneCountryMax = 100;
var getPatientResponseOneStateMax = 100;
var getPatientResponseOneCityMax = 100;
var getPatientResponseOnePincodeMax = 12;
var getPatientResponseOneAgeMin = 0;
var getPatientResponseOneAgeMax = 130;
var GetPatientResponse = zod.object({
  "country": zod.string().max(getPatientResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(getPatientResponseOneStateMax).optional(),
  "city": zod.string().max(getPatientResponseOneCityMax).optional(),
  "pincode": zod.string().max(getPatientResponseOnePincodeMax).optional(),
  "fullName": zod.string().min(1),
  "mobile": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "age": zod.number().int().min(getPatientResponseOneAgeMin).max(getPatientResponseOneAgeMax).optional(),
  "ageReferenceDate": zod.coerce.date().nullish().describe("Date an approximate age was entered; absent on legacy estimates. Never an exact DOB."),
  "gender": zod.string().optional(),
  "address": zod.string().optional(),
  "emergencyContactName": zod.string().optional(),
  "emergencyContactPhone": zod.string().optional(),
  "clinicId": zod.string().optional(),
  "branchId": zod.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "userId": zod.string().nullish(),
  "mobileVerified": zod.boolean(),
  "createdAt": zod.coerce.date()
}));
var UpdatePatientParams = zod.object({
  "id": zod.coerce.string()
});
var updatePatientBodyCountryMax = 100;
var updatePatientBodyStateMax = 100;
var updatePatientBodyCityMax = 100;
var updatePatientBodyPincodeMax = 12;
var updatePatientBodyAgeMin = 0;
var updatePatientBodyAgeMax = 130;
var UpdatePatientBody = zod.object({
  "country": zod.string().max(updatePatientBodyCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updatePatientBodyStateMax).optional(),
  "city": zod.string().max(updatePatientBodyCityMax).optional(),
  "pincode": zod.string().max(updatePatientBodyPincodeMax).optional(),
  "fullName": zod.string().min(1),
  "mobile": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "age": zod.number().int().min(updatePatientBodyAgeMin).max(updatePatientBodyAgeMax).optional(),
  "gender": zod.string().optional(),
  "address": zod.string().optional(),
  "emergencyContactName": zod.string().optional(),
  "emergencyContactPhone": zod.string().optional(),
  "clinicId": zod.string().optional(),
  "branchId": zod.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var updatePatientResponseOneCountryMax = 100;
var updatePatientResponseOneStateMax = 100;
var updatePatientResponseOneCityMax = 100;
var updatePatientResponseOnePincodeMax = 12;
var updatePatientResponseOneAgeMin = 0;
var updatePatientResponseOneAgeMax = 130;
var UpdatePatientResponse = zod.object({
  "country": zod.string().max(updatePatientResponseOneCountryMax).optional().describe("ISO-2 or name; new entries default to IN"),
  "state": zod.string().max(updatePatientResponseOneStateMax).optional(),
  "city": zod.string().max(updatePatientResponseOneCityMax).optional(),
  "pincode": zod.string().max(updatePatientResponseOnePincodeMax).optional(),
  "fullName": zod.string().min(1),
  "mobile": zod.string().nullish(),
  "email": zod.string().email().nullish(),
  "dateOfBirth": zod.coerce.date().nullish(),
  "age": zod.number().int().min(updatePatientResponseOneAgeMin).max(updatePatientResponseOneAgeMax).optional(),
  "ageReferenceDate": zod.coerce.date().nullish().describe("Date an approximate age was entered; absent on legacy estimates. Never an exact DOB."),
  "gender": zod.string().optional(),
  "address": zod.string().optional(),
  "emergencyContactName": zod.string().optional(),
  "emergencyContactPhone": zod.string().optional(),
  "clinicId": zod.string().optional(),
  "branchId": zod.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
}).and(zod.object({
  "id": zod.string(),
  "code": zod.string(),
  "userId": zod.string().nullish(),
  "mobileVerified": zod.boolean(),
  "createdAt": zod.coerce.date()
}));
var DeletePatientParams = zod.object({
  "id": zod.coerce.string()
});
var DeletePatientResponse = zod.void();
var listMastersQueryPageDefault = 1;
var listMastersQueryPageSizeDefault = 20;
var listMastersQueryPageSizeMax = 100;
var ListMastersQueryParams = zod.object({
  "category": zod.coerce.string().optional(),
  "parentId": zod.coerce.string().optional(),
  "search": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "page": zod.coerce.number().int().min(1).default(listMastersQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listMastersQueryPageSizeMax).default(listMastersQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listMastersResponseOneTotalMin = 0;
var ListMastersResponse = zod.object({
  "total": zod.number().int().min(listMastersResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
    "name": zod.string().min(1),
    "code": zod.string().min(1),
    "parentId": zod.string().nullish(),
    "sortOrder": zod.number().int().optional(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string()
  })))
}));
var CreateMasterBody = zod.object({
  "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": zod.string().min(1),
  "code": zod.string().min(1),
  "parentId": zod.string().nullish(),
  "sortOrder": zod.number().int().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var CreateMasterResponse = zod.object({
  "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": zod.string().min(1),
  "code": zod.string().min(1),
  "parentId": zod.string().nullish(),
  "sortOrder": zod.number().int().optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string()
}));
var GetMasterParams = zod.object({
  "id": zod.coerce.string()
});
var GetMasterResponse = zod.object({
  "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": zod.string().min(1),
  "code": zod.string().min(1),
  "parentId": zod.string().nullish(),
  "sortOrder": zod.number().int().optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string()
}));
var UpdateMasterParams = zod.object({
  "id": zod.coerce.string()
});
var UpdateMasterBody = zod.object({
  "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": zod.string().min(1),
  "code": zod.string().min(1),
  "parentId": zod.string().nullish(),
  "sortOrder": zod.number().int().optional(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var UpdateMasterResponse = zod.object({
  "category": zod.enum(["country", "state", "city", "area", "pincode", "clinicType", "clinicCategory", "clinicStatus", "specialization", "qualification", "department", "consultationType", "appointmentStatus", "appointmentType", "bookingSource", "cancellationReason", "queueStatus", "tokenPrefix", "queueType", "queuePriority", "userRole", "userStatus"]),
  "name": zod.string().min(1),
  "code": zod.string().min(1),
  "parentId": zod.string().nullish(),
  "sortOrder": zod.number().int().optional(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string()
}));
var DeleteMasterParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteMasterResponse = zod.void();
var GetScheduleDayContextQueryParams = zod.object({
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string()
});
var getScheduleDayContextResponseItemsItemOneExpectedSnapshotMax = 2e4;
var getScheduleDayContextResponseItemsItemOneDayOfWeekMin = 0;
var getScheduleDayContextResponseItemsItemOneDayOfWeekMax = 6;
var getScheduleDayContextResponseItemsItemOneStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var getScheduleDayContextResponseItemsItemOneTimezoneDefault = `Asia/Kolkata`;
var getScheduleDayContextResponseItemsItemOneTokenPrefixMax = 8;
var getScheduleDayContextResponseItemsItemOneMaxTokensMax = 1e3;
var getScheduleDayContextResponseItemsItemOneBufferMinutesDefault = 0;
var getScheduleDayContextResponseItemsItemOneBufferMinutesMin = 0;
var getScheduleDayContextResponseItemsItemOneBufferMinutesMax = 1440;
var getScheduleDayContextResponseItemsItemOneQueueModeDefault = `mixed`;
var getScheduleDayContextResponseDaysItemDayOfWeekMin = 0;
var getScheduleDayContextResponseDaysItemDayOfWeekMax = 6;
var GetScheduleDayContextResponse = zod.object({
  "items": zod.array(zod.object({
    "expectedSnapshot": zod.string().max(getScheduleDayContextResponseItemsItemOneExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "dayOfWeek": zod.number().int().min(getScheduleDayContextResponseItemsItemOneDayOfWeekMin).max(getScheduleDayContextResponseItemsItemOneDayOfWeekMax).describe("Sunday is 0"),
    "isOpen": zod.boolean(),
    "startTime": zod.string().regex(getScheduleDayContextResponseItemsItemOneStartTimeRegExp),
    "endTime": zod.string(),
    "breakStart": zod.string().nullish(),
    "breakEnd": zod.string().nullish(),
    "timezone": zod.string().default(getScheduleDayContextResponseItemsItemOneTimezoneDefault),
    "tokenPrefix": zod.string().min(1).max(getScheduleDayContextResponseItemsItemOneTokenPrefixMax),
    "maxTokens": zod.number().int().min(1).max(getScheduleDayContextResponseItemsItemOneMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1),
    "bufferMinutes": zod.number().int().min(getScheduleDayContextResponseItemsItemOneBufferMinutesMin).max(getScheduleDayContextResponseItemsItemOneBufferMinutesMax).default(getScheduleDayContextResponseItemsItemOneBufferMinutesDefault),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(getScheduleDayContextResponseItemsItemOneQueueModeDefault),
    "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
    "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
  }).and(zod.object({
    "status": zod.string().optional(),
    "linkedBranchId": zod.string().nullish(),
    "draftKey": zod.string().optional(),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "doctorName": zod.string().optional(),
    "clinicName": zod.string().optional(),
    "branchName": zod.string().optional()
  }))),
  "days": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(getScheduleDayContextResponseDaysItemDayOfWeekMin).max(getScheduleDayContextResponseDaysItemDayOfWeekMax),
    "following": zod.boolean(),
    "custom": zod.boolean(),
    "snapshot": zod.string()
  }))
});
var saveScheduleDayOverrideBodyDayOfWeekMin = 0;
var saveScheduleDayOverrideBodyDayOfWeekMax = 6;
var saveScheduleDayOverrideBodyExpectedSnapshotMax = 2e5;
var saveScheduleDayOverrideBodyRequestIdMin = 10;
var saveScheduleDayOverrideBodyRequestIdMax = 100;
var saveScheduleDayOverrideBodySessionsItemKeyMax = 100;
var saveScheduleDayOverrideBodySessionsItemSessionExpectedSnapshotMax = 2e4;
var saveScheduleDayOverrideBodySessionsItemSessionDayOfWeekMin = 0;
var saveScheduleDayOverrideBodySessionsItemSessionDayOfWeekMax = 6;
var saveScheduleDayOverrideBodySessionsItemSessionStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var saveScheduleDayOverrideBodySessionsItemSessionTimezoneDefault = `Asia/Kolkata`;
var saveScheduleDayOverrideBodySessionsItemSessionTokenPrefixMax = 8;
var saveScheduleDayOverrideBodySessionsItemSessionMaxTokensMax = 1e3;
var saveScheduleDayOverrideBodySessionsItemSessionBufferMinutesDefault = 0;
var saveScheduleDayOverrideBodySessionsItemSessionBufferMinutesMin = 0;
var saveScheduleDayOverrideBodySessionsItemSessionBufferMinutesMax = 1440;
var saveScheduleDayOverrideBodySessionsItemSessionQueueModeDefault = `mixed`;
var SaveScheduleDayOverrideBody = zod.object({
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "dayOfWeek": zod.number().int().min(saveScheduleDayOverrideBodyDayOfWeekMin).max(saveScheduleDayOverrideBodyDayOfWeekMax),
  "isOpen": zod.boolean(),
  "confirmed": zod.literal(true),
  "expectedSnapshot": zod.string().max(saveScheduleDayOverrideBodyExpectedSnapshotMax),
  "requestId": zod.string().min(saveScheduleDayOverrideBodyRequestIdMin).max(saveScheduleDayOverrideBodyRequestIdMax),
  "sessions": zod.array(zod.object({
    "key": zod.string().max(saveScheduleDayOverrideBodySessionsItemKeyMax),
    "id": zod.string().optional(),
    "session": zod.object({
      "expectedSnapshot": zod.string().max(saveScheduleDayOverrideBodySessionsItemSessionExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
      "doctorId": zod.string(),
      "clinicId": zod.string(),
      "branchId": zod.string(),
      "dayOfWeek": zod.number().int().min(saveScheduleDayOverrideBodySessionsItemSessionDayOfWeekMin).max(saveScheduleDayOverrideBodySessionsItemSessionDayOfWeekMax).describe("Sunday is 0"),
      "isOpen": zod.boolean(),
      "startTime": zod.string().regex(saveScheduleDayOverrideBodySessionsItemSessionStartTimeRegExp),
      "endTime": zod.string(),
      "breakStart": zod.string().nullish(),
      "breakEnd": zod.string().nullish(),
      "timezone": zod.string().default(saveScheduleDayOverrideBodySessionsItemSessionTimezoneDefault),
      "tokenPrefix": zod.string().min(1).max(saveScheduleDayOverrideBodySessionsItemSessionTokenPrefixMax),
      "maxTokens": zod.number().int().min(1).max(saveScheduleDayOverrideBodySessionsItemSessionMaxTokensMax),
      "consultationMinutes": zod.number().int().min(1),
      "bufferMinutes": zod.number().int().min(saveScheduleDayOverrideBodySessionsItemSessionBufferMinutesMin).max(saveScheduleDayOverrideBodySessionsItemSessionBufferMinutesMax).default(saveScheduleDayOverrideBodySessionsItemSessionBufferMinutesDefault),
      "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(saveScheduleDayOverrideBodySessionsItemSessionQueueModeDefault),
      "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
      "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
    })
  }))
});
var saveScheduleDayOverrideResponseItemsItemOneExpectedSnapshotMax = 2e4;
var saveScheduleDayOverrideResponseItemsItemOneDayOfWeekMin = 0;
var saveScheduleDayOverrideResponseItemsItemOneDayOfWeekMax = 6;
var saveScheduleDayOverrideResponseItemsItemOneStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var saveScheduleDayOverrideResponseItemsItemOneTimezoneDefault = `Asia/Kolkata`;
var saveScheduleDayOverrideResponseItemsItemOneTokenPrefixMax = 8;
var saveScheduleDayOverrideResponseItemsItemOneMaxTokensMax = 1e3;
var saveScheduleDayOverrideResponseItemsItemOneBufferMinutesDefault = 0;
var saveScheduleDayOverrideResponseItemsItemOneBufferMinutesMin = 0;
var saveScheduleDayOverrideResponseItemsItemOneBufferMinutesMax = 1440;
var saveScheduleDayOverrideResponseItemsItemOneQueueModeDefault = `mixed`;
var saveScheduleDayOverrideResponseDaysItemDayOfWeekMin = 0;
var saveScheduleDayOverrideResponseDaysItemDayOfWeekMax = 6;
var SaveScheduleDayOverrideResponse = zod.object({
  "items": zod.array(zod.object({
    "expectedSnapshot": zod.string().max(saveScheduleDayOverrideResponseItemsItemOneExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "dayOfWeek": zod.number().int().min(saveScheduleDayOverrideResponseItemsItemOneDayOfWeekMin).max(saveScheduleDayOverrideResponseItemsItemOneDayOfWeekMax).describe("Sunday is 0"),
    "isOpen": zod.boolean(),
    "startTime": zod.string().regex(saveScheduleDayOverrideResponseItemsItemOneStartTimeRegExp),
    "endTime": zod.string(),
    "breakStart": zod.string().nullish(),
    "breakEnd": zod.string().nullish(),
    "timezone": zod.string().default(saveScheduleDayOverrideResponseItemsItemOneTimezoneDefault),
    "tokenPrefix": zod.string().min(1).max(saveScheduleDayOverrideResponseItemsItemOneTokenPrefixMax),
    "maxTokens": zod.number().int().min(1).max(saveScheduleDayOverrideResponseItemsItemOneMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1),
    "bufferMinutes": zod.number().int().min(saveScheduleDayOverrideResponseItemsItemOneBufferMinutesMin).max(saveScheduleDayOverrideResponseItemsItemOneBufferMinutesMax).default(saveScheduleDayOverrideResponseItemsItemOneBufferMinutesDefault),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(saveScheduleDayOverrideResponseItemsItemOneQueueModeDefault),
    "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
    "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
  }).and(zod.object({
    "status": zod.string().optional(),
    "linkedBranchId": zod.string().nullish(),
    "draftKey": zod.string().optional(),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "doctorName": zod.string().optional(),
    "clinicName": zod.string().optional(),
    "branchName": zod.string().optional()
  }))),
  "days": zod.array(zod.object({
    "dayOfWeek": zod.number().int().min(saveScheduleDayOverrideResponseDaysItemDayOfWeekMin).max(saveScheduleDayOverrideResponseDaysItemDayOfWeekMax),
    "following": zod.boolean(),
    "custom": zod.boolean(),
    "snapshot": zod.string()
  }))
});
var listSchedulesQueryDayOfWeekMin = 0;
var listSchedulesQueryDayOfWeekMax = 6;
var listSchedulesQueryWeekdayMin = 0;
var listSchedulesQueryWeekdayMax = 6;
var listSchedulesQueryPageDefault = 1;
var listSchedulesQueryPageSizeDefault = 20;
var listSchedulesQueryPageSizeMax = 100;
var ListSchedulesQueryParams = zod.object({
  "search": zod.coerce.string().optional(),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "dayOfWeek": zod.coerce.number().int().min(listSchedulesQueryDayOfWeekMin).max(listSchedulesQueryDayOfWeekMax).optional(),
  "weekday": zod.coerce.number().int().min(listSchedulesQueryWeekdayMin).max(listSchedulesQueryWeekdayMax).optional().describe("Alias for dayOfWeek"),
  "doctorId": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(listSchedulesQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listSchedulesQueryPageSizeMax).default(listSchedulesQueryPageSizeDefault)
});
var listSchedulesResponseOneTotalMin = 0;
var listSchedulesResponseTwoItemsItemOneExpectedSnapshotMax = 2e4;
var listSchedulesResponseTwoItemsItemOneDayOfWeekMin = 0;
var listSchedulesResponseTwoItemsItemOneDayOfWeekMax = 6;
var listSchedulesResponseTwoItemsItemOneStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var listSchedulesResponseTwoItemsItemOneTimezoneDefault = `Asia/Kolkata`;
var listSchedulesResponseTwoItemsItemOneTokenPrefixMax = 8;
var listSchedulesResponseTwoItemsItemOneMaxTokensMax = 1e3;
var listSchedulesResponseTwoItemsItemOneBufferMinutesDefault = 0;
var listSchedulesResponseTwoItemsItemOneBufferMinutesMin = 0;
var listSchedulesResponseTwoItemsItemOneBufferMinutesMax = 1440;
var listSchedulesResponseTwoItemsItemOneQueueModeDefault = `mixed`;
var ListSchedulesResponse = zod.object({
  "total": zod.number().int().min(listSchedulesResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "expectedSnapshot": zod.string().max(listSchedulesResponseTwoItemsItemOneExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "dayOfWeek": zod.number().int().min(listSchedulesResponseTwoItemsItemOneDayOfWeekMin).max(listSchedulesResponseTwoItemsItemOneDayOfWeekMax).describe("Sunday is 0"),
    "isOpen": zod.boolean(),
    "startTime": zod.string().regex(listSchedulesResponseTwoItemsItemOneStartTimeRegExp),
    "endTime": zod.string(),
    "breakStart": zod.string().nullish(),
    "breakEnd": zod.string().nullish(),
    "timezone": zod.string().default(listSchedulesResponseTwoItemsItemOneTimezoneDefault),
    "tokenPrefix": zod.string().min(1).max(listSchedulesResponseTwoItemsItemOneTokenPrefixMax),
    "maxTokens": zod.number().int().min(1).max(listSchedulesResponseTwoItemsItemOneMaxTokensMax),
    "consultationMinutes": zod.number().int().min(1),
    "bufferMinutes": zod.number().int().min(listSchedulesResponseTwoItemsItemOneBufferMinutesMin).max(listSchedulesResponseTwoItemsItemOneBufferMinutesMax).default(listSchedulesResponseTwoItemsItemOneBufferMinutesDefault),
    "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(listSchedulesResponseTwoItemsItemOneQueueModeDefault),
    "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
    "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
  }).and(zod.object({
    "status": zod.string().optional(),
    "linkedBranchId": zod.string().nullish(),
    "draftKey": zod.string().optional(),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "doctorName": zod.string().optional(),
    "clinicName": zod.string().optional(),
    "branchName": zod.string().optional()
  })))
}));
var createScheduleBodyExpectedSnapshotMax = 2e4;
var createScheduleBodyDayOfWeekMin = 0;
var createScheduleBodyDayOfWeekMax = 6;
var createScheduleBodyStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var createScheduleBodyTimezoneDefault = `Asia/Kolkata`;
var createScheduleBodyTokenPrefixMax = 8;
var createScheduleBodyMaxTokensMax = 1e3;
var createScheduleBodyBufferMinutesDefault = 0;
var createScheduleBodyBufferMinutesMin = 0;
var createScheduleBodyBufferMinutesMax = 1440;
var createScheduleBodyQueueModeDefault = `mixed`;
var CreateScheduleBody = zod.object({
  "expectedSnapshot": zod.string().max(createScheduleBodyExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "dayOfWeek": zod.number().int().min(createScheduleBodyDayOfWeekMin).max(createScheduleBodyDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": zod.boolean(),
  "startTime": zod.string().regex(createScheduleBodyStartTimeRegExp),
  "endTime": zod.string(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().default(createScheduleBodyTimezoneDefault),
  "tokenPrefix": zod.string().min(1).max(createScheduleBodyTokenPrefixMax),
  "maxTokens": zod.number().int().min(1).max(createScheduleBodyMaxTokensMax),
  "consultationMinutes": zod.number().int().min(1),
  "bufferMinutes": zod.number().int().min(createScheduleBodyBufferMinutesMin).max(createScheduleBodyBufferMinutesMax).default(createScheduleBodyBufferMinutesDefault),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(createScheduleBodyQueueModeDefault),
  "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
  "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
});
var createScheduleResponseOneExpectedSnapshotMax = 2e4;
var createScheduleResponseOneDayOfWeekMin = 0;
var createScheduleResponseOneDayOfWeekMax = 6;
var createScheduleResponseOneStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var createScheduleResponseOneTimezoneDefault = `Asia/Kolkata`;
var createScheduleResponseOneTokenPrefixMax = 8;
var createScheduleResponseOneMaxTokensMax = 1e3;
var createScheduleResponseOneBufferMinutesDefault = 0;
var createScheduleResponseOneBufferMinutesMin = 0;
var createScheduleResponseOneBufferMinutesMax = 1440;
var createScheduleResponseOneQueueModeDefault = `mixed`;
var CreateScheduleResponse = zod.object({
  "expectedSnapshot": zod.string().max(createScheduleResponseOneExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "dayOfWeek": zod.number().int().min(createScheduleResponseOneDayOfWeekMin).max(createScheduleResponseOneDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": zod.boolean(),
  "startTime": zod.string().regex(createScheduleResponseOneStartTimeRegExp),
  "endTime": zod.string(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().default(createScheduleResponseOneTimezoneDefault),
  "tokenPrefix": zod.string().min(1).max(createScheduleResponseOneTokenPrefixMax),
  "maxTokens": zod.number().int().min(1).max(createScheduleResponseOneMaxTokensMax),
  "consultationMinutes": zod.number().int().min(1),
  "bufferMinutes": zod.number().int().min(createScheduleResponseOneBufferMinutesMin).max(createScheduleResponseOneBufferMinutesMax).default(createScheduleResponseOneBufferMinutesDefault),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(createScheduleResponseOneQueueModeDefault),
  "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
  "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
}).and(zod.object({
  "status": zod.string().optional(),
  "linkedBranchId": zod.string().nullish(),
  "draftKey": zod.string().optional(),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "doctorName": zod.string().optional(),
  "clinicName": zod.string().optional(),
  "branchName": zod.string().optional()
}));
var UpdateScheduleParams = zod.object({
  "id": zod.coerce.string()
});
var updateScheduleBodyExpectedSnapshotMax = 2e4;
var updateScheduleBodyDayOfWeekMin = 0;
var updateScheduleBodyDayOfWeekMax = 6;
var updateScheduleBodyStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var updateScheduleBodyTimezoneDefault = `Asia/Kolkata`;
var updateScheduleBodyTokenPrefixMax = 8;
var updateScheduleBodyMaxTokensMax = 1e3;
var updateScheduleBodyBufferMinutesDefault = 0;
var updateScheduleBodyBufferMinutesMin = 0;
var updateScheduleBodyBufferMinutesMax = 1440;
var updateScheduleBodyQueueModeDefault = `mixed`;
var UpdateScheduleBody = zod.object({
  "expectedSnapshot": zod.string().max(updateScheduleBodyExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "dayOfWeek": zod.number().int().min(updateScheduleBodyDayOfWeekMin).max(updateScheduleBodyDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": zod.boolean(),
  "startTime": zod.string().regex(updateScheduleBodyStartTimeRegExp),
  "endTime": zod.string(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().default(updateScheduleBodyTimezoneDefault),
  "tokenPrefix": zod.string().min(1).max(updateScheduleBodyTokenPrefixMax),
  "maxTokens": zod.number().int().min(1).max(updateScheduleBodyMaxTokensMax),
  "consultationMinutes": zod.number().int().min(1),
  "bufferMinutes": zod.number().int().min(updateScheduleBodyBufferMinutesMin).max(updateScheduleBodyBufferMinutesMax).default(updateScheduleBodyBufferMinutesDefault),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(updateScheduleBodyQueueModeDefault),
  "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
  "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
});
var updateScheduleResponseOneExpectedSnapshotMax = 2e4;
var updateScheduleResponseOneDayOfWeekMin = 0;
var updateScheduleResponseOneDayOfWeekMax = 6;
var updateScheduleResponseOneStartTimeRegExp = new RegExp("^[0-2][0-9]:[0-5][0-9]$");
var updateScheduleResponseOneTimezoneDefault = `Asia/Kolkata`;
var updateScheduleResponseOneTokenPrefixMax = 8;
var updateScheduleResponseOneMaxTokensMax = 1e3;
var updateScheduleResponseOneBufferMinutesDefault = 0;
var updateScheduleResponseOneBufferMinutesMin = 0;
var updateScheduleResponseOneBufferMinutesMax = 1440;
var updateScheduleResponseOneQueueModeDefault = `mixed`;
var UpdateScheduleResponse = zod.object({
  "expectedSnapshot": zod.string().max(updateScheduleResponseOneExpectedSnapshotMax).optional().describe("Optional loaded authoring snapshot for updates. Compared under the schedule locks; mismatch returns 409 without writes. Not stored. Older clients may omit it."),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "dayOfWeek": zod.number().int().min(updateScheduleResponseOneDayOfWeekMin).max(updateScheduleResponseOneDayOfWeekMax).describe("Sunday is 0"),
  "isOpen": zod.boolean(),
  "startTime": zod.string().regex(updateScheduleResponseOneStartTimeRegExp),
  "endTime": zod.string(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "timezone": zod.string().default(updateScheduleResponseOneTimezoneDefault),
  "tokenPrefix": zod.string().min(1).max(updateScheduleResponseOneTokenPrefixMax),
  "maxTokens": zod.number().int().min(1).max(updateScheduleResponseOneMaxTokensMax),
  "consultationMinutes": zod.number().int().min(1),
  "bufferMinutes": zod.number().int().min(updateScheduleResponseOneBufferMinutesMin).max(updateScheduleResponseOneBufferMinutesMax).default(updateScheduleResponseOneBufferMinutesDefault),
  "queueMode": zod.enum(["mixed", "appointmentsOnly", "walkInsOnly"]).default(updateScheduleResponseOneQueueModeDefault),
  "queueOpenTime": zod.string().nullish().describe("Null clears an optional queue opening override."),
  "queueCloseTime": zod.string().nullish().describe("Null clears an optional queue closing override.")
}).and(zod.object({
  "status": zod.string().optional(),
  "linkedBranchId": zod.string().nullish(),
  "draftKey": zod.string().optional(),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "doctorName": zod.string().optional(),
  "clinicName": zod.string().optional(),
  "branchName": zod.string().optional()
}));
var DeleteScheduleParams = zod.object({
  "id": zod.coerce.string()
});
var deleteScheduleQueryExpectedSnapshotMax = 2e4;
var DeleteScheduleQueryParams = zod.object({
  "expectedSnapshot": zod.coerce.string().max(deleteScheduleQueryExpectedSnapshotMax).optional().describe("Optional loaded schedule authoring snapshot. Compared after acquiring doctor locks; stale changes return 409. Deactivation retains history.")
});
var DeleteScheduleResponse = zod.void();
var listAvailabilityExceptionsQueryPageDefault = 1;
var listAvailabilityExceptionsQueryPageSizeDefault = 20;
var listAvailabilityExceptionsQueryPageSizeMax = 100;
var ListAvailabilityExceptionsQueryParams = zod.object({
  "search": zod.coerce.string().optional(),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "date": zod.date().optional(),
  "doctorId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "page": zod.coerce.number().int().min(1).default(listAvailabilityExceptionsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listAvailabilityExceptionsQueryPageSizeMax).default(listAvailabilityExceptionsQueryPageSizeDefault)
});
var listAvailabilityExceptionsResponseOneTotalMin = 0;
var listAvailabilityExceptionsResponseTwoItemsItemOneMaxTokensMax = 1e3;
var ListAvailabilityExceptionsResponse = zod.object({
  "total": zod.number().int().min(listAvailabilityExceptionsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "sessionId": zod.string().optional(),
    "doctorId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "isClosed": zod.boolean(),
    "isExtra": zod.boolean().optional().describe("Adds a bookable session on this date only (requires startTime, endTime, maxTokens; no sessionId)."),
    "reason": zod.string(),
    "startTime": zod.string().nullish(),
    "endTime": zod.string().nullish(),
    "breakStart": zod.string().nullish(),
    "breakEnd": zod.string().nullish(),
    "maxTokens": zod.number().int().min(1).max(listAvailabilityExceptionsResponseTwoItemsItemOneMaxTokensMax).nullish()
  }).and(zod.object({
    "id": zod.string()
  })))
}));
var createAvailabilityExceptionBodyMaxTokensMax = 1e3;
var CreateAvailabilityExceptionBody = zod.object({
  "sessionId": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "isClosed": zod.boolean(),
  "isExtra": zod.boolean().optional().describe("Adds a bookable session on this date only (requires startTime, endTime, maxTokens; no sessionId)."),
  "reason": zod.string(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "maxTokens": zod.number().int().min(1).max(createAvailabilityExceptionBodyMaxTokensMax).nullish()
});
var createAvailabilityExceptionResponseOneMaxTokensMax = 1e3;
var CreateAvailabilityExceptionResponse = zod.object({
  "sessionId": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "isClosed": zod.boolean(),
  "isExtra": zod.boolean().optional().describe("Adds a bookable session on this date only (requires startTime, endTime, maxTokens; no sessionId)."),
  "reason": zod.string(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "maxTokens": zod.number().int().min(1).max(createAvailabilityExceptionResponseOneMaxTokensMax).nullish()
}).and(zod.object({
  "id": zod.string()
}));
var UpdateAvailabilityExceptionParams = zod.object({
  "id": zod.coerce.string()
});
var updateAvailabilityExceptionBodyMaxTokensMax = 1e3;
var UpdateAvailabilityExceptionBody = zod.object({
  "sessionId": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "isClosed": zod.boolean(),
  "isExtra": zod.boolean().optional().describe("Adds a bookable session on this date only (requires startTime, endTime, maxTokens; no sessionId)."),
  "reason": zod.string(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "maxTokens": zod.number().int().min(1).max(updateAvailabilityExceptionBodyMaxTokensMax).nullish()
});
var updateAvailabilityExceptionResponseOneMaxTokensMax = 1e3;
var UpdateAvailabilityExceptionResponse = zod.object({
  "sessionId": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "isClosed": zod.boolean(),
  "isExtra": zod.boolean().optional().describe("Adds a bookable session on this date only (requires startTime, endTime, maxTokens; no sessionId)."),
  "reason": zod.string(),
  "startTime": zod.string().nullish(),
  "endTime": zod.string().nullish(),
  "breakStart": zod.string().nullish(),
  "breakEnd": zod.string().nullish(),
  "maxTokens": zod.number().int().min(1).max(updateAvailabilityExceptionResponseOneMaxTokensMax).nullish()
}).and(zod.object({
  "id": zod.string()
}));
var DeleteAvailabilityExceptionParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteAvailabilityExceptionResponse = zod.void();
var listAppointmentsQueryPageDefault = 1;
var listAppointmentsQueryPageSizeDefault = 20;
var listAppointmentsQueryPageSizeMax = 100;
var ListAppointmentsQueryParams = zod.object({
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional(),
  "statusGroup": zod.enum(["active", "waiting", "absent", "completed", "cancelled", "all"]).optional().describe("Server-side group filter applied before pagination; intersects with status when both supplied"),
  "search": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "patientId": zod.coerce.string().optional(),
  "date": zod.date().optional(),
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]).optional(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]).optional(),
  "page": zod.coerce.number().int().min(1).default(listAppointmentsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listAppointmentsQueryPageSizeMax).default(listAppointmentsQueryPageSizeDefault),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order")
});
var listAppointmentsResponseOneTotalMin = 0;
var listAppointmentsResponseTwoItemsItemOneNotesMax = 1e3;
var listAppointmentsResponseTwoItemsItemTwoBookingDetailsRevisionMin = 0;
var ListAppointmentsResponse = zod.object({
  "total": zod.number().int().min(listAppointmentsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "statusCounts": zod.object({
    "active": zod.number().int().optional(),
    "waiting": zod.number().int().optional(),
    "absent": zod.number().int().optional(),
    "completed": zod.number().int().optional(),
    "cancelled": zod.number().int().optional(),
    "all": zod.number().int().optional()
  }).optional(),
  "items": zod.array(zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(listAppointmentsResponseTwoItemsItemOneNotesMax).optional()
  }).and(zod.object({
    "estimate": zod.object({
      "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
      "basis": zod.enum(["sessionStart", "remainingQueue"]),
      "asOf": zod.string(),
      "patientsAhead": zod.number().int().nullable(),
      "waitMinutes": zod.number().int().nullable(),
      "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
      "beyondSessionEnd": zod.boolean(),
      "guidance": zod.string()
    }).optional(),
    "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
    "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "privatePatient": zod.union([zod.object({
      "fullName": zod.string().nullish(),
      "code": zod.string().nullish(),
      "gender": zod.string().nullish(),
      "dateOfBirth": zod.string().nullish(),
      "age": zod.number().int().nullish(),
      "ageReferenceDate": zod.string().nullish(),
      "mobile": zod.string().nullish(),
      "email": zod.string().nullish(),
      "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
    }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
    "canReschedule": zod.boolean().optional(),
    "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
    "bookingDetailsRevision": zod.number().int().min(listAppointmentsResponseTwoItemsItemTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
    "movementReason": zod.string().nullish(),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
      "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
      "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional(),
    "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
  })))
}));
var createAppointmentBodyOneNotesMax = 1e3;
var createAppointmentBodyTwoBookingMobileMax = 16;
var createAppointmentBodyTwoBookingMobileRegExp = new RegExp("^\\+[1-9][0-9]{7,14}$");
var CreateAppointmentBody = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "patientId": zod.string(),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": zod.string().optional(),
  "consultationTypeId": zod.string().optional(),
  "qrReference": zod.string().optional(),
  "requestId": zod.string().optional().describe("Client-generated idempotency key"),
  "termsAccepted": zod.boolean().optional(),
  "notes": zod.string().max(createAppointmentBodyOneNotesMax).optional()
}).and(zod.object({
  "bookingMobile": zod.string().max(createAppointmentBodyTwoBookingMobileMax).regex(createAppointmentBodyTwoBookingMobileRegExp).describe("Required visit contact. Does not change patient or account contacts, verification or notification recipients.")
}));
var createAppointmentResponseOneNotesMax = 1e3;
var createAppointmentResponseTwoBookingDetailsRevisionMin = 0;
var CreateAppointmentResponse = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "patientId": zod.string(),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": zod.string().optional(),
  "consultationTypeId": zod.string().optional(),
  "qrReference": zod.string().optional(),
  "requestId": zod.string().optional().describe("Client-generated idempotency key"),
  "termsAccepted": zod.boolean().optional(),
  "notes": zod.string().max(createAppointmentResponseOneNotesMax).optional()
}).and(zod.object({
  "estimate": zod.object({
    "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
    "basis": zod.enum(["sessionStart", "remainingQueue"]),
    "asOf": zod.string(),
    "patientsAhead": zod.number().int().nullable(),
    "waitMinutes": zod.number().int().nullable(),
    "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
    "beyondSessionEnd": zod.boolean(),
    "guidance": zod.string()
  }).optional(),
  "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
  "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "reference": zod.string(),
  "token": zod.string(),
  "tokenNumber": zod.number().int().optional(),
  "queueRank": zod.number().optional(),
  "revision": zod.number().int().optional(),
  "expectedDurationMinutes": zod.number().int().nullish(),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": zod.string(),
  "patientCode": zod.string().optional(),
  "privatePatient": zod.union([zod.object({
    "fullName": zod.string().nullish(),
    "code": zod.string().nullish(),
    "gender": zod.string().nullish(),
    "dateOfBirth": zod.string().nullish(),
    "age": zod.number().int().nullish(),
    "ageReferenceDate": zod.string().nullish(),
    "mobile": zod.string().nullish(),
    "email": zod.string().nullish(),
    "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
  }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
  "doctorName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
  "startTime": zod.string().optional(),
  "endTime": zod.string().optional(),
  "createdAt": zod.coerce.date(),
  "checkedInAt": zod.coerce.date().nullish(),
  "calledAt": zod.coerce.date().nullish(),
  "consultationStartedAt": zod.coerce.date().nullish(),
  "completedAt": zod.coerce.date().nullish(),
  "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
  "canReschedule": zod.boolean().optional(),
  "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
  "bookingDetailsRevision": zod.number().int().min(createAppointmentResponseTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
  "movementReason": zod.string().nullish(),
  "history": zod.array(zod.object({
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": zod.coerce.date(),
    "reason": zod.string().optional(),
    "action": zod.string().optional(),
    "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
    "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
    "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
    "position": zod.number().int().optional(),
    "from": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional(),
    "to": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional()
  })).optional(),
  "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
}));
var UpdateAppointmentBookingParams = zod.object({
  "id": zod.coerce.string()
});
var updateAppointmentBookingBodyExpectedRevisionMin = 0;
var updateAppointmentBookingBodyExpectedBookingDetailsRevisionMin = 0;
var updateAppointmentBookingBodyBookingMobileMax = 16;
var updateAppointmentBookingBodyNotesMax = 1e3;
var UpdateAppointmentBookingBody = zod.object({
  "expectedRevision": zod.number().int().min(updateAppointmentBookingBodyExpectedRevisionMin),
  "expectedBookingDetailsRevision": zod.number().int().min(updateAppointmentBookingBodyExpectedBookingDetailsRevisionMin),
  "bookingMobile": zod.string().max(updateAppointmentBookingBodyBookingMobileMax),
  "notes": zod.string().max(updateAppointmentBookingBodyNotesMax)
});
var updateAppointmentBookingResponseOneNotesMax = 1e3;
var updateAppointmentBookingResponseTwoBookingDetailsRevisionMin = 0;
var UpdateAppointmentBookingResponse = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "patientId": zod.string(),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": zod.string().optional(),
  "consultationTypeId": zod.string().optional(),
  "qrReference": zod.string().optional(),
  "requestId": zod.string().optional().describe("Client-generated idempotency key"),
  "termsAccepted": zod.boolean().optional(),
  "notes": zod.string().max(updateAppointmentBookingResponseOneNotesMax).optional()
}).and(zod.object({
  "estimate": zod.object({
    "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
    "basis": zod.enum(["sessionStart", "remainingQueue"]),
    "asOf": zod.string(),
    "patientsAhead": zod.number().int().nullable(),
    "waitMinutes": zod.number().int().nullable(),
    "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
    "beyondSessionEnd": zod.boolean(),
    "guidance": zod.string()
  }).optional(),
  "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
  "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "reference": zod.string(),
  "token": zod.string(),
  "tokenNumber": zod.number().int().optional(),
  "queueRank": zod.number().optional(),
  "revision": zod.number().int().optional(),
  "expectedDurationMinutes": zod.number().int().nullish(),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": zod.string(),
  "patientCode": zod.string().optional(),
  "privatePatient": zod.union([zod.object({
    "fullName": zod.string().nullish(),
    "code": zod.string().nullish(),
    "gender": zod.string().nullish(),
    "dateOfBirth": zod.string().nullish(),
    "age": zod.number().int().nullish(),
    "ageReferenceDate": zod.string().nullish(),
    "mobile": zod.string().nullish(),
    "email": zod.string().nullish(),
    "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
  }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
  "doctorName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
  "startTime": zod.string().optional(),
  "endTime": zod.string().optional(),
  "createdAt": zod.coerce.date(),
  "checkedInAt": zod.coerce.date().nullish(),
  "calledAt": zod.coerce.date().nullish(),
  "consultationStartedAt": zod.coerce.date().nullish(),
  "completedAt": zod.coerce.date().nullish(),
  "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
  "canReschedule": zod.boolean().optional(),
  "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
  "bookingDetailsRevision": zod.number().int().min(updateAppointmentBookingResponseTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
  "movementReason": zod.string().nullish(),
  "history": zod.array(zod.object({
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": zod.coerce.date(),
    "reason": zod.string().optional(),
    "action": zod.string().optional(),
    "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
    "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
    "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
    "position": zod.number().int().optional(),
    "from": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional(),
    "to": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional()
  })).optional(),
  "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
}));
var GetBookingStatusSmsPreviewParams = zod.object({
  "id": zod.coerce.string()
});
var GetBookingStatusSmsPreviewResponse = zod.object({
  "eligible": zod.boolean(),
  "reason": zod.string(),
  "recipient": zod.string(),
  "message": zod.string(),
  "previewToken": zod.string()
});
var SendBookingStatusSmsParams = zod.object({
  "id": zod.coerce.string()
});
var sendBookingStatusSmsBodyPreviewTokenMin = 64;
var sendBookingStatusSmsBodyPreviewTokenMax = 64;
var SendBookingStatusSmsBody = zod.object({
  "requestId": zod.string().uuid(),
  "previewToken": zod.string().min(sendBookingStatusSmsBodyPreviewTokenMin).max(sendBookingStatusSmsBodyPreviewTokenMax)
});
var SendBookingStatusSmsResponse = zod.object({
  "state": zod.enum(["provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "blocked"]),
  "reason": zod.string().optional()
});
var GetTicketEmailPreviewParams = zod.object({
  "id": zod.coerce.string()
});
var GetTicketEmailPreviewResponse = zod.object({
  "recipient": zod.string(),
  "eligible": zod.boolean(),
  "reason": zod.string()
});
var SendTicketEmailParams = zod.object({
  "id": zod.coerce.string()
});
var SendTicketEmailBody = zod.object({
  "requestId": zod.string().uuid(),
  "recipient": zod.string().email()
});
var SendTicketEmailResponse = zod.object({
  "state": zod.enum(["provider_accepted", "unknown"])
});
var GetAppointmentCalendarQueryParams = zod.object({
  "from": zod.date(),
  "to": zod.date(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "status": zod.coerce.string().optional(),
  "search": zod.coerce.string().optional()
});
var GetAppointmentCalendarResponse = zod.object({
  "days": zod.array(zod.object({
    "date": zod.string(),
    "total": zod.number().int(),
    "byStatus": zod.record(zod.string(), zod.number().int())
  })),
  "total": zod.number().int()
});
var GetAppointmentParams = zod.object({
  "id": zod.coerce.string()
});
var getAppointmentResponseOneNotesMax = 1e3;
var getAppointmentResponseTwoBookingDetailsRevisionMin = 0;
var GetAppointmentResponse = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "patientId": zod.string(),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": zod.string().optional(),
  "consultationTypeId": zod.string().optional(),
  "qrReference": zod.string().optional(),
  "requestId": zod.string().optional().describe("Client-generated idempotency key"),
  "termsAccepted": zod.boolean().optional(),
  "notes": zod.string().max(getAppointmentResponseOneNotesMax).optional()
}).and(zod.object({
  "estimate": zod.object({
    "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
    "basis": zod.enum(["sessionStart", "remainingQueue"]),
    "asOf": zod.string(),
    "patientsAhead": zod.number().int().nullable(),
    "waitMinutes": zod.number().int().nullable(),
    "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
    "beyondSessionEnd": zod.boolean(),
    "guidance": zod.string()
  }).optional(),
  "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
  "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "reference": zod.string(),
  "token": zod.string(),
  "tokenNumber": zod.number().int().optional(),
  "queueRank": zod.number().optional(),
  "revision": zod.number().int().optional(),
  "expectedDurationMinutes": zod.number().int().nullish(),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": zod.string(),
  "patientCode": zod.string().optional(),
  "privatePatient": zod.union([zod.object({
    "fullName": zod.string().nullish(),
    "code": zod.string().nullish(),
    "gender": zod.string().nullish(),
    "dateOfBirth": zod.string().nullish(),
    "age": zod.number().int().nullish(),
    "ageReferenceDate": zod.string().nullish(),
    "mobile": zod.string().nullish(),
    "email": zod.string().nullish(),
    "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
  }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
  "doctorName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
  "startTime": zod.string().optional(),
  "endTime": zod.string().optional(),
  "createdAt": zod.coerce.date(),
  "checkedInAt": zod.coerce.date().nullish(),
  "calledAt": zod.coerce.date().nullish(),
  "consultationStartedAt": zod.coerce.date().nullish(),
  "completedAt": zod.coerce.date().nullish(),
  "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
  "canReschedule": zod.boolean().optional(),
  "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
  "bookingDetailsRevision": zod.number().int().min(getAppointmentResponseTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
  "movementReason": zod.string().nullish(),
  "history": zod.array(zod.object({
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": zod.coerce.date(),
    "reason": zod.string().optional(),
    "action": zod.string().optional(),
    "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
    "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
    "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
    "position": zod.number().int().optional(),
    "from": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional(),
    "to": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional()
  })).optional(),
  "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
}));
var GetAppointmentHistoryParams = zod.object({
  "id": zod.coerce.string()
});
var GetAppointmentHistoryQueryParams = zod.object({
  "cursor": zod.coerce.string().optional()
});
var GetAppointmentHistoryResponse = zod.object({
  "history": zod.union([zod.array(zod.object({
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": zod.coerce.date(),
    "reason": zod.string().optional(),
    "action": zod.string().optional(),
    "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
    "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
    "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
    "position": zod.number().int().optional(),
    "from": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional(),
    "to": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional()
  })), zod.null()]).describe("Null for legacy visits without a recorded history; an empty array means no events in this page."),
  "nextCursor": zod.string().nullable()
});
var GetAppointmentQrParams = zod.object({
  "id": zod.coerce.string()
});
var GetAppointmentQrResponse = zod.object({
  "appointmentId": zod.string(),
  "payload": zod.string(),
  "checkInUrl": zod.string()
});
var ResolveAppointmentQrBody = zod.object({
  "payload": zod.string().min(1)
});
var resolveAppointmentQrResponseAppointmentOneNotesMax = 1e3;
var resolveAppointmentQrResponseAppointmentTwoBookingDetailsRevisionMin = 0;
var ResolveAppointmentQrResponse = zod.object({
  "appointment": zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(resolveAppointmentQrResponseAppointmentOneNotesMax).optional()
  }).and(zod.object({
    "estimate": zod.object({
      "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
      "basis": zod.enum(["sessionStart", "remainingQueue"]),
      "asOf": zod.string(),
      "patientsAhead": zod.number().int().nullable(),
      "waitMinutes": zod.number().int().nullable(),
      "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
      "beyondSessionEnd": zod.boolean(),
      "guidance": zod.string()
    }).optional(),
    "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
    "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "privatePatient": zod.union([zod.object({
      "fullName": zod.string().nullish(),
      "code": zod.string().nullish(),
      "gender": zod.string().nullish(),
      "dateOfBirth": zod.string().nullish(),
      "age": zod.number().int().nullish(),
      "ageReferenceDate": zod.string().nullish(),
      "mobile": zod.string().nullish(),
      "email": zod.string().nullish(),
      "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
    }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
    "canReschedule": zod.boolean().optional(),
    "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
    "bookingDetailsRevision": zod.number().int().min(resolveAppointmentQrResponseAppointmentTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
    "movementReason": zod.string().nullish(),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
      "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
      "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional(),
    "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
  })),
  "eligible": zod.boolean(),
  "alreadyCheckedIn": zod.boolean(),
  "message": zod.string()
});
var CheckInAppointmentQrBody = zod.object({
  "payload": zod.string().min(1)
});
var checkInAppointmentQrResponseAppointmentOneNotesMax = 1e3;
var checkInAppointmentQrResponseAppointmentTwoBookingDetailsRevisionMin = 0;
var CheckInAppointmentQrResponse = zod.object({
  "appointment": zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(checkInAppointmentQrResponseAppointmentOneNotesMax).optional()
  }).and(zod.object({
    "estimate": zod.object({
      "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
      "basis": zod.enum(["sessionStart", "remainingQueue"]),
      "asOf": zod.string(),
      "patientsAhead": zod.number().int().nullable(),
      "waitMinutes": zod.number().int().nullable(),
      "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
      "beyondSessionEnd": zod.boolean(),
      "guidance": zod.string()
    }).optional(),
    "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
    "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "privatePatient": zod.union([zod.object({
      "fullName": zod.string().nullish(),
      "code": zod.string().nullish(),
      "gender": zod.string().nullish(),
      "dateOfBirth": zod.string().nullish(),
      "age": zod.number().int().nullish(),
      "ageReferenceDate": zod.string().nullish(),
      "mobile": zod.string().nullish(),
      "email": zod.string().nullish(),
      "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
    }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
    "canReschedule": zod.boolean().optional(),
    "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
    "bookingDetailsRevision": zod.number().int().min(checkInAppointmentQrResponseAppointmentTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
    "movementReason": zod.string().nullish(),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
      "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
      "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional(),
    "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
  })),
  "alreadyCheckedIn": zod.boolean(),
  "message": zod.string()
});
var GetDoctorDurationParams = zod.object({
  "id": zod.coerce.string(),
  "clinicId": zod.coerce.string()
});
var GetDoctorDurationResponse = zod.object({
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "expectedDurationMinutes": zod.number().int().nullable().describe("Existing legacy durations are retained; new selections must be 20/30/60.")
});
var UpdateDoctorDurationParams = zod.object({
  "id": zod.coerce.string(),
  "clinicId": zod.coerce.string()
});
var UpdateDoctorDurationBody = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "clinicId": zod.string(),
  "expectedDurationMinutes": zod.union([zod.literal(20), zod.literal(30), zod.literal(60)]),
  "effect": zod.enum(["futureOnly", "runningSession"]).describe("Both choices update sessions that have not started"),
  "branchId": zod.string().optional(),
  "date": zod.coerce.date().optional(),
  "confirmRunningSession": zod.boolean().optional(),
  "expectedQueueVersion": zod.string().optional()
});
var UpdateDoctorDurationResponse = zod.object({
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "expectedDurationMinutes": zod.number().int().nullable().describe("Existing legacy durations are retained; new selections must be 20/30/60.")
});
var GetAppointmentMovementParams = zod.object({
  "id": zod.coerce.string()
});
var getAppointmentMovementResponseAppointmentOneNotesMax = 1e3;
var getAppointmentMovementResponseAppointmentTwoBookingDetailsRevisionMin = 0;
var GetAppointmentMovementResponse = zod.object({
  "appointment": zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(getAppointmentMovementResponseAppointmentOneNotesMax).optional()
  }).and(zod.object({
    "estimate": zod.object({
      "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
      "basis": zod.enum(["sessionStart", "remainingQueue"]),
      "asOf": zod.string(),
      "patientsAhead": zod.number().int().nullable(),
      "waitMinutes": zod.number().int().nullable(),
      "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
      "beyondSessionEnd": zod.boolean(),
      "guidance": zod.string()
    }).optional(),
    "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
    "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "privatePatient": zod.union([zod.object({
      "fullName": zod.string().nullish(),
      "code": zod.string().nullish(),
      "gender": zod.string().nullish(),
      "dateOfBirth": zod.string().nullish(),
      "age": zod.number().int().nullish(),
      "ageReferenceDate": zod.string().nullish(),
      "mobile": zod.string().nullish(),
      "email": zod.string().nullish(),
      "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
    }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
    "canReschedule": zod.boolean().optional(),
    "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
    "bookingDetailsRevision": zod.number().int().min(getAppointmentMovementResponseAppointmentTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
    "movementReason": zod.string().nullish(),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
      "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
      "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional(),
    "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
  })),
  "queueVersion": zod.string(),
  "currentPosition": zod.number().int(),
  "pendingCount": zod.number().int(),
  "positions": zod.array(zod.number().int())
});
var manageGuestReceiptBodyReceiptSecretRegExp = new RegExp("^[a-f0-9]{64}$");
var manageGuestReceiptBodyActionExpectedRevisionMin = 0;
var manageGuestReceiptBodyDestinationExpectedRevisionMin = 0;
var ManageGuestReceiptBody = zod.object({
  "receiptSecret": zod.string().regex(manageGuestReceiptBodyReceiptSecretRegExp),
  "action": zod.object({
    "releaseCallConfirmed": zod.boolean().optional(),
    "action": zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"]),
    "reason": zod.string().optional(),
    "cancellationReasonId": zod.string().optional(),
    "expectedStatus": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]).optional(),
    "expectedRevision": zod.number().int().min(manageGuestReceiptBodyActionExpectedRevisionMin).optional(),
    "expectedQueueVersion": zod.string().optional(),
    "position": zod.number().int().min(1).optional().describe("Required for requeue. One-based position among pending reservations; current consultation is never displaced.")
  }).optional(),
  "destination": zod.object({
    "releaseCallConfirmed": zod.boolean().optional(),
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "doctorId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "expectedRevision": zod.number().int().min(manageGuestReceiptBodyDestinationExpectedRevisionMin),
    "reason": zod.string().optional()
  }).optional()
});
var manageGuestReceiptResponseAppointmentOneNotesMax = 1e3;
var manageGuestReceiptResponseAppointmentTwoBookingDetailsRevisionMin = 0;
var ManageGuestReceiptResponse = zod.object({
  "appointment": zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(manageGuestReceiptResponseAppointmentOneNotesMax).optional()
  }).and(zod.object({
    "estimate": zod.object({
      "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
      "basis": zod.enum(["sessionStart", "remainingQueue"]),
      "asOf": zod.string(),
      "patientsAhead": zod.number().int().nullable(),
      "waitMinutes": zod.number().int().nullable(),
      "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
      "beyondSessionEnd": zod.boolean(),
      "guidance": zod.string()
    }).optional(),
    "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
    "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "privatePatient": zod.union([zod.object({
      "fullName": zod.string().nullish(),
      "code": zod.string().nullish(),
      "gender": zod.string().nullish(),
      "dateOfBirth": zod.string().nullish(),
      "age": zod.number().int().nullish(),
      "ageReferenceDate": zod.string().nullish(),
      "mobile": zod.string().nullish(),
      "email": zod.string().nullish(),
      "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
    }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
    "canReschedule": zod.boolean().optional(),
    "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
    "bookingDetailsRevision": zod.number().int().min(manageGuestReceiptResponseAppointmentTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
    "movementReason": zod.string().nullish(),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
      "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
      "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional(),
    "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
  })),
  "queueVersion": zod.string(),
  "currentPosition": zod.number().int(),
  "pendingCount": zod.number().int(),
  "positions": zod.array(zod.number().int())
});
var RescheduleAppointmentParams = zod.object({
  "id": zod.coerce.string()
});
var rescheduleAppointmentBodyExpectedRevisionMin = 0;
var RescheduleAppointmentBody = zod.object({
  "releaseCallConfirmed": zod.boolean().optional(),
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "expectedRevision": zod.number().int().min(rescheduleAppointmentBodyExpectedRevisionMin),
  "reason": zod.string().optional()
});
var rescheduleAppointmentResponseOneNotesMax = 1e3;
var rescheduleAppointmentResponseTwoBookingDetailsRevisionMin = 0;
var RescheduleAppointmentResponse = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "patientId": zod.string(),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": zod.string().optional(),
  "consultationTypeId": zod.string().optional(),
  "qrReference": zod.string().optional(),
  "requestId": zod.string().optional().describe("Client-generated idempotency key"),
  "termsAccepted": zod.boolean().optional(),
  "notes": zod.string().max(rescheduleAppointmentResponseOneNotesMax).optional()
}).and(zod.object({
  "estimate": zod.object({
    "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
    "basis": zod.enum(["sessionStart", "remainingQueue"]),
    "asOf": zod.string(),
    "patientsAhead": zod.number().int().nullable(),
    "waitMinutes": zod.number().int().nullable(),
    "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
    "beyondSessionEnd": zod.boolean(),
    "guidance": zod.string()
  }).optional(),
  "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
  "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "reference": zod.string(),
  "token": zod.string(),
  "tokenNumber": zod.number().int().optional(),
  "queueRank": zod.number().optional(),
  "revision": zod.number().int().optional(),
  "expectedDurationMinutes": zod.number().int().nullish(),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": zod.string(),
  "patientCode": zod.string().optional(),
  "privatePatient": zod.union([zod.object({
    "fullName": zod.string().nullish(),
    "code": zod.string().nullish(),
    "gender": zod.string().nullish(),
    "dateOfBirth": zod.string().nullish(),
    "age": zod.number().int().nullish(),
    "ageReferenceDate": zod.string().nullish(),
    "mobile": zod.string().nullish(),
    "email": zod.string().nullish(),
    "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
  }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
  "doctorName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
  "startTime": zod.string().optional(),
  "endTime": zod.string().optional(),
  "createdAt": zod.coerce.date(),
  "checkedInAt": zod.coerce.date().nullish(),
  "calledAt": zod.coerce.date().nullish(),
  "consultationStartedAt": zod.coerce.date().nullish(),
  "completedAt": zod.coerce.date().nullish(),
  "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
  "canReschedule": zod.boolean().optional(),
  "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
  "bookingDetailsRevision": zod.number().int().min(rescheduleAppointmentResponseTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
  "movementReason": zod.string().nullish(),
  "history": zod.array(zod.object({
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": zod.coerce.date(),
    "reason": zod.string().optional(),
    "action": zod.string().optional(),
    "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
    "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
    "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
    "position": zod.number().int().optional(),
    "from": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional(),
    "to": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional()
  })).optional(),
  "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
}));
var TransitionAppointmentParams = zod.object({
  "id": zod.coerce.string()
});
var transitionAppointmentBodyExpectedRevisionMin = 0;
var TransitionAppointmentBody = zod.object({
  "releaseCallConfirmed": zod.boolean().optional(),
  "action": zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"]),
  "reason": zod.string().optional(),
  "cancellationReasonId": zod.string().optional(),
  "expectedStatus": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]).optional(),
  "expectedRevision": zod.number().int().min(transitionAppointmentBodyExpectedRevisionMin).optional(),
  "expectedQueueVersion": zod.string().optional(),
  "position": zod.number().int().min(1).optional().describe("Required for requeue. One-based position among pending reservations; current consultation is never displaced.")
});
var transitionAppointmentResponseOneNotesMax = 1e3;
var transitionAppointmentResponseTwoBookingDetailsRevisionMin = 0;
var TransitionAppointmentResponse = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "patientId": zod.string(),
  "doctorId": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "source": zod.enum(["online", "walkIn", "phone", "qr"]),
  "appointmentTypeId": zod.string().optional(),
  "consultationTypeId": zod.string().optional(),
  "qrReference": zod.string().optional(),
  "requestId": zod.string().optional().describe("Client-generated idempotency key"),
  "termsAccepted": zod.boolean().optional(),
  "notes": zod.string().max(transitionAppointmentResponseOneNotesMax).optional()
}).and(zod.object({
  "estimate": zod.object({
    "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
    "basis": zod.enum(["sessionStart", "remainingQueue"]),
    "asOf": zod.string(),
    "patientsAhead": zod.number().int().nullable(),
    "waitMinutes": zod.number().int().nullable(),
    "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
    "beyondSessionEnd": zod.boolean(),
    "guidance": zod.string()
  }).optional(),
  "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
  "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
  "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "id": zod.string(),
  "reference": zod.string(),
  "token": zod.string(),
  "tokenNumber": zod.number().int().optional(),
  "queueRank": zod.number().optional(),
  "revision": zod.number().int().optional(),
  "expectedDurationMinutes": zod.number().int().nullish(),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
  "patientName": zod.string(),
  "patientCode": zod.string().optional(),
  "privatePatient": zod.union([zod.object({
    "fullName": zod.string().nullish(),
    "code": zod.string().nullish(),
    "gender": zod.string().nullish(),
    "dateOfBirth": zod.string().nullish(),
    "age": zod.number().int().nullish(),
    "ageReferenceDate": zod.string().nullish(),
    "mobile": zod.string().nullish(),
    "email": zod.string().nullish(),
    "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
  }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
  "doctorName": zod.string(),
  "clinicName": zod.string(),
  "branchName": zod.string(),
  "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
  "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
  "startTime": zod.string().optional(),
  "endTime": zod.string().optional(),
  "createdAt": zod.coerce.date(),
  "checkedInAt": zod.coerce.date().nullish(),
  "calledAt": zod.coerce.date().nullish(),
  "consultationStartedAt": zod.coerce.date().nullish(),
  "completedAt": zod.coerce.date().nullish(),
  "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
  "canReschedule": zod.boolean().optional(),
  "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
  "bookingDetailsRevision": zod.number().int().min(transitionAppointmentResponseTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
  "movementReason": zod.string().nullish(),
  "history": zod.array(zod.object({
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "occurredAt": zod.coerce.date(),
    "reason": zod.string().optional(),
    "action": zod.string().optional(),
    "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
    "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
    "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
    "position": zod.number().int().optional(),
    "from": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional(),
    "to": zod.object({
      "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
      "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
      "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
      "doctorId": zod.string().optional(),
      "branchId": zod.string().optional(),
      "date": zod.coerce.date().optional(),
      "startTime": zod.string().optional(),
      "endTime": zod.string().optional(),
      "timezone": zod.string().optional(),
      "token": zod.string().optional(),
      "tokenNumber": zod.number().int().optional()
    }).optional()
  })).optional(),
  "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
}));
var getQueueQueryPageSizeMax = 100;
var getQueueQuerySearchMax = 200;
var GetQueueQueryParams = zod.object({
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string(),
  "branchId": zod.coerce.string(),
  "date": zod.date(),
  "appointmentId": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).optional().describe("Explicit staff listing page; omit both pagination parameters for legacy full-list compatibility"),
  "pageSize": zod.coerce.number().int().min(1).max(getQueueQueryPageSizeMax).optional().describe("Explicit staff listing page size; omitted pagination parameters must not be default-injected by clients"),
  "search": zod.coerce.string().max(getQueueQuerySearchMax).optional().describe("Staff-only listing search applied before pagination"),
  "sort": zod.coerce.string().optional().describe("Staff-only allowlisted listing sort with optional minus prefix"),
  "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]).optional(),
  "statusGroup": zod.enum(["active", "waiting", "absent", "completed", "cancelled", "all"]).optional().describe("Server-side group filter applied before pagination; intersects with status when both supplied")
});
var getQueueResponseEntriesItemOneNotesMax = 1e3;
var getQueueResponseEntriesItemTwoBookingDetailsRevisionMin = 0;
var GetQueueResponse = zod.object({
  "filteredTotal": zod.number().optional().describe("Staff-only count after listing filters; omitted for patients."),
  "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
  "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
  "sessionId": zod.string().nullish(),
  "startTime": zod.string().nullish(),
  "presence": zod.object({
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "status": zod.enum(["available", "onBreak", "away"])
  }).and(zod.object({
    "doctorId": zod.string(),
    "updatedAt": zod.coerce.date().nullable()
  })).optional(),
  "page": zod.number().int().optional(),
  "pageSize": zod.number().int().optional(),
  "totalPages": zod.number().int().optional(),
  "entriesTotal": zod.number().int().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date(),
  "currentToken": zod.string().nullable(),
  "nextToken": zod.string().nullable(),
  "waiting": zod.number().int(),
  "reserved": zod.number().int().optional().describe("All pending booked"),
  "arrived": zod.number().int().optional().describe("Checked-in"),
  "queueVersion": zod.string().optional(),
  "expectedDurationMinutes": zod.number().int().nullish(),
  "blockedByAbsentReservation": zod.boolean().optional(),
  "inConsultation": zod.number().int(),
  "completed": zod.number().int(),
  "noShow": zod.number().int(),
  "total": zod.number().int(),
  "ownEntry": zod.union([zod.object({
    "estimate": zod.object({
      "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
      "basis": zod.enum(["sessionStart", "remainingQueue"]),
      "asOf": zod.string(),
      "patientsAhead": zod.number().int().nullable(),
      "waitMinutes": zod.number().int().nullable(),
      "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
      "beyondSessionEnd": zod.boolean(),
      "guidance": zod.string()
    }).optional(),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "appointmentId": zod.string(),
    "token": zod.string(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientsAhead": zod.number().int(),
    "estimatedWaitMinutes": zod.number().int().nullable()
  }), zod.null()]).optional(),
  "entries": zod.array(zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(getQueueResponseEntriesItemOneNotesMax).optional()
  }).and(zod.object({
    "estimate": zod.object({
      "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
      "basis": zod.enum(["sessionStart", "remainingQueue"]),
      "asOf": zod.string(),
      "patientsAhead": zod.number().int().nullable(),
      "waitMinutes": zod.number().int().nullable(),
      "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
      "beyondSessionEnd": zod.boolean(),
      "guidance": zod.string()
    }).optional(),
    "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
    "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "privatePatient": zod.union([zod.object({
      "fullName": zod.string().nullish(),
      "code": zod.string().nullish(),
      "gender": zod.string().nullish(),
      "dateOfBirth": zod.string().nullish(),
      "age": zod.number().int().nullish(),
      "ageReferenceDate": zod.string().nullish(),
      "mobile": zod.string().nullish(),
      "email": zod.string().nullish(),
      "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
    }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
    "canReschedule": zod.boolean().optional(),
    "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
    "bookingDetailsRevision": zod.number().int().min(getQueueResponseEntriesItemTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
    "movementReason": zod.string().nullish(),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
      "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
      "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional(),
    "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
  }))).optional().describe("Omitted for patients"),
  "statusCounts": zod.object({
    "active": zod.number().int().optional(),
    "waiting": zod.number().int().optional(),
    "absent": zod.number().int().optional(),
    "completed": zod.number().int().optional(),
    "cancelled": zod.number().int().optional(),
    "all": zod.number().int().optional()
  }).optional(),
  "pollIntervalSeconds": zod.literal(30),
  "updatedAt": zod.coerce.date()
});
var CallNextBody = zod.object({
  "sessionId": zod.string().optional(),
  "startTime": zod.string().optional(),
  "doctorId": zod.string(),
  "branchId": zod.string(),
  "date": zod.coerce.date()
});
var callNextResponseAppointmentOneOneNotesMax = 1e3;
var callNextResponseAppointmentOneTwoBookingDetailsRevisionMin = 0;
var CallNextResponse = zod.object({
  "appointment": zod.union([zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(callNextResponseAppointmentOneOneNotesMax).optional()
  }).and(zod.object({
    "estimate": zod.object({
      "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
      "basis": zod.enum(["sessionStart", "remainingQueue"]),
      "asOf": zod.string(),
      "patientsAhead": zod.number().int().nullable(),
      "waitMinutes": zod.number().int().nullable(),
      "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
      "beyondSessionEnd": zod.boolean(),
      "guidance": zod.string()
    }).optional(),
    "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
    "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "privatePatient": zod.union([zod.object({
      "fullName": zod.string().nullish(),
      "code": zod.string().nullish(),
      "gender": zod.string().nullish(),
      "dateOfBirth": zod.string().nullish(),
      "age": zod.number().int().nullish(),
      "ageReferenceDate": zod.string().nullish(),
      "mobile": zod.string().nullish(),
      "email": zod.string().nullish(),
      "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
    }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
    "canReschedule": zod.boolean().optional(),
    "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
    "bookingDetailsRevision": zod.number().int().min(callNextResponseAppointmentOneTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
    "movementReason": zod.string().nullish(),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
      "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
      "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional(),
    "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
  })), zod.null()])
});
var listQrsQueryPageDefault = 1;
var listQrsQueryPageSizeDefault = 20;
var listQrsQueryPageSizeMax = 100;
var ListQrsQueryParams = zod.object({
  "search": zod.coerce.string().optional(),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "status": zod.enum(["active", "inactive"]).optional(),
  "page": zod.coerce.number().int().min(1).default(listQrsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listQrsQueryPageSizeMax).default(listQrsQueryPageSizeDefault)
});
var listQrsResponseOneTotalMin = 0;
var ListQrsResponse = zod.object({
  "total": zod.number().int().min(listQrsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "name": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string().nullish(),
    "doctorId": zod.string().nullish(),
    "status": zod.enum(["active", "inactive"])
  }).and(zod.object({
    "id": zod.string(),
    "reference": zod.string(),
    "bookingUrl": zod.string(),
    "createdAt": zod.coerce.date()
  })))
}));
var CreateQrBody = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var CreateQrResponse = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "reference": zod.string(),
  "bookingUrl": zod.string(),
  "createdAt": zod.coerce.date()
}));
var GetQrParams = zod.object({
  "id": zod.coerce.string()
});
var GetQrResponse = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "reference": zod.string(),
  "bookingUrl": zod.string(),
  "createdAt": zod.coerce.date()
}));
var UpdateQrParams = zod.object({
  "id": zod.coerce.string()
});
var UpdateQrBody = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"]).optional()
});
var UpdateQrResponse = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "reference": zod.string(),
  "bookingUrl": zod.string(),
  "createdAt": zod.coerce.date()
}));
var DeleteQrParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteQrResponse = zod.void();
var RegenerateQrParams = zod.object({
  "id": zod.coerce.string()
});
var RegenerateQrResponse = zod.object({
  "name": zod.string(),
  "clinicId": zod.string(),
  "branchId": zod.string().nullish(),
  "doctorId": zod.string().nullish(),
  "status": zod.enum(["active", "inactive"])
}).and(zod.object({
  "id": zod.string(),
  "reference": zod.string(),
  "bookingUrl": zod.string(),
  "createdAt": zod.coerce.date()
}));
var GetDashboardQueryParams = zod.object({
  "date": zod.date().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional()
});
var getDashboardResponseRecentAppointmentsItemOneNotesMax = 1e3;
var getDashboardResponseRecentAppointmentsItemTwoBookingDetailsRevisionMin = 0;
var GetDashboardResponse = zod.object({
  "totalDoctors": zod.number().int().optional(),
  "totalClinics": zod.number().int().optional(),
  "totalBranches": zod.number().int().optional(),
  "totalPatients": zod.number().int().optional(),
  "todayAppointments": zod.number().int(),
  "activeQueues": zod.number().int().optional(),
  "waiting": zod.number().int(),
  "checkedIn": zod.number().int(),
  "completed": zod.number().int(),
  "cancelled": zod.number().int(),
  "noShow": zod.number().int(),
  "averageWaitMinutes": zod.number(),
  "currentToken": zod.string().nullish(),
  "recentAppointments": zod.array(zod.object({
    "sessionId": zod.string().optional(),
    "startTime": zod.string().optional(),
    "patientId": zod.string(),
    "doctorId": zod.string(),
    "clinicId": zod.string(),
    "branchId": zod.string(),
    "date": zod.coerce.date(),
    "source": zod.enum(["online", "walkIn", "phone", "qr"]),
    "appointmentTypeId": zod.string().optional(),
    "consultationTypeId": zod.string().optional(),
    "qrReference": zod.string().optional(),
    "requestId": zod.string().optional().describe("Client-generated idempotency key"),
    "termsAccepted": zod.boolean().optional(),
    "notes": zod.string().max(getDashboardResponseRecentAppointmentsItemOneNotesMax).optional()
  }).and(zod.object({
    "estimate": zod.object({
      "state": zod.enum(["ready", "paused", "unavailable", "ended", "terminal"]),
      "basis": zod.enum(["sessionStart", "remainingQueue"]),
      "asOf": zod.string(),
      "patientsAhead": zod.number().int().nullable(),
      "waitMinutes": zod.number().int().nullable(),
      "suggestedArrival": zod.string().nullable().describe("Session-local HH:mm; not an appointment time"),
      "beyondSessionEnd": zod.boolean(),
      "guidance": zod.string()
    }).optional(),
    "bookingMobile": zod.string().nullish().describe("Submitted visit contact; may be absent on historical bookings."),
    "bookingContactSource": zod.union([zod.literal("staff"), zod.literal("patient"), zod.literal("guest"), zod.literal(null)]).nullish().describe("Server-derived submitter provenance, not contact ownership or verification."),
    "confirmationEmail": zod.enum(["provider_accepted", "unavailable", "disabled", "no_recipient", "not_attempted"]).optional().describe("Booking confirmation email attempt outcome. Provider acceptance is not proof of inbox delivery."),
    "dateFormat": zod.enum(["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default DD MMM YYYY."),
    "timeFormat": zod.enum(["12h", "24h"]).optional().describe("Parent Clinic Group display preference; locations inherit it. Default 12h."),
    "id": zod.string(),
    "reference": zod.string(),
    "token": zod.string(),
    "tokenNumber": zod.number().int().optional(),
    "queueRank": zod.number().optional(),
    "revision": zod.number().int().optional(),
    "expectedDurationMinutes": zod.number().int().nullish(),
    "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
    "patientName": zod.string(),
    "patientCode": zod.string().optional(),
    "privatePatient": zod.union([zod.object({
      "fullName": zod.string().nullish(),
      "code": zod.string().nullish(),
      "gender": zod.string().nullish(),
      "dateOfBirth": zod.string().nullish(),
      "age": zod.number().int().nullish(),
      "ageReferenceDate": zod.string().nullish(),
      "mobile": zod.string().nullish(),
      "email": zod.string().nullish(),
      "canEdit": zod.boolean().describe("Independent existing patient demographic write authority; server rechecks on save.")
    }), zod.null()]).optional().describe("Minimal independently authorized profile projection, only on the private appointment detail GET; null when unavailable."),
    "doctorName": zod.string(),
    "clinicName": zod.string(),
    "branchName": zod.string(),
    "branchAddress": zod.string().nullish().describe("Booking branch address snapshot; for legacy bookings the current branch address is resolved."),
    "timezone": zod.string().nullish().describe("Time zone for the consulting session range."),
    "startTime": zod.string().optional(),
    "endTime": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "checkedInAt": zod.coerce.date().nullish(),
    "calledAt": zod.coerce.date().nullish(),
    "consultationStartedAt": zod.coerce.date().nullish(),
    "completedAt": zod.coerce.date().nullish(),
    "allowedActions": zod.array(zod.enum(["checkIn", "enqueue", "call", "start", "complete", "noShow", "requeue", "cancel", "shift"])),
    "canReschedule": zod.boolean().optional(),
    "canEditBooking": zod.boolean().optional().describe("Staff role and current appointment state allow visit-only mobile and notes edits; write permissions are rechecked on save."),
    "bookingDetailsRevision": zod.number().int().min(getDashboardResponseRecentAppointmentsItemTwoBookingDetailsRevisionMin).optional().describe("Visit-contact/notes concurrency revision, independent of lifecycle notification revisions."),
    "movementReason": zod.string().nullish(),
    "history": zod.array(zod.object({
      "status": zod.enum(["booked", "checkedIn", "waiting", "called", "inConsultation", "completed", "noShow", "cancelled"]),
      "occurredAt": zod.coerce.date(),
      "reason": zod.string().optional(),
      "action": zod.string().optional(),
      "actorDisplayName": zod.string().nullish().describe("Authorized current display name, never an identity snapshot or raw ID."),
      "actorRecordedRole": zod.string().nullish().describe("Role recorded on this event, never inferred from the current account role."),
      "actorState": zod.enum(["named", "system", "receipt", "unknown", "deleted", "unavailable"]).optional(),
      "position": zod.number().int().optional(),
      "from": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional(),
      "to": zod.object({
        "doctorName": zod.string().optional().describe("Private detail only. Display name recorded at the move, never reconstructed from the current directory."),
        "branchName": zod.string().optional().describe("Private detail only. Location name recorded at the move."),
        "deletedDoctor": zod.boolean().optional().describe("Private detail only. Clinician attribution was erased; takes precedence over any name."),
        "doctorId": zod.string().optional(),
        "branchId": zod.string().optional(),
        "date": zod.coerce.date().optional(),
        "startTime": zod.string().optional(),
        "endTime": zod.string().optional(),
        "timezone": zod.string().optional(),
        "token": zod.string().optional(),
        "tokenNumber": zod.number().int().optional()
      }).optional()
    })).optional(),
    "historyNextCursor": zod.string().nullish().describe("Opaque cursor for older private events; null when the initial page is complete.")
  }))).optional(),
  "recentActivity": zod.array(zod.object({
    "id": zod.string(),
    "actorId": zod.string(),
    "actorName": zod.string().optional(),
    "actorRole": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]).optional(),
    "action": zod.string(),
    "entityType": zod.string(),
    "entityId": zod.string(),
    "clinicId": zod.string().nullish(),
    "summary": zod.string(),
    "createdAt": zod.coerce.date()
  })).optional()
});
var getReportsQuerySearchMax = 200;
var getReportsQueryPageDefault = 1;
var getReportsQueryPageSizeDefault = 20;
var getReportsQueryPageSizeMax = 100;
var getReportsQueryGroupByDefault = `date`;
var GetReportsQueryParams = zod.object({
  "search": zod.coerce.string().max(getReportsQuerySearchMax).optional().describe("Trimmed report search text"),
  "sort": zod.enum(["key", "-key", "label", "-label", "appointments", "-appointments", "outcomes", "-outcomes", "other", "-other", "registrations", "-registrations", "waiting", "-waiting", "checkedIn", "-checkedIn", "completed", "-completed", "noShow", "-noShow", "cancelled", "-cancelled", "averageWaitMinutes", "-averageWaitMinutes", "averageConsultationMinutes", "-averageConsultationMinutes"]).optional().describe("Outcomes orders by cancelled then no-show then residual Other counts. Other equals visits minus completed minus cancelled minus no-show. Group key ascending breaks ties."),
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(getReportsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(getReportsQueryPageSizeMax).default(getReportsQueryPageSizeDefault),
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "groupBy": zod.enum(["clinic", "doctor", "date"]).default(getReportsQueryGroupByDefault)
});
var GetReportsResponse = zod.object({
  "page": zod.number().int().optional(),
  "pageSize": zod.number().int().optional(),
  "totalPages": zod.number().int().optional(),
  "total": zod.number().int().optional(),
  "from": zod.coerce.date(),
  "to": zod.coerce.date(),
  "groupBy": zod.string(),
  "rows": zod.array(zod.object({
    "key": zod.string(),
    "label": zod.string(),
    "appointments": zod.number().int(),
    "checkedIn": zod.number().int().optional(),
    "waiting": zod.number().int().optional(),
    "completed": zod.number().int(),
    "cancelled": zod.number().int(),
    "noShow": zod.number().int(),
    "registrations": zod.number().int(),
    "averageWaitMinutes": zod.number(),
    "averageConsultationMinutes": zod.number().nullish()
  }))
});
var listAuditLogsQueryActivityTypeDefault = `all`;
var listAuditLogsQueryPageDefault = 1;
var listAuditLogsQueryPageSizeDefault = 20;
var listAuditLogsQueryPageSizeMax = 100;
var ListAuditLogsQueryParams = zod.object({
  "search": zod.coerce.string().optional(),
  "sort": zod.coerce.string().optional().describe("Allowlisted field with optional minus prefix for descending order"),
  "activityType": zod.enum(["all", "operational", "security"]).default(listAuditLogsQueryActivityTypeDefault),
  "entityType": zod.coerce.string().optional(),
  "actorId": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "page": zod.coerce.number().int().min(1).default(listAuditLogsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listAuditLogsQueryPageSizeMax).default(listAuditLogsQueryPageSizeDefault)
});
var listAuditLogsResponseOneTotalMin = 0;
var ListAuditLogsResponse = zod.object({
  "total": zod.number().int().min(listAuditLogsResponseOneTotalMin),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "totalPages": zod.number().int().optional()
}).and(zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "actorId": zod.string(),
    "actorName": zod.string().optional(),
    "actorRole": zod.enum(["superAdmin", "clinicAdmin", "doctor", "receptionist", "patient"]).optional(),
    "action": zod.string(),
    "entityType": zod.string(),
    "entityId": zod.string(),
    "clinicId": zod.string().nullish(),
    "summary": zod.string(),
    "createdAt": zod.coerce.date()
  }))
}));
var getSettingsResponseOneCancellationCutoffMinutesMin = 0;
var getSettingsResponseOneOtpExpirySecondsMin = 60;
var getSettingsResponseOneOtpExpirySecondsMax = 900;
var getSettingsResponseOneOtpMaxAttemptsMax = 10;
var getSettingsResponseOneSessionTimeoutMinutesMin = 5;
var GetSettingsResponse = zod.object({
  "platformName": zod.string(),
  "supportEmail": zod.string().email().optional(),
  "supportPhone": zod.string().optional(),
  "timezone": zod.string().optional(),
  "bookingHorizonDays": zod.number().int().min(1).optional(),
  "cancellationCutoffMinutes": zod.number().int().min(getSettingsResponseOneCancellationCutoffMinutesMin).optional(),
  "requireMobileVerification": zod.boolean(),
  "otpExpirySeconds": zod.number().int().min(getSettingsResponseOneOtpExpirySecondsMin).max(getSettingsResponseOneOtpExpirySecondsMax).optional(),
  "otpMaxAttempts": zod.number().int().min(1).max(getSettingsResponseOneOtpMaxAttemptsMax).optional(),
  "sessionTimeoutMinutes": zod.number().int().min(getSettingsResponseOneSessionTimeoutMinutesMin).optional(),
  "notificationsEnabled": zod.boolean().optional(),
  "logoUrl": zod.string().optional(),
  "primaryColor": zod.string().optional(),
  "termsUrl": zod.string().optional(),
  "privacyUrl": zod.string().optional()
}).and(zod.object({
  "otpProviderConfigured": zod.boolean(),
  "queuePollSeconds": zod.literal(30)
}));
var updateSettingsBodyCancellationCutoffMinutesMin = 0;
var updateSettingsBodyOtpExpirySecondsMin = 60;
var updateSettingsBodyOtpExpirySecondsMax = 900;
var updateSettingsBodyOtpMaxAttemptsMax = 10;
var updateSettingsBodySessionTimeoutMinutesMin = 5;
var UpdateSettingsBody = zod.object({
  "platformName": zod.string().optional(),
  "supportEmail": zod.string().email().optional(),
  "supportPhone": zod.string().optional(),
  "timezone": zod.string().optional(),
  "bookingHorizonDays": zod.number().int().min(1).optional(),
  "cancellationCutoffMinutes": zod.number().int().min(updateSettingsBodyCancellationCutoffMinutesMin).optional(),
  "requireMobileVerification": zod.boolean().optional(),
  "otpExpirySeconds": zod.number().int().min(updateSettingsBodyOtpExpirySecondsMin).max(updateSettingsBodyOtpExpirySecondsMax).optional(),
  "otpMaxAttempts": zod.number().int().min(1).max(updateSettingsBodyOtpMaxAttemptsMax).optional(),
  "sessionTimeoutMinutes": zod.number().int().min(updateSettingsBodySessionTimeoutMinutesMin).optional(),
  "notificationsEnabled": zod.boolean().optional(),
  "logoUrl": zod.string().optional(),
  "primaryColor": zod.string().optional(),
  "termsUrl": zod.string().optional(),
  "privacyUrl": zod.string().optional()
});
var updateSettingsResponseOneCancellationCutoffMinutesMin = 0;
var updateSettingsResponseOneOtpExpirySecondsMin = 60;
var updateSettingsResponseOneOtpExpirySecondsMax = 900;
var updateSettingsResponseOneOtpMaxAttemptsMax = 10;
var updateSettingsResponseOneSessionTimeoutMinutesMin = 5;
var UpdateSettingsResponse = zod.object({
  "platformName": zod.string(),
  "supportEmail": zod.string().email().optional(),
  "supportPhone": zod.string().optional(),
  "timezone": zod.string().optional(),
  "bookingHorizonDays": zod.number().int().min(1).optional(),
  "cancellationCutoffMinutes": zod.number().int().min(updateSettingsResponseOneCancellationCutoffMinutesMin).optional(),
  "requireMobileVerification": zod.boolean(),
  "otpExpirySeconds": zod.number().int().min(updateSettingsResponseOneOtpExpirySecondsMin).max(updateSettingsResponseOneOtpExpirySecondsMax).optional(),
  "otpMaxAttempts": zod.number().int().min(1).max(updateSettingsResponseOneOtpMaxAttemptsMax).optional(),
  "sessionTimeoutMinutes": zod.number().int().min(updateSettingsResponseOneSessionTimeoutMinutesMin).optional(),
  "notificationsEnabled": zod.boolean().optional(),
  "logoUrl": zod.string().optional(),
  "primaryColor": zod.string().optional(),
  "termsUrl": zod.string().optional(),
  "privacyUrl": zod.string().optional()
}).and(zod.object({
  "otpProviderConfigured": zod.boolean(),
  "queuePollSeconds": zod.literal(30)
}));
var listNotificationsQueryKindDefault = `all`;
var ListNotificationsQueryParams = zod.object({
  "kind": zod.enum(["all", "appointments", "queue", "system"]).default(listNotificationsQueryKindDefault)
});
var ListNotificationsResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "kind": zod.enum(["appointments", "queue", "system"]),
    "title": zod.string(),
    "body": zod.string().optional(),
    "createdAt": zod.coerce.date(),
    "read": zod.boolean(),
    "appointmentId": zod.string().nullish(),
    "date": zod.string().nullish()
  })),
  "unread": zod.number().int()
});
var getCommunicationUsageQueryGroupByDefault = `clinic`;
var getCommunicationUsageQueryAttributionDefault = `recipient`;
var getCommunicationUsageQueryPageSizeMax = 100;
var GetCommunicationUsageQueryParams = zod.object({
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "channel": zod.enum(["sms", "email"]).optional(),
  "event": zod.coerce.string().optional(),
  "status": zod.enum(["accepted", "pending", "failed", "unknown", "skipped"]).optional(),
  "clinicId": zod.coerce.string().optional(),
  "source": zod.enum(["automatic", "test"]).optional(),
  "groupBy": zod.enum(["clinic", "user", "location", "event", "recipientGroup"]).default(getCommunicationUsageQueryGroupByDefault),
  "attribution": zod.enum(["recipient", "actor"]).default(getCommunicationUsageQueryAttributionDefault),
  "userId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "cursor": zod.coerce.string().optional(),
  "pageSize": zod.coerce.number().int().min(1).max(getCommunicationUsageQueryPageSizeMax).optional()
});
var GetCommunicationUsageResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "channel": zod.string(),
    "event": zod.string(),
    "status": zod.string(),
    "bucket": zod.string(),
    "recipientGroup": zod.string(),
    "clinicId": zod.string().nullable(),
    "createdAt": zod.number().nullable(),
    "dispatchAt": zod.number().nullable(),
    "completedAt": zod.number().nullable(),
    "queuedAt": zod.number().nullish(),
    "dueAt": zod.number().nullish(),
    "httpStatus": zod.number().int().nullish(),
    "legacy": zod.boolean(),
    "recipient": zod.string().nullable(),
    "reason": zod.string().nullable()
  })),
  "nextCursor": zod.string().nullable(),
  "timezone": zod.string(),
  "total": zod.number(),
  "counts": zod.array(zod.object({
    "channel": zod.string(),
    "bucket": zod.string(),
    "count": zod.number(),
    "clinicId": zod.string().nullable(),
    "clinicName": zod.string().nullable()
  })),
  "earliestAvailableAt": zod.number().nullable(),
  "legacyCount": zod.number(),
  "unattributedCount": zod.number(),
  "scopeClinicId": zod.string().nullable(),
  "scopeClinicName": zod.string().nullable(),
  "userOptions": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  })).optional().describe("Staff identities visible through existing staff and doctor reporting scope. Never inferred from historical contacts."),
  "breakdowns": zod.array(zod.object({
    "key": zod.string().nullable(),
    "label": zod.string(),
    "channel": zod.string(),
    "bucket": zod.string(),
    "count": zod.number()
  })).optional()
});
var GetCommunicationUsageDetailParams = zod.object({
  "id": zod.coerce.string()
});
var GetCommunicationUsageDetailResponse = zod.object({
  "id": zod.string(),
  "channel": zod.string(),
  "event": zod.string(),
  "status": zod.string(),
  "bucket": zod.string(),
  "recipientGroup": zod.string(),
  "clinicId": zod.string().nullable(),
  "createdAt": zod.number().nullable(),
  "dispatchAt": zod.number().nullable(),
  "completedAt": zod.number().nullable(),
  "queuedAt": zod.number().nullish(),
  "dueAt": zod.number().nullish(),
  "httpStatus": zod.number().int().nullish(),
  "legacy": zod.boolean(),
  "recipient": zod.string().nullable(),
  "reason": zod.string().nullable()
});
var listNotificationLogsQuerySenderMax = 254;
var listNotificationLogsQueryRecipientMax = 254;
var listNotificationLogsQueryReferenceMax = 100;
var listNotificationLogsQueryCursorMax = 1e3;
var listNotificationLogsQueryPageSizeDefault = 20;
var listNotificationLogsQueryPageSizeMax = 100;
var ListNotificationLogsQueryParams = zod.object({
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "channel": zod.enum(["email", "sms"]).optional(),
  "event": zod.coerce.string().optional(),
  "status": zod.coerce.string().optional(),
  "clinicId": zod.coerce.string().optional(),
  "recipientGroup": zod.coerce.string().optional(),
  "source": zod.enum(["automatic", "test"]).optional(),
  "sender": zod.coerce.string().max(listNotificationLogsQuerySenderMax).optional(),
  "recipient": zod.coerce.string().max(listNotificationLogsQueryRecipientMax).optional(),
  "reference": zod.coerce.string().max(listNotificationLogsQueryReferenceMax).optional(),
  "cursor": zod.coerce.string().max(listNotificationLogsQueryCursorMax).optional(),
  "pageSize": zod.coerce.number().int().min(1).max(listNotificationLogsQueryPageSizeMax).default(listNotificationLogsQueryPageSizeDefault)
});
var ListNotificationLogsResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "channel": zod.enum(["email", "sms"]),
    "event": zod.string(),
    "status": zod.string(),
    "source": zod.enum(["automatic", "test", "manual"]),
    "occurrence": zod.string().nullish(),
    "clinicId": zod.string().nullish(),
    "reference": zod.string().nullish(),
    "recipientGroup": zod.string(),
    "provider": zod.string().nullish(),
    "sender": zod.string().nullish(),
    "recipient": zod.string().nullish(),
    "subject": zod.string().nullish(),
    "message": zod.string().nullish(),
    "templateId": zod.string().nullish(),
    "templateRevision": zod.number().int().nullish(),
    "templateScope": zod.string().nullish(),
    "dltTemplateId": zod.string().nullish(),
    "createdAt": zod.number().int().nullable(),
    "queuedAt": zod.number().int().nullish(),
    "dueAt": zod.number().int().nullish(),
    "dispatchAt": zod.number().int().nullish(),
    "completedAt": zod.number().int().nullish(),
    "reason": zod.string().nullish(),
    "httpStatus": zod.number().int().nullish(),
    "providerId": zod.string().nullish(),
    "legacy": zod.boolean(),
    "detailsUnavailable": zod.boolean().optional(),
    "timeline": zod.array(zod.object({
      "status": zod.string(),
      "at": zod.number().int(),
      "reason": zod.string().nullish()
    }))
  })),
  "nextCursor": zod.string().nullable(),
  "timezone": zod.string()
});
var getNotificationLogPathIdMax = 200;
var GetNotificationLogParams = zod.object({
  "id": zod.coerce.string().max(getNotificationLogPathIdMax)
});
var GetNotificationLogResponse = zod.object({
  "id": zod.string(),
  "channel": zod.enum(["email", "sms"]),
  "event": zod.string(),
  "status": zod.string(),
  "source": zod.enum(["automatic", "test", "manual"]),
  "occurrence": zod.string().nullish(),
  "clinicId": zod.string().nullish(),
  "reference": zod.string().nullish(),
  "recipientGroup": zod.string(),
  "provider": zod.string().nullish(),
  "sender": zod.string().nullish(),
  "recipient": zod.string().nullish(),
  "subject": zod.string().nullish(),
  "message": zod.string().nullish(),
  "templateId": zod.string().nullish(),
  "templateRevision": zod.number().int().nullish(),
  "templateScope": zod.string().nullish(),
  "dltTemplateId": zod.string().nullish(),
  "createdAt": zod.number().int().nullable(),
  "queuedAt": zod.number().int().nullish(),
  "dueAt": zod.number().int().nullish(),
  "dispatchAt": zod.number().int().nullish(),
  "completedAt": zod.number().int().nullish(),
  "reason": zod.string().nullish(),
  "httpStatus": zod.number().int().nullish(),
  "providerId": zod.string().nullish(),
  "legacy": zod.boolean(),
  "detailsUnavailable": zod.boolean().optional(),
  "timeline": zod.array(zod.object({
    "status": zod.string(),
    "at": zod.number().int(),
    "reason": zod.string().nullish()
  }))
});
var listBookingMailOutcomesQueryPageDefault = 1;
var listBookingMailOutcomesQueryPageMax = 1e4;
var listBookingMailOutcomesQueryPageSizeDefault = 20;
var listBookingMailOutcomesQueryPageSizeMax = 50;
var ListBookingMailOutcomesQueryParams = zod.object({
  "clinicId": zod.coerce.string().min(1),
  "page": zod.coerce.number().int().min(1).max(listBookingMailOutcomesQueryPageMax).default(listBookingMailOutcomesQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listBookingMailOutcomesQueryPageSizeMax).default(listBookingMailOutcomesQueryPageSizeDefault)
});
var ListBookingMailOutcomesResponse = zod.object({
  "items": zod.array(zod.object({
    "reference": zod.string().nullable(),
    "status": zod.enum(["pending", "sending", "provider_accepted", "provider_rejected", "pre_dispatch_failed", "delivery_unknown", "configuration_failed", "preparation_failed", "disabled", "obsolete", "no_recipient", "unknown"]),
    "createdAt": zod.number().int().nullable().describe("Recorded event time in milliseconds since epoch")
  })),
  "hasMore": zod.boolean()
});
var markNotificationsReadBodyIdsItemMax = 120;
var markNotificationsReadBodyIdsMax = 100;
var MarkNotificationsReadBody = zod.object({
  "ids": zod.array(zod.string().max(markNotificationsReadBodyIdsItemMax)).max(markNotificationsReadBodyIdsMax).optional(),
  "all": zod.boolean().optional()
});
var MarkNotificationsReadResponse = zod.object({
  "unread": zod.number().int()
});
var ListWorkspacesResponse = zod.object({
  "activeClinicId": zod.string().nullish(),
  "switchable": zod.boolean(),
  "workspaces": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  }))
});
var SelectWorkspaceBody = zod.object({
  "clinicId": zod.string().nullable()
});
var SelectWorkspaceResponse = zod.object({
  "activeClinicId": zod.string().nullish(),
  "switchable": zod.boolean(),
  "workspaces": zod.array(zod.object({
    "id": zod.string(),
    "name": zod.string()
  }))
});
var ListPatientDocumentsParams = zod.object({
  "id": zod.coerce.string()
});
var ListPatientDocumentsResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "patientId": zod.string(),
    "clinicId": zod.string(),
    "clinicName": zod.string().optional(),
    "name": zod.string(),
    "contentType": zod.string(),
    "size": zod.number().int(),
    "createdAt": zod.coerce.date(),
    "uploadedByName": zod.string().optional()
  })),
  "uploadClinicIds": zod.array(zod.string())
});
var UploadPatientDocumentParams = zod.object({
  "id": zod.coerce.string()
});
var uploadPatientDocumentQueryNameMax = 160;
var UploadPatientDocumentQueryParams = zod.object({
  "name": zod.coerce.string().min(1).max(uploadPatientDocumentQueryNameMax),
  "clinicId": zod.coerce.string().optional()
});
var UploadPatientDocumentResponse = zod.object({
  "id": zod.string(),
  "patientId": zod.string(),
  "clinicId": zod.string(),
  "clinicName": zod.string().optional(),
  "name": zod.string(),
  "contentType": zod.string(),
  "size": zod.number().int(),
  "createdAt": zod.coerce.date(),
  "uploadedByName": zod.string().optional()
});
var DownloadPatientDocumentParams = zod.object({
  "id": zod.coerce.string()
});
var DownloadPatientDocumentResponse = zod.unknown();
var DeletePatientDocumentParams = zod.object({
  "id": zod.coerce.string()
});
var DeletePatientDocumentResponse = zod.void();
var ListPatientActivityParams = zod.object({
  "id": zod.coerce.string()
});
var listPatientActivityQueryPageDefault = 1;
var listPatientActivityQueryPageSizeDefault = 20;
var listPatientActivityQueryPageSizeMax = 100;
var ListPatientActivityQueryParams = zod.object({
  "page": zod.coerce.number().int().min(1).default(listPatientActivityQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(listPatientActivityQueryPageSizeMax).default(listPatientActivityQueryPageSizeDefault)
});
var ListPatientActivityResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "appointmentId": zod.string(),
    "fromStatus": zod.string().nullish(),
    "toStatus": zod.string(),
    "occurredAt": zod.coerce.date(),
    "reference": zod.string(),
    "doctorName": zod.string(),
    "date": zod.string(),
    "actorName": zod.string().nullish()
  })),
  "total": zod.number().int(),
  "page": zod.number().int(),
  "pageSize": zod.number().int()
});
var getReportAnalyticsQueryPageDefault = 1;
var getReportAnalyticsQueryPageSizeDefault = 20;
var getReportAnalyticsQueryPageSizeMax = 100;
var getReportAnalyticsQuerySearchMax = 200;
var getReportAnalyticsQueryGroupByDefault = `date`;
var getReportAnalyticsQueryReportTypeDefault = `all`;
var getReportAnalyticsQueryStatusDefault = `all`;
var getReportAnalyticsQueryCompareDefault = false;
var getReportAnalyticsQueryExportAllDefault = false;
var getReportAnalyticsQuerySortDefault = `-date`;
var GetReportAnalyticsQueryParams = zod.object({
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional(),
  "sessionId": zod.coerce.string().optional(),
  "startTime": zod.coerce.string().optional(),
  "page": zod.coerce.number().int().min(1).default(getReportAnalyticsQueryPageDefault),
  "pageSize": zod.coerce.number().int().min(1).max(getReportAnalyticsQueryPageSizeMax).default(getReportAnalyticsQueryPageSizeDefault),
  "search": zod.coerce.string().max(getReportAnalyticsQuerySearchMax).optional(),
  "groupBy": zod.enum(["date", "clinic", "doctor"]).default(getReportAnalyticsQueryGroupByDefault),
  "reportType": zod.enum(["all", "appointments", "doctors", "noShow", "patients", "cancellations", "activity", "reschedules", "clinicPerformance", "patientActivity"]).default(getReportAnalyticsQueryReportTypeDefault),
  "status": zod.enum(["all", "available", "noData"]).default(getReportAnalyticsQueryStatusDefault),
  "compare": zod.coerce.boolean().default(getReportAnalyticsQueryCompareDefault),
  "exportAll": zod.coerce.boolean().default(getReportAnalyticsQueryExportAllDefault),
  "sort": zod.enum(["date", "-date", "label", "-label", "clinic", "-clinic", "type", "-type", "appointments", "-appointments", "uniquePatients", "-uniquePatients", "completed", "-completed", "cancelled", "-cancelled", "noShow", "-noShow", "consultationMinutes", "-consultationMinutes", "reschedules", "-reschedules"]).default(getReportAnalyticsQuerySortDefault)
});
var GetReportAnalyticsResponse = zod.object({
  "from": zod.string(),
  "to": zod.string(),
  "timezone": zod.string(),
  "generatedAt": zod.coerce.date(),
  "summary": zod.object({
    "appointments": zod.number().int(),
    "completed": zod.number().int(),
    "cancelled": zod.number().int(),
    "noShow": zod.number().int(),
    "uniquePatients": zod.number().int(),
    "registrations": zod.number().int(),
    "waiting": zod.number().int(),
    "checkedIn": zod.number().int(),
    "averageWaitMinutes": zod.number().nullable(),
    "averageConsultationMinutes": zod.number().nullable(),
    "consultationMinutes": zod.number().nullable(),
    "timedConsultations": zod.number().int(),
    "reschedules": zod.number().int(),
    "rescheduledAppointments": zod.number().int(),
    "activity": zod.number().int()
  }),
  "previous": zod.union([zod.object({
    "appointments": zod.number().int(),
    "completed": zod.number().int(),
    "cancelled": zod.number().int(),
    "noShow": zod.number().int(),
    "uniquePatients": zod.number().int(),
    "registrations": zod.number().int(),
    "waiting": zod.number().int(),
    "checkedIn": zod.number().int(),
    "averageWaitMinutes": zod.number().nullable(),
    "averageConsultationMinutes": zod.number().nullable(),
    "consultationMinutes": zod.number().nullable(),
    "timedConsultations": zod.number().int(),
    "reschedules": zod.number().int(),
    "rescheduledAppointments": zod.number().int(),
    "activity": zod.number().int()
  }), zod.null()]),
  "previousFrom": zod.string(),
  "previousTo": zod.string(),
  "points": zod.array(zod.object({
    "date": zod.string(),
    "appointments": zod.number().int(),
    "completed": zod.number().int(),
    "cancelled": zod.number().int(),
    "noShow": zod.number().int(),
    "waiting": zod.number().int()
  })),
  "previousPoints": zod.array(zod.object({
    "date": zod.string(),
    "appointments": zod.number().int(),
    "completed": zod.number().int(),
    "cancelled": zod.number().int(),
    "noShow": zod.number().int(),
    "waiting": zod.number().int()
  })),
  "rows": zod.array(zod.object({
    "id": zod.string(),
    "date": zod.string(),
    "label": zod.string(),
    "group": zod.string(),
    "clinicId": zod.string(),
    "clinic": zod.string(),
    "type": zod.string(),
    "family": zod.string(),
    "status": zod.enum(["available", "noData"]),
    "metrics": zod.object({
      "appointments": zod.number().int(),
      "completed": zod.number().int(),
      "cancelled": zod.number().int(),
      "noShow": zod.number().int(),
      "uniquePatients": zod.number().int(),
      "registrations": zod.number().int(),
      "waiting": zod.number().int(),
      "checkedIn": zod.number().int(),
      "averageWaitMinutes": zod.number().nullable(),
      "averageConsultationMinutes": zod.number().nullable(),
      "consultationMinutes": zod.number().nullable(),
      "timedConsultations": zod.number().int(),
      "reschedules": zod.number().int(),
      "rescheduledAppointments": zod.number().int(),
      "activity": zod.number().int()
    })
  })),
  "total": zod.number().int(),
  "page": zod.number().int(),
  "pageSize": zod.number().int(),
  "notes": zod.array(zod.string())
});
var GetReportTrendsQueryParams = zod.object({
  "from": zod.date().optional(),
  "to": zod.date().optional(),
  "clinicId": zod.coerce.string().optional(),
  "branchId": zod.coerce.string().optional(),
  "doctorId": zod.coerce.string().optional()
});
var GetReportTrendsResponse = zod.object({
  "from": zod.string(),
  "to": zod.string(),
  "points": zod.array(zod.object({
    "date": zod.string(),
    "appointments": zod.number().int(),
    "completed": zod.number().int(),
    "cancelled": zod.number().int(),
    "noShow": zod.number().int(),
    "waiting": zod.number().int()
  }))
});
var searchRecordsQueryQMin = 2;
var searchRecordsQueryQMax = 100;
var SearchRecordsQueryParams = zod.object({
  "q": zod.coerce.string().min(searchRecordsQueryQMin).max(searchRecordsQueryQMax)
});
var SearchRecordsResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "clinicId": zod.string().describe("Visit clinic"),
    "branchId": zod.string(),
    "doctorId": zod.string(),
    "startTime": zod.string().nullish().describe("Session start time when the visit belongs to a timed session."),
    "sessionId": zod.string().nullish(),
    "reference": zod.string(),
    "patientName": zod.string(),
    "doctorName": zod.string(),
    "tokenNumber": zod.number().int(),
    "token": zod.string().optional(),
    "date": zod.string(),
    "status": zod.string(),
    "today": zod.boolean()
  }))
});
var listSavedViewsQueryTableKeyMax = 60;
var ListSavedViewsQueryParams = zod.object({
  "tableKey": zod.coerce.string().max(listSavedViewsQueryTableKeyMax)
});
var listSavedViewsResponseItemsItemColumnsOrderItemMax = 60;
var listSavedViewsResponseItemsItemColumnsOrderMax = 40;
var listSavedViewsResponseItemsItemColumnsHiddenItemMax = 60;
var listSavedViewsResponseItemsItemColumnsHiddenMax = 40;
var listSavedViewsResponseItemsItemColumnsPinnedMax = 60;
var ListSavedViewsResponse = zod.object({
  "items": zod.array(zod.object({
    "id": zod.string(),
    "tableKey": zod.string(),
    "name": zod.string(),
    "filters": zod.record(zod.string(), zod.string()),
    "columns": zod.object({
      "order": zod.array(zod.string().max(listSavedViewsResponseItemsItemColumnsOrderItemMax)).max(listSavedViewsResponseItemsItemColumnsOrderMax),
      "hidden": zod.array(zod.string().max(listSavedViewsResponseItemsItemColumnsHiddenItemMax)).max(listSavedViewsResponseItemsItemColumnsHiddenMax),
      "pinned": zod.string().max(listSavedViewsResponseItemsItemColumnsPinnedMax).nullish()
    }).optional(),
    "ownedByMe": zod.boolean(),
    "shared": zod.boolean()
  })),
  "canShare": zod.boolean()
});
var createSavedViewBodyTableKeyMax = 60;
var createSavedViewBodyNameMax = 60;
var createSavedViewBodyFiltersMaxOne = 80;
var createSavedViewBodyColumnsOrderItemMax = 60;
var createSavedViewBodyColumnsOrderMax = 40;
var createSavedViewBodyColumnsHiddenItemMax = 60;
var createSavedViewBodyColumnsHiddenMax = 40;
var createSavedViewBodyColumnsPinnedMax = 60;
var CreateSavedViewBody = zod.object({
  "tableKey": zod.string().max(createSavedViewBodyTableKeyMax),
  "name": zod.string().min(1).max(createSavedViewBodyNameMax),
  "filters": zod.record(zod.string(), zod.string().max(createSavedViewBodyFiltersMaxOne)),
  "columns": zod.object({
    "order": zod.array(zod.string().max(createSavedViewBodyColumnsOrderItemMax)).max(createSavedViewBodyColumnsOrderMax),
    "hidden": zod.array(zod.string().max(createSavedViewBodyColumnsHiddenItemMax)).max(createSavedViewBodyColumnsHiddenMax),
    "pinned": zod.string().max(createSavedViewBodyColumnsPinnedMax).nullish()
  }).optional(),
  "shareWithRole": zod.boolean().optional()
});
var createSavedViewResponseColumnsOrderItemMax = 60;
var createSavedViewResponseColumnsOrderMax = 40;
var createSavedViewResponseColumnsHiddenItemMax = 60;
var createSavedViewResponseColumnsHiddenMax = 40;
var createSavedViewResponseColumnsPinnedMax = 60;
var CreateSavedViewResponse = zod.object({
  "id": zod.string(),
  "tableKey": zod.string(),
  "name": zod.string(),
  "filters": zod.record(zod.string(), zod.string()),
  "columns": zod.object({
    "order": zod.array(zod.string().max(createSavedViewResponseColumnsOrderItemMax)).max(createSavedViewResponseColumnsOrderMax),
    "hidden": zod.array(zod.string().max(createSavedViewResponseColumnsHiddenItemMax)).max(createSavedViewResponseColumnsHiddenMax),
    "pinned": zod.string().max(createSavedViewResponseColumnsPinnedMax).nullish()
  }).optional(),
  "ownedByMe": zod.boolean(),
  "shared": zod.boolean()
});
var DeleteSavedViewParams = zod.object({
  "id": zod.coerce.string()
});
var DeleteSavedViewResponse = zod.void();

// fixture-auth:auth
async function requireUser(req) {
  const id2 = req.headers["x-user"];
  return { id: id2, role: id2 === "ca" ? "clinicAdmin" : id2 || "patient", clinicIds: ["c"] };
}
async function findUser() {
  return null;
}
function roles2(u, rs) {
  if (!rs.includes(u.role)) throw Object.assign(new Error("Forbidden"), { status: 403 });
}

// artifacts/api-server/src/routes/workspace-features.ts
init_http();
init_store();

// artifacts/api-server/src/lib/list-query.ts
init_db();
init_http();
init_queue_order();
init_clinical_membership();
init_patient_registration_scope();
init_retained_doctor_access();
import { sql as sql26 } from "drizzle-orm";
var names = { users: "users", doctors: "doctors", clinics: "clinics", branches: "branches", patients: "patients", masters: "masters", schedules: "schedules", "availability-exceptions": "availability_exceptions", qrs: "qrs", appointments: "appointments", "audit-logs": "audit_logs" };
var raw = sql26.raw;
var inList = (value, ids) => ids?.length ? sql26`${value} in (${sql26.join(ids.map((id2) => sql26`${id2}`), raw(","))})` : raw("false");
function operationalScope(user, clinic, branch) {
  if (user.role === "superAdmin") return raw("true");
  return sql26`(${inList(clinic, user.clinicIds)} and (${branch} is null or ${!["doctor", "receptionist"].includes(user.role)} or ${inList(branch, user.branchIds)}))`;
}
function links(kind) {
  if (kind === "doctors") return managedDoctorLinks(raw("r.id"));
  return raw(`select a.*, c.data->>'name' as clinic_name, b.data->>'name' as branch_name from assignments a join clinics c on c.id=a.clinic_id left join branches b on b.id=a.branch_id where a.user_id=r.${kind === "doctors" ? "user_id" : "id"} and c.status='active' and (a.branch_id is null or b.status='active')`);
}
function readScope(user, kind) {
  if (user.role === "superAdmin" || kind === "masters") return raw("true");
  if (kind === "users" || kind === "doctors") {
    const assigned = sql26`exists(select 1 from (${links(kind)}) l where ${inList(raw("l.clinic_id"), user.clinicIds)})`;
    const branch2 = !["doctor", "receptionist"].includes(user.role) ? raw("true") : sql26`exists(select 1 from (${links(kind)}) l where ${inList(raw("l.branch_id"), user.branchIds)})`;
    if (kind === "doctors") return sql26`(r.id=${user.doctorId || ""} or (${["clinicAdmin", "doctor", "receptionist"].includes(user.role)} and ${assigned} and ${branch2}))`;
    return sql26`(r.id=${user.id} or (r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)} and r.managing_admin_id=${(user.role === "clinicAdmin" ? user.id : user.managingAdminId) || ""}) or (not (r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)}) and r.role<>'superAdmin' and ${assigned} and ${branch2}))`;
  }
  if (kind === "patients") {
    if (user.role === "patient") return sql26`r.id=${user.patientId || ""}`;
    const registered = operationalScope(user, raw("r.clinic_id"), raw("r.branch_id"));
    const ownClinic = user.role === "doctor" ? sql26`(${registered} and ${doctorRegistrationSql(user, raw("r.clinic_id"), raw("r.branch_id"))})` : registered;
    return sql26`(${ownClinic} or ${retainedDoctorVisitSql(user, raw("r.id"))} or exists(select 1 from appointments ap where ap.patient_id=r.id and ${operationalScope(user, raw("ap.clinic_id"), raw("ap.branch_id"))} ${user.role === "doctor" ? sql26`and ap.doctor_id=${user.doctorId || ""}` : raw("")}))`;
  }
  if (kind === "clinics") return operationalScope(user, raw("r.id"), raw("null"));
  if (user.role === "patient") return kind === "appointments" ? sql26`r.patient_id=${user.patientId || ""}` : raw("false");
  const clinic = kind === "availability-exceptions" ? raw("(select clinic_id from branches where id=r.branch_id)") : raw("r.clinic_id");
  const branch = kind === "branches" ? raw("r.id") : raw("r.branch_id");
  let result = operationalScope(user, clinic, branch);
  if (user.role === "doctor" && ["appointments", "qrs"].includes(kind)) result = sql26`${result} and r.doctor_id=${user.doctorId || ""}`;
  if (["schedules", "availability-exceptions"].includes(kind)) result = sql26`${result} and ${clinicalMembership(raw("r.doctor_id"), raw("r.branch_id"))}`;
  return result;
}
function documentSql(kind, assignmentDocument) {
  let doc = raw(`coalesce(to_jsonb(r)->'data','{}'::jsonb) || (select jsonb_object_agg((select string_agg(case when n=1 then word else initcap(word) end,'' order by n) from unnest(string_to_array(k,'_')) with ordinality t(word,n)),v) from jsonb_each(to_jsonb(r)-'data'-'password_hash'-'token_hash') e(k,v))`);
  if (kind === "users") doc = sql26`(${doc}) - 'passwordHash' - 'password_hash' - 'tokenHash' - 'token_hash' - 'clerkId'`;
  if (["users", "doctors"].includes(kind)) doc = sql26`${doc} || ${assignmentDocument || sql26`jsonb_build_object('clinicIds',coalesce((select jsonb_agg(distinct l.clinic_id) from (${links(kind)}) l),'[]'::jsonb),'branchIds',coalesce((select jsonb_agg(distinct l.branch_id) filter(where l.branch_id is not null) from (${links(kind)}) l),'[]'::jsonb))`}`;
  if (kind === "doctors") doc = sql26`${doc} || coalesce((select jsonb_build_object('fullName',u.full_name,'email',u.email,'mobile',coalesce(u.mobile,''),'passwordEnabled',u.password_hash is not null,'managingAdminId',r.owner_admin_id,'managingAdminName',(select full_name from users where id=r.owner_admin_id),'invitationStatus',case when u.password_hash is not null then 'notRequired' else u.invitation_status end,'status',case when u.status<>'active' then 'inactive' else r.status end) from users u where u.id=r.user_id),jsonb_build_object('fullName','Deleted doctor','email','','mobile','','passwordEnabled',false,'status','retired','managingAdminId',null,'managingAdminName',null,'invitationStatus','notRequired')) || jsonb_build_object('specializationName',(select data->>'name' from masters where id=r.specialization_id),'qualificationNames',coalesce((select jsonb_agg(data->>'name') from masters where id in (select jsonb_array_elements_text(coalesce(r.data->'qualificationIds','[]'::jsonb)))),'[]'::jsonb))`;
  if (kind === "users") doc = sql26`${doc} || jsonb_build_object('mobile',coalesce(r.mobile,''),'passwordEnabled',r.password_hash is not null,'managingAdminName',(select full_name from users where id=r.managing_admin_id),'invitationStatus',case when r.password_hash is not null then 'notRequired' else r.invitation_status end)`;
  if (kind === "clinics") doc = sql26`${doc} || jsonb_build_object('adminName',(select full_name from users where id=r.admin_id),
    'categoryName',case when nullif(r.data->>'categoryId','') is not null then coalesce((select data->>'name' from masters where id=r.data->>'categoryId'),'Saved option unavailable') else r.data->>'customCategory' end,
    'specialityNames',coalesce((select jsonb_agg(coalesce(m.data->>'name','Saved option unavailable') order by item.ord)
      from jsonb_array_elements_text(coalesce(r.data->'specialityIds','[]'::jsonb)) with ordinality item(id,ord)
      left join masters m on m.id=item.id),'[]'::jsonb) || coalesce(r.data->'customSpecialities','[]'::jsonb))`;
  if (kind === "branches") doc = sql26`${doc} || jsonb_build_object('clinicName',(select data->>'name' from clinics where id=r.clinic_id),
    'inheritEmail',coalesce((r.data->>'inheritEmail')::boolean,nullif(r.data->>'email','') is null),
    'inheritPhone',coalesce((r.data->>'inheritPhone')::boolean,nullif(r.data->>'phone','') is null),
    'effectiveEmail',case when coalesce((r.data->>'inheritEmail')::boolean,nullif(r.data->>'email','') is null) then (select data->>'email' from clinics where id=r.clinic_id) else r.data->>'email' end,
    'effectivePhone',case when coalesce((r.data->>'inheritPhone')::boolean,nullif(r.data->>'phone','') is null) then (select data->>'phone' from clinics where id=r.clinic_id) else r.data->>'phone' end)`;
  if (["schedules", "availability-exceptions", "qrs"].includes(kind)) doc = sql26`${doc} || jsonb_build_object('doctorName',(select case when d.status='retired' then 'Deleted doctor' else u.full_name end from doctors d left join users u on u.id=d.user_id where d.id=r.doctor_id),'branchName',(select data->>'name' from branches where id=r.branch_id))`;
  if (kind === "qrs") doc = sql26`${doc} || jsonb_build_object('reference',r.public_reference)`;
  if (kind === "appointments") doc = sql26`${doc} || case when exists(select 1 from doctors d where d.id=r.doctor_id and d.status='retired')
    then jsonb_build_object('doctorName','Deleted doctor') else '{}'::jsonb end`;
  if (kind === "audit-logs") doc = sql26`${doc} || jsonb_build_object('actorName',case when r.deleted_actor then 'Deleted user' else (select full_name from users where id=r.actor_id) end,'actorRole',(select role from users where id=r.actor_id))`;
  return doc;
}
function sourceSql(user, kind, extra = raw("true")) {
  assert(names[kind], 400, "Unsupported resource");
  if (["users", "doctors"].includes(kind)) {
    const own = kind === "users" ? sql26`r.id=${user.id}` : sql26`r.id=${user.doctorId || ""}`;
    const peer = kind === "users" ? sql26`r.role='receptionist' and ${["clinicAdmin", "doctor"].includes(user.role)} and r.managing_admin_id=${(user.role === "clinicAdmin" ? user.id : user.managingAdminId) || ""}` : raw("false");
    const unrestricted = user.role === "superAdmin" ? raw("true") : sql26`(${own} or (${peer}))`;
    const assignmentDocument = sql26`jsonb_build_object(
      'clinicIds',coalesce(jsonb_agg(distinct l.clinic_id) filter(where ${unrestricted} or ${inList(raw("l.clinic_id"), user.clinicIds)}),'[]'::jsonb),
      'branchIds',coalesce(jsonb_agg(distinct l.branch_id) filter(where l.branch_id is not null and (${unrestricted} or ${operationalScope(user, raw("l.clinic_id"), raw("l.branch_id"))})),'[]'::jsonb))`;
    return sql26`select ${documentSql(kind, raw("assignment_doc.doc"))} as doc from ${raw(names[kind])} r
      cross join lateral (select ${assignmentDocument} as doc from (${links(kind)}) l) assignment_doc
      where (${readScope(user, kind)}) and (${extra}) and (${kind === "doctors" ? sql26`r.status <> 'retired'` : raw("true")})`;
  }
  return sql26`select ${documentSql(kind)} as doc from ${raw(names[kind])} r where (${readScope(user, kind)}) and (${extra})`;
}
var metricSql = sql26`count(*)::int as appointments,
  count(*) filter(where doc->>'status' in ('booked','checkedIn','waiting'))::int as waiting,
  count(*) filter(where doc->>'status'='inConsultation')::int as "checkedIn",
  count(*) filter(where doc->>'status'='completed')::int as completed,
  count(*) filter(where doc->>'status'='noShow')::int as "noShow",
  count(*) filter(where doc->>'status'='cancelled')::int as cancelled,
  coalesce(avg((doc->>'waitMinutes')::numeric),0)::float as "averageWaitMinutes",
  avg(case when doc->>'status'='completed'
    and doc->>'consultationStartedAt' ~ '^\\d{4}-\\d{2}-\\d{2}T'
    and doc->>'completedAt' ~ '^\\d{4}-\\d{2}-\\d{2}T'
    and (doc->>'completedAt')::timestamptz >= (doc->>'consultationStartedAt')::timestamptz
    then extract(epoch from ((doc->>'completedAt')::timestamptz - (doc->>'consultationStartedAt')::timestamptz))/60 end)::float as "averageConsultationMinutes"`;
var statusCountsSql = sql26`jsonb_build_object(
  'all', count(*)::int,
  ${sql26.join(Object.entries(statusGroups).map(([group, statuses]) => sql26`${group}::text, count(*) filter(where ${inList(raw("doc->>'status'"), statuses)})::int`), raw(","))})`;

// artifacts/api-server/src/routes/workspace-features.ts
init_feature_policy();
init_notification_outbox();
init_notification_preferences();
var workspaceFeaturesRouter = Router();
var statusText = { booked: "Booked", checkedIn: "Checked In", waiting: "Waiting", called: "Called Next", inConsultation: "In Consultation", completed: "Completed", noShow: "Marked Absent", cancelled: "Cancelled" };
async function listNotificationsFor(user) {
  const history = await db.execute(sql27`with a as (select doc from (${sourceSql(user, "appointments")}) s)
    select h.id, h.to_status as "toStatus", (h.from_status is null) as booking, h.created_at as "createdAt", ap.id as "appointmentId", ap.date, ap.token_number as token,
      ap.data->>'reference' as reference, coalesce(p.data->>'fullName', pu.full_name) as patient, du.full_name as doctor,
      (nr.notification_id is not null) as read
    from appointment_history h join a on a.doc->>'id' = h.appointment_id
    join appointments ap on ap.id = h.appointment_id
    left join patients p on p.id = ap.patient_id left join users pu on pu.id = p.user_id
    left join doctors d on d.id = ap.doctor_id left join users du on du.id = d.user_id
    left join notification_reads nr on nr.user_id = ${user.id} and nr.notification_id = 'h:' || h.id
    where h.created_at > now() - interval '30 days' and (${user.role === "patient"} or h.from_status is null or h.actor_id is distinct from ${user.id})
    order by h.created_at desc limit 60`);
  const items = history.rows.map((r) => ({
    id: `h:${r.id}`,
    kind: notificationKind(r.toStatus, r.booking),
    createdAt: new Date(r.createdAt).toISOString(),
    read: !!r.read,
    title: `${r.booking ? "Booked" : statusText[r.toStatus] || r.toStatus} \xB7 Token ${r.token}`,
    body: user.role === "patient" ? `Your visit with ${r.doctor || "your doctor"} (Ref ${r.reference || "-"})` : `${r.patient || "Patient"} with ${r.doctor || "doctor"} \xB7 Ref ${r.reference || "-"}`,
    appointmentId: r.appointmentId,
    date: r.date
  }));
  if (user.role === "superAdmin" || user.role === "clinicAdmin") {
    const scopeSql = user.role === "superAdmin" ? sql27`true` : user.clinicIds.length ? sql27`l.clinic_id in (${sql27.join(user.clinicIds.map((c) => sql27`${c}`), sql27`, `)})` : sql27`false`;
    const system = await db.execute(sql27`select l.id, l.summary, l.action, l.entity_type as "entityType", l.created_at as "createdAt", u.full_name as actor,
        (nr.notification_id is not null) as read
      from audit_logs l left join users u on u.id = l.actor_id
      left join notification_reads nr on nr.user_id = ${user.id} and nr.notification_id = 'a:' || l.id
      where ${scopeSql} and l.created_at > now() - interval '30 days' and l.actor_id is distinct from ${user.id}
        and l.entity_type not in ('appointments', 'auth_sessions', 'patient_documents')
      order by l.created_at desc limit 30`);
    items.push(...system.rows.map((r) => ({ id: `a:${r.id}`, kind: "system", title: r.summary, body: r.actor ? `By ${r.actor}` : void 0, createdAt: new Date(r.createdAt).toISOString(), read: !!r.read, appointmentId: null, date: null })));
  }
  items.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  const preferences = await personalPreferences(user.id);
  return items.filter((item) => preferences.choices[`inApp:${item.kind}`] !== false);
}
workspaceFeaturesRouter.get("/management/booking-mail-outcomes", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req), q = query(ListBookingMailOutcomesQueryParams, req);
  res.json(ListBookingMailOutcomesResponse.parse(await listOwnerBookingMailOutcomes(user, q.clinicId, q.page, q.pageSize)));
});
workspaceFeaturesRouter.get("/notifications", async (req, res) => {
  const user = await requireUser(req), q = query(ListNotificationsQueryParams, req);
  const items = await listNotificationsFor(user);
  res.json({ items: q.kind && q.kind !== "all" ? items.filter((n) => n.kind === q.kind) : items, unread: items.filter((n) => !n.read).length });
});
workspaceFeaturesRouter.post("/notifications/read", async (req, res) => {
  const user = await requireUser(req), body = parse(MarkNotificationsReadBody, req.body);
  const items = await listNotificationsFor(user);
  const visible = new Set(items.map((n) => n.id));
  const ids = body.all ? [...visible] : (body.ids || []).filter((id2) => visible.has(id2));
  if (ids.length) await db.insert(notificationReads).values(ids.map((notificationId) => ({ userId: user.id, notificationId }))).onConflictDoNothing();
  res.json({ unread: items.filter((n) => !n.read && !ids.includes(n.id)).length });
});
async function workspaceList(user) {
  const full = await findUser(user.id);
  const ids = full?.clinicIds || [];
  const switchable = !["superAdmin", "patient"].includes(user.role) && ids.length > 1;
  const rows = ids.length ? await db.select().from(clinics).where(inArray2(clinics.id, ids)) : [];
  return { activeClinicId: user.activeClinicId ?? null, switchable, workspaces: rows.map((c) => ({ id: c.id, name: String(c.data?.name || "Clinic") })).sort((a, b) => a.name.localeCompare(b.name)) };
}
workspaceFeaturesRouter.get("/workspaces", async (req, res) => {
  res.json(await workspaceList(await requireUser(req)));
});
workspaceFeaturesRouter.put("/workspaces/active", async (req, res) => {
  const user = await requireUser(req), body = parse(SelectWorkspaceBody, req.body);
  const full = await findUser(user.id);
  assert(!["superAdmin", "patient"].includes(user.role) && (full?.clinicIds.length || 0) > 1, 403, "Workspace switching is not available for this account");
  if (body.clinicId) assert(full.clinicIds.includes(body.clinicId), 403, "You are not assigned to that clinic");
  await db.transaction(async (tx) => {
    if (body.clinicId) await tx.insert(settings).values({ id: `workspace:${user.id}`, data: { clinicId: body.clinicId } }).onConflictDoUpdate({ target: settings.id, set: { data: { clinicId: body.clinicId } } });
    else await tx.delete(settings).where(eq25(settings.id, `workspace:${user.id}`));
    await audit(user, "switchWorkspace", "users", { id: user.id, clinicId: body.clinicId || null }, tx);
  });
  res.json(await workspaceList({ ...user, activeClinicId: body.clinicId || null }));
});
workspaceFeaturesRouter.get("/search/records", async (req, res) => {
  const user = await requireUser(req), q = query(SearchRecordsQueryParams, req);
  const term = q.q.trim();
  assert(term.length >= 2, 400, "Enter at least 2 characters");
  const like = `%${term.replace(/[\\%_]/g, "\\$&")}%`, token = /^\d{1,6}$/.test(term) ? Number(term) : -1;
  const fallbackTimezone = (await getSettings()).timezone;
  const isToday = sql27`ap.date = to_char(now() at time zone coalesce(nullif(b.data->>'timezone',''),nullif(c.data->>'timezone',''),${fallbackTimezone}), 'YYYY-MM-DD')`;
  const result = await db.execute(sql27`with a as (select doc from (${sourceSql(user, "appointments")}) s)
    select ap.id, ap.clinic_id as "clinicId", ap.branch_id as "branchId", ap.doctor_id as "doctorId", (${isToday}) as today,
      ap.data->>'startTime' as "startTime", ap.data->>'sessionId' as "sessionId", ap.data->>'reference' as reference, ap.token_number as "tokenNumber", ap.data->>'token' as token, ap.date, ap.status,
      coalesce(p.data->>'fullName', pu.full_name, '') as "patientName", coalesce(du.full_name, '') as "doctorName"
    from a join appointments ap on ap.id = a.doc->>'id'
    left join branches b on b.id = ap.branch_id left join clinics c on c.id = ap.clinic_id
    left join patients p on p.id = ap.patient_id left join users pu on pu.id = p.user_id
    left join doctors d on d.id = ap.doctor_id left join users du on du.id = d.user_id
    where ap.data->>'reference' ilike ${like} or ap.token_number = ${token} or coalesce(p.data->>'fullName', pu.full_name) ilike ${like}
    order by (${isToday}) desc, ap.date desc, ap.token_number limit 10`);
  res.json({ items: result.rows.map((r) => ({ ...r, reference: r.reference || "", token: r.token || void 0 })) });
});
var viewOut = (v, user) => ({ id: v.id, tableKey: v.tableKey, name: v.name, filters: v.data?.filters || {}, columns: v.data?.columns, ownedByMe: v.userId === user.id, shared: !!v.sharedRole });
workspaceFeaturesRouter.get("/saved-views", async (req, res) => {
  const user = await requireUser(req), q = query(ListSavedViewsQueryParams, req);
  const own = await db.select().from(savedViews).where(and3(eq25(savedViews.userId, user.id), eq25(savedViews.tableKey, q.tableKey)));
  const shared = (await db.select().from(savedViews).where(and3(inArray2(savedViews.sharedRole, [user.role, "staff"]), eq25(savedViews.tableKey, q.tableKey)))).filter((v) => v.userId !== user.id && receivesSharedView(user.role, v.sharedRole) && (user.role === "superAdmin" || (v.clinicIds || []).some((c) => user.clinicIds.includes(c))));
  res.json({ items: [...own, ...shared].sort((a, b) => a.name.localeCompare(b.name)).map((v) => viewOut(v, user)), canShare: SHARE_ROLES.has(user.role) });
});
workspaceFeaturesRouter.post("/saved-views", async (req, res) => {
  const user = await requireUser(req), body = parse(CreateSavedViewBody, req.body);
  let clean;
  try {
    clean = sanitizeSavedView(body);
  } catch (e) {
    assert(false, 400, e.message);
  }
  const share = !!body.shareWithRole;
  assert(!share || SHARE_ROLES.has(user.role), 403, "Your role cannot share views");
  const existing = await db.select().from(savedViews).where(and3(eq25(savedViews.userId, user.id), eq25(savedViews.tableKey, clean.tableKey)));
  assert(existing.length < 30, 400, "Delete an older view first (30 per list)");
  const same = existing.find((v) => v.name === clean.name);
  const row = { id: same?.id || uid(), userId: user.id, tableKey: clean.tableKey, name: clean.name, data: { filters: clean.filters, columns: clean.columns }, sharedRole: share ? shareAudience(user.role) : null, clinicIds: share ? user.clinicIds : [] };
  await db.insert(savedViews).values(row).onConflictDoUpdate({ target: savedViews.id, set: { data: row.data, sharedRole: row.sharedRole, clinicIds: row.clinicIds } });
  res.status(201).json(viewOut(row, user));
});
workspaceFeaturesRouter.delete("/saved-views/:id", async (req, res) => {
  const user = await requireUser(req);
  const [row] = await db.select().from(savedViews).where(eq25(savedViews.id, String(req.params.id)));
  assert(row && row.userId === user.id, 404, "View not found");
  await db.delete(savedViews).where(eq25(savedViews.id, row.id));
  res.status(204).end();
});

// artifacts/api-server/src/routes/notification-settings.ts
import { Router as Router2 } from "express";
init_http();
init_native_auth();
var notificationSettingsRouter = Router2();
notificationSettingsRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
notificationSettingsRouter.get("/me/notification-settings", async (req, res) => {
  res.json(GetMyNotificationSettingsResponse.parse(await personalNotificationSettings(await requireUser(req))));
});
notificationSettingsRouter.put("/me/notification-settings", async (req, res) => {
  const user = await requireUser(req);
  await consumeRateLimit(`notification-preferences:${user.id}`, 60, 9e5);
  res.json(SaveMyNotificationSettingsResponse.parse(await savePersonalNotificationSettings(user, parse(SaveMyNotificationSettingsBody.strict(), req.body))));
});
notificationSettingsRouter.get("/management/notification-settings", async (req, res) => {
  const user = await requireUser(req), params = query(GetManagedNotificationSettingsQueryParams, req);
  res.json(GetManagedNotificationSettingsResponse.parse(await managedNotificationSettings(user, params.clinicId)));
});
notificationSettingsRouter.put("/management/notification-settings", async (req, res) => {
  const user = await requireUser(req);
  await consumeRateLimit(`notification-policy:${user.id}`, 30, 9e5);
  res.json(SaveManagedNotificationSettingsResponse.parse(await saveManagedNotificationSettings(user, parse(SaveManagedNotificationSettingsBody.strict(), req.body))));
});

// artifacts/api-server/src/routes/notification-history.ts
import { Router as Router3 } from "express";
init_notification_history();

// artifacts/api-server/src/lib/communication-usage.ts
init_db();
init_http();
init_demo_policy();
init_notification_history();
init_notification_history_provenance();
import { sql as sql28 } from "drizzle-orm";
import { z as z7 } from "zod";
var events = ["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder"];
var buckets = ["accepted", "pending", "failed", "unknown", "skipped"];
var filters = z7.object({
  from: z7.string().datetime({ offset: true }).optional(),
  to: z7.string().datetime({ offset: true }).optional(),
  channel: z7.enum(["sms", "email"]).optional(),
  event: z7.enum([...events, "provider_test"]).optional(),
  status: z7.enum(buckets).optional(),
  clinicId: z7.string().min(1).max(100).optional(),
  source: z7.enum(["automatic", "test"]).default("automatic"),
  groupBy: z7.enum(["clinic", "user", "location", "event", "recipientGroup"]).default("clinic"),
  attribution: z7.enum(["recipient", "actor"]).default("recipient"),
  userId: z7.string().min(1).max(100).optional(),
  branchId: z7.string().min(1).max(100).optional(),
  pageSize: z7.coerce.number().int().min(1).max(100).default(25),
  cursor: z7.string().max(1e3).optional()
}).strict();
var numberAt = (field2) => sql28`case when data->>${field2} ~ '^-?[0-9]{1,15}$' then (data->>${field2})::bigint else null end`;
var idPattern = /^(notification-history:[a-f0-9]{64}|legacy:(mail|sms)-outbox:[A-Za-z0-9:_-]{1,170})$/;
function records(now, metadataOnly = true, selection = {}) {
  return sql28`with raw as materialized (${historyRecords(metadataOnly, selection)}),
    classified as (
      select id, data, ${numberAt("createdAt")} as occurred_at,
        case when data->>'status'='sending' and
          (${numberAt("dispatchAt")} is null or ${numberAt("dispatchAt")} < ${now - 3e5})
          then 'delivery_unknown' else coalesce(data->>'status','unknown') end as state,
        case when data->>'source'='automatic'
          and data->>'event' in (${sql28.join(events.map((e) => sql28`${e}`), sql28`,`)})
          and data->>'recipientGroup' in ('patient','doctor','clinicAdmin','receptionist')
          and (data->>'legacy'='true' or data->'provenance'->>'version'='2')
          then nullif(data->>'clinicId','') else null end as attributed_clinic
      from raw where coalesce(data->>'erased','false') <> 'true'
        and data->>'channel' in ('sms','email')
    ), records as (
      select *, case
        when state='provider_accepted' then 'accepted'
        when state in ('pending','sending') then 'pending'
        when state in ('provider_rejected','pre_dispatch_failed','configuration_failed','preparation_failed') then 'failed'
        when state in ('not_attempted','disabled','obsolete','no_recipient') then 'skipped'
        else 'unknown' end as bucket
      from classified
    )`;
}
async function scope(user, conn) {
  assert(
    ["superAdmin", "clinicAdmin"].includes(user.role) && !user.demo && user.demoFixture !== DEMO_FIXTURE,
    403,
    "Administrator reporting access required"
  );
  if (user.role === "superAdmin") return null;
  const result = await conn.execute(sql28`select id, data->>'name' as name from clinics where admin_id=${user.id} order by id`);
  assert(result.rows.length > 0, 403, "Current clinic ownership required");
  return {
    ids: result.rows.map((row) => row.id),
    id: result.rows.length === 1 ? result.rows[0].id : null,
    name: result.rows.length === 1 ? result.rows[0].name : `All currently owned clinics (${result.rows.length})`
  };
}
function ownership(user) {
  return user.role === "clinicAdmin" ? sql28`attributed_clinic in (select id from clinics where admin_id=${user.id})` : sql28`true`;
}
function metadata(row) {
  const d = row.data;
  const timestamp2 = (k) => Number.isSafeInteger(d[k]) ? d[k] : null;
  return {
    id: row.id,
    channel: d.channel,
    event: d.event || "unknown",
    status: row.state,
    bucket: row.bucket,
    clinicId: row.attributed_clinic || null,
    recipientGroup: d.recipientGroup || "unknown",
    createdAt: row.occurred_at == null ? null : Number(row.occurred_at),
    dispatchAt: timestamp2("dispatchAt"),
    completedAt: timestamp2("completedAt"),
    queuedAt: timestamp2("queuedAt"),
    dueAt: timestamp2("dueAt"),
    httpStatus: Number.isInteger(d.httpStatus) && d.httpStatus >= 100 && d.httpStatus <= 599 ? d.httpStatus : null,
    legacy: !!d.legacy,
    recipient: null,
    // Never expose arbitrary persisted/provider text through this projection.
    reason: row.bucket === "unknown" ? "Outcome not confirmed" : ["failed", "skipped"].includes(row.bucket) ? row.state.replace(/_/g, " ") : null
  };
}
var cursorTime = sql28`coalesce(occurred_at, -9007199254740991)`;
async function communicationUsage(user, input, conn = db, now = Date.now()) {
  const owned = await scope(user, conn);
  const parsed = filters.safeParse(input);
  assert(parsed.success, 400, "Invalid communication usage filters");
  const q = parsed.data;
  assert(!q.from || !q.to || Date.parse(q.from) <= Date.parse(q.to), 400, "Invalid date range");
  if (owned) {
    assert(q.source === "automatic" && (!q.clinicId || owned.ids.includes(q.clinicId)), 403, "Current clinic scope required");
  }
  const directory = (await conn.execute(sql28`
    select id,max(name) as name from (
      select doc->>'id' as id,doc->>'fullName' as name
      from (${sourceSql(user, "users")}) u
      where doc->>'role' in ('superAdmin','clinicAdmin','doctor','receptionist')
      union all
      select doc->>'userId' as id,doc->>'fullName' as name
      from (${sourceSql(user, "doctors")}) d
    ) report_users where nullif(id,'') is not null
    group by id order by max(name),id`)).rows;
  if (q.userId) assert(directory.some((u) => u.id === q.userId), 403, "User outside your reporting scope");
  const identities = directory.length ? sql28`values ${sql28.join(directory.map((u) => sql28`(${accountSubjectFingerprint(u.id)},${u.id},${u.name})`), sql28`, `)}` : sql28`select null::text,null::text,null::text where false`;
  const base = [ownership(user), sql28`data->>'source'=${q.source}`];
  if (q.clinicId) base.push(q.clinicId === "unattributed" ? sql28`attributed_clinic is null` : sql28`attributed_clinic=${q.clinicId}`);
  const conditions = [...base];
  if (q.from) conditions.push(sql28`occurred_at >= ${Date.parse(q.from)}`);
  if (q.to) conditions.push(sql28`occurred_at <= ${Date.parse(q.to)}`);
  if (q.channel) conditions.push(sql28`data->>'channel'=${q.channel}`);
  if (q.event) conditions.push(sql28`data->>'event'=${q.event}`);
  if (q.status) conditions.push(sql28`bucket=${q.status}`);
  if (q.userId) conditions.push(sql28`data->'reporting'->>${q.attribution}=${accountSubjectFingerprint(q.userId)}`);
  if (q.branchId) conditions.push(sql28`data->'reporting'->>'branchId'=${q.branchId}`);
  const dimension = q.groupBy === "user" ? sql28`identity.user_id` : q.groupBy === "location" ? sql28`data->'reporting'->>'branchId'` : q.groupBy === "event" ? sql28`data->>'event'` : q.groupBy === "recipientGroup" ? sql28`data->>'recipientGroup'` : sql28`attributed_clinic`;
  const dimensionLabel = q.groupBy === "user" ? sql28`identity.name` : q.groupBy === "location" ? sql28`(select data->>'name' from branches where id=matching.data->'reporting'->>'branchId' and clinic_id=attributed_clinic)` : q.groupBy === "clinic" ? sql28`(select data->>'name' from clinics where id=attributed_clinic)` : dimension;
  const matching = sql28.join(conditions, sql28` and `);
  let seek = sql28`true`;
  if (q.cursor) {
    let c;
    try {
      c = JSON.parse(Buffer.from(q.cursor, "base64url").toString());
    } catch {
    }
    assert(Array.isArray(c) && c.length === 2 && Number.isSafeInteger(c[0]) && typeof c[1] === "string" && idPattern.test(c[1]), 400, "Invalid communication cursor");
    seek = sql28`(${cursorTime},id) < (${c[0]}::bigint,${c[1]}::text)`;
  }
  const rawClinicId = owned?.id || (q.clinicId !== "unattributed" ? q.clinicId : void 0);
  const result = await conn.execute(sql28`${records(now, true, { clinicId: rawClinicId, source: q.source, ownerId: owned ? user.id : void 0 })},
    matching as (select * from records where ${matching}),
    counts as (
      select data->>'channel' as channel, bucket, attributed_clinic as "clinicId",
        (select data->>'name' from clinics where id=attributed_clinic) as "clinicName", count(*)::float8 as count
      from matching group by data->>'channel', bucket, attributed_clinic
    ), page as (
      select id, data, state, bucket, occurred_at, attributed_clinic from matching where ${seek}
      order by ${cursorTime} desc, id desc limit ${q.pageSize + 1}
    ), identities(fingerprint,user_id,name) as (${identities}),
    breakdowns as (select ${dimension} as key,coalesce(${dimensionLabel},'Unattributed / Unavailable') as label,
      matching.data->>'channel' as channel,bucket,count(*)::float8 as count from matching
      left join identities identity on identity.fingerprint=matching.data->'reporting'->>${q.attribution}
      group by 1,2,3,4)
    select
      coalesce((select jsonb_agg(to_jsonb(page) order by coalesce(occurred_at,-9007199254740991) desc,id desc) from page),'[]') as page,
      coalesce((select jsonb_agg(to_jsonb(counts)) from counts),'[]') as counts,
      coalesce((select jsonb_agg(to_jsonb(breakdowns)) from breakdowns),'[]') as breakdowns,
      (select count(*)::float8 from matching) as total,
      (select min(occurred_at)::float8 from records where ${sql28.join(base, sql28` and `)}) as earliest,
      (select count(*)::float8 from matching where data->>'legacy'='true') as legacy,
      (select count(*)::float8 from matching where attributed_clinic is null) as unattributed`);
  const r = result.rows[0];
  const page = r.page.slice(0, q.pageSize), last = page.at(-1);
  return {
    items: page.map(metadata),
    counts: r.counts,
    breakdowns: r.breakdowns,
    total: r.total,
    userOptions: directory.map((u) => ({ id: u.id, name: u.name || "Staff name unavailable" })),
    nextCursor: r.page.length > q.pageSize ? Buffer.from(JSON.stringify([last.occurred_at == null ? -9007199254740991 : Number(last.occurred_at), last.id])).toString("base64url") : null,
    timezone: "Asia/Kolkata",
    earliestAvailableAt: r.earliest,
    legacyCount: r.legacy,
    unattributedCount: r.unattributed,
    scopeClinicId: owned?.id || null,
    scopeClinicName: owned?.name || null
  };
}
async function communicationUsageDetail(user, id2, conn = db, now = Date.now()) {
  await scope(user, conn);
  assert(idPattern.test(id2), 400, "Invalid communication record ID");
  const result = await conn.execute(sql28`${records(now, false, { id: id2 })}
    select * from records where id=${id2} and ${ownership(user)}`);
  const row = result.rows[0];
  assert(row, 404, "Communication record unavailable");
  const safe = metadata(row);
  if (row.attributed_clinic && row.data.encrypted) {
    const log = projection(row, now);
    const contact = log.recipient;
    if (typeof contact === "string" && contact) {
      safe.recipient = contact.includes("@") ? `${contact.slice(0, 1)}***@***` : `***${contact.replace(/\D/g, "").slice(-2)}`;
    }
  }
  return safe;
}

// artifacts/api-server/src/routes/notification-history.ts
var notificationHistoryRouter = Router3();
notificationHistoryRouter.get("/reports/communication-usage", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(GetCommunicationUsageResponse.parse(await communicationUsage(await requireUser(req), req.query)));
});
notificationHistoryRouter.get("/reports/communication-usage/:id", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(GetCommunicationUsageDetailResponse.parse(await communicationUsageDetail(await requireUser(req), String(req.params.id))));
});
notificationHistoryRouter.get("/management/notification-logs", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(ListNotificationLogsResponse.parse(await listNotificationLogs(await requireUser(req), req.query)));
});
notificationHistoryRouter.get("/management/notification-logs/:id", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(GetNotificationLogResponse.parse(await getNotificationLog(await requireUser(req), String(req.params.id))));
});

// artifacts/api-server/src/routes/notification-templates.ts
init_notification_history();
init_db();
init_notification_templates();
import { Router as Router4 } from "express";
init_http();
init_native_auth();
init_notification_template_store();
init_notification_templates();
import { ipKeyGenerator } from "express-rate-limit";
init_notification_template_store();
init_email_preview();
var notificationTemplatesRouter = Router4();
notificationTemplatesRouter.get("/management/templates", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  assert(req.query.clinicId === void 0 || typeof req.query.clinicId === "string", 400, "Invalid clinic");
  assert(req.query.recipient === void 0 || templateRecipients.includes(req.query.recipient), 400, "Invalid recipient group");
  assert(req.query.channel === void 0 || ["email", "sms"].includes(String(req.query.channel)), 400, "Invalid channel");
  res.json(await templateCatalog(user, req.query.clinicId, req.query.recipient, req.query.channel === "sms" ? "sms" : "email"));
});
notificationTemplatesRouter.put("/management/templates", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  await consumeRateLimit(`template-edit:${user.id}`, 30, 9e5);
  res.json(await saveTemplate(user, req.body));
});
notificationTemplatesRouter.get("/management/event-controls", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  roles2(user, ["superAdmin"]);
  assert(req.query.clinicId === void 0 || typeof req.query.clinicId === "string", 400, "Invalid clinic");
  res.json(await eventControls(user, req.query.clinicId));
});
notificationTemplatesRouter.put("/management/event-controls", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  roles2(user, ["superAdmin"]);
  await consumeRateLimit(`event-control:${user.id}`, 30, 9e5);
  const input = eventControlInput.parse(req.body);
  await changeActivation(user, input);
  res.json(await eventControls(user, input.clinicId));
});
notificationTemplatesRouter.post("/management/templates/preview", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  roles2(user, ["superAdmin"]);
  await consumeRateLimit(`template-preview:${user.id}`, 60, 9e5);
  const prepared = await prepareTemplateTest(user, req.body);
  const html = "html" in prepared.rendered ? await emailPreviewHtml(prepared.rendered) : void 0;
  res.json({ status: "preview", message: "Preview only. Nothing sent or activated.", subject: prepared.rendered.subject, body: prepared.rendered.text, ...html ? { html } : {} });
});
notificationTemplatesRouter.post("/management/templates/test", async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  roles2(user, ["superAdmin"]);
  const sms = req.body?.channel === "sms";
  const testKey = sms ? "template-test:sms" : "template-test";
  await consumeRateLimit(`${testKey}:${user.id}`, sms ? 15 : 3, 9e5);
  await consumeRateLimit(`${testKey}:ip:${ipKeyGenerator(req.ip || "unknown")}`, sms ? 15 : 10, 9e5);
  try {
    res.json(await testTemplate(user, await prepareTemplateTest(user, req.body)));
  } catch (error) {
    const b = req.body;
    if (!user.demo && b?.confirmed === true && /^[a-f0-9-]{36}$/i.test(b.requestId || "") && ["sms", "email"].includes(b.channel) && templateEvents.includes(b.event) && templateRecipients.includes(b.recipientGroup))
      await recordDecision(db, `notification-test:${user.id}:${b.requestId}`, {
        channel: b.channel,
        event: b.event,
        recipientGroup: b.recipientGroup,
        source: "test",
        occurrence: b.requestId,
        clinicId: typeof b.clinicId === "string" && b.clinicId.length <= 100 ? b.clinicId : void 0
      }, "preparation_failed");
    throw error;
  }
});

// artifacts/api-server/src/routes/integrations.ts
import { Router as Router5 } from "express";
import { ipKeyGenerator as ipKeyGenerator2 } from "express-rate-limit";
init_db();
import { eq as eq26 } from "drizzle-orm";
init_http();
init_integration_config();
init_native_auth();
init_integration_vault();

// artifacts/api-server/src/lib/integration-checks.ts
init_integration_vault();
init_integration_config();
import { access, constants as constants2 } from "node:fs/promises";

// artifacts/api-server/src/lib/smtp-verification.ts
init_integration_config();
import nodemailer2 from "nodemailer";
async function verifySmtp(env) {
  const transport = nodemailer2.createTransport(smtpTransportOptions(smtpConfig(env)));
  let timer;
  try {
    await Promise.race([
      transport.verify(),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(Object.assign(new Error("SMTP verification deadline"), { code: "ETIMEDOUT" })), 35e3);
      })
    ]);
  } finally {
    clearTimeout(timer);
    transport.close();
  }
}

// artifacts/api-server/src/lib/integration-checks.ts
init_local_media();
init_objectStorage();
async function checkIntegration(provider) {
  const checks = [];
  let source = "environment";
  try {
    if (provider === "smtp") {
      const resolved = await resolvedIntegration("smtp");
      source = resolved.source;
      await verifySmtp(resolved.env);
      checks.push({ name: "Connection and authentication", status: "passed", message: "SMTP connection, TLS and authentication succeeded. No message was sent." });
      checks.push({ name: "Sender permission and inbox delivery", status: "not_verified", message: "SMTP verification cannot prove sender authorization or inbox delivery. Use the separately confirmed test email." });
    } else if (provider === "sms") {
      const resolved = await resolvedIntegration("sms");
      source = resolved.source;
      if (!integrationReadiness(resolved.env).sms.ready) throw Error("Incomplete");
      const env = resolved.env;
      const headers = { Authorization: `Basic ${Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString("base64")}` };
      const account2 = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}.json`, { headers, signal: AbortSignal.timeout(12e3) });
      if (!account2.ok || (await account2.json()).status !== "active") throw Error("Account unavailable");
      const service = await fetch(`https://messaging.twilio.com/v1/Services/${env.TWILIO_MESSAGING_SERVICE_SID}`, { headers, signal: AbortSignal.timeout(12e3) });
      if (!service.ok || (await service.json()).account_sid !== env.TWILIO_ACCOUNT_SID) throw Error("Service unavailable");
      checks.push({ name: "Account and messaging service access", status: "passed", message: "Credentials can read the active account and configured Messaging Service. No SMS was sent." });
      checks.push({ name: "SMS delivery permission", status: "not_verified", message: "Sender registration, destination restrictions, credit and delivery are not proven by read-only checks." });
    } else {
      const config = mediaConfig();
      if (config.driver === "local") {
        await access(config.root, constants2.R_OK | constants2.W_OK);
        checks.push({ name: "Folder access", status: "passed", message: "The configured folder is readable and writable by the service account. No file was created." });
      } else {
        const path2 = new ObjectStorageService().getPrivateObjectDir().replace(/^\/+/, "");
        const [permissions] = await objectStorageClient.bucket(path2.split("/")[0]).iam.testPermissions(["storage.objects.get", "storage.objects.create"]);
        for (const [permission, name] of [["storage.objects.get", "Read objects"], ["storage.objects.create", "Create objects"]]) {
          const allowed = permissions[permission];
          checks.push({ name, status: allowed ? "passed" : "failed", message: allowed ? "The provider reports this permission for the configured bucket. No object was read or uploaded." : "The provider did not grant this permission for the configured bucket. Check the application's bucket access." });
        }
      }
      checks.push({ name: "Durability and end-to-end upload", status: "not_verified", message: "This check cannot prove disk persistence, every object permission or successful browser uploads." });
    }
  } catch (error) {
    const code = error?.code;
    const reason = code === 401 || code === "EAUTH" ? "Authentication was rejected." : code === 403 ? "Access to the checked resource was denied." : code === 404 ? "The configured resource was not found." : ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "ESOCKET"].includes(code) ? "The provider could not be reached." : code === "INTEGRATION_KEY_REQUIRED" || code === "INTEGRATION_DECRYPT_FAILED" ? "The server encryption key is unavailable or cannot decrypt the saved settings." : "The configuration or provider access could not be verified.";
    checks.push({ name: provider === "storage" ? "Storage permission check" : "Connection/access check", status: "failed", message: `${reason} Check configuration and provider permissions. Raw provider diagnostics are not exposed because they may contain secrets.${provider === "storage" ? " A failed permission probe alone does not establish whether individual object uploads or downloads work." : ""}` });
  }
  return { provider, source, checkedAt: (/* @__PURE__ */ new Date()).toISOString(), checks };
}

// artifacts/api-server/src/routes/integrations.ts
init_local_media();
init_demo_policy();
var integrationsRouter = Router5();
var path = "/settings/integrations";
integrationsRouter.use(path, async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const user = await requireUser(req);
  roles2(user, ["superAdmin"]);
  if (user.demo || user.demoFixture === DEMO_FIXTURE) throw new HttpError(403, "Demo accounts cannot access integration credentials");
  res.locals.integrationActor = user.id;
  next();
});
integrationsRouter.get(path, async (_req, res) => {
  res.json(GetIntegrationSettingsResponse.parse(await integrationSettings()));
});
integrationsRouter.get(`${path}/storage`, async (_req, res) => {
  const config = mediaConfig();
  res.json({ provider: config.driver, source: "environment", publicPath: config.url, configured: config.driver === "object" ? !!process.env.PRIVATE_OBJECT_DIR : !!config.root });
});
integrationsRouter.post(`${path}/:provider/check`, async (req, res) => {
  const provider = String(req.params.provider);
  if (!["smtp", "sms", "storage"].includes(provider)) throw new HttpError(400, "Unsupported provider");
  await consumeRateLimit(`integration-check:${res.locals.integrationActor}`, 10, 9e5);
  res.json(await checkIntegration(provider));
});
integrationsRouter.put(path, async (req, res) => {
  await consumeRateLimit(`integration-edit:ip:${ipKeyGenerator2(req.ip || "unknown")}`, 20, 9e5);
  await consumeRateLimit(`integration-edit:actor:${res.locals.integrationActor}`, 5, 9e5);
  const parsed = UpdateIntegrationSettingsBody.strict().safeParse(req.body);
  if (!parsed.success) throw new HttpError(400, "Invalid configuration request", "INTEGRATION_INVALID");
  const body = parsed.data;
  const allowed = integrationFields[body.provider];
  if (Object.keys(body.values).some((key4) => !allowed.includes(key4)) || Object.entries(body.values).some(([key4, value]) => value.length > (key4 === "NOTIFICATION_SMS_MAPPING" ? 8192 : 2048)) || body.mode === "environment" && Object.keys(body.values).length)
    throw new HttpError(400, "Unsupported configuration fields", "INTEGRATION_INVALID");
  const [actor] = await db.select().from(users).where(eq26(users.id, res.locals.integrationActor));
  if (!await verifyPassword(actor?.passwordHash, body.currentPassword))
    throw new HttpError(403, "Password confirmation failed", "PASSWORD_CONFIRMATION_FAILED");
  await saveIntegration(body.provider, body.values, body.revision, body.mode, res.locals.integrationActor);
  res.json(GetIntegrationSettingsResponse.parse(await integrationSettings()));
});
integrationsRouter.post(`${path}/notification-sms/test-message`, async (req, res) => {
  const parsed = SendNotificationSmsTestMessageBody.strict().safeParse(req.body);
  if (!parsed.success || !/^\+[1-9]\d{6,14}$/.test(parsed.data.recipient) || !parsed.data.message.trim() || [parsed.data.senderId, parsed.data.dltEntityId, parsed.data.dltTemplateId].some((v) => v && /[\r\n]/.test(v)))
    throw new HttpError(400, "Enter a valid international phone number, message and sender identifiers", "INVALID_SMS_TEST");
  await consumeRateLimit(`sms-test:ip:${ipKeyGenerator2(req.ip || "unknown")}`, 10, 9e5);
  await consumeRateLimit(`sms-test:actor:${res.locals.integrationActor}`, 3, 9e5);
  const { recipient, message, senderId, dltEntityId, dltTemplateId, requestId, confirmed } = parsed.data;
  const outcome = await dispatchNotificationTest(res.locals.integrationActor, {
    channel: "sms",
    event: "provider_test",
    recipientGroup: "explicit",
    recipient,
    subject: "",
    message,
    requestId,
    confirmed,
    content: { senderId, dltEntityId, dltTemplateId }
  });
  const status = outcome === "pre_dispatch_failed" ? "not_dispatched" : outcome;
  const messages2 = {
    provider_accepted: "The provider accepted the test message. Handset delivery is not confirmed.",
    provider_rejected: "The provider rejected the test message. Check saved configuration and registered template identifiers.",
    delivery_unknown: "Delivery is unknown. Check the provider before sending again to avoid duplicates.",
    not_dispatched: "The test was not dispatched. Check the provider endpoint and network configuration."
  };
  res.json({ status, message: messages2[status] });
});
integrationsRouter.get(`${path}/smtp/test-receipt`, async (_req, res) => {
  res.json(GetSmtpTestReceiptResponse.parse(await latestSmtpTestReceipt(res.locals.integrationActor)));
});
integrationsRouter.post(`${path}/smtp/test-receipt`, async (req, res) => {
  const parsed = ConfirmSmtpTestReceiptBody.strict().safeParse(req.body);
  if (!parsed.success || parsed.data.received !== true || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(parsed.data.requestId))
    throw new HttpError(400, "Confirm receipt of a valid SMTP test.", "INVALID_SMTP_RECEIPT");
  res.json(GetSmtpTestReceiptResponse.parse(await confirmSmtpReceipt(res.locals.integrationActor, parsed.data.requestId)));
});
integrationsRouter.post(`${path}/smtp/test-email`, async (req, res) => {
  try {
    await consumeRateLimit(`smtp-test:ip:${ipKeyGenerator2(req.ip || "unknown")}`, 10, 9e5);
    await consumeRateLimit(`smtp-test:actor:${res.locals.integrationActor}`, 3, 9e5);
  } catch (error) {
    if (error instanceof HttpError && error.code === "RATE_LIMITED")
      throw new HttpError(429, "Test email limit reached. Try again later.", "SMTP_TEST_RATE_LIMIT");
    throw error;
  }
  const parsed = SendSmtpTestEmailBody.strict().safeParse(req.body);
  if (!parsed.success || !validEmailAddress(parsed.data.recipient))
    throw new HttpError(400, "Enter one valid recipient email address", "INVALID_RECIPIENT");
  const status = await dispatchNotificationTest(res.locals.integrationActor, {
    channel: "email",
    event: "provider_test",
    recipientGroup: "explicit",
    recipient: parsed.data.recipient,
    confirmed: parsed.data.confirmed,
    requestId: parsed.data.requestId,
    subject: "Digi-Q \u2014 SMTP configuration test",
    message: "This is a test email requested by a Digi-Q Super Admin to check SMTP configuration. No patient or account information is included."
  });
  const messages2 = {
    provider_accepted: "The SMTP provider accepted the test message. Inbox delivery is not confirmed.",
    provider_rejected: "The SMTP provider rejected the test message.",
    pre_dispatch_failed: "The test was not dispatched. Check SMTP configuration.",
    delivery_unknown: "Dispatch outcome is uncertain. Do not resend without checking the provider."
  };
  res.json({ status, message: messages2[status] });
});

// <stdin>
import express from "express";
var app = express();
app.use(express.json());
app.use((req, res, next) => {
  req.authUserId = req.headers["x-user"];
  req.authSessionHash = "fixture";
  next();
});
app.use(notificationTemplatesRouter);
app.use(integrationsRouter);
app.use(notificationHistoryRouter);
app.use(notificationSettingsRouter);
app.use((err, req, res, next) => res.status(err.status || 400).json({ error: "Sanitized", code: err.code }));
export {
  KEEP_IN_TOUCH_REQUEST_TIMEOUT_MS,
  KEEP_IN_TOUCH_URL,
  all,
  app,
  appointmentHistory,
  appointmentTransitions,
  appointments,
  assignments,
  audit,
  auditLogs,
  authChallenges,
  authRateLimits,
  authSessions,
  authorizeNotificationHistory,
  authorizedTemplateScope,
  availabilityExceptions,
  branches,
  capturePatientConfirmation,
  change,
  changeActivation,
  claimNotificationOccurrence,
  classifySmsResponse,
  cleanupNotificationHistory,
  clinics,
  confirmAppointmentEmail,
  confirmSmtpReceipt,
  confirmationPresentation,
  confirmationText,
  db,
  decryptIntegration,
  defaultConfirmationEmail,
  defaultRecipient,
  defaultSettings,
  defaultTemplate,
  deliveryControlCatalog,
  dispatchNotificationTest,
  doctors,
  eligibleStaffMobile,
  emailAddressPattern,
  emailFailure,
  emailNotificationsEnabled,
  encryptIntegration,
  enqueueEvent,
  enqueueSmsEvent,
  eventControlInput,
  eventControls,
  eventTestInput,
  eventTitles,
  filtered,
  flatten,
  getNotificationLog,
  getSettings,
  guestRequests,
  historyAssetSnapshots,
  historyId,
  historyRecords,
  initialConfirmationEmail,
  integrationCredentials,
  integrationFields,
  integrationReadiness,
  integrationSettings,
  isSecurityEvent,
  latestSmtpTestReceipt,
  listNotificationLogs,
  listNotificationsFor,
  listOwnerBookingMailOutcomes,
  lockNotificationPreferences,
  managedNotificationSettings,
  maskedDestination,
  masters,
  notificationEntry,
  notificationPhone,
  notificationReads,
  notificationRecipientUser,
  notificationSmsConfig,
  notificationSmsEnabled,
  notificationSmsReadiness,
  notificationTemplateKey,
  one,
  otpChallenges,
  outcomeMessages,
  paginate,
  patientAccountsForPhone,
  patientDocuments,
  patientLoginPhone,
  patientLoginSmsBody,
  patients,
  pendingPreferenceAllowed,
  personalNotificationSettings,
  personalPreferences,
  preferenceKey,
  prepareTemplateTest,
  processNotifications,
  processSmsNotifications,
  projection,
  publicSmsAddress,
  put,
  qrs,
  recipientPreference,
  recordDecision,
  recordNotification,
  reminderDispatchEligible,
  reminderDue,
  renderNotification,
  requireSecurityDelivery,
  requiredEvent,
  resolvedIntegration,
  resolvedTemplate,
  safeNotificationText,
  saveIntegration,
  saveManagedNotificationSettings,
  savePersonalNotificationSettings,
  saveTemplate,
  savedViews,
  schedules,
  securityEmail,
  securityEmailDiagnostic,
  securitySms,
  sendNotificationSms,
  sendPatientLoginSms,
  settings,
  smsMappingSchema,
  smsMetadataReady,
  smsPayload,
  smsTemplateContent,
  smsUrl,
  smtpConfig,
  smtpEnvironment,
  smtpFields,
  smtpTestFingerprint,
  smtpTransportOptions,
  staffDeletionReceipts,
  staffErasedAssets,
  staffErasedIdentities,
  staffSessionProofs,
  startNotificationWorker,
  startPatientSmsLogin,
  substitute,
  templateCatalog,
  templateContent,
  templateEvents,
  templateRecipients,
  templateSave,
  templateSnapshot,
  templateVariables,
  testTemplate,
  uid,
  users,
  validEmailAddress,
  validEventContent,
  validTemplateTarget,
  variablesForTemplate,
  vaultConfigured,
  verifyPatientSmsLogin,
  writePersonalPreferences
};
