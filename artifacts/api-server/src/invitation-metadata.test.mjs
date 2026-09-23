// Pure invitation metadata regressions: no server, database, or provider calls.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const directory = await mkdtemp(join(tmpdir(), "clinicflow-invitation-metadata-"));
const bundle = join(directory, "invitation-metadata.mjs");
await build({
  entryPoints: [resolve(import.meta.dirname, "lib/invitation-metadata.ts")],
  outfile: bundle,
  bundle: true,
  platform: "node",
  format: "esm",
});
const { invitationMetadata } = await import(bundle);
after(() => rm(directory, { recursive: true, force: true }));

test("real receptionist example includes trusted role, clinic, and branch", () => {
  const metadata = invitationMetadata(
    "receptionist",
    ["sunshine"],
    ["baner"],
    [{ id: "sunshine", name: "Sunshine Multispeciality Clinic", status: "active" }],
    [{ id: "baner", clinicId: "sunshine", name: "Baner Branch", status: "active" }],
  );

  assert.deepEqual(metadata, {
    clinicFlowRole: "receptionist",
    clinicFlowRoleLabel: "Receptionist",
    clinicFlowClinicNames: ["Sunshine Multispeciality Clinic"],
    clinicFlowBranchNames: ["Baner Branch"],
  });
});

test("multiple valid assignments retain assignment order and remove duplicate names", () => {
  const metadata = invitationMetadata(
    "doctor",
    ["clinic-2", "clinic-1", "clinic-2"],
    ["branch-2", "branch-1", "branch-2"],
    [
      { id: "clinic-1", name: "North Clinic", status: "active" },
      { id: "clinic-2", name: "South Clinic", status: "active" },
    ],
    [
      { id: "branch-1", clinicId: "clinic-1", name: "Central Branch", status: "active" },
      { id: "branch-2", clinicId: "clinic-2", name: "Lakeside Branch", status: "active" },
    ],
  );

  assert.deepEqual(metadata.clinicFlowClinicNames, ["South Clinic", "North Clinic"]);
  assert.deepEqual(metadata.clinicFlowBranchNames, ["Lakeside Branch", "Central Branch"]);
  assert.equal(metadata.clinicFlowRoleLabel, "Doctor");
});

test("an assignment with no branches produces an empty branch list", () => {
  const metadata = invitationMetadata(
    "clinicAdmin",
    ["clinic"],
    [],
    [{ id: "clinic", name: "Clinic", status: "active" }],
    [{ id: "branch", clinicId: "clinic", name: "Branch", status: "active" }],
  );

  assert.deepEqual(metadata.clinicFlowClinicNames, ["Clinic"]);
  assert.deepEqual(metadata.clinicFlowBranchNames, []);
  assert.equal(metadata.clinicFlowRoleLabel, "Clinic Administrator");
});

test("inactive, stale, orphaned, and out-of-scope rows are excluded", () => {
  const metadata = invitationMetadata(
    "receptionist",
    ["valid-clinic", "inactive-clinic", "stale-clinic"],
    ["valid-branch", "inactive-branch", "orphan-branch", "stale-branch"],
    [
      { id: "valid-clinic", name: "Valid Clinic", status: "active" },
      { id: "inactive-clinic", name: "Inactive Clinic", status: "inactive" },
      { id: "outside-clinic", name: "Outside Clinic", status: "active" },
    ],
    [
      { id: "valid-branch", clinicId: "valid-clinic", name: "Valid Branch", status: "active" },
      { id: "inactive-branch", clinicId: "valid-clinic", name: "Inactive Branch", status: "inactive" },
      { id: "orphan-branch", clinicId: "outside-clinic", name: "Orphan Branch", status: "active" },
      { id: "outside-branch", clinicId: "valid-clinic", name: "Outside Branch", status: "active" },
    ],
  );

  assert.deepEqual(metadata.clinicFlowClinicNames, ["Valid Clinic"]);
  assert.deepEqual(metadata.clinicFlowBranchNames, ["Valid Branch"]);
});