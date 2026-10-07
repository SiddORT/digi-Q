import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fieldWidth } from "../lib/field-width.ts";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const settings = read("./ClinicSettings.tsx");
const resources = read("../resources.tsx");
const css = read("./clinic-settings.css");

test("B11 no duplicate location count beside the clinic selector; one list heading count", () => {
  assert.doesNotMatch(settings, /settings-scope-meta/);
  assert.doesNotMatch(settings, /data\.branches\.length\} \{data\.branches\.length===1/);
  // One useful total, in the Locations list heading; pagination keeps range/page controls without repeating it.
  assert.match(resources, /const headingCount=resource==="branches";/);
  assert.match(resources, /<FilterBar filters=\{primaryFilters\} title=\{headingCount\?<h2[^]*?Locations[^]*?query\.data\.total/);
  assert.equal((resources.match(/text-locations-count/g) || []).length, 1);
  assert.match(resources, /hideTotal=\{headingCount\}/);
  const controls = read("./ListingControls.tsx");
  assert.match(controls, /hideTotal\?: boolean;/);
  assert.match(controls, /hideTotal = false/, "backward compatible default keeps other lists' totals");
  assert.match(controls, /\{startRecord\}–\{endRecord\}<\/strong>\{!hideTotal && <> of/);
});

test("B12 clinic-wide scope marker without an extra paragraph", () => {
  assert.match(settings, /settings-scope-badge[^]*Clinic-wide management <HelpTip/);
  assert.doesNotMatch(settings, /view==="locations"&&<><p className="listing-hint"/);
  assert.match(css, /\.settings-scope-badge\{/);
});

test("B13 Locations list uses the shared ResourcePage FilterBar toolbar", () => {
  assert.match(settings, /<ResourcePage key=\{`\$\{clinicId\}-branches`\} resource="branches"/);
  assert.match(resources, /admin-listing-filter\$\{embedded\?" embedded":""\}`\}><FilterBar filters=\{primaryFilters\} title=\{headingCount/);
  assert.match(resources, /listName=resource==="branches"\?"locations"/);
});

test("B14 location editor groups identity/address/contact with inherit toggles beside fields", () => {
  assert.match(resources, /LOCATION_EDITOR_GROUPS[^]*\["Identity",[^]*\["Address",[^]*\["Contact",\["email","inheritEmail","phone","inheritPhone"\]\]/);
  assert.match(resources, /data-location-editor=\{locationEditor\|\|undefined\}/);
  assert.match(resources, /Use Clinic Email\$\{parentClinic\.data\?\.email/);
  assert.match(resources, /Use Clinic Phone\$\{parentClinic\.data\?\.phone/);
  assert.equal(fieldWidth({ key: "inheritEmail", type: "checkbox" }), "md");
  assert.equal(fieldWidth({ key: "pincode" }), "xs");
  assert.equal(fieldWidth({ key: "isOpen", type: "checkbox" }), "full");
  assert.doesNotMatch(resources, /Effective contacts:/);
});

test("B15 consistent Edit Location title, guarded Cancel/Save footer and scroll padding", () => {
  assert.match(settings, /title=\{`Edit Location · \$\{branch\?\.name/);
  assert.doesNotMatch(settings, /Location opening days & hours/);
  assert.match(resources, /title=\{`\$\{editing\.id\?"Edit":"Add"\} \$\{title\(singularName\)\}`\}/);
  assert.match(resources, /singularName=resource==="branches"\?"location"/);
  assert.match(resources, /<FormActions onCancel=\{onCancel\} cancelClosesDialog/);
  assert.equal((css.match(/\.app-dialog-body\{scroll-padding-bottom:96px\}/g) || []).length, 1);
  assert.equal((css.match(/\.settings-scope-badge\{/g) || []).length, 1);
});
