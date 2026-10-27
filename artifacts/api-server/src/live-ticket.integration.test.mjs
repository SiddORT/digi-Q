import { after, before, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
mock.timers.enable({ apis: ["Date"], now: Date.UTC(2030, 0, 7, 12) });
process.env.SESSION_SECRET = "isolated-live-ticket-fixture-not-for-production";
process.env.CLINICFLOW_PUBLIC_ORIGIN = "https://tickets.example.invalid";
let h;
before(async () => { h = await createQueueHarness(); });
beforeEach(async () => { mock.timers.setTime(Date.UTC(2030, 0, 7, 12)); await h.seed(); });
after(async () => { try { if (h) await h.close(); } finally { mock.timers.reset(); } });
const read = (secret, user) => h.api.readLiveStatus(secret, user);
const issue = body => h.route(h.api.liveTicketRouter, "post", "/live-ticket-links", h.patient, body);
test("email attachment is an estimated snapshot with a live link and private QR, without sending", async () => {
  const branch=await h.api.one(h.t.branches,"b");
  await h.api.change(h.t.branches,"b",{data:{...branch,address:"21 Fictional Branch Street"}});
  const a = await h.book("p1", h.tomorrow, {notes:"PRIVATE-NOTE-MUST-NOT-EXPORT"});
  const attachment = await h.api.ticketAttachment(h.staff, a.id);
  const dir = await mkdtemp(join(tmpdir(),"live-email-pdf-"));
  try {
    const path=join(dir,"ticket.pdf");
    await writeFile(path,attachment.content);
    const text=execFileSync("pdftotext",[path,"-"],{encoding:"utf8"}).replace(/\s+/g," ");
    for(const field of [a.patientName,a.reference,a.token,"Session","Wait from session start","Suggested arrival","Estimate as of","2030-01-07T12:00:00.000Z","snapshot","live ticket"]) assert.ok(text.includes(field),field);
    assert.match(text,/https:\/\/tickets\.example\.invalid\/live-ticket#/);
    for(const hidden of ["PRIVATE-NOTE-MUST-NOT-EXPORT",a.bookingMobile,"expectedDurationMinutes","minutes per patient"]) if(hidden) assert.ok(!text.includes(hidden),hidden);
    assert.match(attachment.content.toString("latin1"),/\/Subtype \/Image/,"private QR image remains embedded");
    assert.ok(attachment.content.toString("latin1").includes("https://www.google.com/maps/dir/"),"branch directions remain clickable");
  } finally { await rm(dir,{recursive:true,force:true}); }
});

test("minimal public projection excludes every personal field and validation QR", async () => {
  const a = await h.book("p1", h.tomorrow, { notes: "PRIVATE-NOTE" });
  const link = await issue({ appointmentId: a.id });
  const secret = new URL(link.url).hash.slice(1);
  assert.match(secret, /^[a-f0-9]{64}$/);
  assert.equal(new URL(link.url).pathname, "/live-ticket");
  const anonymous = await read(secret);
  for (const key of ["appointment", "id", "appointmentId", "patientId", "patientName", "patientCode", "reference", "history", "notes", "bookingMobile", "checkInUrl", "expectedDurationMinutes", "reason", "actorId"])
    assert.equal(Object.hasOwn(anonymous, key), false, key);
  assert.equal(anonymous.token, a.token);
  assert.ok(anonymous.estimate.asOf);
  const serialized = JSON.stringify(await h.api.all(h.t.settings));
  assert.ok(!serialized.includes(secret), "plaintext capability never stored");
  assert.ok(serialized.includes(h.api.liveHash(secret)), "hash is persisted");
});
test("only exact patient owner is upgraded; staff, another patient and guest are not", async () => {
  const a = await h.book("p1", h.tomorrow);
  const { url } = await issue({ appointmentId: a.id });
  const secret = new URL(url).hash.slice(1);
  assert.equal((await read(secret, h.patient)).appointment.id, a.id);
  for (const user of [h.staff, { ...h.patient, patientId: "p2" }, { role: "guest", patientId: "p1" }]) assert.equal((await read(secret, user)).appointment, undefined);
  assert.equal((await read(secret, h.patient)).appointment.expectedDurationMinutes, undefined);
});
test("invalid, appointment ID, QR payload and expired capabilities fail identically", async () => {
  const a = await h.book("p1", h.tomorrow);
  const { url } = await issue({ appointmentId: a.id });
  const secret = new URL(url).hash.slice(1);
  for (const value of ["f".repeat(64), a.id, a.reference]) await assert.rejects(read(value), e => e.status === 404);
  mock.timers.setTime(Date.UTC(2030, 0, 12));
  await assert.rejects(read(secret), e => e.status === 404);
});
test("revocation invalidates existing links without disabling newly issued links", async () => {
  const a = await h.book("p1", h.tomorrow);
  const first = await issue({ appointmentId: a.id });
  await h.api.revokeLiveLinks(a);
  await assert.rejects(read(new URL(first.url).hash.slice(1)), e => e.status === 404);
  const next = await issue({ appointmentId: a.id });
  assert.equal((await read(new URL(next.url).hash.slice(1))).status, a.status);
});
test("issuance checks appointment read scope and does not accept mixed authority", async () => {
  const a = await h.book("p2", h.tomorrow);
  await assert.rejects(issue({ appointmentId: a.id }), e => e.status === 403);
  await assert.rejects(issue({ appointmentId: a.id, receiptSecret: "a".repeat(64) }), e => e.status === 400);
});
test("saved active duration survives a general setting change; explicit session changes are read", async () => {
  const a = await h.book("p1", h.tomorrow), b = await h.book("p2", h.tomorrow);
  const { url } = await issue({ appointmentId: a.id });
  const secret = new URL(url).hash.slice(1);
  const doctor = await h.api.one(h.t.doctors, "d");
  await h.api.change(h.t.doctors, "d", { data: { ...doctor, expectedDurations: { c: 60 } } });
  const view = await h.api.appointmentViewWithBranch(b, h.staff);
  assert.equal(view.estimate.waitMinutes, 10);
  const stored = await h.api.one(h.t.settings, `session:d:b:${h.tomorrow}:00:00`);
  await h.api.change(h.t.settings, stored.id, { data: { expectedDurationMinutes: 20 } });
  assert.equal((await h.api.appointmentViewWithBranch(b, h.staff)).estimate.waitMinutes, 20);
  assert.equal((await read(secret)).estimate.waitMinutes, 0);
});
test("guest receipt still manages the booking but live capability cannot substitute for it", async () => {
  const receiptSecret = "a".repeat(64);
  await h.api.put(h.t.qrs, { id: "qr", clinicId: "c", branchId: "b", publicReference: "guest-qr" });
  const guest = await h.api.createGuestRequest({ qrReference: "guest-qr", fullName: "Private Guest", mobile: "+14155552671", branchId: "b", doctorId: "d", date: h.tomorrow, requestId: "12345678-1234-4234-8234-123456789012", receiptSecret });
  const link = await h.route(h.api.liveTicketRouter, "post", "/live-ticket-links", null, { receiptSecret });
  const secret = new URL(link.url).hash.slice(1);
  await assert.rejects(h.api.manageReceipt({ receiptSecret: secret }), e => e.status === 404);
  assert.equal((await h.api.manageReceipt({ receiptSecret })).appointment.id, guest.appointmentId);
  await h.api.revokeLiveLinks(await h.api.one(h.t.appointments, guest.appointmentId));
  assert.equal((await h.api.manageReceipt({ receiptSecret })).appointment.id, guest.appointmentId);
});
