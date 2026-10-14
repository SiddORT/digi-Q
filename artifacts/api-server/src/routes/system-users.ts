import { Router } from "express";
import { db, users, assignments, clinics } from "@workspace/db";
import { z } from "zod";
import { and, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { requireUser, roles } from "../lib/auth";
import { assert } from "../lib/http";
import { getCustomRoles, saveCustomRoles } from "../lib/custom-roles";
import { computeStaffDeletionImpact } from "../lib/staff-deletion-impact";
import { assertLiveRemovalActor } from "../lib/staff-removal-auth";
import { reviewStaffRemoval, commitStaffRemoval, retryStaffFileCleanup } from "../lib/staff-removal";
import { getDeletionReceipt } from "../lib/staff-deletion-receipts";
import { reviewStaffVisitHandoff, commitStaffVisitHandoff } from "../lib/staff-visit-handoff";
import { reviewStaffResponsibilityHandoff, commitStaffResponsibilityHandoff } from "../lib/staff-responsibility-handoff";
import { historyEvidenceInput, historyRestoreInput, historyUnresolvedInput, listHistoryReconciliation,
  previewHistoryReconciliation, restoreHistoryReconciliation, markHistoryUnresolved } from "../lib/notification-history-reconciliation";
import { consumeRateLimit } from "../lib/native-auth";

export const systemUsersRouter = Router();
systemUsersRouter.use("/management/system-users", async (req, res, next) => {
  roles(await requireUser(req), ["superAdmin"]); res.setHeader("Cache-Control", "no-store"); next();
});
systemUsersRouter.get("/management/system-users", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1), pageSize = 30;
  assert(Number.isSafeInteger(page), 400, "Invalid page");
  const filters: any[] = [inArray(users.role, ["superAdmin", "clinicAdmin", "doctor", "receptionist"])];
  if (typeof req.query.search === "string" && req.query.search) {
    const term = `%${req.query.search.replace(/[%_\\]/g, "\\$&").slice(0, 100)}%`;
    filters.push(or(ilike(users.fullName, term), ilike(users.email, term)));
  }
  if (typeof req.query.role === "string" && req.query.role) filters.push(eq(users.role, req.query.role));
  if (typeof req.query.status === "string" && req.query.status) filters.push(eq(users.status, req.query.status));
  if (typeof req.query.clinicId === "string" && req.query.clinicId) filters.push(sql`(${users.id} in (select ${assignments.userId} from ${assignments} where ${assignments.clinicId}=${req.query.clinicId}) or ${users.id} in (select ${clinics.adminId} from ${clinics} where ${clinics.id}=${req.query.clinicId}))`);
  const where = and(...filters);
  const rows = await db.select({ id: users.id, fullName: users.fullName, email: users.email, role: users.role, status: users.status }).from(users).where(where).orderBy(users.fullName, users.id).limit(pageSize).offset((page - 1) * pageSize);
  const [count] = await db.select({ total: sql<number>`count(*)::int` }).from(users).where(where);
  const ids = rows.map(r => r.id);
  const links = ids.length ? await db.select({ userId: assignments.userId, clinicId: clinics.id, name: sql<string>`${clinics.data}->>'name'` }).from(assignments).innerJoin(clinics, eq(assignments.clinicId, clinics.id)).where(inArray(assignments.userId, ids)) : [];
  const owned = ids.length ? await db.select({ userId: clinics.adminId, clinicId: clinics.id, name: sql<string>`${clinics.data}->>'name'` }).from(clinics).where(inArray(clinics.adminId, ids)) : [];
  res.json({ data: rows.map(row => ({ ...row, clinics: [...new Map([...links, ...owned].filter(l => l.userId === row.id).map(l => [l.clinicId, { id: l.clinicId, name: l.name }])).values()] })), total: count.total, page, pageSize });
});
systemUsersRouter.get("/management/custom-roles", async (req, res) => {
  roles(await requireUser(req), ["superAdmin"]); res.setHeader("Cache-Control", "no-store"); res.json(await getCustomRoles());
});
systemUsersRouter.get("/management/system-users/:id/deletion-impact", async (req, res) => {
  const actor = await requireUser(req);
  res.json(await reviewStaffRemoval({ actorId: actor.id, sessionHash: req.authSessionHash!, targetId: req.params.id as string }));
});
const key = z.string().min(1).max(200);
systemUsersRouter.get("/management/system-users/:id/notification-history-review", async (req, res) => {
  const actor = await requireUser(req);
  res.json(await listHistoryReconciliation({ actorId: actor.id, sessionHash: req.authSessionHash!, targetId: req.params.id as string }));
});
for (const action of ["scan", "preview", "restore", "unresolved"] as const) {
  systemUsersRouter.post(`/management/system-users/:id/notification-history-review/${action}`, async (req, res) => {
    const actor = await requireUser(req);
    await consumeRateLimit(`history-reconciliation:${actor.id}`, 30, 900_000);
    const context = { actorId: actor.id, sessionHash: req.authSessionHash!, targetId: req.params.id as string };
    if (action === "scan") {
      const input = body(z.object({ cursor: z.string().regex(/^notification-history:[a-f0-9]{64}$/) }).strict(), req.body);
      res.json(await listHistoryReconciliation({ ...context, ...input }));
    } else if (action === "preview") {
      res.json(await previewHistoryReconciliation({ ...context, ...body(historyEvidenceInput, req.body) }));
    } else if (action === "restore") {
      res.json(await restoreHistoryReconciliation({ ...context, ...body(historyRestoreInput, req.body) }));
    } else {
      res.json(await markHistoryUnresolved({ ...context, ...body(historyUnresolvedInput, req.body) }));
    }
  });
}
const move = z.object({ appointmentId: key, doctorId: key, branchId: key,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), expectedRevision: z.number().int().min(0),
  sessionId: key.optional(), startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(), reason: z.string().max(500).optional() }).strict();
const handoffInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("visits"), moves: z.array(move).min(1).max(50) }).strict(),
  z.object({ kind: z.literal("clinic-responsibilities"), replacementId: key }).strict(),
]);
const visitProposal = z.object({ moves: z.array(move).min(1).max(50), destinations: z.record(key, z.string().regex(/^[a-f0-9]{64}$/)) }).strict();
const responsibilityProposal = z.object({ kind: z.literal("clinic-responsibilities"), replacementId: key,
  clinicIds: z.array(key).max(5000), staffIds: z.array(key).max(5000), doctorIds: z.array(key).max(5000),
  destinationVersion: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
function body<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value); assert(parsed.success, 400, "Invalid staff-removal request"); return parsed.data!;
}
async function context(req: any) {
  const actor = await requireUser(req);
  await db.transaction(tx => assertLiveRemovalActor(tx, actor.id, req.authSessionHash));
  return { actorId: actor.id, sessionHash: req.authSessionHash!, targetId: String(req.params.id ?? "") };
}
systemUsersRouter.post("/management/system-users/:id/permanent-removal", async (req, res) => {
  const ctx = await context(req);
  const input = body(z.object({ version: z.string().regex(/^[a-f0-9]{64}$/),
    reviewToken: z.string().min(1).max(4096), confirmation: z.literal("delete") }).strict(), req.body);
  // Account commit and provider cleanup are deliberately separate. Return the
  // durable account-removed result even if immediate cleanup is unavailable.
  const receipt = await commitStaffRemoval(ctx, input);
  let result = receipt;
  if (receipt.state === "cleanup_pending")
    try { result = await retryStaffFileCleanup(receipt.operationId); } catch { /* explicit pending receipt remains authoritative */ }
  res.json(result);
});
systemUsersRouter.get("/management/staff-removals/:operationId", async (req, res) => {
  await context(req); res.setHeader("Cache-Control", "no-store");
  res.json(await getDeletionReceipt(db, body(z.string().uuid(), req.params.operationId)));
});
systemUsersRouter.post("/management/staff-removals/:operationId/retry-cleanup", async (req, res) => {
  await context(req); res.setHeader("Cache-Control", "no-store");
  body(z.object({}).strict(), req.body ?? {});
  res.json(await retryStaffFileCleanup(body(z.string().uuid(), req.params.operationId)));
});
systemUsersRouter.post("/management/system-users/:id/handoff-impact", async (req, res) => {
  const ctx = await context(req), input = body(handoffInput, req.body);
  const result = input.kind === "visits" ? await reviewStaffVisitHandoff(ctx, input.moves) :
    await reviewStaffResponsibilityHandoff(ctx, input.replacementId);
  res.json({ ...result, kind: input.kind });
});
systemUsersRouter.post("/management/system-users/:id/handoff", async (req, res) => {
  const ctx = await context(req);
  const input = body(z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("visits"), proposal: visitProposal, reviewToken: z.string().max(4096) }).strict(),
    z.object({ kind: z.literal("clinic-responsibilities"), proposal: responsibilityProposal, reviewToken: z.string().max(4096) }).strict(),
  ]), req.body);
  res.json(input.kind === "visits" ? await commitStaffVisitHandoff(ctx, input.proposal, input.reviewToken) :
    await commitStaffResponsibilityHandoff(ctx, input.proposal, input.reviewToken));
});
systemUsersRouter.get("/management/system-users/:id/handoff-options", async (req, res) => {
  const ctx = await context(req);
  const target = await db.execute(sql`select id from users where id=${ctx.targetId}`);
  assert(target.rows.length, 404, "Staff account not found");
  const candidates = await db.execute(sql`select d.id,d.user_id as "userId",u.full_name as "fullName",
    coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'clinicId',b.clinic_id,'name',b.data->>'name') order by b.id)
      from assignments a join branches b on b.id=a.branch_id join clinics c on c.id=b.clinic_id
      where a.user_id=u.id and b.status='active' and c.status='active'),'[]'::jsonb) as branches
    from doctors d join users u on u.id=d.user_id where d.status='active' and u.status='active'
    and u.id<>${ctx.targetId} and not coalesce((u.data->>'demo')::boolean,false)
    and not (u.data ? 'demoFixture') order by u.full_name,d.id`);
  const admins = await db.execute(sql`select id,full_name as "fullName",email from users where role='clinicAdmin'
    and status='active' and id<>${ctx.targetId} and not coalesce((data->>'demo')::boolean,false)
    and not (data ? 'demoFixture') order by full_name,id`);
  const visits = await db.execute(sql`select a.id,a.patient_id as "patientId",p.data->>'fullName' as "patientName",
    a.clinic_id as "clinicId",a.branch_id as "branchId",a.date,a.status,a.data->>'startTime' as "startTime",
    a.data->>'timezone' as timezone,coalesce((a.data->>'revision')::int,0) as revision,a.data->>'checkedInAt' as "checkedInAt"
    from appointments a join doctors d on d.id=a.doctor_id join patients p on p.id=a.patient_id
    where d.user_id=${ctx.targetId} and a.status not in ('completed','noShow','cancelled') order by a.date,a.id limit 500`);
  res.json({ doctors: candidates.rows, admins: admins.rows, visits: visits.rows });
});
systemUsersRouter.put("/management/custom-roles", async (req, res) => {
  res.json(await saveCustomRoles(await requireUser(req), req.body));
});