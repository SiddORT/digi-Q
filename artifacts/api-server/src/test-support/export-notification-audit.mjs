// Read-only evidence export. Only pure renderers are retained in the bundle:
// no database, environment values, transport, worker or application is executed.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "../../../..");
const src = path.resolve(import.meta.dirname, "..");
const pure = new Set(["notification-templates", "security-template-definitions",
  "notification-template-values", "display-preferences", "appointment-confirmation"]);
const bundle = await build({
  stdin: {
    contents: `export * from "./lib/notification-templates";
      export * from "./lib/security-template-definitions";
      export * from "./lib/notification-template-values";
      export { confirmationText } from "./lib/appointment-confirmation";`,
    resolveDir: src, loader: "ts",
  },
  bundle: true, platform: "node", format: "esm", write: false, metafile: true,
  define: { "process.env.CLINICFLOW_PUBLIC_ORIGIN": JSON.stringify("https://example.invalid") },
  plugins: [{ name: "pure-audit-only", setup(b) {
    b.onResolve({ filter: /.*/ }, args => {
      if (args.path === "zod" || args.importer.includes("/node_modules/") ||
        pure.has(path.basename(args.path).replace(/\.ts$/, ""))) return;
      return { path: args.path, external: true, sideEffects: false };
    });
  } }],
});
assert.equal(Object.values(bundle.metafile.outputs).flatMap(o => o.imports).length, 0,
  "The preview bundle must not retain database, transport or other runtime imports");
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const clinic = { name: "Fictional Lotus Clinic", slug: "fictional-lotus",
  email: "reception@example.invalid", phone: "[fictional clinic phone]",
  dateFormat: "DD/MM/YYYY", timeFormat: "24h" };
const visit = { patientName: "Example Patient", clinicName: clinic.name,
  branchName: "Example East Location", doctorName: "Dr Example Doctor",
  date: "2030-01-15", startTime: "09:00", endTime: "12:00", timezone: "Asia/Kolkata",
  reference: "CF-FICTIONAL-001", token: "Q-007", tokenNumber: 7, status: "waiting" };
const previous = { ...visit, date: "2030-01-14", startTime: "14:00", endTime: "17:00",
  token: "Q-003", tokenNumber: 3 };
const source = await fs.readFile(path.join(src, "lib/appointment-confirmation.ts"), "utf8");
const actualSubject = source.match(/claimed\.rendered\?\.subject\s*\|\|\s*"([^"]+)"/)?.[1];
assert.equal(actualSubject, "DigiQ Doctors — Appointment confirmation");
const details = api.confirmationText(visit, clinic);
const oldDetails = api.confirmationText(previous, clinic).replace("Your appointment is confirmed.", "Previous visit details:");
const values = {
  ...api.visitTemplateValues(visit, clinic, "Example Recipient", previous),
  clinic_name: clinic.name, clinic_contact: `${clinic.email} · ${clinic.phone}`,
  patient_name: visit.patientName, doctor_name: visit.doctorName,
  appointment_details: details.replace("Your appointment is confirmed.", "Visit details:"),
  previous_details: oldDetails, reference: visit.reference, timezone: visit.timezone,
  booking_link: "https://example.invalid/fictional-lotus",
  otp: "123456", expiry_minutes: "10",
  setup_link: "https://example.invalid/set-password?token=fictional-preview-only",
  role_name: "staff member",
};
const sections = [
  "# Fictional notification previews",
  "Generated from the workspace's pure template and ticket renderers. These are built-in defaults, not saved effective UAT wording and not sends. Every identity, code, reference and link below is fictional. Disabled recipient templates are deliberately included to expose their wording before any opt-in.",
  "## Actual built-in patient booking delivery",
  "The editor preview is different; this is the special default patient confirmation path.",
  `Subject: **${actualSubject}**\n\n\`\`\`text\n${details}\n\`\`\``,
];
let count = 0;
for (const event of api.templateEvents) {
  for (const recipient of api.templateRecipients) {
    if (!api.validTemplateTarget(event, recipient, "email")) continue;
    const content = api.defaultTemplate(event, recipient);
    const role = recipient === "doctor" ? "doctor" : event === "password_setup_complete"
      ? "staff member" : recipient === "clinicAdmin" ? "Clinic Admin" : "staff member";
    const rendered = api.renderNotification(content, { ...values, role_name: role,
      appointment_details: event === "booking" && recipient === "patient" ? details : values.appointment_details });
    assert(!rendered.text.includes("{{"), `${event}/${recipient} left unresolved placeholders`);
    sections.push(`## ${api.eventTitles[event]} — ${recipient}`,
      `Event: \`${event}\`. Built-in email activation: **${content.enabled ? "on" : "off"}**. ${event === "booking" && recipient === "patient" ? "**Editor preview only; actual default delivery appears above.**" : ""}`,
      `Subject: **${rendered.subject}**\n\n\`\`\`text\n${rendered.text}\n\`\`\``);
    count++;
  }
}
// Verify audit claims without changing an effective template.
assert(!api.defaultTemplate("rescheduled", "clinicAdmin").body.includes("previous_details"));
assert(api.defaultTemplate("rescheduled", "patient").body.includes("previous_details"));
assert(api.validEventContent("booking", { ...api.defaultTemplate("booking"),
  subject: "Doctor password setup", body: "Your registration is ready." }),
  "Operational wording validation does not enforce semantic action alignment");
