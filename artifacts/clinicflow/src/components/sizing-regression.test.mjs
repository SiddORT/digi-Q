import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
test("custom role drawer widens for the Allowed Actions matrix; headings and row action never wrap", () => {
  const c = read("../form-standard.css");
  assert.match(c, /\.app-dialog\.app-dialog-drawer:has\(\.cr-matrix\)\{width:min\(960px,calc\(100vw - 32px\)\)/);
  assert.match(c, /\.cr-matrix\{overflow-x:auto/);
  assert.match(c, /\.cr-matrix th,\.cr-matrix td\{white-space:nowrap/);
  assert.match(read("./CustomRoles.tsx"), /className="table-wrap cr-matrix"/);
});
test("platform and clinic policy numeric settings use readable widths and short labels", () => {
  const r = read("../resources.tsx");
  assert.match(r, /label:"Cancellation Cutoff \(minutes\)",width:"md"/);
  assert.match(r, /label:"Booking Horizon \(days\)",width:"md"/);
  assert.match(read("./ClinicSettings.tsx"), /label:"Cancellation Cutoff \(minutes\)",width:"md"/);
});
