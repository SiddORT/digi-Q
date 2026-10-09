import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("vite"))("esbuild");
const bundle = await build({
  stdin: {
    contents: 'export { ResourceRecord } from "./ResourceRecord"; export { Router } from "wouter";',
    resolveDir: fileURLToPath(new URL(".", import.meta.url)), loader: "tsx",
  },
  bundle: true, write: false, platform: "node", format: "cjs", jsx: "automatic",
  external: ["react", "react/*", "react-dom", "react-dom/*"],
  loader: { ".css": "empty" },
});
const recordModule = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(require, recordModule, recordModule.exports);
const { ResourceRecord, Router } = recordModule.exports;
const renderRecord = (resource, row, columns = ["name"], options = {}) =>
  renderToStaticMarkup(React.createElement(Router, { ssrPath: "/admin/clinics" }, React.createElement(ResourceRecord, {
    resource, row, columns, column: columns[0], portal: "admin",
    superadminClinics: false, clinicHref: "/admin/clinics/clinic-1", ...options,
  })));
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const clinic = read("../clinic.tsx"), resources = read("../resources.tsx"), users = read("../Users.tsx"), queue = read("./queue/SessionQueue.tsx");

test("appointment toolbar: sort lives in the filter drawer, updated time is an icon tip, suggestions omit references", () => {
  assert.match(clinic, /advanced=\{<><SearchableSelect label="Status"[^]*?<SearchableSelect label="Visit Range"[^]*?<SearchableSelect label="Sort Appointments" value=\{draft\.sort\}/);
  assert.match(clinic, /<HelpTip label="Last Updated"/);
  assert.match(clinic, /description:\[a\.doctorName,formatDate\(a\.date,a\)\]/);
  assert.match(clinic, /value:a\.reference/); // selection still searches the backend reference
});
test("rendered ordinary record cells omit technical codes and references", () => {
  for (const resource of ["clinics", "branches", "doctors", "patients", "users", "masters", "qrs"]) {
    const html = renderRecord(resource, {
      id: "record-1", name: "Visible record", code: "PRIVATE-CODE", reference: "PRIVATE-REF",
      city: "Pune", clinicName: "Clinic Group", specializationName: "General Medicine", mobile: "Test contact", email: "contact@example.test",
    });
    assert.match(html, /class="admin-record"><strong>/);
    assert.match(html, /Visible record/);
    assert.doesNotMatch(html, /PRIVATE-CODE|PRIVATE-REF/);
    assert.ok((html.match(/<small>/g) || []).length <= 1, `${resource} has at most one context line`);
  }
  assert.match(resources, /compact&&c===config\.columns\[0\]\?<ResourceRecord /, "the listing uses the rendered component");
});
test("record context does not duplicate visible columns or leave empty secondary lines", () => {
  const row = { id: "p1", fullName: "Test patient", mobile: "Test mobile", email: "patient@example.test" };
  const compact = renderRecord("patients", row, ["fullName"]);
  assert.match(compact, /Test mobile/);
  assert.doesNotMatch(compact, /patient@example\.test/);
  const email = renderRecord("patients", row, ["fullName", "mobile"]);
  assert.doesNotMatch(email, /Test mobile/);
  assert.match(email, /patient@example\.test/);
  const noContext = renderRecord("patients", row, ["fullName", "mobile", "email"]);
  assert.doesNotMatch(noContext, /<small>|Test mobile|patient@example\.test/);
  assert.doesNotMatch(renderRecord("masters", { id: "m1", name: "Test master" }), /<small>/);
});
test("superadmin clinic records retain their permitted code and admin navigation", () => {
  const row = { id: "c1", name: "Test clinic", city: "Pune", code: "CLINIC-CODE", reference: "PRIVATE-REF" };
  const html = renderRecord("clinics", row, ["name"], { superadminClinics: true });
  assert.match(html, /href="\/admin\/clinics\/clinic-1"/);
  assert.match(html, /Code: CLINIC-CODE/);
  assert.doesNotMatch(html, /Pune|PRIVATE-REF/);
  assert.match(renderRecord("clinics", { ...row, code: "" }, ["name"], { superadminClinics: true }), /Code not set/);
  const ordinary = renderRecord("clinics", row);
  assert.match(ordinary, /Pune/);
  assert.doesNotMatch(ordinary, /CLINIC-CODE/);
});
test("staff assignments are a counted dialog trigger and Created is not a default column", () => {
  assert.match(users, /<AssignmentSummary /);
  assert.doesNotMatch(users, /sortable\("createdAt","Created"\)/);
});
test("queue notes, duration and quick switch open as overlays", () => {
  assert.doesNotMatch(queue, /<details className="sq-(switch|duration|note-details)"/);
  assert.doesNotMatch(queue, /showDuration/);
  const duration = read("./queue/DurationEditor.tsx");
  assert.match(duration, /variant="drawer"/);
  assert.match(duration, /data-testid="button-queue-duration"/);
  assert.match(duration, /dirty=\{minutes!==openedMinutes\|\|effect!=="futureOnly"\|\|confirm\}/);
  assert.match(queue, /title="Multi-doctor sessions · quick switch"/);
});
test("audit technical payload is available in a drawer", () => {
  assert.match(resources, /data-testid="audit-payload"/);
});