let smsCount = 0;
sections.push("# Fictional SMS fallback previews",
  "SMS sends only body text, not an email subject or footer. Operational fallbacks are off. New registration/setup security fallbacks below are blocked until approved content is explicitly published; Required is not approval. Existing patient login SMS separately requires provider/sender/DLT readiness. These are fictional renders only.");
for (const event of api.templateEvents) {
  for (const recipient of api.templateRecipients) {
    if (!api.validTemplateTarget(event, recipient, "sms")) continue;
    const fallback = api.defaultTemplate(event, recipient);
    const content = api.isSecurityEvent(event) ? api.securityDefault(event, true) : fallback;
    const body = api.isSecurityEvent(event) || event === "patient_login_otp"
      ? content.body : `${api.eventTitles[event]}: {{clinic_name}}\n${fallback.body}`;
    const rendered = api.substitute(body, { ...values,
      role_name: recipient === "doctor" ? "doctor" : event === "password_setup_complete"
        ? "staff member" : recipient === "clinicAdmin" ? "Clinic Admin" : "staff member" });
    assert(!rendered.includes("{{"));
    const gate = api.isSecurityEvent(event) ? "Required fallback; dispatch blocked without approved publication"
      : event === "patient_login_otp" ? "Required existing login fallback; provider metadata still required"
      : "Off by default; optional gates apply";
    sections.push(`## SMS: ${api.eventTitles[event]} — ${recipient}`,
      gate, `\`\`\`text\n${rendered}\n\`\`\``);
    smsCount++;
  }
}
const previews = sections.join("\n\n");
await fs.writeFile(path.join(root, "docs/audits/notification-journey-previews.md"), previews + "\n");
const installed = await fs.readdir(path.join(root, "node_modules/.pnpm"));
const markdownPackage = installed.find(name => name.startsWith("markdown-it@"));
assert(markdownPackage, "The existing markdown-it dependency is required");
const { default: MarkdownIt } = await import(pathToFileURL(path.join(root,
  "node_modules/.pnpm", markdownPackage, "node_modules/markdown-it/index.mjs")).href);
const report = await fs.readFile(path.join(root, "docs/audits/notification-journey-coverage.md"), "utf8");
const body = new MarkdownIt({ html: false }).render(`${report}\n\n---\n\n${previews}`);
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>ClinicFlow notification journey audit</title><style>
body{font:15px/1.65 system-ui,sans-serif;margin:0;background:#fafbf9;color:#193431}
main{max-width:1180px;margin:auto;padding:32px}h1,h2,h3{line-height:1.25}
h1{color:#13786f}h2{margin-top:36px;border-bottom:1px solid #ccd9d5;padding-bottom:8px}
table{border-collapse:collapse;width:100%;font-size:12px;margin:20px 0}
th,td{border:1px solid #ccd9d5;padding:8px;text-align:left;vertical-align:top}
th{background:#eaf2ed}pre{white-space:pre-wrap;padding:16px;background:#eef3ef}
p,li,td,pre,code{overflow-wrap:anywhere}a{color:#13786f}hr{margin:48px 0}
@media(max-width:700px){main{padding:16px}table{display:block;overflow-x:auto}}
@media print{body{background:white;font-size:10pt}main{padding:0}tr,pre{break-inside:avoid}h2,h3{break-after:avoid}}
</style></head><body><main>${body}</main></body></html>`;
await fs.mkdir(path.join(root, "generated-artifacts"), { recursive: true });
await fs.writeFile(path.join(root, "generated-artifacts/notification-journey-audit.html"), html);
console.log(`Rendered ${count} email editor/event previews, ${smsCount} SMS fallbacks, plus actual patient booking delivery; pure-bundle and discrepancy assertions passed. No live access or sends.`);
