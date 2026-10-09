import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const file = resolve(import.meta.dirname, `.registration-test-${process.pid}.mjs`);
await build({ stdin: { contents: 'export * from "./registration-draft"; export * from "./locality-selection";', resolveDir: import.meta.dirname }, outfile: file, bundle: true, platform: "node", format: "esm" });
const m = await import(file);
after(async () => { await rm(file, { force: true }); delete globalThis.sessionStorage; });
const storage = () => { const map = new Map(); globalThis.sessionStorage = { getItem: k => map.get(k) || null, setItem: (k,v) => map.set(k,v), removeItem: k => map.delete(k) }; return map; };
test("temporary account draft excludes every secret and is mode/actor isolated", () => {
  const map = storage(), key = m.registrationDraftKey("account", "anonymous");
  assert.equal(m.writeRegistrationDraft(key, m.accountDraftSchema, { fullName: "Fictional Owner", email: "owner@example.invalid", step: "verify", password: "never-write-this", code: "123456", challengeId: "credential" }), true);
  assert.doesNotMatch(map.get(key), /never-write|123456|credential|password|challengeId/);
  assert.equal(m.readRegistrationDraft(m.registrationDraftKey("self", "other"), m.accountDraftSchema).data, undefined);
  assert.equal(m.readRegistrationDraft(key, m.accountDraftSchema).data.step, "verify");
  assert.equal(m.clearRegistrationDraft(key), true);
  assert.equal(map.size, 0);
});
test("expired, malformed, wrong-version and blocked drafts fail safely", () => {
  const map = storage();
  for (const raw of ["{", JSON.stringify({version:9,expires:Date.now()+5000,data:{}}), JSON.stringify({version:1,expires:Date.now()-1,data:{}}), JSON.stringify({version:1,expires:Date.now()+5000,data:{password:"secret"}})]) {
    map.set("draft", raw);
    assert.equal(m.readRegistrationDraft("draft", m.accountDraftSchema).data, undefined);
  }
  globalThis.sessionStorage = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); }, removeItem() { throw Error("blocked"); } };
  assert.deepEqual(m.readRegistrationDraft("draft", m.accountDraftSchema), {stored:false});
  assert.equal(m.writeRegistrationDraft("draft", m.accountDraftSchema, {fullName:"Fictional", email:"owner@example.invalid", step:"details"}), false);
  assert.equal(m.clearRegistrationDraft("draft"), false);
});
test("locality selection removes only its inserted segment and preserves manual/substrings and later selections", () => {
  let value = m.toggleLocality("Mulund West Avenue", [], "Mulund West|Mumbai", "Mulund West");
  assert.equal(value.address, "Mulund West Avenue, Mulund West");
  value = m.toggleLocality(value.address, value.localities, "Nahur|Mumbai", "Nahur");
  value = m.toggleLocality(value.address, value.localities, "Mulund West|Mumbai", "Mulund West");
  assert.equal(value.address, "Mulund West Avenue, Nahur");
  value = m.toggleLocality(value.address, value.localities, "Nahur|Mumbai", "Nahur");
  assert.deepEqual(value, {address:"Mulund West Avenue", localities:[]});
  assert.deepEqual(m.toggleLocality("Street, Mulund West", [], "Mulund West|Mumbai", "Mulund West"), {address:"Street, Mulund West",localities:[]});
  const inserted = m.toggleLocality("Street", [], "local|district", "Local");
  assert.deepEqual(m.reconcileLocalities(inserted.address.replace("Local", "Manual edit"), inserted.localities), []);
});
