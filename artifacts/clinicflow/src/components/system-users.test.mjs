import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";
const src = readFileSync(new URL("./SystemUsers.tsx", import.meta.url), "utf8");
const fn = src.slice(src.indexOf("export function effectivePermissions"), src.indexOf("function EffectivePanel"));
const js = ts.transpileModule(fn, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { effectivePermissions } = await import("data:text/javascript," + encodeURIComponent(js));
const policy = { modules: ["appointments", "patients"], actions: ["cancel", "update"], denied: ["receptionist:patients:update", "doctor:appointments:cancel"] };
const config = { roles: [{ id: "g", name: "No cancels", baseRole: "receptionist", denied: ["appointments:cancel"] }, { id: "c", name: "Harbour lite", baseRole: "receptionist", denied: ["appointments:update"] }, { id: "d", name: "Doc role", baseRole: "doctor", denied: ["patients:cancel"] }],
  bindings: [{ userId: "u", roleId: "g" }, { userId: "u", roleId: "c", clinicId: "c1" }, { userId: "u", roleId: "d" }, { userId: "x", roleId: "g" }] };
const user = { id: "u", role: "receptionist" };
const find = (r, m, a) => r.rows.find(x => x.module === m && x.action === a);

test("platform scope unions base policy and all-scope bindings; clinic-specific listed as pending", () => {
  const r = effectivePermissions(user, policy, config, "");
  assert.deepEqual(find(r, "patients", "update").sources, ["Base role policy"]);
  assert.deepEqual(find(r, "appointments", "cancel").sources, ["No cancels"]);
  assert.equal(find(r, "appointments", "update").denied, false);
  assert.equal(find(r, "patients", "cancel").denied, false, "mismatched base role binding ignored");
  assert.deepEqual(r.pending.map(p => p.roleName), ["Harbour lite"]);
});
test("chosen clinic includes its bindings; other users and super admin unaffected", () => {
  const r = effectivePermissions(user, policy, config, "c1");
  assert.deepEqual(find(r, "appointments", "update").sources, ["Harbour lite"]);
  assert.equal(r.pending.length, 0);
  assert.equal(effectivePermissions({ id: "s", role: "superAdmin" }, policy, config, "").rows.every(x => !x.denied), true);
});
test("panel copy: not restricted never overrides built-in rules; choose clinic prompt", () => {
  assert.match(src, /Built-in clinic ownership, assignments and workflow checks still apply/);
  assert.match(src, /Choose a clinic to include them/);
  assert.match(src, /variant="drawer"/);
  assert.doesNotMatch(src, /effective-panel-/);
});

test("system users contract: API always returns data[] and per-user clinics[]; UI does not mask failures", async () => {
  const { readFileSync: read } = await import("node:fs");
  const spec = read(new URL("../../../../lib/api-spec/openapi.yaml", import.meta.url), "utf8");
  assert.match(spec, /required: \[id, fullName, email, role, status, clinics\]/);
  assert.match(spec, /required: \[data, total, page, pageSize\]/);
  const route = read(new URL("../../../api-server/src/routes/system-users.ts", import.meta.url), "utf8");
  assert.match(route, /res\.json\(\{ data: rows\.map\(row => \(\{ \.\.\.row, clinics: \[\.\.\.new Map\(/);
  assert.doesNotMatch(src, /clinics\s*\?\?\s*\[\]|clinics\s*\|\|\s*\[\]/);
});
