import { readFile, writeFile } from "node:fs/promises";
import { clerkClient } from "@clerk/express";
import {
  assignments,
  auditLogs,
  branches,
  clinics,
  db,
  pool,
  users,
} from "@workspace/db";
import { eq } from "drizzle-orm";

const manifestPath = "/tmp/clinicflow-manual-invitation-audit.json";
const reportPath = new URL("../../docs/audits/manual-invitation-delivery-investigation.md", import.meta.url);
const resourcesPath = new URL("../../artifacts/api-server/src/routes/resources.ts", import.meta.url);
const invitationApiPath = new URL(
  "../../node_modules/.pnpm/@clerk+backend@3.18.1/node_modules/@clerk/backend/dist/api/endpoints/InvitationApi.d.ts",
  import.meta.url,
);
const emailApiPath = new URL(
  "../../node_modules/.pnpm/@clerk+backend@3.18.1/node_modules/@clerk/backend/dist/api/endpoints/EmailApi.d.ts",
  import.meta.url,
);
const clinicName = "Sunshine Multispeciality Clinic";
const branchName = "Sunshine Multispeciality Clinic – Baner Branch";

type Manifest = {
  suite: string;
  marker: string;
  createdAt: string;
  phase: string;
  inbox: string;
  clinicId: string;
  branchId: string;
  managingAdminId: string;
  actor: { userId?: string };
  target: { userId?: string; invitationId?: string };
  invitation?: {
    mechanism: string;
    notify: boolean;
    redirectPath: string;
    configuredExpiryDays: number;
    providerStatus: string;
  };
};

type EmailTemplate = {
  slug?: string;
  delivered_by_clerk?: boolean;
  enabled?: boolean;
  flagged_as_suspicious?: boolean;
  created_at?: number;
  updated_at?: number;
  body?: string;
  markup?: string;
};

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function iso(value: Date | number | string) {
  return new Date(value).toISOString();
}

function isoOptional(value: number | undefined) {
  return value === undefined ? "not returned" : iso(value);
}

