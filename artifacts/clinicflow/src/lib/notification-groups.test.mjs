import { test } from "node:test";
import assert from "node:assert/strict";
import { notificationGroup, sameActivationRows, groupActivationChanges } from "./notification-groups.ts";

const row = (recipient, enabled, required = false) => ({ channel: "email", event: "booking", recipient, enabled, required, revision: 1, source: "platform" });
test("summaries use only saved optional activation, not gate/readiness or required rows", () => {
  for (const [rows, status, next] of [
    [[row("patient", true), row("doctor", true)], "Enabled", false],
    [[row("patient", false), row("doctor", false)], "Disabled", true],
    [[row("patient", true), row("doctor", false)], "Custom", true],
    [[row("patient", true, true)], "Required", true],
    [[row("patient", true, true), row("doctor", false)], "Disabled", true],
  ]) {
    const group = notificationGroup(rows.map(r => ({ ...r, ready: false })), "booking");
    assert.equal(group.status, status); assert.equal(group.next, next);
  }
});
test("batches exclude required and unchanged rows, preserving untouched inheritance", () => {
  const rows = [row("patient", true, true), row("doctor", true), row("receptionist", false)];
  assert.deepEqual(groupActivationChanges(rows, true), [{ channel: "email", event: "booking", recipient: "receptionist", revision: 1, enabled: true }]);
  assert.equal(notificationGroup([...rows, { ...row("doctor", false), event: "reminder" }], "booking").optional.length, 2);
});
test("confirmation baseline includes membership, requiredness, revision, source and activation", () => {
  const rows = [row("patient", true), row("doctor", false)];
  assert(sameActivationRows(rows, [...rows].reverse()));
  for (const change of [{ revision: 2 }, { source: "clinic" }, { enabled: false }, { required: true }, { recipient: "other" }]) {
    assert(!sameActivationRows(rows, [{ ...rows[0], ...change }, rows[1]]));
  }
  assert(!sameActivationRows(rows, rows.slice(0, 1)));
});
