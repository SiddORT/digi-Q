import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

const src = readFileSync(new URL("./staff-role-switch.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { planRoleSwitch } = await import(`data:text/javascript,${encodeURIComponent(js)}`);

test("shared fields carry over; empty role-specific forms switch immediately", () => {
  const plan = planRoleSwitch({ fullName: "Asha Rao", email: "asha@clinic.in", mobile: "+919812345678", status: "active", clinicIds: ["c1"], branchIds: [], registrationNumber: "", experienceYears: Number.NaN }, { clinicIds: ["c1"] });
  assert.deepEqual(plan.shared, { fullName: "Asha Rao", email: "asha@clinic.in", mobile: "+919812345678" });
  assert.equal(plan.discards, false);
});
test("filled role-specific values require confirmation", () => {
  assert.equal(planRoleSwitch({ fullName: "A", registrationNumber: "KMC-4471" }).discards, true);
  assert.equal(planRoleSwitch({ experienceYears: 0 }).discards, true);
  assert.equal(planRoleSwitch({ branchIds: ["b2"] }).discards, true);
  assert.equal(planRoleSwitch({ clinicIds: ["c1", "c2"] }, { clinicIds: ["c1"] }).discards, true);
});
test("opaque admin setup input (dirty) always requires confirmation; blank shared values are not carried", () => {
  assert.equal(planRoleSwitch({}, {}, true).discards, true);
  assert.deepEqual(planRoleSwitch({ fullName: "  ", email: "" }).shared, {});
});
test("Add Staff wires confirmation, carry-over with dirty protection, and independent role payloads", () => {
  const users = readFileSync(new URL("../Users.tsx", import.meta.url), "utf8");
  assert.match(users, /planRoleSwitch\(snapshot\.current\.values,snapshot\.current\.defaults,editTab==="admins"&&dirty\)/);
  assert.match(users, /await roleConfirm\.ask\(\{title:`Switch to \$\{singular\(next\)\}\?`/);
  assert.match(users, /setValue\(key as any,value,\{shouldDirty:true\}\)/);
  assert.match(users, /<UserEditor key=\{`\$\{editTab\}:\$\{editing\.id\|\|"new"\}`\} tab=\{editTab\}/);
  assert.match(users, /tab === "doctors" \? initial\.id \? api\.updateDoctor\(initial\.id, body\) : api\.createDoctor\(body\) : initial\.id \? api\.updateUser\(initial\.id, body\) : api\.createUser\(body\)/);
  assert.match(users, /onSuccess: \(result\) => \{ client\.invalidateQueries\(\); onClose\(result\); \}/);
  assert.match(users, /if\(!wasEdit&&savedTab!==tab\)\{setTab\(savedTab\);setDraftTab\(savedTab\);\}/);
  assert.match(users, /<label>Clinic Groups <span className="required">\*<\/span><\/label>/);
  assert.match(users, /<label>Locations \{tab === "receptionists"/);
  assert.match(users, /size="medium"/);
});
