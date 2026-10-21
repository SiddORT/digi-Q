import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
const { build } = createRequire(new URL("../../../api-server/package.json", import.meta.url))("esbuild");

const output = resolve(import.meta.dirname, "../../.clinic-metadata-render.cjs");
await build({ entryPoints: [resolve(import.meta.dirname, "ClinicMetadataFields.tsx")], outfile: output, bundle: true, platform: "node", format: "cjs", jsx: "automatic", packages: "external", loader: { ".css": "empty" }, alias: { "@": resolve(import.meta.dirname, ".."), "@workspace/api-client-react": resolve(import.meta.dirname, "../../../../lib/api-client-react/src/index.ts") } });
const require = createRequire(output);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { QueryClient, QueryClientProvider } = require("@tanstack/react-query");
const { ClinicMetadataFields, ClinicMetadataFacts } = require(output);
after(() => rm(output, { force: true }));
const render = (props = {}) => renderToStaticMarkup(React.createElement(QueryClientProvider, { client: new QueryClient() },
  React.createElement(ClinicMetadataFields, { value: {}, categories: [], specialities: [], loading: false, onChange() {}, ...props })));

test("empty catalogs explicitly allow custom clinic entry without claiming successful selection", () => {
  const html = render();
  assert.match(html, /No standard categories are available/);
  assert.match(html, /No standard specialities are available/);
  assert.match(html, /Add custom speciality/);
  assert.match(html, /Category \(optional\)/);
  assert.doesNotMatch(html, /__custom_category/); // Sentinel is not a saved/displayed ID.
});
test("failed and loading lookups have distinct, retryable states and keep the custom controls available", () => {
  const failed = render({ error: true });
  assert.match(failed, /Healthcare suggestions could not be loaded/);
  assert.match(failed, /Retry healthcare suggestions/);
  assert.doesNotMatch(failed, /No standard categories/);
  const loading = render({ loading: true });
  assert.match(loading, /Loading healthcare suggestions/);
  assert.doesNotMatch(loading, /No standard categories/);
  assert.match(loading, /Add custom speciality/);
});
test("standard and inactive historical selections have readable labels, not master IDs", () => {
  const html = render({ value: { categoryId: "old-cat-id", specialityIds: ["old-spec-id", "active-spec-id"] },
    saved: { categoryId: "old-cat-id", categoryName: "Historical Category", specialityIds: ["old-spec-id"], specialityNames: ["Historical Speciality"] },
    specialities: [{ id: "active-spec-id", name: "General Medicine" }] });
  assert.match(html, /Historical Category/);
  assert.match(html, /Historical Speciality/);
  assert.match(html, /General Medicine/);
  assert.doesNotMatch(html, /old-cat-id|old-spec-id|active-spec-id/);
});
test("custom fields are labelled, bounded, removable and safe-rendered alongside standard specialities", () => {
  const html = render({ value: { customCategory: "Local <Clinic>", specialityIds: ["s"], customSpecialities: ['Care "One"', "<script>alert(1)</script>"] },
    specialities: [{ id: "s", name: "General Medicine" }] });
  assert.match(html, /Local &lt;Clinic&gt;/);
  assert.match(html, /Custom speciality 1/);
  assert.match(html, /aria-label="Remove custom speciality 1"/);
  assert.match(html, /maxLength="100"/);
  assert.match(html, /aria-labelledby="[^"]+-label"/);
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /Remove custom category/);
  assert.match(html, /General Medicine/);
  assert.match(html, /not qualifications or accreditation/);
});
test("shared clinic/profile facts show exact names and optional blanks", () => {
  const facts = clinic => renderToStaticMarkup(React.createElement("dl", null, React.createElement(ClinicMetadataFacts, { clinic })));
  assert.equal(facts({}), "<dl><div><dt>Category</dt><dd>Not set</dd></div><div><dt>Specialities</dt><dd>Not set</dd></div></dl>");
  assert.match(facts({ categoryName: "Community Care", specialityNames: ["General Medicine", "Custom Care"] }), /General Medicine, Custom Care/);
});
