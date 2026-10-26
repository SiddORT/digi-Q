import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { setupDraftSchema, writeRegistrationDraft, readRegistrationDraft } from "./registration-draft.ts";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const { outputFiles } = await build({ entryPoints: [new URL("./clinic-address.ts", import.meta.url).pathname], bundle: true, platform: "node", format: "esm", write: false });
const { resolveClinicAddress, clinicAddressProblem, normalizeClinicSlug, clinicAddressConflict, resolveLocationAddresses, locationAddressProblem } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

test("blank and whitespace entries choose a checked name-derived address", async () => {
  const calls = [];
  for (const input of ["", "  "]) {
    assert.equal(await resolveClinicAddress("Café Care", input, async slug => { calls.push(slug); return true; }), "cafe-care");
  }
  assert.deepEqual(calls, ["cafe-care", "cafe-care"]);
});

test("short, non-Latin, punctuation-only, reserved and truncated names always produce valid addresses", async () => {
  for (const name of ["A", "AB", "医院", "!!!", "admin", "doctor", "api", "health", `${"a".repeat(62)} rest`, "a".repeat(100)]) {
    const slug = await resolveClinicAddress(name, "", async () => true);
    assert.equal(clinicAddressProblem(slug), "", `${name}: ${slug}`);
    assert.ok(slug.length >= 3 && slug.length <= 63);
  }
  assert.equal(normalizeClinicSlug(`${"a".repeat(62)} more`).endsWith("-"), false);
});

test("collisions have bounded alternatives, then a unique fallback, without accepting unchecked values", async () => {
  const seen = [];
  const chosen = await resolveClinicAddress("Popular Clinic", "", async slug => { seen.push(slug); return seen.length === 8; }, () => "123456abcdef");
  assert.equal(chosen, "popular-clinic-123456abcdef");
  assert.deepEqual(seen.slice(0, 3), ["popular-clinic", "popular-clinic-2", "popular-clinic-3"]);
  let calls = 0;
  await assert.rejects(resolveClinicAddress("Taken", "", async () => { calls++; return false; }), /Try again or enter/);
  assert.equal(calls, 10);
});

test("custom values retain format, reserved-name and availability validation and are never substituted", async () => {
  for (const slug of ["a", "-abc", "abc-", "a--b", "Bad", "has space", "a".repeat(64), "admin", "doctor"]) {
    let calls = 0;
    await assert.rejects(resolveClinicAddress("Other Name", slug, async () => { calls++; return true; }));
    assert.equal(calls, 0);
  }
  const checked = [];
  await assert.rejects(resolveClinicAddress("Other Name", "custom-clinic", async slug => { checked.push(slug); return false; }), /unavailable/);
  assert.deepEqual(checked, ["custom-clinic"]);
  assert.equal(await resolveClinicAddress("Other Name", "custom-clinic", async () => true), "custom-clinic");
});

test("lookup failures stop generation immediately, rather than trying a different name", async () => {
  for (const input of ["", "my-clinic"]) {
    let calls = 0;
    await assert.rejects(resolveClinicAddress("Name", input, async () => { calls++; throw new Error("Lookup unavailable"); }), /Lookup unavailable/);
    assert.equal(calls, 1);
  }
});

test("blank locations reserve later custom names first and resolve duplicates without mutating inputs", () => {
  const input = [
    { name: "Café Care", slug: "" }, { name: "Café Care", slug: "  " },
    { name: "Manual override", slug: "cafe-care" }, { name: "Manual override", slug: "cafe-care-2" },
  ];
  const resolved = resolveLocationAddresses(input);
  assert.deepEqual(resolved.map(b => b.slug), ["cafe-care-3", "cafe-care-4", "cafe-care", "cafe-care-2"]);
  assert.equal(input[0].slug, "");
  assert.deepEqual(resolveLocationAddresses(resolved.map(b => ({ ...b, name: "Renamed" }))).map(b => b.slug), resolved.map(b => b.slug));
});

test("location edge cases and thirty identical long names resolve to distinct valid values", () => {
  for (const name of ["A", "AB", "医院", "!!!", "admin", "doctor", "api", "health", `${"a".repeat(62)} rest`, "a".repeat(100)]) {
    const result = resolveLocationAddresses(Array.from({ length: 30 }, () => ({ name, slug: "" })));
    assert.equal(new Set(result.map(b => b.slug)).size, 30);
    for (const branch of result) assert.equal(locationAddressProblem(branch.slug), "", `${name}: ${branch.slug}`);
  }
});

test("invalid and duplicate explicit location names fail without substitution", () => {
  for (const slug of ["a", "-abc", "abc-", "a--b", "Bad", "has space", "a".repeat(64), "admin", "doctor"]) {
    assert.throws(() => resolveLocationAddresses([{ name: "Other", slug }]), /Location URL name/);
  }
  assert.throws(() => resolveLocationAddresses([{ name: "First", slug: "same" }, { name: "Second", slug: "same" }]), /different Location URL name/);
});

test("only definite public URL conflicts receive address recovery guidance", () => {
  assert.equal(clinicAddressConflict({ status: 409, data: { error: "This public URL is already in use" } }), true);
  for (const error of [new Error("Network failure"), { status: 409, data: { error: "This administrator already owns a clinic" } }, { status: 500 }])
    assert.equal(clinicAddressConflict(error), false);
});

test("generated addresses survive the existing actor-scoped draft without changing request identity", async () => {
  const source = readFileSync(new URL("../components/ClinicRegistrationWizard.tsx", import.meta.url), "utf8");
  // Use the complete schema's field types to ensure this is a real persisted setup, not a partial mock.
  const values = { dateFormat: "DD MMM YYYY", timeFormat: "12h", fullName: "Fictional Owner", email: "owner@test.invalid",
    mobile: "", name: "医院", slug: await resolveClinicAddress("医院", "", async () => true),
    categoryId: "", specialityIds: [], customCategory: null, customSpecialities: [], referralCode: "", clinicEmail: "", phone: "",
    branches: resolveLocationAddresses(Array.from({ length: 2 }, () => ({ name: "Location", slug: "", address: "Fictional Way", city: "", timezone: "UTC", email: "", phone: "", inheritEmail: true, inheritPhone: true,
      hours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isOpen: false, sessions: [] })) }))),
    alsoConsult: false, specializationId: "", qualificationIds: [], linkConsultationHours: true, sessionCapacity: "", consultationMinutes: "" };
  const old = globalThis.sessionStorage, storage = new Map();
  globalThis.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  try {
    for (const mode of ["admin", "self"]) {
      const key = `test-${mode}`, draft = { step: 5, requestId: crypto.randomUUID(), values };
      assert.equal(writeRegistrationDraft(key, setupDraftSchema, draft), true);
      assert.deepEqual(readRegistrationDraft(key, setupDraftSchema).data, draft);
    }
    assert.match(source, /set\("slug", slug, \{ shouldDirty: true \}\)/);
  } finally { globalThis.sessionStorage = old; }
});
