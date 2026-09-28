import assert from "node:assert/strict";
import test from "node:test";
import { assignmentTargetRole, staffInput } from "./staff-input.ts";

test("tab names become actual singular assignment roles", () => {
  assert.equal(assignmentTargetRole("doctors"), "doctor");
  assert.equal(assignmentTargetRole("receptionists"), "receptionist");
  assert.equal(assignmentTargetRole("admins"), "doctor");
});

test("blank optional numbers never become JSON null", () => {
  for (const experienceYears of [NaN, undefined, null, "", Infinity]) {
    assert.equal("experienceYears" in staffInput("doctors", { experienceYears }), false);
  }
  assert.equal(staffInput("doctors", { experienceYears: 0 }).experienceYears, 0);
  assert.equal(staffInput("doctors", { experienceYears: 5 }).experienceYears, 5);
});

test("editing submits writable fields and preserves deliberate empty branch assignments", () => {
  const body = staffInput("doctors", {
    fullName: "Test", clinicIds: ["a"], branchIds: [],
    ownerAdminId: "readonly", managingAdminId: "readonly", invitationStatus: "sent",
    id: "readonly", passwordHash: "readonly", tokenHash: "readonly", experienceYears: NaN,
  });
  assert.deepEqual(body, { role: "doctor", status: "active", fullName: "Test", email: "", clinicIds: ["a"], branchIds: [] });
});

test("role-specific forms cannot submit ownership or incompatible mappings", () => {
  assert.deepEqual(staffInput("admins", { role: "doctor", clinicIds: ["a"], branchIds: ["b"] }), { fullName: "", email: "", role: "clinicAdmin", status: "active" });
  assert.deepEqual(staffInput("receptionists", { clinicIds: ["a"], branchIds: ["b"], experienceYears: 2 }), { fullName: "", email: "", role: "receptionist", status: "active", clinicIds: ["a"], branchIds: ["b"] });
});