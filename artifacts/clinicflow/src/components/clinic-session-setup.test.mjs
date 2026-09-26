import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const component = readFileSync(new URL("./ClinicSessionSetup.tsx", import.meta.url), "utf8");

test("session setup locks identity and booking parameters during a save", () => {
  assert.match(component, /Location<select disabled=\{busy\}/);
  assert.match(component, /Doctor<select disabled=\{busy \|\| incompleteDoctors\}/);
  for (const field of ["Patients per session", "Expected consultation (minutes)", "Ticket prefix"])
    assert.ok(component.includes(`${field}<input disabled={busy}`), `${field} must lock during save`);
  assert.match(component, /if \(busy \|\| !selectedBranch \|\| !doctorId \|\| incompleteDoctors\) return/);
});

test("closed and walk-ins-only sessions are never claimed as patient-bookable", () => {
  assert.match(component, /s\.isOpen && s\.queueMode !== "walkInsOnly"/);
  assert.match(component, /existing session does not allow patient appointments; edit in Weekly schedule/);
  assert.match(component, /Not ready for patient bookings: no open weekly doctor sessions/);
});

test("setup discloses mixed booking policy, avoids duplicates, and does not silently truncate doctors", () => {
  assert.match(component, /Queue policy: <strong>Mixed \(patient appointments and walk-ins\)<\/strong>/);
  assert.match(component, /doctors\.data\.total > doctorOptions\.length/);
  assert.match(component, /Only \{doctorOptions\.length\} of \{doctors\.data\?\.total\} assigned doctors/);
  assert.match(component, /const latest = await api\.listSchedules/);
  assert.match(component, /if \(!h \|\| existing\(h, latest\.items\)\) continue/);
});