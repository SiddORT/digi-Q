import { createHash, randomUUID } from "node:crypto";
import { db, settings, auditLogs, users } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { assert } from "./http";
import { recordNotification, recordDecision } from "./notification-history";
import { resolvedIntegration } from "./integration-vault";
import { smtpConfig } from "./integration-config";
import { notificationSmsConfig, smsPayload, sendNotificationSms, type SmsOutcome } from "./notification-sms-transport";
import { sendAuthEmail } from "./auth-email";
import { storedSmsDiagnostic, type SmsDiagnostic } from "./notification-sms-diagnostics";
import { withStaffDispatch } from "./staff-dispatch-barrier";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { smtpTestFingerprint } from "./smtp-test-receipt";

type TestInput = {
  channel: "email" | "sms"; event: string; recipientGroup: string; clinicId?: string;
  recipient: string; subject: string; message: string; requestId: string; confirmed: boolean;
  templateId?: string; templateScope?: string; templateRevision?: number;
  content?: { senderId?: string; dltEntityId?: string; dltTemplateId?: string };
  rendered?: { text: string; html: string; logoPath?: string };
};
/** One claim shared by provider and template tests. Explicit requests bypass optional
 * activation gates but never configuration, authentication or durable at-most-once. */
export async function dispatchNotificationTest(actor: string, input: TestInput, conn: any = db,
  smsSend = sendNotificationSms, emailSend = sendAuthEmail, onDiagnostic?: (diagnostic: SmsDiagnostic) => void): Promise<SmsOutcome> {
  assert(input.confirmed && /^[a-f0-9-]{36}$/i.test(input.requestId), 400, "Confirm the test and provide a request ID");
  const ids = new Set([actor]);
  const accounts = await conn.select({ id: users.id, role: users.role, email: users.email, mobile: users.mobile }).from(users);
  const phone = (value: unknown) => {
    try { return parsePhoneNumberFromString(String(value || ""), "IN")?.number || ""; } catch { return ""; }
  };
  for (const account of accounts) {
    if (!["superAdmin", "clinicAdmin", "doctor", "receptionist"].includes(account.role)) continue;
    if (input.channel === "email" ? account.email.toLowerCase() === input.recipient.toLowerCase() :
      Boolean(phone(input.recipient)) && phone(account.mobile) === phone(input.recipient)) ids.add(account.id);
  }
  return withStaffDispatch([...ids], "test",
    () => dispatchNotificationTestInternal(actor, input, conn, smsSend, emailSend, onDiagnostic), conn,
    outcome => outcome === "delivery_unknown");
}
async function dispatchNotificationTestInternal(actor: string, input: TestInput, conn: any,
  smsSend: typeof sendNotificationSms, emailSend: typeof sendAuthEmail, onDiagnostic?: (diagnostic: SmsDiagnostic) => void): Promise<SmsOutcome> {
  const reportDiagnostic = (diagnostic: SmsDiagnostic) => {
    try { onDiagnostic?.(diagnostic); } catch { /* Reporting never permits a resend. */ }
  };
  assert(input.confirmed && /^[a-f0-9-]{36}$/i.test(input.requestId), 400, "Confirm the test and provide a request ID");
  const id = `notification-test:${actor}:${input.requestId}`;
  const digest = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const entry = { channel: input.channel, event: input.event, recipientGroup: input.recipientGroup,
    clinicId: input.clinicId, source: "test" as const, occurrence: input.requestId,
    _sourceInput: { snapshot: { actorId: actor } } };
  const claim = await conn.transaction(async (tx: any) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${id}))`);
    const [prior] = await tx.select().from(settings).where(eq(settings.id, id));
    if (prior) {
      assert(prior.data.digest === digest, 409, "Request ID already used for a different test");
      return { replay: prior.data.status as SmsOutcome, diagnostic: storedSmsDiagnostic(prior.data.diagnosticCode, prior.data.httpStatus) };
    }
    let env: NodeJS.ProcessEnv, sender: string, provider: string, secrets: string[];
    try {
      env = (await resolvedIntegration(input.channel === "sms" ? "notificationSms" : "smtp", tx)).env;
      if (input.channel === "sms") {
        const cfg = notificationSmsConfig(env);
        smsPayload(cfg, input.recipient, input.message, input.content || {});
        sender = input.content?.senderId || cfg.senderId; provider = cfg.provider; secrets = [cfg.key, cfg.bearerToken];
      } else {
        const cfg = smtpConfig(env);
        sender = cfg.from; provider = "smtp"; secrets = [cfg.password];
      }
    } catch {
      await tx.insert(settings).values({ id, data: { digest, status: "pre_dispatch_failed", createdAt: Date.now() } });
      await recordDecision(tx, id, entry, "configuration_failed");
      return { replay: "pre_dispatch_failed" as SmsOutcome };
    }
    // The permanent claim is the authority; history failure cannot permit a second send.
    await tx.insert(settings).values({ id, data: { digest, status: "delivery_unknown", createdAt: Date.now(), claimedAt: Date.now(),
      ...(input.channel === "email" && input.event === "provider_test"
        ? { receiptKind: "smtp_provider_test", smtpFingerprint: smtpTestFingerprint(env) } : {}),
    } });
    await tx.insert(auditLogs).values({
      id:randomUUID(),actorId:actor,action:"notification_test",entityType:"notification_templates",entityId:input.channel,
      summary:`${input.channel} ${input.event} ${input.recipientGroup} test requested`,
    });
    await recordNotification(tx, id, entry, "sending", {
      sender, provider, recipient: input.recipient, subject: input.subject, message: input.message,
      templateId: input.templateId, templateScope: input.templateScope, templateRevision: input.templateRevision,
      dltTemplateId: input.content?.dltTemplateId,
    }, secrets);
    return { env };
  });
  if (claim.replay) {
    if (claim.replay === "provider_rejected" && "diagnostic" in claim && claim.diagnostic) reportDiagnostic(claim.diagnostic);
    return claim.replay;
  }
  let status: SmsOutcome = "delivery_unknown", httpStatus: number | undefined;
  let diagnostic: SmsDiagnostic | undefined;
  try {
    if (input.channel === "sms") status = await smsSend(claim.env!, input.recipient, input.message, input.content || {}, code => { httpStatus = code; },
      info => { diagnostic = storedSmsDiagnostic(info.code, httpStatus); });
    else {
      await emailSend(input.recipient, input.subject, input.message, undefined, input.rendered, [], claim.env!);
      status = "provider_accepted";
    }
  } catch (error: any) {
    status = error?.code === "EMAIL_REJECTED" ? "provider_rejected" :
      ["EMAIL_UNCONFIGURED", "EMAIL_PRE_DISPATCH_FAILED"].includes(error?.code) ? "pre_dispatch_failed" : "delivery_unknown";
  }
  if (status !== "provider_rejected") diagnostic = undefined;
  // If final persistence fails, the permanent unknown claim prevents replay.
  try {
    await conn.update(settings).set({ data: sql`${settings.data} || ${JSON.stringify({ digest, status, finishedAt: Date.now(),
      ...(diagnostic ? { diagnosticCode: diagnostic.code, httpStatus: diagnostic.httpStatus } : {}) })}::jsonb` }).where(eq(settings.id, id));
    await recordNotification(conn, id, entry, status, undefined, [], Date.now(), httpStatus);
  } catch { /* Durable unknown claim retained; never rethrow to encourage a new send. */ }
  if (diagnostic) reportDiagnostic(diagnostic);
  return status;
}
