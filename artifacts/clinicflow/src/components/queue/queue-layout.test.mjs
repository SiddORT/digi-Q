import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read = name => readFileSync(new URL(name,import.meta.url),"utf8");
const queue=read("./SessionQueue.tsx"), shell=read("../../clinic.tsx"), selector=read("./SessionSelector.tsx"), tabs=read("./StatusTabs.tsx"), css=read("./queue-workspace.css");

test("Queue owns its only heading and four staff entry points",()=>{
 assert.match(shell,/page!=="queue"&&<div className="page-heading"/);
 assert.match(queue,/<header className="sq-page-header">[^]*Booking QR[^]*Quick Switch[^]*Validate QR[^]*Register Walk-In/);
 assert.match(queue,/sessionSelection\.snapshotOnly\?<span className="badge">Historical session · no new bookings<\/span>:enabled&&<Link/);
 assert.match(queue,/!isDoctor&&branchId&&<button/);
 assert.match(queue,/!queuePin&&<><CareLookup kind="clinics"/);
 assert.match(queue,/!queuePin&&branch\.data&&<div className="sq-context"/);
});
test("session controls distinguish selected and timezone-running states without changing session identity",()=>{
 assert.match(selector,/role="group" aria-labelledby="sq-sessions-label"/);
 assert.match(selector,/data-current=\{state==="Currently running"/);
 assert.match(selector,/aria-pressed=\{selection.selectedKey===key\}/);
 assert.match(selector,/sessionContextKey\(item\)/);
 assert.match(css,/\.sq-session-scroll\{[^}]*overflow-x:auto/);
});
test("five session aggregates lead the table, with exact consultation filtering and scoped counts",()=>{
 assert.match(css,/\.workspace \.sq-summary\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
 for(const name of ["Current Token","Next Waiting Token","Waiting","Completed","Session Total"])assert.ok(queue.includes(`<small>${name}</small>`));
 assert.ok(queue.indexOf('className="sq-summary"')<queue.indexOf("{listControls}<section"));
 assert.match(tabs,/\["inConsultation","In Consultation"\]/);
 assert.match(queue,/counts=\{debounced\|\|!q\?undefined:/);
 assert.match(queue,/entriesTotal\?\?0/);
 assert.match(queue,/Last successful response \{formatConfiguredTimestamp\(q.updatedAt/);
 assert.match(queue,/refetchInterval:30000/);
});
test("scope, refresh and mutation guards survive layout changes",()=>{
 assert.match(queue,/clinicId===queuePin\.clinicId&&branchId===queuePin\.branchId/);
 assert.match(queue,/enabled=scopeReady&&dateValid/);
 assert.match(queue,/refetchInterval:30000/);
 assert.match(queue,/disabled=\{freshness\.stale\|\|q\.presence\?\.status!=="available"/);
 assert.match(queue,/if\(lock\.current\)return;lock\.current=true/);
 assert.match(queue,/autoDate\.current=false;setDate\(today\(branch\.data\.timezone\)\)/);
 assert.match(queue,/whole session queue metrics/i);
 assert.match(queue,/autoDate\.current&&!appointmentId&&!selected\.data/);
 assert.match(queue,/if\(selected\.data\)\{autoDate\.current=false/);
 assert.match(queue,/label="Your Appointment"[^]*onChange=\{id=>\{autoDate\.current=false;setAppointment\(id\)/);
});