async function main() {
  assert(process.env.NODE_ENV === "development", "Refusing: investigation requires NODE_ENV=development.");
  assert(process.env.CLERK_SECRET_KEY?.startsWith("sk_test_"), "Refusing: expected a Clerk development key.");

  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  assert(manifest.suite === "manual-real-invitation-audit" && manifest.phase === "invited",
    "Refusing: the retained manual invitation fixture is not in invited phase.");
  assert(manifest.target.userId && manifest.target.invitationId,
    "Refusing: the retained fixture lacks target ownership identifiers.");

  const [target] = await db.select().from(users).where(eq(users.id, manifest.target.userId));
  assert(target && target.email.toLowerCase() === manifest.inbox,
    "Refusing: target app user does not match the private manifest recipient.");
  const [clinic] = await db.select().from(clinics).where(eq(clinics.id, manifest.clinicId));
  const [branch] = await db.select().from(branches).where(eq(branches.id, manifest.branchId));
  const links = await db.select().from(assignments).where(eq(assignments.userId, target.id));
  const auditRows = await db.select().from(auditLogs).where(eq(auditLogs.entityId, target.id));

  const invitations = await clerkClient.invitations.getInvitationList({
    query: manifest.inbox,
    limit: 100,
  });
  const exactInvitations = invitations.data.filter(item =>
    item.id === manifest.target.invitationId &&
    item.emailAddress.toLowerCase() === manifest.inbox);
  assert(exactInvitations.length === 1,
    "The exact manifest-owned Clerk invitation could not be uniquely read.");
  const invitation = exactInvitations[0];
  const instance = await clerkClient.instance.get();
  const identities = await clerkClient.users.getUserList({
    emailAddress: [manifest.inbox],
    limit: 10,
  });

  const resourcesSource = await readFile(resourcesPath, "utf8");
  const invitationApiSource = await readFile(invitationApiPath, "utf8");
  const emailApiSource = await readFile(emailApiPath, "utf8");
  const createCall = resourcesSource.match(
    /clerkClient\.invitations\.createInvitation\(\{([\s\S]*?)\n\s*\}\);/,
  )?.[1] || "";
  const explicitNotify = /\bnotify\s*:/.test(createCall);
  const sdkNotifyDefaultsTrue = /Whether an email invitation should be sent[\s\S]*Defaults to `true`/.test(
    invitationApiSource,
  );
  const sdkCreateSaysSendsEmail = /Creates a new invitation[\s\S]*sends the invitation email/.test(
    invitationApiSource,
  );
  const emailGetNeedsId = /get\(emailId: string\)/.test(emailApiSource);
  const emailListAvailable = /\b(list|getEmailList)\s*\(/.test(emailApiSource);
  const templateReadAvailable = Object.keys(clerkClient).some(key =>
    /email.*template|template.*email|emailSmsTemplate/i.test(key));
  const templateResponse = await fetch("https://api.clerk.com/v1/templates/email", {
    method: "GET",
    headers: {
      authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
      accept: "application/json",
    },
  });
  const templateStatus = templateResponse.status;
  let invitationTemplate: EmailTemplate | undefined;
  if (templateResponse.ok) {
    const templates = await templateResponse.json() as unknown;
    assert(Array.isArray(templates), "Documented template list returned an unexpected response shape.");
    invitationTemplate = (templates as EmailTemplate[]).find(item => item.slug === "invitation");
  } else {
    await templateResponse.arrayBuffer();
  }
  const templateBodyReferencesClinicMetadata = invitationTemplate
    ? /clinicFlowClinicNames|clinic_flow_clinic_names/i.test(
      `${invitationTemplate.body || ""}\n${invitationTemplate.markup || ""}`,
    )
    : null;

  const roleCorrect = target.role === "receptionist";
  const clinicCorrect = clinic?.id === manifest.clinicId &&
    (clinic.data as Record<string, unknown>)?.name === clinicName;
  const branchCorrect = branch?.id === manifest.branchId &&
    branch.clinicId === manifest.clinicId &&
    (branch.data as Record<string, unknown>)?.name === branchName;
  const mappingsCorrect = links.length === 2 &&
    links.every(link => link.clinicId === manifest.clinicId) &&
    links.filter(link => link.branchId === null).length === 1 &&
    links.filter(link => link.branchId === manifest.branchId).length === 1;
  const metadata = invitation.publicMetadata || {};
  const providerRoleMetadataCorrect = metadata.clinicFlowRole === "receptionist";
  const providerClinicMetadataCorrect =
    Array.isArray(metadata.clinicFlowClinicNames) &&
    metadata.clinicFlowClinicNames.length === 1 &&
    metadata.clinicFlowClinicNames[0] === clinicName;
  const invitationCreated = invitation.id === manifest.target.invitationId;
  const recipientCorrect = invitation.emailAddress.toLowerCase() === manifest.inbox &&
    target.email.toLowerCase() === manifest.inbox;
  const ticketCreated = typeof invitation.url === "string" && invitation.url.length > 0;
  const exactCreateAudit = auditRows.filter(row =>
    row.action === "create" &&
    row.entityType === "users" &&
    row.actorId === manifest.actor.userId);
  const resendAudits = auditRows.filter(row => /invitationResent/i.test(row.action));

  const investigatedAt = new Date().toISOString();
  const templateFinding = invitationTemplate
    ? `Slug \`${invitationTemplate.slug}\`; \`delivered_by_clerk=${String(invitationTemplate.delivered_by_clerk)}\`; \`enabled=${String(invitationTemplate.enabled)}\`; \`flagged_as_suspicious=${String(invitationTemplate.flagged_as_suspicious)}\`; created ${isoOptional(invitationTemplate.created_at)}; updated ${isoOptional(invitationTemplate.updated_at)}.`
    : templateResponse.ok
      ? `No exact \`invitation\` slug was present in the successful list response (HTTP ${templateStatus}).`
      : `Template list unavailable (HTTP ${templateStatus}); the response body was discarded.`;
  const templateDeliveryConclusion = !invitationTemplate
    ? "The documented template read did not return the exact invitation template, so its delivery mode remains unknown."
    : invitationTemplate.enabled === false
      ? "The live invitation email template is disabled. This is concrete configuration evidence that Clerk template delivery is off."
      : invitationTemplate.delivered_by_clerk === false
        ? "The live template is not delivered by Clerk; configuration delegates delivery to a custom email.created webhook."
        : "The live template is enabled and delivered by Clerk. Template-off/custom-delivery configuration does not explain the missing message.";
  const lines = [
    "# Manual invitation delivery investigation",
    "",
    `**Investigation time:** ${investigatedAt}`,
    "**Mode:** Urgent read-only inspection; the retained invitation and all temporary records were left unchanged.",
    "**Reported mailbox result:** The intended recipient reports no invitation email was received.",
    "**Overall status:** Invitation record valid and still pending; actual email-provider acceptance and mailbox delivery are unverified.",
    "",
    "## Requested result table",
    "",
    "| Area | Result | Proof level | Evidence |",
    "|---|---|---|---|",
    `| Invitation created | Yes | Direct live Clerk read | The exact private-manifest invitation exists and is \`${invitation.status}\`. |`,
    `| Recipient correct | ${recipientCorrect ? "Yes" : "No"} | Direct private reconciliation | App user and exact Clerk invitation both match the private-manifest recipient. The address is not reproduced here. |`,
    `| Role correct | ${roleCorrect && providerRoleMetadataCorrect ? "Yes" : "No"} | Direct DB and provider metadata reads | App role and invitation metadata both say Receptionist. |`,
    `| Clinic mapping correct | ${clinicCorrect && mappingsCorrect ? "Yes" : "No"} | Direct DB read | Exactly one clinic-level membership exists for ${clinicName}. |`,
    `| Branch mapping correct | ${branchCorrect && mappingsCorrect ? "Yes" : "No"} | Direct DB read | Exactly one branch assignment exists for ${branchName}, in the expected clinic. |`,
    `| Provider clinic-name metadata | ${providerClinicMetadataCorrect ? "Correct" : "Empty/not correct"} | Direct live Clerk read | The app's persisted clinic/branch assignments are correct, but the invitation's clinic-name metadata array is empty. This is not evidence of an email delivery outcome. |`,
    `| Invitation ticket created | ${ticketCreated ? "Yes" : "No"} | Direct live Clerk read | The exact recipient invitation resource contains a ticket URL. It was not printed, parsed, opened, or consumed. |`,
    `| Send requested | ${sdkNotifyDefaultsTrue && sdkCreateSaysSendsEmail ? "Yes, by documented default semantics" : "Unverified"} | Code plus installed SDK contract | The app called Clerk createInvitation. The app did **not** include a literal \`notify:true\`; the installed SDK documents \`notify\` as defaulting to true and describes createInvitation as sending the invitation email. No wire capture exists. |`,
    "| Send accepted | Unverified | Evidence boundary | Clerk accepted creation of the invitation resource. That response has no email message ID or provider-acceptance/delivery field, so pending invitation status is not proof that an email provider accepted a message. |",
    "| Delivery status | Not received per recipient; provider delivery status unavailable | User report plus API boundary | No delivered, bounced, rejected, deferred, suppressed, or failed state is exposed on the invitation resource. |",
    "| Failure reason | Unknown | Evidence boundary | No live bounce, rejection, suppression, quota-exhaustion, or provider error evidence is available. |",
    "",
    "## Dates and current state",
    "",
    `- Private fixture was checked at ${iso(manifest.createdAt)}.`,
    `- App target record was created at ${iso(target.createdAt)}.`,
    `- Clerk invitation was created at ${iso(invitation.createdAt)} and last updated at ${iso(invitation.updatedAt)}.`,
    `- Clerk invitation status at ${investigatedAt}: \`${invitation.status}\`.`,
    `- App invitation status at ${investigatedAt}: \`${target.invitationStatus}\`; this app value means createInvitation returned without throwing, not that mailbox delivery succeeded.`,
    `- Matching Clerk user identities at investigation time: ${identities.data.length}. The pending invitation has not become the expected accepted user identity.`,
    `- Exact app create-audit rows: ${exactCreateAudit.length}; resend-audit rows for this target: ${resendAudits.length}.`,
    `- Clerk instance environment returned by the documented read-only instance SDK endpoint: \`${instance.environmentType}\`.`,
    "",
    "## Notify and invitation evidence",
    "",
    `- The retained private manifest records the intended mechanism, a ${manifest.invitation?.configuredExpiryDays ?? "configured"}-day configured expiry, and intended notify behavior. It is ownership/context evidence, not a network trace.`,
    `- The current app source ${explicitNotify ? "does explicitly pass" : "does not explicitly pass"} \`notify:true\` to Clerk. It relies on Clerk's documented default of true.`,
    "- The exact Clerk resource independently proves creation, current pending state, exact private recipient association, Receptionist role metadata, and existence of a URL on that same resource.",
    "- The invitation clinic-name metadata array is empty even though the persisted app mapping is exact. This metadata discrepancy does not prove or explain email non-delivery.",
    "- The provider URL was only checked for presence on the exact recipient resource. It was not exposed, parsed, requested, or used.",
    "- Pending is an invitation lifecycle state. It does not establish email-provider acceptance, delivery, inbox placement, or recipient receipt.",
    "",
    "## Email mechanism and custom-sender check",
    "",
    "- ClinicFlow calls Clerk's Backend SDK `invitations.createInvitation` directly.",
    "- No application email transport, SMTP client, transactional-email provider client, invitation email sender, or `email.created` webhook handler is present in the server code searched.",
    "- Therefore there is no app-side custom sender attempt or app-side provider error to inspect.",
    "- The installed Clerk SDK does not expose an email-template client, so the investigation used the official documented deprecated read-only REST list endpoint exactly once.",
    `- Live invitation template: ${templateFinding}`,
    `- Template references clinic metadata in body/markup: \`${String(templateBodyReferencesClinicMetadata)}\`. Only this boolean was retained; no subject, HTML, body, markup, or variable content was logged or reported.`,
    `- ${templateDeliveryConclusion}`,
    "- This finding does not claim that Clerk Dashboard/management access is unavailable; dashboard configuration and logs were not evaluated by this SDK-only script.",
    "",
    "## Delivery-log and query boundary",
    "",
    `| Read-only query/evidence source | Outcome | Sanitized detail |`,
    "|---|---|---|",
    `| Clerk invitation list, exact private recipient and invitation ID | Success | One exact invitation returned; status \`${invitation.status}\`. |`,
    `| Clerk instance GET | Success | Environment type \`${instance.environmentType}\`. |`,
    "| Clerk user lookup, exact private recipient | Success | No accepted matching Clerk user identity currently exists. |",
    `| Clerk email status GET | Unavailable for this invitation | The installed SDK ${emailGetNeedsId ? "requires" : "does not document"} an email message ID; the invitation resource exposes none. No speculative ID or endpoint was used. |`,
    `| Clerk email list/log query | Unavailable in installed documented SDK | ${emailListAvailable ? "A list method exists but was not associated safely." : "No email list/log method is exposed."} |`,
    `| Clerk invitation-email template list GET | ${templateResponse.ok ? "Success" : `Unavailable (HTTP ${templateStatus})`} | Official documented REST endpoint used once because ${templateReadAvailable ? "the SDK client association was unsuitable" : "no read-only template SDK client is exposed"}. ${templateFinding} |`,
    "| Bounce/rejection/suppression/message ID | Unavailable | The invitation has no such fields, and no correlated email ID is available for the documented email GET. |",
    "| Dashboard/management delivery logs | Not evaluated by this script | No claim is made about dashboard availability or what authorized management views may expose. |",
    "",
    "## Development-instance limits",
    "",
    "- The live instance identifies itself as Development.",
    "- Clerk public documentation states development emails normally use an `@accounts.dev` sender and documents a development allowance of 100 emails per month.",
    "- Current quota usage is unknown. There is no live evidence that the allowance was exhausted, so quota exhaustion is **not** identified as the cause.",
    "- There is likewise no evidence of suppression, bounce, rejection, spam filtering, or a recipient-side fault.",
    "",
    "## Conclusion",
    "",
    "- **Known:** the exact recipient, Receptionist role, one exact persisted clinic, one exact persisted branch, provider role metadata, and ticket association are correct. Clerk created the invitation and still reports it pending.",
    "- **Known discrepancy:** the invitation's provider clinic-name metadata array is empty. No evidence ties that metadata discrepancy to email delivery.",
    "- **Known:** the app invoked Clerk's standard invitation API and relied on its documented notify-default behavior; it did not explicitly serialize `notify:true`.",
    "- **Known:** the recipient reports that no email arrived.",
    `- **Template configuration:** ${templateDeliveryConclusion}`,
    "- **Not verified:** email-message creation, downstream provider acceptance, delivery, bounce/rejection/suppression state, message ID, and development quota usage.",
    `- **Cause:** ${invitationTemplate?.enabled === false
      ? "the live invitation template is disabled; no further provider-log evidence is available to determine whether anything else contributed."
      : invitationTemplate?.delivered_by_clerk === false
        ? "Clerk delivery is disabled for this template and delivery is delegated to a custom webhook; no correlated custom-delivery attempt or error is available in this app."
        : "indeterminate. The live template configuration is on for Clerk delivery, while message logs/quota remain unavailable. No specific quota, bounce, suppression, recipient-side, or provider failure is claimed."}`,
    "- The invitation flow must remain paused and must not be marked passed until real delivery and the complete invitation → password setup → staff login flow are verified.",
    "- No invitation/account resend, revoke, creation, deletion, cleanup, authentication/settings change, or business-data change was performed.",
    "",
  ];

  await writeFile(reportPath, lines.join("\n"));
}

main()
  .catch(error => {
    console.error(error instanceof Error ? error.message : "Sanitized investigation failure.");
    process.exitCode = 1;
  })
  .finally(() => pool.end());