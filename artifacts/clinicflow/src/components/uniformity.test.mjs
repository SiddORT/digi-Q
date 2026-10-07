import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("shared list header: title + primary action, then wide search + tools, then exposed filters/status, then chips", () => {
  const src = read("./ListingControls.tsx");
  const bar = src.slice(src.indexOf("export function FilterBar"));
  const r = bar.slice(bar.indexOf("  return ("));
  const top = r.indexOf("lh-top"), actions = r.indexOf('className="lh-actions"'), search = r.indexOf("lh-search-row"), tools = r.indexOf("lh-table-tools"), sub = r.indexOf("lh-sub"), filters = r.indexOf("lh-filters"), chips = r.indexOf("lh-chips-row");
  assert.ok(top > 0 && top < actions && actions < search && search < tools && tools < sub && sub < filters && filters < chips, "row order");
  assert.match(bar, /const toolsInline = !status && !countInSub;/);
  assert.match(bar, /const hasSubRow = !toolsInline && !!\(status \|\| meta \|\| advanced \|\| showClear \|\| countInSub\)/);
  // Filters never strand alone on row 2: without status/count they join the search row.
  assert.match(bar, /\{toolsInline && !!\(meta \|\| advanced \|\| showClear\) && tools\}/);
  assert.match(bar, /\{\(hasSubRow \|\| filters\) && \(/);
  const css = read("./uniformity.css");
  assert.match(css, /\.list-header\{--lh-h:var\(--control-md\)/);
  assert.match(css, /\.lh-actions :is\(\.button,a\.button,button\.button\)\{min-height:var\(--lh-h\)/);
  assert.match(css, /\.workspace-search input\{min-height:var\(--lh-h\)/);
  assert.match(css, /\.export-status\{white-space:normal;max-width:260px;overflow:visible/);
});

test("appointments header carries Export beside a full-size Book appointment; updated tip in meta", () => {
  const clinic = read("../clinic.tsx");
  const appts = clinic.slice(clinic.indexOf("function Appointments("), clinic.indexOf("function Booking("));
  assert.match(appts, /secondary=\{<><FilteredAppointmentExport[^]*?actions=\{<><Link className="button" href=\{`\/\$\{role\}\/book`\} data-testid="link-page-book-appointment">/);
  assert.match(appts, /meta=\{<>[\s\S]*?\{q\.dataUpdatedAt>0\?<span className="listing-updated-tip"/);
  assert.doesNotMatch(appts, /meta=\{<><SearchableSelect label="Visit Range"/, "visit range is a drawer filter");
  assert.doesNotMatch(clinic, /className="button small" href=\{`\/\$\{role\}\/book`\}/);
});

test("appointment details keep every field, empty state and explanation in grouped structure", () => {
  const d = read("./appointments/AppointmentDetails.tsx");
  for (const s of ["a.patientName", "a.status", "a.token", "Not assigned", "a.doctorName", "a.clinicName", "a.branchName", "formatDate(a.date", "a.startTime", "a.endTime", "a.timezone", "a.reference", "navigator.clipboard.writeText(a.reference)", "No notes recorded.", "a.checkedInAt", "a.completedAt", "Not recorded", "not arrival at the clinic", "Status and Reason History", "No history recorded.", "event.reason", "Session window, not a promised consultation time."]) assert.ok(d.includes(s), s);
  assert.match(d, /className="appt-detail-grid"/);
  assert.match(read("./appointments/AppointmentRows.tsx"), /id=\{`appt-expand-\$\{a\.id\}`\}/);
});

test("ticket popup retains all information, links and export actions", () => {
  const t = read("./appointments/AppointmentTicket.tsx");
  for (const s of ["confirmationEmailMessage", "link-ticket-patient-live", "href={patientLiveUrl}", "Patient Booking Status Page", "Doctor status:", "Calling is paused; your booking is kept.", "patients ahead", "An estimate only, not a countdown", "Booking status updates unavailable or offline", "QR is for authorized staff validation", "Status refreshes every 30 seconds while connected. Printed tickets do not update.", "Open Booking Status", "Appointment History", "Ticket is offline or stale", "Retry QR"]) assert.ok(t.includes(s), s);
  const v = read("./tickets/VisitTicket.tsx");
  for (const s of ["button-download-ticket", "button-print-ticket", "m.qrCaption", "address: t.address", "doctorName: t.doctorName", "clinicName: t.clinicName", "sessionRange(t)", "ticket.reference", "modelFor(ticket)"]) assert.ok(v.includes(s), s);
  // Exported/printed HTML still includes every field.
  const html = v.slice(v.indexOf("export function ticketHtml"), v.indexOf("export function bookingStatusLabel"));
  for (const s of ["const m = modelFor(t)", "m.patient", "m.number", "m.reference", "m.visitPrimary", "m.visitSecondary", "m.facts", "m.qrCaption", "ticketCssVarString()"]) assert.ok(html.includes(s), s);
  const model = read("./tickets/ticket-model.ts");
  for (const s of ["t.patientName", "t.waitingNumber", "t.reference", "t.branchName", "Keep it private", "Session ${t.sessionText}"]) assert.ok(model.includes(s), s);
  assert.match(v, /dateText: formatDate\(t\.date, t\), sessionText: sessionRange\(t\)/);
  assert.match(v, /style=\{ticketCssVars\(\) as CSSProperties\}/);
  assert.doesNotMatch(read("./tickets/visit-ticket.css").split("/* Center only")[0], /#[0-9a-f]{6}/i, "screen ticket colours come only from the shared model");
  const css = read("./uniformity.css");
  assert.match(css, /\.appt-ticket \.vt-actions\{margin:0;flex-wrap:nowrap\}/);
  assert.doesNotMatch(css.slice(css.indexOf("On-screen ticket"), css.indexOf("Shared drawer")), /overflow:hidden|display:none/);
});

test("listing pages put the real page h1 on row 1 beside search and actions; count becomes row-2 metadata", () => {
  const src = read("./ListingControls.tsx");
  assert.match(src, /export const ListPageTitleContext = createContext/);
  assert.match(src, /pageTitle \? <div className="lh-page-title">[^]*?<h1 data-testid="text-page-title">\{pageTitle\.title\}<\/h1>/);
  assert.match(src, /countInSub && <div className="filter-bar-title lh-count"/);
  const clinic = read("../clinic.tsx");
  assert.match(clinic, /\{!listingPage&&<div className="page-heading">/);
  assert.match(clinic, /<ListPageTitleContext\.Provider value=\{listingPage\?\{title:navLabel\(page,role\)/);
  const css = read("./uniformity.css");
  assert.match(css, /\.lh-top\{flex-wrap:nowrap\}/);
  assert.match(css, /@media \(max-width:900px\)\{\n  \.workspace \.list-header \.lh-top\{flex-wrap:wrap\}/);
  assert.doesNotMatch(css, /max-width:1100px/);
});

test("whole-app consistency: shared section heads, grouped editors, outlined secondary actions", () => {
  for (const p of ["./CustomRoles.tsx", "./IntegrationSettings.tsx", "./AccessRules.tsx", "./ClinicSettings.tsx", "./DemoClinicManagement.tsx", "./queue/GuestRequests.tsx"]) assert.match(read(p), /section-head/, p);
  assert.match(read("../clinic.tsx"), /platform-preferences"><div className="panel-heading compact-heading section-head">/);
  for (const p of ["./EmailTemplates.tsx", "./AccessRules.tsx", "./IntegrationSettings.tsx"]) assert.doesNotMatch(read(p), /className="secondary/, p);
  const res = read("../resources.tsx");
  assert.match(res, /const EDITOR_GROUPS/);
  assert.match(res, /className="editor-section wide"/);
  assert.match(res, /collapsed\?<div hidden className="wide" data-testid=\{`collapsed-\$\{field\.key\}`\}>/);
  const css = read("./uniformity.css");
  for (const re of [/\.workspace \.section-head\{display:flex/, /\.workspace \.editor-section\{/, /\.workspace \.button\.secondary\{background:var\(--dq-surface\)/]) assert.match(css, re);
});
