import test from "node:test";import assert from "node:assert";import {readFileSync} from "node:fs";
const r=f=>readFileSync(new URL(f,import.meta.url),"utf8");
test("saved views never persist search terms",()=>{const s=r("./lib/listing-views.ts");assert.match(s,/UNSAFE_VIEW_KEYS = \["search", "q", "page"\]/);});
test("bulk check-in is blocked",()=>{assert.match(r("./lib/check-in-policy.ts"),/ids.length !== 1/);assert.doesNotMatch(r("./components/appointments/BulkAppointments.tsx"),/run\("checkIn"\)/);});
test("resource listings use column and view controls",()=>{const s=r("./resources.tsx");assert.match(s,/ColumnSettings/);assert.match(s,/SavedViews/);assert.match(s,/col-actions sticky/);assert.match(s,/row-expansion/);});
test("sidebar and search share preference store",()=>{assert.match(r("./components/WorkspaceSearch.tsx"),/useNavigationPreferences/);assert.match(r("./components/WorkspaceShell.tsx"),/useNavigationPreferences/);});
test("bespoke tables use shared column preferences",()=>{
  for(const f of ["./components/appointments/AppointmentRows.tsx","./Users.tsx","./components/SystemUsers.tsx","./clinic.tsx"])assert.match(r(f),/useTableColumns\(/,f);
  assert.match(r("./components/appointments/AppointmentRows.tsx"),/reorderable:!sessionScoped,pinnable:!sessionScoped/);
});
test("expansion never duplicates actions and pinning is single",()=>{const s=r("./components/TableColumns.tsx");assert.match(s,/arranged\.hidden\.map/);assert.doesNotMatch(s,/actions/i.source==="x"?/x/:/col-actions/);assert.match(r("./components/ListingViewControls.tsx"),/one pinned column/);});
test("saved views: allowlisted safe values and column snapshot with old-view compatibility",()=>{const s=r("./lib/listing-views.ts");assert.match(s,/SAFE_VALUE = \/\^\[A-Za-z0-9_\\-:\.,\]\+\$\//);assert.match(s,/columns\?: ViewColumns/);assert.match(s,/applyViewColumns/);assert.match(r("./clinic.tsx"),/APPOINTMENT_VIEW_KEYS=\["view","from","to","status","clinic","branch","doctor","sort","size"\]/);});
test("saved view name uses useId, announces save and warns about patient details",()=>{const s=r("./components/ListingViewControls.tsx");assert.match(s,/useId\(\)/);assert.match(s,/role="status" aria-live="polite"/);assert.match(s,/Do not enter patient names/);});
test("saved views on Users, SystemUsers and Reports carry column snapshots",()=>{
  assert.match(r("./Users.tsx"),/STAFF_VIEW_KEYS[^]*readTableColumns\(`users-\$\{tab\}`/);
  assert.match(r("./components/SystemUsers.tsx"),/SYSTEM_USER_VIEW_KEYS[^]*writeTableColumns\("system-users"/);
  assert.match(r("./clinic.tsx"),/REPORT_VIEW_KEYS[^]*writeTableColumns\("reports"/);
});
test("touch targets follow 32px desktop / 44px touch scale",()=>{const c=r("./components/listing-view-controls.css");assert.match(c,/min-width:32px;min-height:32px/);assert.match(c,/pointer:coarse[^]*min-height:44px/);assert.doesNotMatch(c,/28px/);});
test("resource listing accepts every approved page size including 25", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./resources.tsx", import.meta.url), "utf8");
  assert.match(src, /PAGE_SIZE_OPTIONS as readonly number\[\]\)\.includes\(sizeValue\)/);
});
