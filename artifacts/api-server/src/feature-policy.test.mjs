// Pure unit tests: no database, storage or network.
import { test } from "node:test";
import assert from "node:assert/strict";
import { narrowToWorkspace, sanitizeSavedView, sniffDocument, safeDocumentName, notificationKind, DOCUMENT_MAX_BYTES } from "./lib/feature-policy.ts";

const staff = { role: "receptionist", clinicIds: ["c1", "c2"], branchIds: ["b1", "b2"] };
const map = new Map([["b1", "c1"], ["b2", "c2"]]);
test("workspace narrows to an assigned clinic only", () => {
  const n = narrowToWorkspace(staff, "c2", map);
  assert.deepEqual(n.clinicIds, ["c2"]); assert.deepEqual(n.branchIds, ["b2"]); assert.equal(n.activeClinicId, "c2");
});
test("workspace never expands to an unassigned clinic", () => {
  const n = narrowToWorkspace(staff, "c9", map);
  assert.deepEqual(n.clinicIds, ["c1", "c2"]); assert.equal(n.activeClinicId, null);
});
test("super admin and patient are never narrowed", () => {
  assert.equal(narrowToWorkspace({ ...staff, role: "superAdmin" }, "c1", map).clinicIds.length, 2);
  assert.equal(narrowToWorkspace({ ...staff, role: "patient" }, "c1", map).activeClinicId, null);
});
test("saved views drop search text and free-text values", () => {
  const v = sanitizeSavedView({ tableKey: "appointments", name: " Today ", filters: { search: "Ravi", status: "waiting", doctorId: "d_1", note: "has space", patientName: "x" }, columns: { order: ["date", "bad col"], hidden: [], pinned: "date" } });
  assert.deepEqual(v.filters, { status: "waiting", doctorId: "d_1" });
  assert.deepEqual(v.columns.order, ["date"]); assert.equal(v.name, "Today");
  assert.throws(() => sanitizeSavedView({ tableKey: "Bad Key", name: "x" }));
  assert.throws(() => sanitizeSavedView({ tableKey: "reports", name: "  " }));
});
test("document sniffing uses magic bytes and bounds size", () => {
  assert.equal(sniffDocument(Buffer.from("%PDF-1.7\n")), "application/pdf");
  assert.equal(sniffDocument(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0])), "image/png");
  assert.equal(sniffDocument(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "image/jpeg");
  assert.equal(sniffDocument(Buffer.from("plain notes\n")), "text/plain");
  assert.equal(sniffDocument(Buffer.from([0x4d, 0x5a, 0x00, 0x01])), null);
  assert.equal(sniffDocument(Buffer.alloc(0)), null);
  assert.equal(sniffDocument(Buffer.alloc(DOCUMENT_MAX_BYTES + 1, 0x61)), null);
});
test("document names are sanitized", () => {
  assert.equal(safeDocumentName("../a/b\"<x>.pdf"), "a_b__x_.pdf");
  assert.equal(safeDocumentName(""), "document");
});
test("notification kind follows queue statuses", () => {
  assert.equal(notificationKind("waiting"), "queue"); assert.equal(notificationKind("cancelled"), "appointments");
});
