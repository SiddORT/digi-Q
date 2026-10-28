import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { createQueueHarness } from "./test-support/postgres-queue.mjs";

let h;
const root = { id: "fictional-root", role: "superAdmin", clinicIds: [], branchIds: [] };
before(async () => { h = await createQueueHarness(); });
beforeEach(async () => { await h.seed(); });
after(async () => { if (h) await h.close(); });
const get = (id, actor = root, cursor) => h.route(h.api.appointmentsRouter, "get",
  cursor === undefined ? "/appointments/:id" : "/appointments/:id/history",
  actor, {}, { id }, cursor === undefined ? {} : { cursor });

test("records the database compatibility boundary without requiring PostgreSQL 16", async () => {
  const { rows: [version] } = await h.control.query("select current_setting('server_version') as version, current_setting('server_version_num')::int as number, to_regprocedure('pg_input_is_valid(text,text)') as validator");
  console.log("Appointment detail compatibility:", version);
  if (version.number < 160000) {
    assert.equal(version.validator, null);
    await assert.rejects(h.control.query("select pg_input_is_valid('2030-01-07T10:00:00Z', 'timestamp with time zone')"),
      error => error.code === "42883" && /pg_input_is_valid/.test(error.message));
  } else {
    assert.ok(version.validator);
  }
});

for (const status of ["waiting", "cancelled"]) {
  test(`Super Admin private ${status} detail returns HTTP 200 with legacy timestamp paging and privacy intact`, async () => {
    const a = await h.book();
    const row = await h.api.one(h.t.appointments, a.id);
    const valid = [
      { occurredAt: "2030-01-07T11:00:00+02:00", reason: "offset older" },
      { occurredAt: "2030-01-07T10:00:00.123Z", reason: "fractional UTC newest" },
      ...Array.from({ length: 65 }, (_, i) => ({ occurredAt: "2030-01-07T10:00:00.000Z", reason: `tie-${i}` })),
      { occurredAt: "2028-02-29", reason: "valid leap date" },
      { occurredAt: "2029-01-07T10:00:00", reason: "legacy unzoned" },
    ];
    const invalid = [
      {}, { occurredAt: null }, { occurredAt: "" }, { occurredAt: "garbage" },
      { occurredAt: "2030-02-30T10:00:00Z" }, { occurredAt: "2030-02-29T10:00:00Z" },
      { occurredAt: "2030-13-07T10:00:00Z" }, { occurredAt: "2030-01-07T25:00:00Z" },
      { occurredAt: "2030-01-07T10:00:00+99:99" }, { occurredAt: "10:00:00" },
      { occurredAt: "infinity" }, { occurredAt: "-infinity" }, { occurredAt: 123 },
      ...Array.from({ length: 25 }, () => ({ occurredAt: "not-a-timestamp" })),
    ].map((event, i) => ({ ...event, reason: `invalid-${i}` }));
    const history = [...valid, ...invalid].map(event => ({ ...event, status,
      actorId: "erased-actor", actorKind: "doctor", deletedActor: true,
      from: { date: a.date, doctorId: "d", doctorName: "Erased label", deletedDoctor: true, branchName: "Recorded location" },
    }));
    await h.api.change(h.t.appointments, a.id, { status, data: { ...row, history } });
    const server = h.api.appointmentDetailApp(root).listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    let detail;
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/appointments/${a.id}`);
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("cache-control"), "no-store");
      detail = await response.json();
    } finally { await new Promise(resolve => server.close(resolve)); }
    assert.equal(detail.status, status);
    assert.ok(detail.privatePatient);
    assert.equal(detail.history.length, 30);
    const events = [...detail.history];
    let cursor = detail.historyNextCursor;
    let sawUnknownTimeCursor = false;
    while (cursor) {
      if (JSON.parse(Buffer.from(cursor, "base64url").toString()).time === null) sawUnknownTimeCursor = true;
      const page = await get(a.id, root, cursor);
      assert.ok(page.history.length <= 30);
      events.push(...page.history);
      cursor = page.nextCursor;
    }
    assert.equal(sawUnknownTimeCursor, true, "unknown timestamps must also page without repeating or losing events");
    assert.deepEqual(events.map(e => e.reason), [
      "fractional UTC newest", ...Array.from({ length: 65 }, (_, i) => `tie-${64 - i}`),
      "offset older", "legacy unzoned", "valid leap date", ...invalid.map(e => e.reason).reverse(),
    ]);
    for (const event of events) {
      assert.equal(event.actorState, "deleted");
      assert.equal(event.actorDisplayName, null);
      assert.deepEqual(event.from, { date: a.date, deletedDoctor: true, branchName: "Recorded location" });
    }
    assert.equal(JSON.stringify(events).includes("erased-actor"), false);
    assert.equal(JSON.stringify(events).includes("Erased label"), false);
    for (const actor of [{ ...h.staff, clinicIds: [] }, { ...h.patient, patientId: "p2" }]) {
      await assert.rejects(get(a.id, actor), error => error.status === 403);
      await assert.rejects(get(a.id, actor, detail.historyNextCursor), error => error.status === 403);
    }
    const listed = await h.route(h.api.appointmentsRouter, "get", "/appointments", root);
    const listRow = listed.items.find(item => item.id === a.id);
    assert.equal(listRow.privatePatient, undefined);
    for (const event of listRow.history) {
      assert.equal(event.actorId, undefined);
      assert.equal(event.actorDisplayName, undefined);
      assert.equal(event.from?.doctorName, undefined);
      assert.equal(event.from?.branchName, undefined);
    }
  });
}

test("missing and empty embedded history stay distinct in Super Admin detail", async () => {
  const a = await h.book();
  const { history: _history, ...row } = await h.api.one(h.t.appointments, a.id);
  await h.api.change(h.t.appointments, a.id, { data: row });
  const missing = await get(a.id);
  assert.equal(missing.history, undefined);
  assert.equal(missing.historyNextCursor, null);
  await h.api.change(h.t.appointments, a.id, { data: { ...row, history: [] } });
  assert.deepEqual((await get(a.id)).history, []);
});
