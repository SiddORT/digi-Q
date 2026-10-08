import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const src = readFileSync(new URL("./custom-roles.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const m = await import("data:text/javascript," + encodeURIComponent(js));
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const cfg = () => ({ revision: 3, roles: [{ id: "r1", name: "Front desk lite", baseRole: "receptionist", denied: ["appointments:cancel"] }], bindings: [{ userId: "u1", roleId: "r1" }] });
const user = { id: "u2", fullName: "Amara Osei", email: "a@x.test", role: "receptionist", status: "active", clinics: [{ id: "c1", name: "Harbour" }] };

test("delete is blocked while bindings exist unless explicitly removed", () => {
  assert.deepEqual(m.deleteRole(cfg(), "r1", false), { blocked: 1 });
  const out = m.deleteRole(cfg(), "r1", true);
  assert.equal(out.roles.length, 0); assert.equal(out.bindings.length, 0);
});
test("bindings require matching base role, active status and the user's own clinic", () => {
  const role = cfg().roles[0];
  assert.match(m.bindingError(role, { ...user, role: "doctor" }, "", cfg()), /base role/);
  assert.match(m.bindingError(role, { ...user, status: "inactive" }, "", cfg()), /active/);
  assert.match(m.bindingError(role, user, "c9", cfg()), /assigned clinics/);
  assert.equal(m.bindingError(role, user, "c1", cfg()), null);
  assert.match(m.bindingError(role, { ...user, id: "u1" }, "", cfg()), /already exists/);
  const added = m.addBinding(cfg(), { userId: "u2", roleId: "r1" });
  assert.deepEqual(added.bindings[1], { userId: "u2", roleId: "r1" });
});
test("changing base role drops assignments; names validated; equality ignores order", () => {
  const c = m.upsertRole(cfg(), { ...cfg().roles[0], baseRole: "doctor" });
  assert.equal(c.bindings.length, 0);
  assert.match(m.validateRole({ id: "x", name: " front DESK lite ", baseRole: "doctor", denied: [] }, cfg().roles), /already uses/);
  assert.ok(m.configsEqual(cfg(), { ...cfg(), roles: [{ ...cfg().roles[0], denied: ["appointments:cancel"] }] }));
  assert.equal(m.capKey("patients", "update"), "patients:update");
});
test("UI wiring: SA-only routes, rendered below AccessRules, no passwords, 409 retains edits", () => {
  const clinic = read("../clinic.tsx");
  assert.match(clinic, /<AccessRules\/><CustomRoles\/>/);
  assert.match(clinic, /page==="system-users"&&identity\.user!\.role==="superAdmin"\?<SystemUsers\/>/);
  assert.match(read("../App.tsx"), /"permissions","system-users"\]\.includes\(page\)/);
  const ui = read("./CustomRoles.tsx") + read("./SystemUsers.tsx");
  assert.doesNotMatch(ui, /passwordEnabled|passwordHash|passwordSalt/);
  assert.match(ui, /=== 409\) setConflict\(true\)/);
  assert.match(ui, /setQueryData\(queryKey, saved\)/);
  assert.match(ui, /status: "active"/);
  for (const f of ["./CustomRoles.tsx", "./SystemUsers.tsx"]) assert.deepEqual(ts.createSourceFile(f, read(f), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX).parseDiagnostics, [], f);
});

test("platform settings copy reflects the connected notification worker", () => {
  const clinic = read("../clinic.tsx");
  assert.doesNotMatch(clinic, /General notifications are not connected/);
  assert.doesNotMatch(clinic, /queue notifications/i);
  assert.match(clinic, /background event worker when notifications are enabled/);
});
