// Loopback-only acceptance target. Disposable migrated PostgreSQL, real auth/QR routers.
// No workspace DB, production fixtures or live transports. Control endpoints never ship.
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createHmac, randomBytes, createHash } from "node:crypto";
import { createFeatureHarness } from "../artifacts/api-server/src/test-support/feature-harness.mjs";
import { seedFeatureFixtures } from "../artifacts/api-server/src/test-support/feature-fixtures.mjs";

process.env.AUTH_SESSION_MODE = "native";
process.env.SESSION_SECRET = "disposable-qr-test-signing-key-not-used-outside-tests";
const require = createRequire(new URL("../artifacts/api-server/package.json", import.meta.url));
const argon2 = require("argon2");
const password = "Fictional-Qr-Password-123";
const h = await createFeatureHarness({ administration: true, bookingLookups: true, postgres: true, simulatedMail: true });
await seedFeatureFixtures(h.pg);
await h.pg.query("update users set password_hash=$1 where role!='patient'", [await argon2.hash(password)]);
await h.pg.exec("insert into settings(id,data) values('platform','{\"notificationsEnabled\":false,\"publicWebsiteUrl\":\"http://127.0.0.1:43720\"}') on conflict(id) do update set data=excluded.data");
await h.pg.exec("update branches set data=data||'{\"timezone\":\"UTC\"}'::jsonb");
for (let day = 0; day < 7; day++) {
  await h.pg.query("insert into schedules(id,doctor_id,clinic_id,branch_id,day_of_week,data) values($1,'d1','c1','b1',$2,$3)",
    [`qr-day-${day}`, day, { isOpen: true, startTime: "00:00", endTime: "23:59", timezone: "UTC", maxTokens: 100, consultationMinutes: 10 }]);
}
function signed(reference) {
  return `v1.${Buffer.from(reference).toString("base64url")}.${createHmac("sha256", process.env.SESSION_SECRET).update(`clinicflow:appointment-qr:v1:${reference}`).digest("base64url")}`;
}
const control = createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  try {
    const path = new URL(req.url, "http://localhost").pathname.replace("/__qr-evidence", "");
    if (path === "/reset") {
      await h.pg.exec("truncate appointments cascade");
      await h.pg.exec("delete from audit_logs; delete from auth_rate_limits");
      return res.end("{}");
    }
    if (path === "/snapshot") {
      const { rows } = await h.pg.query("select id,status,data from appointments order by id");
      const history = await h.pg.query("select * from appointment_history order by id");
      const audit = await h.pg.query("select * from audit_logs order by id");
      return res.end(JSON.stringify({ rows, history: history.rows, audit: audit.rows }));
    }
    if (path === "/unknown") return res.end(JSON.stringify({ payload: signed("QR-MISSING") }));
    if (path === "/patient-session") {
      const token = randomBytes(32).toString("base64url");
      await h.pg.query("insert into auth_sessions(token_hash,user_id,expires_at) values($1,'patu',now()+interval '1 hour')", [createHash("sha256").update(token).digest("hex")]);
      return res.end(JSON.stringify({ token }));
    }
    // Isolated records for date/status/queue-boundary tests. Booking tests use the real API.
    if (path.startsWith("/state/")) {
      const state = path.slice(7);
      if (!["waiting", "inConsultation", "completed", "cancelled", "noShow", "tomorrow", "blocked"].includes(state)) throw new Error("Unknown test state");
      await h.pg.exec("truncate appointments cascade");
      const date = new Date(Date.now() + (state === "tomorrow" ? 86400000 : 0)).toISOString().slice(0, 10);
      const status = ["tomorrow", "blocked"].includes(state) ? "waiting" : state;
      await h.pg.query(`insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,actor_id,data)
        values('qr-a','p1','d1','c1','b1',$1,7,$2,'rec',$3)`, [date, status, {
          reference: "QR-ACCEPTANCE", patientName: "Ravi Kumar", doctorName: "Dr Meera Rao",
          clinicName: "Lakeview Clinic", branchName: "Lakeview Main",
          token: "A-7", startTime: "00:00", endTime: "23:59", timezone: "UTC", queueRank: 7,
        }]);
      if (state === "blocked") {
        await h.pg.query(`insert into appointments(id,patient_id,doctor_id,clinic_id,branch_id,date,token_number,status,actor_id,data)
          values('qr-before','p3','d1','c1','b1',$1,1,'waiting','rec',$2)`, [date, { reference: "QR-BEFORE", startTime: "00:00", endTime: "23:59", timezone: "UTC", queueRank: 1 }]);
      }
      return res.end(JSON.stringify({ payload: signed("QR-ACCEPTANCE") }));
    }
    res.statusCode = 404; res.end("{}");
  } catch (error) { res.statusCode = 500; res.end(JSON.stringify({ error: error.message })); }
});
await new Promise(resolve => control.listen(43722, "127.0.0.1", resolve));
const vite = spawn("pnpm", ["--filter", "@workspace/clinicflow", "exec", "vite", "--config", "workspace-regression/vite.config.ts"],
  { stdio: "inherit", env: { ...process.env, SCHEDULE_TEST_API: new URL(h.base).origin, QR_TEST_CONTROL: "1" } });
let closing = false;
async function close() { if (closing) return; closing = true; vite.kill("SIGTERM"); control.close(); await h.close(); process.exit(0); }
process.on("SIGTERM", close); process.on("SIGINT", close); vite.on("exit", close);
