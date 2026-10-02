// Isolated renderer and transport doubles: no environment secrets or SMTP connections.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";

const fixtureConfig = {
  host: "smtp.example.invalid", port: 587, secure: false, requireTLS: true,
  user: "fixture-user", password: "fixture-only", from: "sender@example.invalid",
};
const bundle = await build({
  stdin: {
    contents: 'export { systemEmailTemplate } from "./lib/email-template"; export { sendAuthEmail } from "./lib/auth-email";',
    resolveDir: import.meta.dirname, loader: "ts",
  },
  bundle: true, write: false, platform: "node", format: "esm",
  plugins: [{
    name: "isolated-email",
    setup(builder) {
      builder.onResolve({ filter: /logo-bytes$/ }, () => ({ path: "logo", namespace: "logo-fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "logo-fixture" }, () => ({ contents: 'export const loadLogoBytes=async()=>{throw Error("No real storage access in email tests")};' }));
      builder.onResolve({ filter: /integration-vault$/ }, () => ({ path: "vault", namespace: "vault-fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "vault-fixture" }, () => ({ contents: "export const resolvedIntegration=async()=>({env:{}});" }));
      builder.onResolve({ filter: /integration-config$/ }, () => ({ path: "config", namespace: "fixture" }));
      builder.onResolve({ filter: /^\.\/http$/ }, () => ({ path: "http", namespace: "fixture" }));
      builder.onResolve({ filter: /^nodemailer$/ }, () => ({ path: "mail", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
        contents: path === "config"
          ? `export function smtpConfig(){return ${JSON.stringify(fixtureConfig)}}`
          : path === "http"
            ? 'export class HttpError extends Error { constructor(status,message,code){super(message);this.status=status;this.code=code;} }'
            : `export default {createTransport(options){
                globalThis.emailTemplateTransportOptions=options;
                return {async sendMail(message){
                  globalThis.emailTemplateMessage=message;
                  return {accepted:[message.to],rejected:[]};
                }};
              }};`,
      }));
    },
  }],
});
const { systemEmailTemplate, sendAuthEmail } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);

test("branded HTML escapes subject and body; plaintext preserves the original content", () => {
  const subject = '<img src=x onerror="alert(1)"> & \'Subject\'';
  const body = '<script>alert("unsafe")</script>\n<a href="file:///private">link</a> & \'quote\'';
  const result = systemEmailTemplate(subject, body);
  assert.match(result.html, /DigiQ Doctors/);
  assert.match(result.html, /Please do not reply/);
  assert.ok(result.html.includes("&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;Subject&#39;"));
  assert.ok(result.html.includes("&lt;script&gt;alert(&quot;unsafe&quot;)&lt;/script&gt;"));
  assert.ok(result.html.includes("&lt;a href=&quot;file:///private&quot;&gt;link&lt;/a&gt; &amp; &#39;quote&#39;"));
  assert.doesNotMatch(result.html, /<script|<img|<a /);
  assert.ok(result.text.includes(subject));
  assert.ok(result.text.includes(body));
});

test("codes, token URLs, already-formatted dates and line endings are not interpreted", () => {
  const body = "Code: 001234\r\nhttps://example.invalid/reset?token=Ab_C-9.012&next=%2Fhome\nDate: 03/04/2026 09:05 PM +05:30";
  const result = systemEmailTemplate("Account access", body);
  assert.ok(result.text.includes(body));
  assert.ok(result.html.includes(body.replace("&", "&amp;")));
  assert.doesNotMatch(result.html, /href=|src=/);
});

test("empty and Unicode bodies remain valid branded messages", () => {
  for (const body of ["", "こんにちは 👩🏽‍⚕️ — café"]) {
    const result = systemEmailTemplate("Notice", body);
    assert.ok(result.text.includes(`\n\n${body}\n\n`));
    assert.ok(result.html.includes(`>${body}</div>`));
  }
});

test("injected legacy void transport receives safe branded multipart content", async () => {
  let message;
  await sendAuthEmail("recipient@example.invalid", "Account access", "Code: 001234", {
    async sendMail(options) { message = options; },
  });
  assert.equal(message.from, fixtureConfig.from);
  assert.equal(message.to, "recipient@example.invalid");
  assert.equal(message.subject, "Account access");
  assert.match(message.text, /Code: 001234/);
  assert.match(message.html, /DigiQ Doctors/);
  assert.equal(message.disableFileAccess, true);
  assert.equal(message.disableUrlAccess, true);
});

test("provider rejection and transport diagnostics become generic delivery errors", async () => {
  for (const result of [
    { accepted: [], rejected: [] },
    { accepted: [], rejected: ["private-recipient"] },
    { accepted: ["recipient@example.invalid"], rejected: ["private-recipient"] },
    { rejected: ["private-recipient"] },
  ]) {
    await assert.rejects(sendAuthEmail("recipient@example.invalid", "Subject", "Body", {
      async sendMail() { return result; },
    }), { status: 503, code: "EMAIL_DELIVERY_FAILED", message: "Email delivery unavailable" });
  }
  await assert.rejects(sendAuthEmail("recipient@example.invalid", "Subject", "Body", {
    async sendMail() { throw new Error("private SMTP fixture diagnostics"); },
  }), { status: 503, code: "EMAIL_DELIVERY_FAILED", message: "Email delivery unavailable" });
  await sendAuthEmail("recipient@example.invalid", "Subject", "Body", {
    async sendMail() { return { accepted: ["recipient@example.invalid"], rejected: [] }; },
  });
});

test("default transport keeps mandatory TLS, validation defaults, timeouts and access restrictions", async () => {
  await sendAuthEmail("recipient@example.invalid", "Subject", "Body");
  const options = globalThis.emailTemplateTransportOptions;
  assert.equal(options.requireTLS, true);
  assert.equal(options.secure, false);
  assert.equal(options.connectionTimeout, 10000);
  assert.equal(options.greetingTimeout, 10000);
  assert.equal(options.socketTimeout, 20000);
  assert.equal(options.disableFileAccess, true);
  assert.equal(options.disableUrlAccess, true);
  assert.equal(options.tls?.rejectUnauthorized, undefined);
  assert.equal(globalThis.emailTemplateMessage.disableFileAccess, true);
  assert.equal(globalThis.emailTemplateMessage.disableUrlAccess, true);
  delete globalThis.emailTemplateTransportOptions;
  delete globalThis.emailTemplateMessage;
});