// Real packages and real contracts, with synthetic values only. No DB connection,
// credentials, provider traffic, or large attack payloads are used.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire, Module } from "node:module";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const apiRequire = createRequire(resolve("artifacts/api-server/package.json"));
const dbRequire = createRequire(resolve("lib/db/package.json"));
const uiRequire = createRequire(resolve("artifacts/clinicflow/package.json"));
const mockupRequire = createRequire(resolve("artifacts/mockup-sandbox/package.json"));
const { build } = apiRequire("esbuild");
const z = apiRequire("zod");
const result = await build({
  stdin: {
    contents: `
      export * as contract from "@workspace/api-zod";
      export * as tables from "@workspace/db/schema";
      export * as http from "./lib/http";
      export { smsMappingSchema } from "./lib/notification-sms-transport";
      export { setupDraftSchema, accountDraftSchema } from "../../clinicflow/src/lib/registration-draft";
    `,
    resolveDir: resolve("artifacts/api-server/src"),
  },
  bundle: true, write: false, platform: "node", format: "cjs",
});
const module = new Module(resolve("generated-artifacts/f02-test.cjs"));
module.filename = module.id;
module.paths = apiRequire.resolve.paths("zod");
module._compile(result.outputFiles[0].text, module.filename);
const { contract: c, tables, http, smsMappingSchema, setupDraftSchema, accountDraftSchema } = module.exports;
const { createInsertSchema, createSelectSchema, createUpdateSchema } = dbRequire("drizzle-zod");
const { isTable } = dbRequire("drizzle-orm");

test("all workspace consumers resolve the patched runtime and supported adapters", () => {
  for (const pkg of ["artifacts/api-server", "artifacts/clinicflow", "artifacts/mockup-sandbox", "lib/api-zod", "lib/db"]) {
    const require = createRequire(resolve(pkg, "package.json"));
    assert.equal(require("zod/package.json").version, "4.6.7", pkg);
  }
  for (const require of [uiRequire, mockupRequire]) {
    assert.equal(require("@hookform/resolvers/package.json").version, "7.0.6");
    assert.equal(typeof require("@hookform/resolvers/zod").zodResolver, "function");
  }
  assert.equal(JSON.parse(readFileSync(resolve(dbRequire.resolve("drizzle-zod"), "../package.json"), "utf8")).version, "0.8.3");
  assert.equal(Object.values(c).filter(v => typeof v?.safeParse === "function").length, 423);
  for (const name of ["DeleteScheduleParams", "GetDoctorPresenceParams", "ResolveClinicSlugParams",
    "ResolveBranchSlugParams", "ListPatientActivityParams", "UploadPatientDocumentParams", "GetAppointmentHistoryParams"]) {
    assert.equal(typeof c[name].parse, "function", `barrel must export runtime ${name}`);
  }
});

test("optional, nullable and omitted update fields retain their distinct output", () => {
  assert.deepEqual(c.UpdatePatientBody.parse({ fullName: "Synthetic Patient" }), { fullName: "Synthetic Patient" });
  assert.deepEqual(c.UpdatePatientBody.parse({ fullName: "Synthetic Patient", mobile: null, email: null, dateOfBirth: null }),
    { fullName: "Synthetic Patient", mobile: null, email: null, dateOfBirth: null });
  assert.equal(c.UpdatePatientBody.safeParse({ fullName: "Synthetic Patient", age: null }).success, false);
  assert.equal(c.UpdatePatientBody.safeParse({ fullName: "" }).success, false);
  assert.deepEqual(c.UpdatePatientBody.parse({ fullName: "Synthetic Patient", password: "never-retain" }), { fullName: "Synthetic Patient" });
});

test("date coercion, actual calendar validation and query defaults remain at the HTTP boundary", () => {
  const body = { patientId: "p", doctorId: "d", clinicId: "c", branchId: "b",
    date: "2026-11-16", source: "online", bookingMobile: "+919876543210" };
  assert.ok(c.CreateAppointmentBody.parse(body).date instanceof Date);
  assert.equal(http.parse(c.CreateAppointmentBody, body).date, "2026-11-16");
  for (const date of ["2026-02-30", "16/11/2026", "not-a-date"]) {
    assert.throws(() => http.parse(c.CreateAppointmentBody, { ...body, date }), /Invalid date/);
  }
  const q = http.query(c.ListAppointmentsQueryParams, { query: { date: "2026-11-16", page: "2", pageSize: "25" } });
  assert.equal(q.date, "2026-11-16"); assert.equal(q.page, 2); assert.equal(q.pageSize, 25);
  const defaults = http.query(c.ListAppointmentsQueryParams, { query: {} });
  assert.equal(defaults.page, 1); assert.equal(defaults.pageSize, 20);
  for (const query of [{ pageSize: "101" }, { page: "no" }, { from: "2026-11-17", to: "2026-11-16" }]) {
    assert.throws(() => http.query(c.ListAppointmentsQueryParams, { query }));
  }
  assert.throws(() => c.GetPatientParams.parse({}), /id/);
  assert.equal(c.GetPatientParams.parse({ id: 123 }).id, "123");
});

