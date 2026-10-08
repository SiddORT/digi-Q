// Data tests (transpiled source, real functions) for the shared day editor, tab mapping, inherited defaults and QR parsing.
import assert from "node:assert/strict";
import { test } from "node:test";
import ts from "typescript";
import { readFileSync } from "node:fs";
const load = rel => {
  const source = readFileSync(new URL(rel, import.meta.url), "utf8");
  const out = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {}; new Function("exports", "require", out)(exports, () => ({})); return exports;
};
const plan = load("./schedule/week-plan.ts");
const tabs = load("../lib/form-tabs.ts");
const inherit = load("../lib/inherited-defaults.ts");
const qr = load("../lib/staff-qr.ts");
const origin = "https://clinicflow.example";

test("enabling a day adds exactly one blank interval; disabling retains drafts; re-enabling restores them", () => {
  const blank = () => ({ startTime: "", endTime: "" });
  const on = plan.setDayOpen({ dayOfWeek: 1, isOpen: false, sessions: [] }, true, blank);
  assert.deepEqual(on.sessions, [{ startTime: "", endTime: "" }]);
  assert.ok(plan.dayErrors({ ...on, sessions: on.sessions.map((s, i) => ({ ...s, key: String(i) })) }).length > 0, "blank interval is an inline error, not a default");
  const filled = { ...on, sessions: [{ startTime: "09:00", endTime: "12:00" }, { startTime: "14:00", endTime: "18:00" }] };
  const off = plan.setDayOpen(filled, false, blank);
  assert.equal(off.isOpen, false); assert.equal(off.sessions.length, 2);
  assert.deepEqual(plan.setDayOpen(off, true, blank).sessions, filled.sessions);
  assert.deepEqual(plan.removeDaySession({ sessions: [{ startTime: "09:00", endTime: "12:00" }] }, 0, blank).sessions, [blank()]);
  assert.deepEqual(plan.removeDaySession(filled, 0, blank).sessions, [filled.sessions[1]]);
});
test("overlapping intervals error; outside location hours is only a warning", () => {
  const day = { dayOfWeek: 1, isOpen: true, sessions: [{ key: "a", startTime: "09:00", endTime: "12:00" }, { key: "b", startTime: "11:00", endTime: "13:00" }] };
  assert.ok(plan.dayErrors(day).some(e => /overlap/i.test(e)));
  assert.equal(plan.dayErrors({ ...day, sessions: [day.sessions[0]] }).length, 0);
  assert.ok(plan.outsideHours({ key: "x", startTime: "07:00", endTime: "08:00" }, [{ startTime: "09:00", endTime: "17:00" }], true));
});
test("doctors use visible sections; receptionist tab validation stays unchanged", () => {
  assert.equal(tabs.STAFF_TABS.doctors, undefined);
  assert.deepEqual(tabs.STAFF_TABS.receptionists.map(t => t.label), ["Personal", "Assignment"]);
  assert.equal(tabs.STAFF_TABS.admins, undefined);
  const d = tabs.STAFF_TABS.receptionists;
  assert.equal(tabs.firstInvalidTab(d, ["branchIds"]), 1);
  assert.equal(tabs.firstInvalidTab(d, ["email", "clinicIds"]), 0);
  assert.equal(tabs.firstInvalidTab(d, []), -1);
  assert.deepEqual(tabs.invalidTabs(tabs.STAFF_TABS.receptionists, ["clinicIds"]), [false, true]);
  for (const list of Object.values(tabs.STAFF_TABS)) assert.equal(new Set(list.flatMap(t => t.fields)).size, list.flatMap(t => t.fields).length, "each field on one tab");
});
test("generic Editor preserves patient/user tabs and removes doctor tabs", () => {
  assert.deepEqual(tabs.EDITOR_TABS.patients.map(([l]) => l), ["Personal & Contact", "Additional Details"]);
  assert.equal(tabs.editorTabIndex("patients", "Emergency contact"), 1);
  assert.equal(tabs.EDITOR_TABS.doctors, undefined);
  assert.equal(tabs.editorTabIndex("doctors", "Professional"), 0);
  assert.equal(tabs.editorTabIndex("doctors", "Assignment and scope"), 0);
  assert.equal(tabs.editorTabIndex("users", "Assignment and scope"), 1);
  assert.equal(tabs.editorTabIndex(undefined, "Professional"), 0);
});
test("inherited clinic defaults: only owner or Super Admin may change; new staff must confirm reuse, edits never", () => {
  const clinic = { adminId: "owner" };
  assert.equal(inherit.canChangeClinicDefaults({ id: "owner", role: "clinicAdmin" }, clinic), true);
  assert.equal(inherit.canChangeClinicDefaults({ id: "x", role: "superAdmin" }, clinic), true);
  assert.equal(inherit.canChangeClinicDefaults({ id: "other", role: "clinicAdmin" }, clinic), false);
  assert.equal(inherit.canChangeClinicDefaults({ id: "owner", role: "doctor" }, clinic), false);
  assert.equal(inherit.canChangeClinicDefaults({ id: "r", role: "receptionist" }, clinic), false);
  assert.match(inherit.inheritedConfirmationError(true, ["c"], undefined), /Confirm/);
  assert.equal(inherit.inheritedConfirmationError(true, ["c"], true), undefined);
  assert.equal(inherit.inheritedConfirmationError(false, ["c"], undefined), undefined);
  assert.equal(inherit.inheritedConfirmationError(true, [], undefined), undefined);
  assert.equal(inherit.clinicSettingsHref("c 1", "policies"), "/admin/clinic?clinicId=c%201&section=policies");
  assert.equal(inherit.addressLine({ address: "1 Road", area: "Kothrud", city: "Pune", country: "IN" }), "1 Road, Kothrud, Pune, IN");
  assert.equal(inherit.contactSource({ inheritEmail: false, inheritPhone: true }), "Partly the clinic's contact");
  const summary = readFileSync(new URL("./InheritedClinicSummary.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(summary, /ClinicSettings|getClinicSettings|policies\./, "policy values are never read for the summary");
  assert.equal(inherit.openingHoursSummary(null), "No hour limits set");
  assert.equal(inherit.openingHoursSummary([]), "Closed all week");
  assert.equal(inherit.openingHoursSummary([1, 2].map(d => ({ dayOfWeek: d, startTime: "09:00", endTime: "13:00" }))), "Mon–Tue 09:00–13:00 · Wed–Sun Closed");
});
test("QR paste: relative and absolute same-origin links normalise; foreign links never accepted; raw codes pass to server", () => {
  assert.deepEqual(qr.staffQrPayload("/check-in?payload=abc.def", origin), { payload: "abc.def" });
  assert.deepEqual(qr.staffQrPayload("check-in?payload=abc", origin), { payload: "abc" });
  assert.deepEqual(qr.staffQrPayload(`${origin}/check-in?payload=abc`, origin), { payload: "abc" });
  assert.deepEqual(qr.staffQrPayload("/app/check-in?payload=abc", origin, "/app/"), { payload: "abc" });
  assert.deepEqual(qr.staffQrPayload("  raw.signed.token ", origin), { payload: "raw.signed.token" });
  for (const bad of ["https://evil.example/check-in?payload=abc", "//evil.example/check-in?payload=abc", "javascript:alert(1)", `${origin}/admin/dashboard?payload=abc`, "/check-in", "", `https://u:p@clinicflow.example/check-in?payload=a`]) assert.ok("error" in qr.staffQrPayload(bad, origin), bad);
});
test("in-app QR entries open inline; public /check-in remains a direct route", () => {
  const read = rel => readFileSync(new URL(rel, import.meta.url), "utf8");
  assert.match(read("./WorkspaceSearch.tsx"), /href: "\/check-in", inline: true/);
  assert.match(read("./WorkspaceSearch.tsx"), /openQrInline\(\)/);
  assert.match(read("./WorkspaceShell.tsx"), /openQrInline\(\)/);
  assert.match(read("../clinic.tsx"), /<main className="content"><QrInlineHost\/>/);
  assert.match(read("../App.tsx"), /path="\/check-in" component=\{CheckInScanner\}/);
});

test("owner-only clinic/location fields: UI locks mirror the server list; creation is never locked", () => {
  assert.ok(["name", "slug", "address", "timezone", "openingHours"].every(k => inherit.OWNER_ONLY_FIELDS.branches.includes(k)));
  assert.ok(["name", "address", "city", "dateFormat", "policies"].every(k => inherit.OWNER_ONLY_FIELDS.clinics.includes(k)));
  assert.equal(inherit.ownerOnlyLocked("branches", "name", true, false), true);
  assert.equal(inherit.ownerOnlyLocked("branches", "name", false, false), false, "doctor creating a location");
  assert.equal(inherit.ownerOnlyLocked("branches", "name", true, true), false);
  assert.equal(inherit.ownerOnlyLocked("branches", "status", true, false), false);
  const server = readFileSync(new URL("../../../api-server/src/routes/resources.ts", import.meta.url), "utf8");
  const list = name => JSON.parse(server.match(new RegExp(`${name} = (\\[[^\\]]*\\])`))[1]);
  assert.deepEqual([...list("CLINIC_OWNED_BRANCH_KEYS"), ...list("CLINIC_OWNED_ADDRESS_KEYS")].sort(), [...inherit.OWNER_ONLY_FIELDS.branches].sort());
  assert.deepEqual(list("CLINIC_OWNED_CLINIC_KEYS").sort(), [...inherit.OWNER_ONLY_FIELDS.clinics].sort());
  const ui = readFileSync(new URL("../resources.tsx", import.meta.url), "utf8");
  assert.match(ui, /data-testid="text-owner-only-fields"/);
});
