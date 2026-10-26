import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const bundle = await build({
  stdin: { contents: `export * from "./lib/notification-templates";
    export * from "./lib/email-presentation"; export * from "./lib/email-preview";
    export * from "./lib/security-template-definitions";`,
    resolveDir: import.meta.dirname, loader: "ts" },
  write: false, bundle: true, platform: "node", format: "esm",
  plugins: [{ name: "no-storage", setup(b) {
    b.onResolve({ filter: /logo-bytes$/ }, () => ({ path: "logo", namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'export const loadLogoBytes=async()=>{throw Error("Real storage forbidden")};' }));
  } }],
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`);
const content = body => ({ enabled: true, subject: "Your visit & details", body, footer: "Saved footer {{clinic_name}}", prefix: "Clinic", logoUrl: "" });
const visit = { introduction: "Your appointment is confirmed.", clinic: "Example & Partners",
  location: "North location", doctor: "Dr Example", date: "26 Oct 2026", start: "9:00 AM",
  end: "12:00 PM", timezone: "Asia/Kolkata", reference: "EX-0042", token: "A-01",
  contact: "reception@example.invalid", closing: "Keep your appointment ticket. A session is a time range, not an exact consultation time. Check in with reception when you arrive." };
const values = { clinic_name: visit.clinic, doctor_name: visit.doctor, patient_name: "Example Patient",
  reference: visit.reference, clinic_contact: visit.contact, appointment_details: "Complete legacy summary\nDoctor: Other full summary\nNo information dropped." };

test("structured booking preserves wording/order with one complete detail card, never summary-as-doctor", () => {
  const source = content("Hello {{patient_name}},\n\nYour booking at {{clinic_name}} is confirmed.\n{{appointment_details}}\nReference: {{reference}}\n{{clinic_contact}}");
  const result = api.renderNotification(source, values, { event: "booking", visit });
  assert.equal(result.subject, "Clinic Your visit & details");
    assert.equal(result.text, "Hello Example Patient,\n\nYour booking at Example & Partners is confirmed.\n" + values.appointment_details + "\nReference: EX-0042\nreception@example.invalid\n\n" + api.emailSupportText + "\n\nSaved footer Example & Partners");
  assert.match(result.html, />Doctor<\/td><td[^>]*>Dr Example<\/td>/);
  for (const value of [visit.location, visit.date, visit.timezone, visit.token, visit.closing]) assert.ok(result.html.includes(value), value);
  assert.equal((result.html.match(/EX-0042/g) || []).length, 1);
  assert.equal((result.html.match(/reception@example.invalid/g) || []).length, 1);
  assert.ok(result.html.indexOf("Hello ") < result.html.indexOf("Your booking"));
});

test("legacy and previous summaries remain complete and distinguishable; substitutions are inert", () => {
  const malicious = '<img src=x onerror="alert(1)"> {{otp}} & patient';
  const result = api.renderNotification(content("Hello {{patient_name}}\nPrevious details: {{previous_details}}\nNew details:\n{{appointment_details}}"),
    { ...values, patient_name: malicious, previous_details: "Old visit <details>\nOld location\nOld reference", otp: "009812" }, { event: "rescheduled" });
  assert.ok(result.text.includes(malicious));
  assert.match(result.html, /&lt;img src=x onerror=&quot;alert\(1\)&quot;&gt; \{\{otp\}\} &amp; patient/);
  assert.doesNotMatch(result.html, /<img|YOUR OTP|009812/);
  assert.match(result.html, /PREVIOUS VISIT/);
  for (const v of ["Old location", "Old reference", "Complete legacy summary", "No information dropped."]) assert.ok(result.html.includes(v));
  assert.ok(result.html.indexOf("Old location") < result.html.indexOf("New details:"));
});

const assertSupportOnly = html => {
  const links = [...html.matchAll(/href="([^"]*)"/g)].map(m => m[1]);
  assert.deepEqual(links, ["mailto:no-reply@digi-q.in", "mailto:no-reply@digi-q.in"]);
  assert.match(html, />Get support /);
  assert.match(html, />no-reply@digi-q.in<\/a>/);
};
test("each OTP event has real code/expiry and only the fixed support action, with no fabricated names", () => {
  for (const event of ["patient_login_otp", "clinic_registration_otp", "patient_email_otp", "staff_email_otp", "registration_mobile_otp", "staff_mobile_otp"]) {
    const source = api.defaultTemplate(event);
    const result = api.renderNotification(source, { otp: "004281", expiry_minutes: "7", patient_name: "Forbidden fabricated patient" }, { event });
    assert.equal(result.text, [api.substitute(source.body, { otp: "004281", expiry_minutes: "7" }), api.emailSupportText, api.automatedFooter].join("\n\n"));
    assert.match(result.html, /aria-label="Verification code 004281"/);
    assert.match(result.html, /Valid for <strong>7 minutes<\/strong>/);
    assert.match(result.html, /Care\. Plan\. Care Together/);
    assert.match(result.html, /For your security/);
    assert.match(result.html, /Need help/);
    assert.doesNotMatch(result.html, /123456|10 minutes|Forbidden fabricated patient|appointment booking|DigiQ Doctors/);
    assertSupportOnly(result.html);
    assert.match(result.html, /Hello,/);
    assert.match(result.html, /If you did not request this OTP/);
    const code = result.html.match(/user-select:all">([\s\S]*?)<\/div>/)[1].replace(/<[^>]*>/g, "");
    assert.equal(code, "004281");
    assert.equal((result.html.match(/aria-hidden="true" style="display:inline-block;box-sizing/g) || []).length, 6);
    if (event === "clinic_registration_otp") assert.match(result.html, /Clinic registration verification/);
    if (event === "patient_login_otp") assert.match(result.html, /Login verification/);
  }
});

test("supported HTTPS links become descriptive buttons and fallback links; unsafe schemes remain escaped text", () => {
  for (const key of ["setup_link", "sign_in_link", "booking_link"]) {
    const url = "https://example.invalid/path?token=fictional&next=%2Fhome";
    const result = api.renderNotification(content(`Before\n{{${key}}}\nAfter`), { [key]: url, clinic_name: "Example" });
    assert.equal((result.html.match(/href="https:\/\/example.invalid/g) || []).length, 2);
    assert.match(result.html, /Or use this link/);
    assert.ok(result.text.includes(url));
    for (const invalid of ["javascript:alert(1)", "data:text/html,<script>x</script>", "https://user:password@example.invalid", "//example.invalid", "http://example.invalid"]) {
      const html = api.renderNotification(content(`{{${key}}}`), { [key]: invalid }).html;
      assertSupportOnly(html);
      assert.doesNotMatch(html, /<script/);
    }
  }
});

test("onboarding and account notices do not invent visits; missing contacts and long names remain safe", () => {
  for (const event of ["onboarding", "staff_welcome", "password_setup_complete"]) {
    const result = api.renderNotification(api.defaultTemplate(event), { clinic_name: "Long".repeat(200), recipient_name: "Example Recipient", clinic_contact: "", role_name: "Doctor", location_names: "", sign_in_link: "https://example.invalid/sign-in" }, { event });
    assert.doesNotMatch(result.html, /Your appointment is confirmed|>Doctor<\/td>|>Session<\/td>|>Clinic contact<\/td>/);
    assert.match(result.html, /overflow-wrap:anywhere/);
    assert.doesNotMatch(result.html, /undefined/);
  }
});

test("clinic logo uses CID in sends; preview embeds only selected logo bytes and reports failures", async () => {
  const logoPath = "/api/branding/logos/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const result = api.renderNotification({ ...content("Saved message"), logoUrl: logoPath }, values);
  assert.equal(result.logoPath, logoPath);
  assert.match(result.html, /src="cid:clinic-logo"/);
  const preview = await api.emailPreviewHtml(result, async path => {
    assert.equal(path, logoPath); return Buffer.from("fictional-png-bytes");
  });
  assert.match(preview, /src="data:image\/png;base64,/);
  assert.doesNotMatch(preview, /cid:|\/api\/branding\/logos/);
  const missing = await api.emailPreviewHtml(result, async () => { throw Error("private/path"); });
  assert.match(missing, /Clinic logo unavailable in preview/);
  assert.doesNotMatch(missing, /private\/path|cid:/);
  assert.match(api.renderNotification({ ...content("message"), logoUrl: "https://example.invalid/logo.png" }, values).html, /src="https:\/\/example.invalid\/logo.png"/);
});

test("fixed support is identical in sends and previews, outside immutable authored content", async () => {
  const source = { ...api.defaultTemplate("patient_email_otp"), body: "Saved DigiQ Doctors wording: {{otp}} — {{expiry_minutes}} minutes.", footer: "Authored footer" };
  const snapshot = structuredClone(source);
  const rendered = api.renderNotification(source, { otp: "000001", expiry_minutes: "3", support_link: "https://evil.invalid", clinic_contact: "evil@example.invalid" }, { event: "patient_email_otp" });
  assert.equal(await api.emailPreviewHtml(rendered), rendered.html);
  assert.deepEqual(source, snapshot);
  assert.match(rendered.html, /Saved DigiQ Doctors wording/);
  assert.match(rendered.html, /Authored footer/);
  assertSupportOnly(rendered.html);
  assert.doesNotMatch(rendered.html, /evil/);
  assert.equal((rendered.html.match(/Need help\?/g) || []).length, 1);
  assert.ok(rendered.text.includes("000001"));
});

test("security authoring still rejects every literal destination, including the fixed presentation address", () => {
  for (const event of api.securityEvents) {
    const source = api.defaultTemplate(event);
    assert.equal(api.validEventContent(event, source), true);
    for (const destination of ["https://evil.invalid", "www.evil.invalid", "evil@example.invalid",
      "mailto:evil@example.invalid", "no-reply@digi-q.in", "mailto:no-reply@digi-q.in", '<a href="https://evil.invalid">Support</a>']) {
      for (const field of ["subject", "body", "prefix", "footer"]) {
        assert.equal(api.validEventContent(event, { ...source, [field]: `${source[field]} ${destination}` }), false, `${event}/${field}/${destination}`);
      }
    }
    assert.equal(api.validEventContent(event, { ...source, body: `${source.body} {{support_link}}` }), false);
  }
  assert.equal(api.safeEmailUrl("mailto:no-reply@digi-q.in"), undefined);
});

test("optional names are not inferred; supported account names and actions remain escaped and ordered", () => {
  const source = api.defaultTemplate("doctor_setup");
  const rendered = api.renderNotification(source, { recipient_name: '<Example & Co>', role_name: "Doctor",
    setup_link: "https://example.invalid/setup?token=fictional", expiry_minutes: "23" }, { event: "doctor_setup" });
  assert.match(rendered.html, /&lt;Example &amp; Co&gt;/);
  assert.match(rendered.html, /Set up your password/);
  assert.match(rendered.text, /23 minutes/);
  assert.doesNotMatch(rendered.html, /YOUR OTP|Hello,<\/div>/);
  assert.ok(rendered.html.indexOf("Hello ") < rendered.html.indexOf("Set up your password"));
  for (const expiry of ["", "0", "<invalid>"]) {
    const html = api.otpEmailPanel("000001", expiry);
    assert.doesNotMatch(html, /Valid for|10 minutes|<invalid>/);
  }
});

// Reproducible browser examples, generated only on explicit request and ignored by Git.
if (process.argv.includes("--examples")) {
  const dir = resolve(import.meta.dirname, "../../../generated-artifacts/email-theme");
  await mkdir(dir, { recursive: true });
  const examples = {
    booking: api.renderNotification(api.defaultTemplate("booking"), values, { event: "booking", visit }).html,
    otp: api.renderNotification(api.defaultTemplate("clinic_registration_otp"), { otp: "004281", expiry_minutes: "7" }, { event: "clinic_registration_otp" }).html,
    rescheduled: api.renderNotification(api.defaultTemplate("rescheduled"), { ...values, previous_details: "Example & Partners · South location\nDoctor: Dr Previous\nDate: 25 Oct 2026\nSession: 2:00 PM–4:00 PM (Asia/Kolkata)\nReference: EX-0042" }, { event: "rescheduled", visit: { ...visit, introduction: "Visit details:" } }).html,
    onboarding: api.renderNotification(api.defaultTemplate("onboarding"), values, { event: "onboarding" }).html,
    "long-image-blocked": api.renderNotification({ ...content("Hello {{patient_name}},\n{{appointment_details}}"), logoUrl: "https://example.invalid/blocked-logo.png" },
      { ...values, patient_name: "<UnusuallyLongName>".repeat(30) }, { event: "booking", visit }).html,
  };
  for (const [name, html] of Object.entries(examples)) await writeFile(resolve(dir, `${name}.html`), html);
}
