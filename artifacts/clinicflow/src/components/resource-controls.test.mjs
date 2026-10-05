import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const resource = readFileSync(new URL("../resources.tsx", import.meta.url), "utf8");
const filters = readFileSync(new URL("./ListingControls.tsx", import.meta.url), "utf8");

test("lists have one compact density and status filters in the drawer", () => {
  assert.match(resource, /const density="compact"/);
  assert.doesNotMatch(resource, /digiq-density:|density-toggle|setDensity/);
  assert.match(resource, /\{hasStatusTabs&&<SearchableSelect label="Status" testId=\{`select-\$\{resource\}-status`\} value=\{draft\.status\|\|"all"\}/);
  assert.doesNotMatch(resource, /role="tablist" aria-label=\{`\$\{title\(listName\)\} status`\}/);
});

test("sort is drafted in the filter drawer, column headers expose direction", () => {
  assert.match(resource, /aria-sort=\{sortableColumns\.has\(c\)/);
  // Approved direction: sort and every record filter live in the right drawer and apply together.
  assert.match(resource, /advanced=\{hasAdvanced\?<>[^]*?<div className="sort-menu"[^>]*><SearchableSelect label=\{`Sort \$\{listName\}`\} value=\{[^}]*draft\.sort/);
  assert.doesNotMatch(resource, / meta=\{<>/, "no inline record filters remain in the listing header");
  assert.match(resource, /sort:draft\.sort\|\|"-createdAt",page:1/);
  assert.doesNotMatch(resource, /<SearchableSelect label="Sort"/);
});

test("fixed clinic scope is enforced on API calls and new records", () => {
  assert.match(resource, /const filters:Record<string,string>=\{[\s\S]*?\.\.\.fixedClinicId\?\{clinicId:fixedClinicId\}/);
  assert.match(resource, /if\(key==="clinicId"&&fixedClinicId\)continue/);
  assert.match(resource, /setEditing\(\{\.\.\.defaults,[\s\S]*?fixedClinicId\?\{clinicId:fixedClinicId\}/);
  assert.match(resource, /onEdit\?\:\(row:any\)=>void/);
});

test("user status is an accessible switch and filters can apply a draft", () => {
  assert.match(resource, /<StatusSwitch label=\{`\$\{row\.fullName\}/);
  const handler = resource.match(/const changeUserStatus=async\(row:any\)=>\{([\s\S]*?)\n \};/)?.[1];
  assert.ok(handler, "status changes use the async confirmation handler");
  assert.match(handler, /if\(statusUpdate\.isPending\)return/);
  assert.match(handler, /if\(next==="inactive"&&!await confirmation\.ask\(\{title:`Deactivate \$\{row\.fullName\}\?`[\s\S]*?\}\)\)return;/);
  assert.ok(handler.indexOf("confirmation.ask") < handler.indexOf("statusUpdate.mutate"), "mutation follows awaited confirmation and cancellation guard");
  assert.match(resource, /\{confirmation\.dialog\}/, "shared confirmation is rendered");
  assert.doesNotMatch(resource, /window\.confirm/);
  assert.match(resource, /statusUpdate=useMutation/);
  assert.match(resource, /onOpen=\{\(\)=>setDraft\(\{\.\.\.filters,sort\}\)\} onApply=\{applyDraft\}/);
  assert.match(filters, /onApply\?\.\(\)/);
  assert.match(filters, /"Apply filters" : "Done"/);
});

test("QR previews open from the row without duplicating the full listing", () => {
  assert.match(resource, /setQrPreview\(row\)/);
  assert.match(resource, /<QrCard row=\{qrPreview\}/);
  assert.doesNotMatch(resource, /<div className="qr-grid">/);
});