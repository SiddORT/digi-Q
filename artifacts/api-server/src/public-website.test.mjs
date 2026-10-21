import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { build } from "esbuild";
const require = createRequire(import.meta.url);
const compiled = await build({
  stdin: { resolveDir: import.meta.dirname, contents: `
    export * from "../../../lib/api-zod/src/public-website";
    export * from "./lib/public-website";
    export * from "./lib/public-website-config";
    export { clinicBookingLink } from "./lib/notification-template-values";
    export { patientBookingPath } from "../../clinicflow/src/components/patient-qr";
    export { staffQrPayload } from "../../clinicflow/src/lib/staff-qr";
  ` }, bundle: true, platform: "node", format: "cjs", write: false,
  define: { "process.env.CLINICFLOW_PUBLIC_ORIGIN": "globalThis.fictionalPublicOrigin" },
});
const mod = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(require, mod, mod.exports);
const { parsePublicOrigin, publicWebsiteUrl, publicOrigin, publicUrl, publicWebsiteConfig, clinicBookingLink, patientBookingPath, staffQrPayload } = mod.exports;

test("only HTTPS authorities, including UAT and harmless trailing separators, are accepted", () => {
  for (const [input, expected] of [
    [" https://CARE.example.invalid:443/// ", "https://care.example.invalid"],
    ["https://uat.example.invalid:8443/", "https://uat.example.invalid:8443"],
  ]) assert.equal(parsePublicOrigin(input), expected);
  for (const value of [undefined, "", "care.example.invalid", "http://care.example.invalid",
    "https://user:pass@care.example.invalid", "https://@care.example.invalid", "https://care.example.invalid/prefix",
    "https://care.example.invalid/../", "https://care.example.invalid?x=1",
    "https://care.example.invalid?", "https://care.example.invalid#",
    "https://care.example.invalid/#secret", "https://care.example.invalid\\evil", "https://care.exa\nmple.invalid"]) {
    assert.equal(parsePublicOrigin(value), null, String(value));
  }
});
test("all server links and the minimal no-store public response share the authority, never the request host", () => {
  for (const origin of ["https://care.example.invalid", "https://uat.example.invalid:8443"]) {
    globalThis.fictionalPublicOrigin = `${origin}/`;
    assert.equal(publicOrigin(), origin);
    assert.equal(publicUrl("/set-password?token=fictional"), `${origin}/set-password?token=fictional`);
    assert.equal(publicUrl("/check-in?payload=v1.fictional.signature"), `${origin}/check-in?payload=v1.fictional.signature`);
    assert.equal(clinicBookingLink({ slug: "fictional-care" }), `${origin}/fictional-care`);
    const headers = {}, response = { setHeader: (k,v) => {headers[k]=v;}, json: v => {response.body=v;} };
    publicWebsiteConfig({ get: () => "https://alternate.example.invalid", protocol: "https" }, response);
    assert.deepEqual(headers, { "Cache-Control": "no-store" });
    assert.deepEqual(response.body, { publicOrigin: origin });
  }
  for (const origin of [undefined, "", "http://bad.example.invalid", "https://bad.example.invalid/path"]) {
    globalThis.fictionalPublicOrigin = origin;
    assert.throws(() => publicOrigin(), e => e.status === 503 && e.code === "PUBLIC_ORIGIN_UNCONFIGURED");
    assert.equal(clinicBookingLink({ slug: "fictional-care" }), "");
  }
});
test("stored routes and private payloads are preserved; arbitrary external authority is rejected", () => {
  const origin = "https://care.example.invalid";
  const route = "/check-in?payload=v1.opaque%2Breference.signature";
  assert.equal(publicWebsiteUrl(origin, route), origin + route);
  for (const value of ["//evil.example.invalid/book/x", "https://evil.example.invalid/book/x", "/\\evil.example.invalid", "book/x"])
    assert.throws(() => publicWebsiteUrl(origin, value));
});
test("canonical QR links work from alternate prefixed frontends without widening patient/staff boundaries", () => {
  const browser = "https://alternate.example.invalid", canonical = "https://care.example.invalid";
  assert.equal(patientBookingPath(`${canonical}/fictional-care/main-location?book=1`, browser, "/preview/", canonical), "/fictional-care/main-location?book=1");
  assert.equal(patientBookingPath(`${browser}/preview/book/ref_1`, browser, "/preview/", canonical), "/book/ref_1");
  assert.equal(patientBookingPath(`${canonical}/check-in?payload=private`, browser, "/preview/", canonical), null);
  assert.equal(patientBookingPath("https://evil.example.invalid/book/ref", browser, "", canonical), null);
  assert.equal(patientBookingPath(`${canonical}/book/ref`, browser, "/preview/", null), null);
  assert.deepEqual(staffQrPayload(`${canonical}/check-in?payload=private`, browser, "/preview/", canonical), { payload: "private" });
  assert.deepEqual(staffQrPayload(`${browser}/preview/check-in?payload=private`, browser, "/preview/", canonical), { payload: "private" });
  assert.deepEqual(staffQrPayload("v1.opaque.signature", browser, "/preview/", null), { payload: "v1.opaque.signature" });
  for (const value of [`${canonical}/book/ref`, "https://evil.example.invalid/check-in?payload=private"])
    assert.ok("error" in staffQrPayload(value, browser, "/preview/", canonical));
});
