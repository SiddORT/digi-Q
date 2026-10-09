// Real PostgreSQL plans, actual service SQL, fictional data, no project DB or SMTP.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PgDialect } from "drizzle-orm/pg-core";
import { createFeatureHarness } from "./test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "./test-support/feature-fixtures.mjs";

const indexName = "settings_owner_booking_history_idx";
const migrationPath = new URL("../../../lib/db/drizzle/0017_booking_mail_history.sql", import.meta.url);
const nodes = plan => [plan, ...(plan.Plans || []).flatMap(nodes)];
const summarize = result => ({
  ms: result["Execution Time"],
  buffers: result.Plan["Shared Hit Blocks"] + result.Plan["Shared Read Blocks"],
  nodes: nodes(result.Plan).map(n => ({
    type: n["Node Type"], index: n["Index Name"], rows: n["Actual Rows"],
    removed: n["Rows Removed by Filter"], condition: n["Index Cond"],
  })),
});

test("large owner history uses clinic-specific ordered index reads without rewriting durable history", { timeout: 120000 }, async t => {
  const h = await createFeatureHarness({ postgres: true });
  try {
    await seedFeatureFixtures(h.pg);
    // Establish the pre-migration baseline only in this disposable cluster.
    await h.pg.exec(`drop index ${indexName}`);
    await h.pg.exec(`
      insert into settings(id,data)
      select 'mail-outbox:' || case when g % 5 = 0 then 'reminder' else 'booking' end || ':load-' || lpad(g::text,7,'0'),
        jsonb_build_object('event',case when g % 5 = 0 then 'reminder' else 'booking' end,
          'recipientGroup',case when g % 3 = 0 then 'patient' else 'clinicAdmin' end,
          'clinicId','load-clinic-' || (g % 100)::text,
          'createdAt',1700000000000::bigint + g / 2,
          'state','delivery_unknown','snapshot',jsonb_build_object('reference','OTHER-' || g,'notes',repeat('x',600)))
      from generate_series(1,200000) g;
      insert into settings(id,data)
      select 'mail-outbox:booking:owner-load-' || lpad(g::text,7,'0'),
        jsonb_build_object('event','booking','recipientGroup','clinicAdmin','clinicId','c1',
          'createdAt',case when g <= 2 then null else 1700000000000::bigint + g / 2 end,
          'state',case when g % 2 = 0 then 'sending' else 'delivery_unknown' end,
          'attempts',1,'claimedAt',1700000000000::bigint,
          'snapshot',jsonb_build_object('reference','OWNER-' || g,'notes',repeat('x',600)))
      from generate_series(1,20000) g;
      -- Non-history settings must not be cast by the partial index.
      insert into settings(id,data) values('unrelated-setting','{"createdAt":"not-a-timestamp"}');
      analyze settings;
    `);
    const fingerprint = async () => (await h.pg.query(
      "select count(*)::int as count, md5(string_agg(id || data::text, '' order by id)) as digest from settings"
    )).rows[0];
    const before = await fingerprint();
    const plans = {};
    async function explain(page, pageSize = 20, clinicId = "c1") {
      let plan;
      // Capture the actual service SQL, not a separately maintained query replica.
      const conn = {
        select: globalThis.__featurePostgresDb.select.bind(globalThis.__featurePostgresDb),
        execute: async statement => {
          const query = new PgDialect().sqlToQuery(statement);
          plan = (await h.pg.query(`explain (analyze, buffers, format json) ${query.sql}`, query.params)).rows[0]["QUERY PLAN"][0];
          return h.pg.query(query.sql, query.params);
        },
      };
      const result = await h.listOwnerBookingMailOutcomes(
        { id: "adm", role: "clinicAdmin", clinicIds: ["c1", "c2"], activeClinicId: clinicId },
        clinicId, page, pageSize, conn,
      );
      return { plan, result };
    }
    const baseline = await explain(1);
    plans.baseline = summarize(baseline.plan);
    assert.ok(nodes(baseline.plan.Plan).some(n => /Sort/.test(n["Node Type"])), "baseline sorts history");
    const migration = await readFile(migrationPath, "utf8");
    await h.pg.exec(migration);
    await h.pg.exec(migration); // Safe external migration replay.
    await h.pg.exec("analyze settings");
    for (const [name, page, pageSize, clinicId] of [
      ["first", 1, 20, "c1"], ["middle", 101, 50, "c1"],
      ["last", 400, 50, "c1"], ["emptyClinic", 1, 20, "c2"],
      ["beyondHistory", 10000, 50, "c1"],
    ]) {
      const { plan, result } = await explain(page, pageSize, clinicId);
      plans[name] = summarize(plan);
      const scan = nodes(plan.Plan).find(n => n["Index Name"] === indexName);
      assert.ok(scan, `${name} uses the history index`);
      assert.match(scan["Index Cond"], /clinicId.*(?:c1|c2)/, "clinic equality is an index condition");
      assert.ok(!nodes(plan.Plan).some(n => /Sort/.test(n["Node Type"]) || n["Node Type"] === "Seq Scan" && n["Relation Name"] === "settings"), `${name} avoids global scan/sort`);
      assert.ok(scan["Actual Rows"] <= Math.min(20000, page * pageSize + 1), "offset work remains confined to selected clinic history");
      if (name === "first") {
        assert.deepEqual(result, baseline.result);
        assert.equal(result.items[0].reference, "OWNER-20000");
        assert.ok(plans.first.buffers < plans.baseline.buffers / 10, "first page reads substantially fewer buffers");
      }
      if (name === "last") {
        assert.equal(result.items.at(-1).createdAt, null);
        assert.deepEqual(result.items.slice(-2).map(i => i.reference), ["OWNER-2", "OWNER-1"], "nulls last with id descending tie-break");
        assert.equal(result.hasMore, false);
      }
      if (name === "emptyClinic" || name === "beyondHistory") assert.deepEqual(result, { items: [], hasMore: false });
    }
    assert.deepEqual(await fingerprint(), before, "index creation and reads preserve every settings payload");
    t.diagnostic(JSON.stringify(plans));
  } finally {
    await h.close();
  }
});
