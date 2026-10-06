import assert from "node:assert/strict";
import { test, after } from "node:test";
import { build } from "esbuild";
import { rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { canShowAppointmentTicket } from "../../clinicflow/src/components/appointments/presentation.ts";

const directory = resolve(import.meta.dirname, "../../clinicflow/src/components/appointments");
const bundle = join(directory, `.appointment-details-${process.pid}.test-bundle.mjs`);
after(() => rm(bundle, { force: true }));
await build({
  stdin: {
    contents: `import { createElement } from "react"; import { renderToStaticMarkup } from "react-dom/server"; import { AppointmentDetails } from "./AppointmentDetails"; export {ticketHtml,sessionRange} from "../tickets/VisitTicket"; export const render = appointment => renderToStaticMarkup(createElement(AppointmentDetails, {appointment}));`,
    resolveDir: directory,
  },
  outfile: bundle, platform: "node", format: "esm", bundle: true, packages: "external", jsx: "automatic",
  define: {"import.meta.env.BASE_URL":'"/"'}, loader: {".css":"empty"},
  plugins: [{
    name: "isolated-title",
    setup(b) {
      // Bundle the workspace API client from source (its extensionless TS imports cannot load as an external package).
      b.onResolve({ filter: /^@workspace\/api-client-react$/ }, () => ({ path: resolve(import.meta.dirname, "../../../lib/api-client-react/src/index.ts") }));
      b.onResolve({ filter: /\/resources$/ }, () => ({ path: "title", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const title = value => value; export const ErrorNotice = () => null;" }));
    },
  }],
});
const { render, ticketHtml, sessionRange } = await import(pathToFileURL(bundle).href);
test("completed visit tickets are hidden without suppressing other existing states", () => {
  assert.equal(canShowAppointmentTicket({status:"completed"}), false);
  for (const status of ["waiting","called","inConsultation","cancelled","noShow"]) assert.equal(canShowAppointmentTicket({status}), true);
});
test("private detail renders notes, reasons and consultation check-in without actor IDs or raw HTML", () => {
  const html = render({
    patientName: "Patient", reference: "A1", notes: "<script>private note</script>",
    timezone: "UTC", checkedInAt: "2030-01-07T12:00:00Z",
    history: [{status:"noShow",action:"noShow",occurredAt:"2030-01-07T12:05:00Z",reason:"Patient temporarily absent",actorId:"private-actor-id"}],
  });
  assert.match(html, /private note/);
  assert.match(html, /Patient temporarily absent/);
  assert.match(html, /Consultation check-in/);
  assert.match(html, /not arrival at the clinic/);
  assert.doesNotMatch(html, /<script>|private-actor-id/);
});
test("legacy missing notes and timestamps are reported honestly", () => {
  const html = render({patientName:"Patient",reference:"A1"});
  assert.match(html, /No notes recorded/);
  assert.match(html, /Not recorded/);
  assert.match(html, /No history recorded/);
});
test("ticket display and export use each clinic's preferences without changing QR geometry", () => {
  const ticket={patientName:"Patient",clinicName:"Clinic",branchName:"Location",doctorName:"Doctor",date:"2030-01-07",startTime:"14:05",endTime:"15:05",dateFormat:"MM/DD/YYYY",timeFormat:"24h"};
  assert.equal(sessionRange(ticket),"14:05 – 15:05");
  const html=ticketHtml(ticket,"data:image/png;base64,test");
  assert.match(html,/01\/07\/2030/);
  assert.match(html,/width:180px/);
  assert.match(html,/max-width:560px/);
  assert.match(html,/14:05 – 15:05/);
  assert.match(ticketHtml({...ticket,dateFormat:"DD MMM YYYY",timeFormat:"12h"},null),/07 Jan 2030/);
  assert.equal(sessionRange({...ticket,timeFormat:"12h"}),"2:05 PM – 3:05 PM");
});