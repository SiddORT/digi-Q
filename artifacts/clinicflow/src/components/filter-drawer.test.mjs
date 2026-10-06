import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const controls = read("./ListingControls.tsx");

test("drawer Apply checks form validity, honours caller false, and shows an inline summary", () => {
  const apply = controls.slice(controls.indexOf("const apply = () => {"), controls.indexOf("const pageTitle"));
  assert.ok(apply.indexOf("checkValidity()") < apply.indexOf("onApply?.()"), "constraint validity runs before the caller commits");
  assert.match(apply, /:invalid"\)\?\.focus\(\)/);
  assert.match(apply, /if \(onApply\?\.\(\) === false\) \{ setInvalidMessage/);
  assert.ok(apply.indexOf("closeFilters()") > apply.indexOf("=== false"), "drawer only closes after a successful apply");
  assert.match(controls, /<form id=\{panelId\} ref=\{formRef\}[^>]*noValidate/);
  assert.match(controls, /role="alert" className="field-error filter-drawer-error"/);
  assert.match(controls, /onApply\?: \(\) => boolean \| void;/);
});

test("drawerValidationMessage pluralises the invalid count", async () => {
  const { build } = (await import("node:module")).createRequire(import.meta.resolve("vite"))("esbuild");
  const out = await build({ stdin: { contents: controls.slice(controls.indexOf("export function drawerValidationMessage"), controls.indexOf("export interface FilterChip")), loader: "ts" }, write: false, format: "esm" });
  const mod = await import(`data:text/javascript,${encodeURIComponent(out.outputFiles[0].text)}`);
  assert.equal(mod.drawerValidationMessage({ querySelectorAll: () => [1] }), "Correct the highlighted filter before applying.");
  assert.equal(mod.drawerValidationMessage({ querySelectorAll: () => [1, 2, 3] }), "Correct the 3 highlighted filters before applying.");
});

test("reports, appointments and resources draft every filter and block invalid ranges", () => {
  const clinic = read("../clinic.tsx"), resources = read("../resources.tsx");
  assert.match(clinic, /const applyFilters=\(\)=>\{if\(draftRangeError\)return false;setFrom\(draft\.from\);setTo\(draft\.to\)/);
  assert.match(clinic, /<DateRangeInput required testId="report-range" fromTestId="input-report-from" toTestId="input-report-to" onFromValidityChange=\{setReportFromValid\} onToValidityChange=\{setReportToValid\} from=\{draft\.from\} to=\{draft\.to\}/);
  assert.match(clinic, /const resetReport=\(\)=>\{const d=today\(\);setFrom\(d\);setTo\(d\);[^}]*setDraft\(\{from:d,to:d,/);
  assert.match(clinic, /onReset=\{resetReport\}/);
  assert.match(clinic, /if\(!fromValid\|\|!toValid\|\|draftRangeInvalid\)return false;/);
  assert.match(resources, /const applyDraft=\(\)=>\{if\(rangeError\(draft\.from\|\|"",draft\.to\|\|""\)\)return false;/);
});

test("picker popover portals into the dialog and AppDialog yields Escape/outside clicks to it", () => {
  const input = read("./DateFormatInput.tsx"), dialog = read("./AppDialog.tsx");
  assert.match(input, /closest\('\[role="dialog"\],\[role="alertdialog"\]'\)[^]*?\|\| document\.body/);
  assert.match(input, /createPortal\(/);
  assert.match(dialog, /closest\("\.dtp-popover, \[data-dtp-open\]"\)\) return;/);
  assert.match(dialog, /closest\("\.dtp-popover"\)\) return;/);
});

test("status filters are drawer fields across listings; queue keeps operational tabs", () => {
  for (const f of ["../Users.tsx", "./SystemUsers.tsx", "../resources.tsx"]) assert.doesNotMatch(read(f), / status=\{</, f);
  assert.match(read("./queue/SessionQueue.tsx"), /<FilterBar status=\{<StatusTabs/);
});
test("assigned/network sorts draft until Apply; queue pauses on invalid date text", () => {
  const clinic = read("../clinic.tsx"), queue = read("./queue/SessionQueue.tsx"), input = read("./DateFormatInput.tsx");
  assert.match(clinic, /onOpen=\{\(\)=>setAssignedDraft\(assignedSort\)\} onApply=\{\(\)=>\{setAssignedSort\(assignedDraft\);\}\}/);
  assert.match(clinic, /onOpen=\{\(\)=>setNetworkDraft\(networkSort\)\} onApply=\{\(\)=>\{setNetworkSort\(networkDraft\);\}\}/);
  assert.match(clinic, /setAssignedSort\("name"\);setAssignedDraft\("name"\)/);
  assert.match(queue, /const enabled=dateValid&&/);
  assert.match(queue, /enabled:!isPatient&&dateValid/);
  assert.match(queue, /onValidityChange=\{setDateValid\}/);
  assert.match(queue, /data-testid="text-queue-date-invalid"/);
  assert.match(input, /data-testid="button-picker-view-toggle"/);
  assert.match(input, /button-picker-year-\$\{year\}/);
});
test("reports pass typed-date validity into the range error", () => {
  const clinic = read("../clinic.tsx");
  assert.match(clinic, /rangeError\(draft\.from,draft\.to,true,!reportFromValid\|\|!reportToValid\)/);
  assert.match(clinic, /fromTestId="input-report-from"[^>]*onFromValidityChange=\{setReportFromValid\}/);
  assert.match(clinic, /toTestId="input-report-to"[^>]*onToValidityChange=\{setReportToValid\}/);
});
