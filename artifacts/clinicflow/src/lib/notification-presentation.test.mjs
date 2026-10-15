import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rowDeliveryReasons, activationSource } from "./notification-presentation.ts";

test("scope warning deduplication retains every provider, recipient and unknown diagnostic", () => {
  const local = ["SMTP not configured", "Recipient is unavailable", "Future gate reason"];
  const blockedReasons = ["Published activation is off", "Clinic notification gate is off", ...local];
  assert.deepEqual(rowDeliveryReasons({ blockedReasons }, true), local);
  assert.deepEqual(rowDeliveryReasons({ blockedReasons }, false), ["Clinic notification gate is off", ...local]);
  assert.deepEqual(rowDeliveryReasons({ blockedReasons: ["Platform default notification gate is off; clinics may have explicit overrides", ...local] }, true), local);
});
test("activation provenance never mislabels inherited system activation as clinic wording", () => {
  assert.equal(activationSource("platform", "clinic"), "Inherited system activation");
  assert.equal(activationSource("clinic", "clinic"), "Published clinic activation");
  assert.equal(activationSource("default", ""), "Default activation");
});
test("route keeps System Default explicit and ignores old Super Admin clinic links", () => {
  const page = readFileSync(new URL("../components/NotificationTemplatesPage.tsx", import.meta.url), "utf8");
  const entry = page.slice(page.indexOf("export function NotificationTemplatesPage"));
  assert.doesNotMatch(entry, /window\.location|initial=/);
  assert.match(page, /emptyOption=\{\{ value: "__system_default__", label: "System Default" \}\}/);
  assert.match(page, /url\.searchParams\.delete\("clinicId"\)/);
  assert.match(page, /!superAdmin && !clinics\?\.some/);
  assert.match(page, /clinics\?\.length === 1 \? <OverflowText/);
  assert.doesNotMatch(page, /filtersOpen|button-toggle-filters|\.slice\(0,\s*160\)/);
  assert.match(page, /button-clear-filters/);
  assert.match(page, /unavailable = pending \|\| controls\.isFetching \|\| controls\.isError/);
});
