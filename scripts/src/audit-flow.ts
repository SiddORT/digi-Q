import { chmod, readFile, unlink, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import {
  db, pool, users, doctors, patients, assignments, auditLogs, appointments,
  appointmentHistory, otpChallenges, availabilityExceptions, schedules, qrs,
  branches, clinics,
} from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const credentialPath = "/tmp/clinicflow-audit-credentials.json";
const reportJsonPath = new URL("../../docs/audits/api-verification.json", import.meta.url);
const reportMarkdownPath = new URL("../../docs/audits/api-verification.md", import.meta.url);
const marker = `CF-AUDIT-${new Date().toISOString().replace(/\D/g, "").slice(0, 14)}-${randomBytes(3).toString("hex")}`;
const baseUrl = (process.env.AUDIT_API_URL || "http://127.0.0.1:3000/api").replace(/\/$/, "");
const roles = ["superAdmin", "clinicAdmin", "receptionist", "doctorA", "doctorB", "patientA", "patientB"] as const;
type Role = typeof roles[number];
type Json = Record<string, any>;
type Account = { role: Role; email: string; password: string; clerkId: string; userId: string; doctorId?: string; patientId?: string; mobile?: string };
type Fixture = {
  marker: string;
  createdAt: string;
  baseUrl: string;
  accounts: Account[];
  ids: Record<string, string>;
  browserUse: string;
};
type Evidence = { name: string; outcome: "pass" | "fail" | "skip"; method?: string; route?: string; status?: number; detail: string; payload?: unknown };

const evidence: Evidence[] = [];
let lastRequestAt = 0;

function guard() {
  if (process.env.NODE_ENV !== "development") throw new Error("Refusing: NODE_ENV must be development.");
  if (!process.env.CLERK_SECRET_KEY?.startsWith("sk_test_")) throw new Error("Refusing: CLERK_SECRET_KEY must be a Clerk test-instance sk_test_ key.");
  if (process.env.REPLIT_DEPLOYMENT === "1" || process.env.REPLIT_DEPLOYMENT_ID || process.env.DEPLOYMENT_ID) {
    throw new Error("Refusing: audit runner cannot execute in a deployment.");
  }
  if (!process.env.DATABASE_URL) throw new Error("Refusing: DATABASE_URL is required.");
}

function safePayload(value: unknown): unknown {
  if (value === undefined) return undefined;
  const text = JSON.stringify(value, (key, item) => /token|password|secret|authorization|developmentCode/i.test(key) ? "[REDACTED]" : item);
  return text.length > 1800 ? `${text.slice(0, 1750)}…[truncated]` : JSON.parse(text);
}

function record(name: string, outcome: Evidence["outcome"], detail: string, response?: ApiResponse) {
  evidence.push({
    name, outcome, detail, method: response?.method, route: response?.route,
    status: response?.status, payload: safePayload(response?.body),
  });
}

function check(condition: unknown, name: string, detail: string, response?: ApiResponse): asserts condition {
  if (!condition) {
    record(name, "fail", detail, response);
    throw new Error(`${name}: ${detail}`);
  }
  record(name, "pass", detail, response);
}

function dateInKolkata(offsetDays = 0) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(Date.now() + offsetDays * 86_400_000));
  const p = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function weekday(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

async function pause() {
  const wait = Math.max(0, 400 - (Date.now() - lastRequestAt));
  if (wait) await new Promise(resolve => setTimeout(resolve, wait));
  lastRequestAt = Date.now();
}

type ApiResponse = { method: string; route: string; status: number; body: any; headers: Headers };
async function api(method: string, route: string, token?: string, body?: unknown, retries = 4): Promise<ApiResponse> {
  await pause();
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let parsed: any = null;
  const text = await response.text();
  if (text) {
    try { parsed = JSON.parse(text); } catch { parsed = text.slice(0, 500); }
  }
  if (response.status === 429 && retries > 0) {
    const retryAfter = Number(response.headers.get("retry-after") || 1);
    await new Promise(resolve => setTimeout(resolve, Math.max(1, retryAfter) * 1000));
    return api(method, route, token, body, retries - 1);
  }
  return { method, route, status: response.status, body: parsed, headers: response.headers };
}

async function expect(method: string, route: string, token: string | undefined, body: unknown, statuses: number[], name: string) {
  const response = await api(method, route, token, body);
  check(statuses.includes(response.status), name, `Expected ${statuses.join("/")} and received ${response.status}.`, response);
  return response.body;
}

async function tokenFor(account: Account) {
  const session = await clerkClient.sessions.createSession({ userId: account.clerkId });
  const token = await clerkClient.sessions.getToken(session.id);
  return token.jwt;
}

function accountSeed(role: Role, index: number): Account {
  const appRole = role === "doctorA" || role === "doctorB" ? "doctor" : role === "patientA" || role === "patientB" ? "patient" : role;
  const email = `clinicflow.audit.${marker.toLowerCase()}.${role.toLowerCase()}@example.com`;
  return {
    role, email, password: `Cf!${randomBytes(18).toString("base64url")}9z`,
    clerkId: "", userId: randomUUID(),
    ...(appRole === "doctor" ? { doctorId: randomUUID() } : {}),
    ...(appRole === "patient" ? { patientId: randomUUID(), mobile: `+9197${String(Date.now()).slice(-6)}${index}` } : {}),
  };
}

async function createIdentitiesAndProfiles(): Promise<Fixture> {
  const accounts = roles.map((role, index) => accountSeed(role, index));
  const createdClerkIds: string[] = [];
  try {
    for (const account of accounts) {
      const existing = await clerkClient.users.getUserList({ emailAddress: [account.email], limit: 1 });
      if (existing.data.length) throw new Error(`Refusing to modify existing Clerk identity for ${account.role}.`);
      const identity = await clerkClient.users.createUser({
        emailAddress: [account.email],
        password: account.password,
        firstName: `${marker} ${account.role}`,
        privateMetadata: { purpose: "clinicflow-authenticated-api-audit", marker },
      });
      account.clerkId = identity.id;
      createdClerkIds.push(identity.id);
    }
    await db.transaction(async tx => {
      for (const account of accounts) {
        const appRole = account.role.startsWith("doctor") ? "doctor" : account.role.startsWith("patient") ? "patient" : account.role;
        await tx.insert(users).values({
          id: account.userId, clerkId: account.clerkId, email: account.email,
          fullName: `${marker} ${account.role}`, mobile: account.mobile, role: appRole,
          data: { auditOnly: true, marker },
        });
        if (account.doctorId) await tx.insert(doctors).values({
          id: account.doctorId, userId: account.userId,
          data: { fullName: `${marker} ${account.role}`, email: account.email, code: `AUD-${marker.slice(-6)}-${account.role}` },
        });
        if (account.patientId) await tx.insert(patients).values({
          id: account.patientId, userId: account.userId, mobile: account.mobile!,
          data: { fullName: `${marker} ${account.role}`, email: account.email, code: `AUD-${marker.slice(-6)}-${account.role}` },
        });
        await tx.insert(auditLogs).values({
          id: randomUUID(), actorId: account.userId, action: "auditProvision",
          entityType: "users", entityId: account.userId, summary: `${marker} development-only authenticated audit fixture`,
        });
      }
    });
  } catch (error) {
    for (const clerkId of createdClerkIds) {
      try { await clerkClient.users.deleteUser(clerkId); } catch { /* best-effort rollback */ }
    }
    throw error;
  }
  const fixture: Fixture = {
    marker, createdAt: new Date().toISOString(), baseUrl, accounts, ids: {},
    browserUse: "Audit fixtures are intentionally retained for the separate browser audit. Run --cleanup --confirm-cleanup only after that audit.",
  };
  await writeFile(credentialPath, JSON.stringify(fixture, null, 2), { mode: 0o600 });
  await chmod(credentialPath, 0o600);
  return fixture;
}

async function updateFixture(fixture: Fixture) {
  await writeFile(credentialPath, JSON.stringify(fixture, null, 2), { mode: 0o600 });
  await chmod(credentialPath, 0o600);
}

async function provisionBusinessFixtures(fixture: Fixture, tokens: Record<Role, string>) {
  const admin = tokens.superAdmin;
  const clinicA = await expect("POST", "/clinics", admin, {
    name: `${marker} Clinic A`, address: `${marker} Audit Address A`, city: "Pune", status: "active",
  }, [201], "Create isolated Clinic A through API");
  const clinicB = await expect("POST", "/clinics", admin, {
    name: `${marker} Clinic B`, address: `${marker} Audit Address B`, city: "Pune", status: "active",
  }, [201], "Create isolated Clinic B through API");
  const branchA = await expect("POST", "/branches", admin, {
    clinicId: clinicA.id, name: `${marker} Branch A1`, address: `${marker} Branch Address A`,
    timezone: "Asia/Kolkata", status: "active",
  }, [201], "Create Branch A through API");
  const branchB = await expect("POST", "/branches", admin, {
    clinicId: clinicB.id, name: `${marker} Branch B1`, address: `${marker} Branch Address B`,
    timezone: "Asia/Kolkata", status: "active",
  }, [201], "Create Branch B through API");
  const inactiveBranch = await expect("POST", "/branches", admin, {
    clinicId: clinicA.id, name: `${marker} Inactive Branch`, address: `${marker} Inactive`,
    timezone: "Asia/Kolkata", status: "inactive",
  }, [201], "Create inactive validation branch through API");
  Object.assign(fixture.ids, {
    clinicA: clinicA.id, clinicB: clinicB.id, branchA: branchA.id, branchB: branchB.id,
    inactiveBranch: inactiveBranch.id,
  });

  const byRole = Object.fromEntries(fixture.accounts.map(a => [a.role, a])) as Record<Role, Account>;
  const patchUser = async (role: "clinicAdmin" | "receptionist", clinicIds: string[], branchIds: string[]) => {
    const a = byRole[role];
    return expect("PATCH", `/users/${a.userId}`, admin, {
      fullName: `${marker} ${role}`, email: a.email, role, status: "active", clinicIds, branchIds,
    }, [200], `Assign ${role} scope through API`);
  };
  await patchUser("clinicAdmin", [clinicA.id], []);
  await patchUser("receptionist", [clinicA.id], [branchA.id]);
  for (const [role, clinicId, branchId] of [
    ["doctorA", clinicA.id, branchA.id], ["doctorB", clinicB.id, branchB.id],
  ] as const) {
    const a = byRole[role];
    await expect("PATCH", `/doctors/${a.doctorId}`, admin, {
      fullName: `${marker} ${role}`, email: a.email, clinicIds: [clinicId], branchIds: [branchId], status: "active",
    }, [200], `Assign ${role} through doctor API`);
  }
  // Patient registration scope is profile linkage, not a business record. The patient remains the same isolated identity.
  await db.update(patients).set({ clinicId: clinicA.id, branchId: branchA.id }).where(inArray(patients.id, [byRole.patientA.patientId!, byRole.patientB.patientId!]));

  const today = dateInKolkata(), tomorrow = dateInKolkata(1), future = dateInKolkata(2);
  fixture.ids.today = today;
  for (const [role, clinicId, branchId, prefix, maxTokens] of [
    ["doctorA", clinicA.id, branchA.id, "A", 20],
    ["doctorB", clinicB.id, branchB.id, "B", 1],
  ] as const) {
    const schedule = await expect("POST", "/schedules", admin, {
      doctorId: byRole[role].doctorId, clinicId, branchId, dayOfWeek: weekday(today),
      isOpen: true, startTime: "00:00", endTime: "23:59", timezone: "Asia/Kolkata",
      tokenPrefix: `${prefix}${marker.slice(-2).toUpperCase()}`, maxTokens, consultationMinutes: 10,
      bufferMinutes: 0, queueMode: "mixed", queueOpenTime: "00:00", queueCloseTime: "23:59",
    }, [201], `Create full-day ${role} schedule through API`);
    fixture.ids[`schedule${role.slice(-1)}`] = schedule.id;
  }
  if (weekday(tomorrow) !== weekday(today)) {
    const schedule = await expect("POST", "/schedules", admin, {
      doctorId: byRole.doctorA.doctorId, clinicId: clinicA.id, branchId: branchA.id, dayOfWeek: weekday(tomorrow),
      isOpen: true, startTime: "00:00", endTime: "23:59", timezone: "Asia/Kolkata",
      tokenPrefix: `AX${marker.slice(-2).toUpperCase()}`, maxTokens: 20, consultationMinutes: 10,
      bufferMinutes: 0, queueMode: "mixed", queueOpenTime: "00:00", queueCloseTime: "23:59",
    }, [201], "Create next-day schedule for closed-date validation");
    fixture.ids.scheduleTomorrow = schedule.id;
  }
  if (![weekday(today), weekday(tomorrow)].includes(weekday(future))) {
    const schedule = await expect("POST", "/schedules", admin, {
      doctorId: byRole.doctorA.doctorId, clinicId: clinicA.id, branchId: branchA.id, dayOfWeek: weekday(future),
      isOpen: true, startTime: "00:00", endTime: "23:59", timezone: "Asia/Kolkata",
      tokenPrefix: `AF${marker.slice(-2).toUpperCase()}`, maxTokens: 20, consultationMinutes: 10,
      bufferMinutes: 0, queueMode: "mixed", queueOpenTime: "00:00", queueCloseTime: "23:59",
    }, [201], "Create future schedule for cancellation validation");
    fixture.ids.scheduleFuture = schedule.id;
  }
  const closed = await expect("POST", "/availability-exceptions", admin, {
    doctorId: byRole.doctorA.doctorId, branchId: branchA.id, date: tomorrow,
    isClosed: true, reason: `${marker} closed-date regression`, startTime: null, endTime: null,
    breakStart: null, breakEnd: null, maxTokens: null,
  }, [201], "Create closed-date exception through API");
  fixture.ids.closedException = closed.id;
  await updateFixture(fixture);
}

async function verifyMobiles(fixture: Fixture, tokens: Record<Role, string>) {
  for (const role of ["patientA", "patientB"] as const) {
    const account = fixture.accounts.find(a => a.role === role)!;
    const request = await api("POST", "/otp/request", tokens[role], { mobile: account.mobile });
    check(request.status === 200, `${role} request mobile OTP`, "Existing development OTP endpoint accepted request.", request);
    check(request.body?.provider === "development" && typeof request.body?.developmentCode === "string",
      `${role} development OTP delivery`, "Development provider returned an in-band code without changing global settings.", request);
    const verify = await api("POST", "/otp/verify", tokens[role], {
      challengeId: request.body.challengeId, code: request.body.developmentCode,
    });
    check(verify.status === 200 && verify.body?.verified === true, `${role} verify mobile OTP`, "Patient mobile verified via existing OTP flow.", verify);
  }
}

async function transition(id: string, action: string, expectedStatus: string, token: string, expected = 200) {
  return expect("POST", `/appointments/${id}/actions`, token, { action, expectedStatus, reason: `${marker} ${action}` }, [expected], `${action} ${id.slice(0, 8)}`);
}

async function executeRegression(fixture: Fixture, tokens: Record<Role, string>) {
  const ids = fixture.ids;
  const a = Object.fromEntries(fixture.accounts.map(account => [account.role, account])) as Record<Role, Account>;
  const today = ids.today;
  const appointment = (patientId: string, doctorId: string, clinicId: string, branchId: string, source: string, extra: Json = {}) => ({
    patientId, doctorId, clinicId, branchId, date: today, source, notes: `${marker} ${source}`, ...extra,
  });

  const qr = await expect("POST", "/qrs", tokens.superAdmin, {
    name: `${marker} Doctor A QR`, clinicId: ids.clinicA, branchId: ids.branchA,
    doctorId: a.doctorA.doctorId, status: "active",
  }, [201], "Create scoped QR through API");
  ids.qr = qr.id;
  const oldReference = qr.reference;
  await expect("GET", `/public/qr/${oldReference}`, undefined, undefined, [200], "Resolve active public QR without patient data");
  const regenerated = await expect("POST", `/qrs/${qr.id}/regenerate`, tokens.superAdmin, {}, [200], "Regenerate QR");
  ids.qrReference = regenerated.reference;
  await expect("GET", `/public/qr/${oldReference}`, undefined, undefined, [404], "Reject stale regenerated QR reference");
  await expect("GET", `/public/qr/${regenerated.reference}`, undefined, undefined, [200], "Resolve regenerated QR reference");

  const requestId = randomUUID();
  const onlineBody = appointment(a.patientA.patientId!, a.doctorA.doctorId!, ids.clinicA, ids.branchA, "online", { requestId, termsAccepted: true });
  const online = await expect("POST", "/appointments", tokens.patientA, onlineBody, [201], "Patient online booking remains booked");
  ids.onlineAppointment = online.id;
  check(online.status === "booked", "Online booking initial state", "Advance online booking is booked, not waiting.");
  const replay = await expect("POST", "/appointments", tokens.patientA, onlineBody, [201], "Idempotent booking replay");
  check(replay.id === online.id, "Idempotent replay identity", "Same actor/requestId returned the original appointment.");
  await expect("POST", "/appointments", tokens.patientA, { ...onlineBody, source: "qr", qrReference: regenerated.reference }, [409], "Reject idempotency key semantic mutation");

  for (const [role, route] of [
    ["patientA", `/appointments/${online.id}`], ["receptionist", `/appointments/${online.id}`],
    ["doctorA", `/appointments/${online.id}`], ["clinicAdmin", `/appointments/${online.id}`],
    ["superAdmin", `/appointments/${online.id}`],
  ] as const) await expect("GET", route, tokens[role], undefined, [200], `${role} sees connected appointment`);
  await expect("GET", `/appointments/${online.id}`, tokens.doctorB, undefined, [403], "Doctor B cannot read Doctor A appointment");
  await expect("GET", `/patients/${a.patientB.patientId}`, tokens.patientA, undefined, [403], "Patient A cannot read Patient B profile");
  await expect("PATCH", "/settings", tokens.clinicAdmin, { bookingHorizonDays: 1 }, [403], "Clinic admin cannot mutate platform settings");
  await expect("POST", "/queue/call-next", tokens.receptionist, { doctorId: a.doctorB.doctorId, branchId: ids.branchB, date: today }, [403], "Clinic A receptionist cannot operate Clinic B queue");

  await transition(online.id, "checkIn", "booked", tokens.receptionist);
  await transition(online.id, "enqueue", "checkedIn", tokens.receptionist);
  const patientQueue = await expect("GET", `/queue?doctorId=${a.doctorA.doctorId}&branchId=${ids.branchA}&date=${today}&appointmentId=${online.id}`, tokens.patientA, undefined, [200], "Patient live queue");
  check(!("entries" in patientQueue) && patientQueue.ownEntry?.appointmentId === online.id, "Patient queue privacy", "Patient response contains own/aggregate data and omits staff entries.");
  const called = await expect("POST", "/queue/call-next", tokens.doctorA, {
    doctorId: a.doctorA.doctorId, branchId: ids.branchA, date: today,
  }, [200], "Call oldest waiting appointment");
  check(called.appointment?.id === online.id && called.appointment?.status === "called", "Call-next consistency", "Call-next selected the expected waiting appointment.");
  await transition(online.id, "start", "called", tokens.doctorA);
  await transition(online.id, "complete", "inConsultation", tokens.doctorA);
  const history = await expect("GET", `/appointments/${online.id}`, tokens.patientA, undefined, [200], "Completed appointment history remains readable");
  check(history.status === "completed" && history.history?.map((x: Json) => x.status).join(",") === "booked,checkedIn,waiting,called,inConsultation,completed",
    "Lifecycle history preserved", "All connected lifecycle states persisted in order.");
  for (const role of ["superAdmin", "clinicAdmin", "receptionist", "doctorA", "patientA"] as const) {
    const dashboard = await expect("GET", `/dashboard?date=${today}`, tokens[role], undefined, [200], `${role} dashboard reads persisted state`);
    check(Number(dashboard.completed) >= 1, `${role} dashboard completion count`, "Completed flow is reflected in dashboard metrics.");
  }

  const walkIn = await expect("POST", "/appointments", tokens.receptionist,
    appointment(a.patientB.patientId!, a.doctorA.doctorId!, ids.clinicA, ids.branchA, "walkIn", { requestId: randomUUID() }),
    [201], "Receptionist creates walk-in");
  ids.walkInAppointment = walkIn.id;
  check(walkIn.status === "waiting", "Walk-in immediate queue state", "Walk-in traversed check-in and enqueue atomically.");
  await transition(walkIn.id, "noShow", "waiting", tokens.receptionist);
  await transition(walkIn.id, "requeue", "noShow", tokens.receptionist);
  await expect("POST", "/queue/call-next", tokens.doctorA, { doctorId: a.doctorA.doctorId, branchId: ids.branchA, date: today }, [200], "Call requeued no-show");
  await transition(walkIn.id, "start", "called", tokens.doctorA);
  await transition(walkIn.id, "complete", "inConsultation", tokens.doctorA);

  const phone = await expect("POST", "/appointments", tokens.receptionist,
    appointment(a.patientA.patientId!, a.doctorA.doctorId!, ids.clinicA, ids.branchA, "phone", { date: dateInKolkata(2), requestId: randomUUID() }),
    [201], "Receptionist creates phone booking");
  ids.phoneAppointment = phone.id;
  check(phone.status === "booked", "Phone advance state", "Phone booking remains booked until explicit check-in.");
  const cancelled = await api("POST", `/appointments/${phone.id}/actions`, tokens.receptionist, { action: "cancel", expectedStatus: "booked", reason: `${marker} cancellation` });
  if (cancelled.status === 200) {
    record("Cancel booked appointment", "pass", "Cancellation succeeded under configured cutoff.", cancelled);
    await expect("POST", `/appointments/${phone.id}/actions`, tokens.doctorA, { action: "start", expectedStatus: "cancelled" }, [409], "Cancelled appointment rejects consultation");
  } else {
    record("Cancel booked appointment", "fail", `Future cancellation unexpectedly returned ${cancelled.status}.`, cancelled);
    await expect("POST", `/appointments/${phone.id}/actions`, tokens.doctorA, { action: "start", expectedStatus: "booked" }, [409], "Booked appointment rejects invalid start");
    throw new Error("Future cancellation regression");
  }

  const qrBooking = await expect("POST", "/appointments", tokens.patientB,
    appointment(a.patientB.patientId!, a.doctorA.doctorId!, ids.clinicA, ids.branchA, "qr", {
      requestId: randomUUID(), termsAccepted: true, qrReference: regenerated.reference,
    }), [201], "Patient books through regenerated QR");
  ids.qrAppointment = qrBooking.id;
  check(qrBooking.status === "booked", "QR converges to normal appointment", "QR entry produced a standard booked appointment.");
  await transition(qrBooking.id, "checkIn", "booked", tokens.receptionist);
  await transition(qrBooking.id, "enqueue", "checkedIn", tokens.receptionist);
  await expect("POST", "/queue/call-next", tokens.doctorA, { doctorId: a.doctorA.doctorId, branchId: ids.branchA, date: today }, [200], "Call QR appointment");
  await transition(qrBooking.id, "start", "called", tokens.doctorA);
  await transition(qrBooking.id, "complete", "inConsultation", tokens.doctorA);

  const capacityOne = await expect("POST", "/appointments", tokens.patientA,
    appointment(a.patientA.patientId!, a.doctorB.doctorId!, ids.clinicB, ids.branchB, "online", { requestId: randomUUID(), termsAccepted: true }),
    [201], "Book sole Doctor B capacity");
  ids.capacityAppointment = capacityOne.id;
  await expect("POST", "/appointments", tokens.patientB,
    appointment(a.patientB.patientId!, a.doctorB.doctorId!, ids.clinicB, ids.branchB, "online", { requestId: randomUUID(), termsAccepted: true }),
    [409], "Reject full session");

  const closed = await expect("GET", `/public/availability?doctorId=${a.doctorA.doctorId}&branchId=${ids.branchA}&date=${dateInKolkata(1)}`, undefined, undefined, [200], "Closed-date availability");
  check(closed.available === false && /closed/i.test(closed.reason), "Closed date rejected", "Availability reports the configured closure.");
  const past = await expect("GET", `/public/availability?doctorId=${a.doctorA.doctorId}&branchId=${ids.branchA}&date=${dateInKolkata(-1)}`, undefined, undefined, [200], "Past availability");
  check(past.available === false, "Past date rejected", "Past date is unavailable.");
  const horizon = await expect("GET", `/public/availability?doctorId=${a.doctorA.doctorId}&branchId=${ids.branchA}&date=${dateInKolkata(370)}`, undefined, undefined, [200], "Booking horizon availability");
  check(horizon.available === false && /horizon/i.test(horizon.reason), "Beyond-horizon date rejected", "Date outside configured booking horizon is unavailable.");
  await expect("POST", "/appointments", tokens.receptionist,
    appointment(a.patientA.patientId!, a.doctorA.doctorId!, ids.clinicA, ids.branchB, "phone", { requestId: randomUUID() }),
    [403, 409], "Reject invalid doctor/branch/clinic combination");
  await expect("POST", "/appointments", tokens.receptionist,
    appointment(a.patientA.patientId!, a.doctorA.doctorId!, ids.clinicA, ids.inactiveBranch, "walkIn", { requestId: randomUUID() }),
    [403, 409], "Reject inactive or unassigned branch");

  // Concurrent call-next is the meaningful queue race and must never activate two records.
  const raceA = await expect("POST", "/appointments", tokens.receptionist,
    appointment(a.patientA.patientId!, a.doctorA.doctorId!, ids.clinicA, ids.branchA, "walkIn", { requestId: randomUUID() }),
    [201], "Create race queue entry A");
  const raceB = await expect("POST", "/appointments", tokens.receptionist,
    appointment(a.patientB.patientId!, a.doctorA.doctorId!, ids.clinicA, ids.branchA, "walkIn", { requestId: randomUUID() }),
    [201], "Create race queue entry B");
  const callBody = { doctorId: a.doctorA.doctorId, branchId: ids.branchA, date: today };
  const raceResponses = await Promise.all([
    api("POST", "/queue/call-next", tokens.doctorA, callBody),
    api("POST", "/queue/call-next", tokens.receptionist, callBody),
  ]);
  check(raceResponses.filter(r => r.status === 200).length === 1 && raceResponses.filter(r => r.status === 409).length === 1,
    "Concurrent call-next serialization", "Exactly one caller activated an appointment; the competing caller received 409.", raceResponses[1]);
  const queue = await expect("GET", `/queue?doctorId=${a.doctorA.doctorId}&branchId=${ids.branchA}&date=${today}`, tokens.receptionist, undefined, [200], "Queue after call-next race");
  check(queue.entries.filter((entry: Json) => ["called", "inConsultation"].includes(entry.status)).length === 1,
    "Single active called/consultation invariant", "Queue contains exactly one active called/consultation record.");
  ids.raceAppointmentA = raceA.id;
  ids.raceAppointmentB = raceB.id;
  await updateFixture(fixture);
}

async function writeReport(fixture: Fixture | null, startedAt: string, fatal?: unknown) {
  const report = {
    generatedAt: new Date().toISOString(), startedAt, mode: fatal ? "failed" : "executed",
    marker: fixture?.marker || null, baseUrl, credentialsPath: credentialPath,
    credentialsRetainedForBrowserAudit: Boolean(fixture),
    summary: {
      passed: evidence.filter(item => item.outcome === "pass").length,
      failed: evidence.filter(item => item.outcome === "fail").length + (fatal ? 1 : 0),
      skipped: evidence.filter(item => item.outcome === "skip").length,
    },
    fatal: fatal instanceof Error ? fatal.message : fatal ? String(fatal) : null,
    evidence,
    limitations: [
      "Browser/mobile responsive checks are intentionally outside this API runner.",
      "Production SMS delivery is not tested; only the existing explicitly enabled development OTP provider is exercised.",
      "Fixtures remain for the separate browser audit until explicit confirmed cleanup.",
    ],
  };
  await writeFile(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const lines = [
    "# Authenticated API integration verification", "",
    `**Executed:** ${report.generatedAt}`, `**Marker:** ${report.marker || "setup failed before fixture creation"}`,
    `**Result:** ${report.summary.passed} passed, ${report.summary.failed} failed, ${report.summary.skipped} skipped.`, "",
    "## Verification evidence", "",
    "| Outcome | Check | Route/status | Evidence |", "|---|---|---|---|",
    ...evidence.map(item => `| ${item.outcome.toUpperCase()} | ${item.name.replaceAll("|", "\\|")} | ${item.method || ""} ${item.route || ""} ${item.status || ""} | ${item.detail.replaceAll("|", "\\|")} |`),
    ...(fatal ? ["", "## Fatal runner error", "", fatal instanceof Error ? fatal.message : String(fatal)] : []),
    "", "## Safety and retention", "",
    "- All requests used genuine Clerk development-instance sessions and Bearer tokens; no auth bypass was used.",
    "- The runner refuses non-development, non-test Clerk, and deployment environments.",
    "- Credentials and fixture IDs exist only in `/tmp/clinicflow-audit-credentials.json` with mode 0600 and are not included here.",
    "- Fixtures are visibly tagged and retained for the separate browser tester. Cleanup requires `--cleanup --confirm-cleanup`.",
    "- Existing records and global settings were not changed.", "",
    "## Limitations", "",
    ...report.limitations.map(item => `- ${item}`), "",
  ];
  await writeFile(reportMarkdownPath, lines.join("\n"));
}

async function cleanup() {
  if (!process.argv.includes("--confirm-cleanup")) throw new Error("Cleanup requires --cleanup --confirm-cleanup.");
  const fixture = JSON.parse(await readFile(credentialPath, "utf8")) as Fixture;
  if (!fixture.marker.startsWith("CF-AUDIT-") || !fixture.accounts.every(a => a.email.includes(fixture.marker.toLowerCase()))) {
    throw new Error("Refusing cleanup: credential file is not a valid isolated audit fixture.");
  }
  const userIds = fixture.accounts.map(a => a.userId);
  const doctorIds = fixture.accounts.flatMap(a => a.doctorId ? [a.doctorId] : []);
  const patientIds = fixture.accounts.flatMap(a => a.patientId ? [a.patientId] : []);
  const clinicIds = [fixture.ids.clinicA, fixture.ids.clinicB].filter(Boolean);
  const ownedClinics = await db.select().from(clinics).where(inArray(clinics.id, clinicIds));
  if (ownedClinics.length !== clinicIds.length || ownedClinics.some(row =>
    !String(row.data.name || "").includes(fixture.marker) || !userIds.includes(row.ownerId || "")
  )) {
    throw new Error("Refusing cleanup: fixture clinic ownership/marker verification failed.");
  }
  const ownedBranches = (await db.select().from(branches)).filter(row => clinicIds.includes(row.clinicId));
  if (ownedBranches.some(row => !String(row.data.name || "").includes(fixture.marker))) {
    throw new Error("Refusing cleanup: a branch in fixture scope is not marker-owned.");
  }
  const branchIds = ownedBranches.map(row => row.id);
  const scopedAppointments = (await db.select().from(appointments)).filter(row => clinicIds.includes(row.clinicId));
  const scopedPatients = (await db.select().from(patients)).filter(row => clinicIds.includes(row.clinicId || ""));
  const scopedAssignments = (await db.select().from(assignments)).filter(row => clinicIds.includes(row.clinicId) || userIds.includes(row.userId));
  const scopedSchedules = (await db.select().from(schedules)).filter(row => clinicIds.includes(row.clinicId));
  const scopedExceptions = (await db.select().from(availabilityExceptions)).filter(row => branchIds.includes(row.branchId));
  const scopedQrs = (await db.select().from(qrs)).filter(row => clinicIds.includes(row.clinicId));
  const scopedAudits = (await db.select().from(auditLogs)).filter(row => userIds.includes(row.actorId || "") || clinicIds.includes(row.clinicId || ""));
  await db.transaction(async tx => {
    const appointmentIds = scopedAppointments.map(row => row.id);
    if (appointmentIds.length) await tx.delete(appointmentHistory).where(inArray(appointmentHistory.appointmentId, appointmentIds));
    if (appointmentIds.length) await tx.delete(appointments).where(inArray(appointments.id, appointmentIds));
    await tx.delete(otpChallenges).where(inArray(otpChallenges.userId, userIds));
    if (scopedExceptions.length) await tx.delete(availabilityExceptions).where(inArray(availabilityExceptions.id, scopedExceptions.map(row => row.id)));
    if (scopedSchedules.length) await tx.delete(schedules).where(inArray(schedules.id, scopedSchedules.map(row => row.id)));
    if (scopedQrs.length) await tx.delete(qrs).where(inArray(qrs.id, scopedQrs.map(row => row.id)));
    if (scopedAudits.length) await tx.delete(auditLogs).where(inArray(auditLogs.id, scopedAudits.map(row => row.id)));
    if (scopedAssignments.length) await tx.delete(assignments).where(inArray(assignments.id, scopedAssignments.map(row => row.id)));
    const allPatientIds = [...new Set([...patientIds, ...scopedPatients.map(row => row.id)])];
    if (allPatientIds.length) await tx.delete(patients).where(inArray(patients.id, allPatientIds));
    if (doctorIds.length) await tx.delete(doctors).where(inArray(doctors.id, doctorIds));
    if (branchIds.length) await tx.delete(branches).where(inArray(branches.id, branchIds));
    await tx.delete(clinics).where(inArray(clinics.id, clinicIds));
    await tx.delete(users).where(inArray(users.id, userIds));
  });
  for (const account of fixture.accounts) await clerkClient.users.deleteUser(account.clerkId);
  const remainingDatabaseRows = [
    ...(await db.select().from(clinics)).filter(row => clinicIds.includes(row.id)),
    ...(await db.select().from(branches)).filter(row => branchIds.includes(row.id)),
    ...(await db.select().from(appointments)).filter(row => clinicIds.includes(row.clinicId)),
    ...(await db.select().from(users)).filter(row => userIds.includes(row.id)),
    ...(await db.select().from(patients)).filter(row => clinicIds.includes(row.clinicId || "")),
    ...(await db.select().from(assignments)).filter(row => clinicIds.includes(row.clinicId) || userIds.includes(row.userId)),
  ];
  if (remainingDatabaseRows.length) throw new Error(`Cleanup verification failed: ${remainingDatabaseRows.length} marker-owned database rows remain.`);
  for (const account of fixture.accounts) {
    const matches = await clerkClient.users.getUserList({ emailAddress: [account.email], limit: 1 });
    if (matches.data.length) throw new Error(`Cleanup verification failed: Clerk identity remains for ${account.role}.`);
  }
  await unlink(credentialPath);
  process.stdout.write(`Cleaned and verified isolated fixture ${fixture.marker}; removed temporary credential file.\n`);
}

async function main() {
  guard();
  if (process.argv.includes("--cleanup")) return cleanup();
  const health = await api("GET", "/healthz");
  if (health.status !== 200) throw new Error(`API is not ready at ${baseUrl}; health returned ${health.status}.`);
  const startedAt = new Date().toISOString();
  let fixture: Fixture | null = null;
  try {
    fixture = await createIdentitiesAndProfiles();
    const tokens = {} as Record<Role, string>;
    for (const account of fixture.accounts) tokens[account.role] = await tokenFor(account);
    await provisionBusinessFixtures(fixture, tokens);
    await verifyMobiles(fixture, tokens);
    await executeRegression(fixture, tokens);
    await writeReport(fixture, startedAt);
    process.stdout.write(`Audit complete: ${evidence.filter(x => x.outcome === "pass").length} passed, ${evidence.filter(x => x.outcome === "fail").length} failed, ${evidence.filter(x => x.outcome === "skip").length} skipped. Credentials retained at ${credentialPath} (0600).\n`);
  } catch (error) {
    await writeReport(fixture, startedAt, error);
    throw error;
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => pool.end());