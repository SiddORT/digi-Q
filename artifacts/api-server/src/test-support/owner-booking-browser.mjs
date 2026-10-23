// Explicitly opted-in Preview fixture, with no normal database or live delivery.
import { createServer, request } from "node:http";
import { createOwnerBookingHarness, ownerSetup } from "./owner-booking-harness.mjs";

if (process.env.NODE_ENV !== "development") throw new Error("Owner booking fixture is development-only");
const realFetch = globalThis.fetch;
globalThis.fetch = (input, options) => {
  const url = new URL(typeof input === "string" ? input : input.url ?? input.toString());
  if (!["127.0.0.1", "localhost"].includes(url.hostname)) throw new Error("External network disabled in owner booking fixture");
  return realFetch(input, options);
};
const h = await createOwnerBookingHarness();
// Deliberately reproduce the historical missing self-profile in isolated
// persisted data. No opt-in means no fixture and no such records at all.
const superCookie=await h.login("super@owner.test.invalid");
const recoverySeed=await h.as(superCookie,"POST","/clinic-admin-onboarding",{
  ...ownerSetup("browser-recovery",false),
  admin:{email:"recovery@owner.test.invalid",fullName:"Fictional Recovery Owner"},
});
if(recoverySeed.status!==201)throw new Error("Could not seed disposable recovery owner");
await h.acceptInvitation("recovery@owner.test.invalid");
const source = new URL(h.base);
const proxy = createServer(async (req, res) => {
  // Fixture-only state transition for real-UI freshness acceptance. Never loaded
  // by production start; this cluster contains only isolated fictional records.
  if (req.url === "/api/__owner-booking-doctor-status" && req.method === "POST") {
    let body = "";
    for await (const chunk of req) {
      body += chunk;
      if (body.length > 1024) { res.writeHead(413); return res.end(); }
    }
    let input;
    try { input = JSON.parse(body); } catch { res.writeHead(400); return res.end(); }
    if (!["active", "inactive"].includes(input.status) || typeof input.doctorId !== "string") {
      res.writeHead(400); return res.end();
    }
    const result = await h.pg.query("update doctors set status=$1 where id=$2 returning id,status", [input.status,input.doctorId]);
    res.writeHead(result.rows.length ? 200 : 404, {"Content-Type":"application/json","Cache-Control":"no-store"});
    return res.end(JSON.stringify(result.rows[0] || {}));
  }
  // Only exists in this disposable server, never the production router. Allows
  // browser tests to read simulated codes and independently inspect persistence.
  if (req.url === "/api/__owner-booking-evidence" && req.method === "GET") {
    const records = {};
    for (const [name, query] of Object.entries({
      users: "select id,email,full_name,role,status from users",
      doctors: "select id,user_id,owner_admin_id,status,data from doctors",
      assignments: "select user_id,clinic_id,branch_id from assignments",
      branches: "select id,clinic_id,status,data from branches",
      appointments: "select id,doctor_id,clinic_id,branch_id,patient_id,data from appointments",
      patients: "select id,clinic_id,branch_id,data from patients",
    })) records[name] = (await h.pg.query(query)).rows;
    res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
    return res.end(JSON.stringify({ ...records, mail: h.mail.messages }));
  }
  // The private test proxy has no trusted client-IP boundary. Keep the harness
  // limiter on its real loopback peer instead of forwarding Preview's header.
  const headers = { ...req.headers };
  delete headers["x-forwarded-for"];
  const upstream = request({ hostname: source.hostname, port: source.port, path: req.url,
    method: req.method, headers }, response => {
    res.writeHead(response.statusCode, response.headers); response.pipe(res);
  });
  upstream.on("error", () => { res.statusCode = 502; res.end("Disposable fixture unavailable"); });
  req.pipe(upstream);
});
const port = Number(process.env.PORT);
if (!Number.isInteger(port) || port < 1) throw new Error("A routed development PORT is required");
proxy.listen(port, "0.0.0.0", () => console.log("Disposable owner booking API ready; outbound network disabled"));
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  proxy.close();
  await h.close();
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