test("legacy UUID-shaped identifiers are not silently tightened to RFC version bits", () => {
  for (const id of ["11111111-1111-4111-8111-111111111111", "00000000-0000-0000-0000-000000000001",
    "FFFFFFFF-FFFF-FFFF-FFFF-FFFFFFFFFFFF"]) {
    assert.equal(c.GetClinicRegistrationCompletionQueryParams.parse({ requestId: id }).requestId, id);
    assert.equal(setupDraftSchema.shape.requestId.parse(id), id);
    assert.equal(z.guid().parse(id), id);
  }
  for (const requestId of ["x", "", "11111111-1111-4111-8111-111111111111\n"]) {
    assert.equal(c.GetClinicRegistrationCompletionQueryParams.safeParse({ requestId }).success, false);
  }
});

test("OTP formats and unknown-field handling remain explicit", () => {
  for (const code of ["1234", "123456", "12345678"]) assert.equal(c.VerifyOtpBody.parse({ challengeId: "synthetic", code }).code, code);
  for (const code of ["123", "123456789", "123a56", "１２３４５６", 123456, null]) {
    assert.equal(c.VerifyOtpBody.safeParse({ challengeId: "synthetic", code }).success, false);
  }
  for (const mobile of ["9876543210", "+01234567890", "+1", ""]) assert.equal(c.RequestOtpBody.safeParse({ mobile }).success, false);
  const mapping = { encoding: "json", authMode: "bearer", authField: "Authorization",
    fields: { recipient: "mobile", message: "message", senderId: "sender", dltEntityId: "entity", dltTemplateId: "template" },
    acceptedStatuses: [200], dltRequired: false };
  assert.deepEqual(smsMappingSchema.parse(mapping).staticFields, {});
  assert.equal(smsMappingSchema.safeParse({ ...mapping, fields: { ...mapping.fields, password: "forbidden" } }).success, false);
  assert.equal(smsMappingSchema.safeParse({ ...mapping, staticFields: { "bad-key": "invalid" } }).success, false);
  assert.equal(smsMappingSchema.safeParse({ ...mapping, acceptedStatuses: [500] }).success, false);
});

test("validation errors preserve HTTP status, code and field paths without echoing submitted values", () => {
  const parsed = c.VerifyOtpBody.safeParse({ challengeId: "synthetic", code: "private-invalid-code" });
  assert.equal(parsed.success, false);
  let status, data;
  const res = { status(value) { status = value; return this; }, json(value) { data = value; } };
  http.errors(parsed.error, { log: { error() { assert.fail("validation should not be logged as a server error"); } } }, res, () => {});
  assert.equal(status, 400); assert.equal(data.code, "VALIDATION_ERROR");
  assert.match(data.error, /^Invalid input: code /);
  assert.doesNotMatch(data.error, /private-invalid-code/);
});

for (const [name, require] of [["ClinicFlow", uiRequire], ["Canvas", mockupRequire]]) {
  test(`${name} resolver returns transformed output and nested/strict errors with real Zod 4`, async () => {
    const { zodResolver } = require("@hookform/resolvers/zod");
    const schema = z.object({ count: z.coerce.number().int().min(1),
      contact: z.object({ email: z.email(), note: z.string().optional() }).strict() }).strict();
    const resolver = zodResolver(schema);
    const options = { criteriaMode: "all", fields: {}, shouldUseNativeValidation: false };
    const valid = await resolver({ count: "2", contact: { email: "synthetic@example.test" } }, {}, options);
    assert.deepEqual(valid, { errors: {}, values: { count: 2, contact: { email: "synthetic@example.test" } } });
    const invalid = await resolver({ count: "0", contact: { email: "invalid" } }, {}, options);
    assert.deepEqual(invalid.values, {});
    assert.equal(invalid.errors.count.type, "too_small");
    assert.equal(invalid.errors.contact.email.type, "invalid_format");
    assert.ok(invalid.errors.contact.email.types);
    const unknown = await resolver({ count: "2", contact: { email: "synthetic@example.test", injected: "forbidden" } }, {}, options);
    assert.deepEqual(unknown.values, {});
    assert.equal(unknown.errors.contact.type, "unrecognized_keys");
    const nullOptional = await resolver({ count: "2", contact: { email: "synthetic@example.test", note: null } }, {}, options);
    assert.equal(nullOptional.errors.contact.note.type, "invalid_type");
  });
}

