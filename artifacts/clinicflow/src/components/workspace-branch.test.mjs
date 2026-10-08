import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const out = new URL(`../../.wb-test-${process.pid}.mjs`, import.meta.url);
let W;
before(async () => {
  await build({ entryPoints: [fileURLToPath(new URL("../lib/workspace-branch.ts", import.meta.url))], outfile: fileURLToPath(out), bundle: true, platform: "node", format: "esm" });
  W = await import(out.href);
});
after(async () => { await unlink(out).catch(() => {}); });

const list = [{ id: "b1", clinicId: "c1", name: "North", clinicName: "Alpha" }, { id: "b2", clinicId: "c1", name: "South", clinicName: "Alpha" }];

test("selector only for staff and doctors, never patients, guests or super admins", () => {
  for (const role of ["doctor", "receptionist", "clinicAdmin"]) assert.equal(W.branchSelectorMode(role), "on");
  for (const role of ["patient", "superAdmin", undefined, null, ""]) assert.equal(W.branchSelectorMode(role), "off");
});

test("saved choice is validated against the current authorized active list", () => {
  assert.equal(W.resolveSavedBranch("b2", list), "b2");
  assert.equal(W.resolveSavedBranch("revoked", list), "", "multiple assigned locations require an explicit choice");
  assert.equal(W.resolveSavedBranch("", [list[0]]), "b1", "a sole authorized location is reused");
  assert.equal(W.resolveSavedBranch("b2", []), "", "no fallback to all branches when nothing is authorized");
  assert.equal(W.workspaceBranchKey("u1"), "dq.workspace.branch.u1");
});

test("switch strips location, doctor and session query state but keeps other filters", () => {
  assert.equal(W.scopedQueryStrip("?branch=b1&doctor=d&sessionId=s&status=waiting&clinicId=c&page=3"), "status=waiting");
});

test("global management pages are not branch-scoped", () => {
  for (const p of ["dashboard", "appointments", "queue", "book", "availability", "exceptions", "patients", "reports"]) assert.ok(W.BRANCH_SCOPED_PAGES.includes(p));
  for (const p of ["clinics", "branches", "users", "settings", "masters", "audit", "templates", "permissions", "integrations", "qrs", "system-users", "profile"]) assert.ok(!W.BRANCH_SCOPED_PAGES.includes(p));
});

test("workspace wiring: selector beside notifications, gate, provider, explicit page filtering", () => {
  const clinic = read("../clinic.tsx"), ctx = read("./WorkspaceBranch.tsx");
  assert.match(clinic, /<LocationSelector\/><NotificationsPanel/);
  assert.match(clinic, /<WorkspaceBranchProvider [^>]*identity=\{identity\}><PortalWorkspace/);
  assert.match(clinic, /<BranchScopeGate page=\{page\}>/);
  assert.match(clinic, /getGetDashboardQueryKey\(dashboardParams\)/);
  assert.equal((clinic.match(/usePinnedCare\(/g) || []).length, 3, "appointments, booking, reports");
  assert.match(read("./queue/SessionQueue.tsx"), /usePinnedCare\(clinicId,branchId,setClinic,setBranch\)/);
  assert.match(read("./SchedulingWorkspace.tsx"), /const schedulePin=fixedClinicId\?null:pin/);
  assert.match(read("../resources.tsx"), /branchPin=workspacePin&&!fixedClinicId&&\["patients","availability","exceptions"\]/);
  // failure never falls back to unscoped data; switching confirms unsaved changes
  assert.match(ctx, /status === "error"\) return <div className="error-box"/);
  assert.match(ctx, /unsaved\.current\.size && !await confirmation\.ask/);
  assert.match(ctx, /sessionStorage\.removeItem\("clinicflow-staff-session"\)/);
  assert.match(ctx, /key=\{ctx\.pin!\.branchId\}/, "pages remount per branch so no previous-branch state survives");
  assert.doesNotMatch(ctx, /window\.fetch\s*=/);
  assert.match(ctx, /branches\.length < 2\) return <span className="loc-select is-fixed"/);
  assert.match(read("./schedule/WeeklyScheduleEditor.tsx"), /useRegisterUnsaved\(dirty\)/);
});

test("doctors can discover the allowed Users page", () => {
  const clinic = read("../clinic.tsx");
  assert.match(clinic, / doctor:\["dashboard","appointments","queue","patients","clinics","availability","profile"\]/);
  assert.match(read("../App.tsx"), /doctor:\[[^\]]*"users"/);
});
