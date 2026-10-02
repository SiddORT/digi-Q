import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const out = new URL(`../../.phone-test-${process.pid}.mjs`, import.meta.url);
let m;
before(async () => { await build({ entryPoints: [fileURLToPath(new URL("./validators.ts", import.meta.url)), fileURLToPath(new URL("./phone.ts", import.meta.url))].slice(1), outfile: fileURLToPath(out), bundle: true, platform: "node", format: "esm", packages: "external" }); m = await import(out.href); });
after(async () => { await unlink(out).catch(() => {}); });
test("splits stored international numbers into country and national", () => {
  assert.deepEqual(m.splitPhone("+919876543210"), { country: "IN", national: "9876543210" });
  assert.deepEqual(m.splitPhone("+442079460958"), { country: "GB", national: "2079460958" });
  assert.equal(m.splitPhone("+12025550123", "CA").national, "2025550123");
  assert.deepEqual(m.splitPhone("", "IN"), { country: "IN", national: "" });
});
test("joins with selected country, pasted international wins, trunk zero dropped", () => {
  assert.equal(m.joinPhone("IN", "98765 43210"), "+919876543210");
  assert.equal(m.joinPhone("GB", "07911 123456"), "+447911123456");
  assert.equal(m.joinPhone("IN", "+44 7911 123456"), "+447911123456");
  assert.equal(m.joinPhone("IN", "0044 7911 123456"), "+447911123456");
  assert.equal(m.joinPhone("IN", ""), "");
});
test("country-aware validation", () => {
  assert.equal(m.phoneValidityMessage("+919876543210"), undefined);
  assert.match(m.phoneValidityMessage("+9198765"), /length|valid/);
  assert.equal(m.phoneValidityMessage(""), undefined);
});
test("national display formatting keeps digits", () => {
  assert.equal(m.formatNational("IN", "9876543210").replace(/\D/g, ""), "9876543210");
});