test("drizzle-zod builds insert/select/update validators for every actual PostgreSQL table without connecting", t => {
  let count = 0;
  for (const table of Object.values(tables)) {
    if (!isTable(table)) continue;
    for (const factory of [createInsertSchema, createSelectSchema, createUpdateSchema]) {
      const schema = factory(table);
      assert.equal(typeof schema.parse, "function");
      assert.equal(schema.safeParse(null).success, false);
    }
    count++;
  }
  assert.ok(count >= 20, `checked ${count} tables`);
  t.diagnostic(`Validated insert/select/update schema construction for ${count} PostgreSQL tables`);
  const user = { id: "synthetic", email: "synthetic@example.test", fullName: "Synthetic", role: "patient" };
  const insert = createInsertSchema(tables.users);
  assert.deepEqual(insert.parse(user), user);
  assert.equal(insert.safeParse({ ...user, createdAt: "2026-11-16" }).success, false);
  assert.ok(insert.parse({ ...user, createdAt: new Date("2026-11-16Z"), mobile: null }).createdAt instanceof Date);
  assert.equal(insert.safeParse({ ...user, fullName: null }).success, false);
  // JSON literal null is valid JSONB; SQL NOT NULL constraints are not a
  // prohibition on the JSON value null. Keep the adapter's existing contract.
  assert.deepEqual(insert.parse({ ...user, data: null }).data, null);
  assert.deepEqual(createUpdateSchema(tables.users).parse({ mobile: null }), { mobile: null });
  const select = createSelectSchema(tables.users);
  assert.equal(select.safeParse(user).success, false, "defaulted columns are required on selected rows");
});

test("bounded oversized collections reject before visiting their invalid nested items", () => {
  let visited = 0;
  const item = z.preprocess(value => { visited++; return value; }, z.object({ name: z.string() }));
  const bounded = z.array(item).max(10);
  const rejected = bounded.safeParse(Array.from({ length: 128 }, () => ({ name: null })));
  assert.equal(rejected.success, false);
  assert.equal(visited, 0, "patched size guard must run before per-element issue allocation");
  assert.equal(rejected.error.issues.length, 1);
  assert.equal(rejected.error.issues[0].code, "too_big");
  const nested = z.object({ groups: z.array(z.object({ rows: bounded })).max(4) });
  const tooManyGroups = nested.safeParse({ groups: Array.from({ length: 16 }, () => ({ rows: Array(128).fill(null) })) });
  assert.equal(tooManyGroups.success, false); assert.equal(visited, 0);
  const tooManyRows = nested.safeParse({ groups: [{ rows: Array(128).fill(null) }] });
  assert.equal(tooManyRows.success, false); assert.equal(visited, 0);
  assert.deepEqual(tooManyRows.error.issues[0].path, ["groups", 0, "rows"]);
  const inBound = bounded.safeParse([{ name: "valid" }]);
  assert.equal(inBound.success, true); assert.equal(visited, 1);
  // Also exercise a real persisted-draft collection rather than only synthetic schemas.
  const sessions = setupDraftSchema.shape.values.shape.branches.element.shape.hours.element.shape.sessions;
  const draftFailure = sessions.safeParse(Array.from({ length: 64 }, () => ({ startTime: null, endTime: null })));
  assert.equal(draftFailure.success, false);
  assert.equal(draftFailure.error.issues.length, 1);
  // Unbounded schemas still validate each item. Keep this case small; do not
  // claim bounded memory for every possible unconstrained schema.
  const unbounded = z.array(z.object({ name: z.string() })).safeParse(Array(32).fill(null));
  assert.equal(unbounded.success, false); assert.equal(unbounded.error.issues.length, 32);
});

test("registration drafts retain their existing stripping and custom transformations", () => {
  assert.deepEqual(accountDraftSchema.parse({ fullName: "Synthetic", email: "synthetic@example.test", step: "review",
    password: "must-not-be-retained", code: "123456" }), { fullName: "Synthetic", email: "synthetic@example.test", step: "details" });
  assert.equal(setupDraftSchema.shape.step.parse(5), 4);
});
