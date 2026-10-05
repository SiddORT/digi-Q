import { Router } from "express";
import { db, settings, clinics, savedViews, notificationReads } from "@workspace/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import * as z from "@workspace/api-zod";
import { requireUser, findUser } from "../lib/auth";
import { parse, query, assert } from "../lib/http";
import { audit, uid, getSettings } from "../lib/store";
import { sourceSql } from "../lib/list-query";
import { localNow } from "../lib/availability";
import { notificationKind, sanitizeSavedView, SHARE_ROLES, shareAudience, receivesSharedView } from "../lib/feature-policy";

export const workspaceFeaturesRouter = Router();
const statusText: Record<string, string> = { booked: "Booked", checkedIn: "Checked In", waiting: "Waiting", called: "Called Next", inConsultation: "In Consultation", completed: "Completed", noShow: "Marked Absent", cancelled: "Cancelled" };

/** Derived from real appointment_history (scoped) and, for administrators, audit_logs. Own actions excluded. */
export async function listNotificationsFor(user: any) {
  const history = await db.execute(sql`with a as (select doc from (${sourceSql(user, "appointments")}) s)
    select h.id, h.to_status as "toStatus", h.created_at as "createdAt", ap.id as "appointmentId", ap.date, ap.token_number as token,
      ap.data->>'reference' as reference, coalesce(p.data->>'fullName', pu.full_name) as patient, du.full_name as doctor,
      (nr.notification_id is not null) as read
    from appointment_history h join a on a.doc->>'id' = h.appointment_id
    join appointments ap on ap.id = h.appointment_id
    left join patients p on p.id = ap.patient_id left join users pu on pu.id = p.user_id
    left join doctors d on d.id = ap.doctor_id left join users du on du.id = d.user_id
    left join notification_reads nr on nr.user_id = ${user.id} and nr.notification_id = 'h:' || h.id
    where h.created_at > now() - interval '30 days' and (${user.role === "patient"} or h.actor_id <> ${user.id})
    order by h.created_at desc limit 60`);
  const items: any[] = (history.rows as any[]).map(r => ({
    id: `h:${r.id}`, kind: notificationKind(r.toStatus), createdAt: new Date(r.createdAt).toISOString(), read: !!r.read,
    title: `${statusText[r.toStatus] || r.toStatus} · Token ${r.token}`,
    body: user.role === "patient" ? `Your visit with ${r.doctor || "your doctor"} (Ref ${r.reference || "-"})` : `${r.patient || "Patient"} with ${r.doctor || "doctor"} · Ref ${r.reference || "-"}`,
    appointmentId: r.appointmentId, date: r.date,
  }));
  if (user.role === "superAdmin" || user.role === "clinicAdmin") {
    const scopeSql = user.role === "superAdmin" ? sql`true` : user.clinicIds.length ? sql`l.clinic_id in (${sql.join(user.clinicIds.map((c: string) => sql`${c}`), sql`, `)})` : sql`false`;
    const system = await db.execute(sql`select l.id, l.summary, l.action, l.entity_type as "entityType", l.created_at as "createdAt", u.full_name as actor,
        (nr.notification_id is not null) as read
      from audit_logs l left join users u on u.id = l.actor_id
      left join notification_reads nr on nr.user_id = ${user.id} and nr.notification_id = 'a:' || l.id
      where ${scopeSql} and l.created_at > now() - interval '30 days' and l.actor_id is distinct from ${user.id}
        and l.entity_type not in ('appointments', 'auth_sessions', 'patient_documents')
      order by l.created_at desc limit 30`);
    items.push(...(system.rows as any[]).map(r => ({ id: `a:${r.id}`, kind: "system", title: r.summary, body: r.actor ? `By ${r.actor}` : undefined, createdAt: new Date(r.createdAt).toISOString(), read: !!r.read, appointmentId: null, date: null })));
  }
  items.sort((x, y) => y.createdAt.localeCompare(x.createdAt));
  return items;
}
workspaceFeaturesRouter.get("/notifications", async (req, res) => {
  const user = await requireUser(req), q = query(z.ListNotificationsQueryParams, req);
  const items = await listNotificationsFor(user);
  res.json({ items: q.kind && q.kind !== "all" ? items.filter(n => n.kind === q.kind) : items, unread: items.filter(n => !n.read).length });
});
workspaceFeaturesRouter.post("/notifications/read", async (req, res) => {
  const user = await requireUser(req), body = parse(z.MarkNotificationsReadBody, req.body);
  const items = await listNotificationsFor(user);
  const visible = new Set(items.map(n => n.id));
  // Only IDs the user can currently see may be marked; arbitrary IDs are ignored.
  const ids = body.all ? [...visible] : ((body.ids || []) as string[]).filter((id: string) => visible.has(id));
  if (ids.length) await db.insert(notificationReads).values(ids.map((notificationId: string) => ({ userId: user.id, notificationId }))).onConflictDoNothing();
  res.json({ unread: items.filter(n => !n.read && !ids.includes(n.id)).length });
});

async function workspaceList(user: any) {
  const full = await findUser(user.id);
  const ids: string[] = full?.clinicIds || [];
  const switchable = !["superAdmin", "patient"].includes(user.role) && ids.length > 1;
  const rows = ids.length ? await db.select().from(clinics).where(inArray(clinics.id, ids)) : [];
  return { activeClinicId: user.activeClinicId ?? null, switchable, workspaces: rows.map(c => ({ id: c.id, name: String((c.data as any)?.name || "Clinic") })).sort((a, b) => a.name.localeCompare(b.name)) };
}
workspaceFeaturesRouter.get("/workspaces", async (req, res) => { res.json(await workspaceList(await requireUser(req))); });
workspaceFeaturesRouter.put("/workspaces/active", async (req, res) => {
  const user = await requireUser(req), body = parse(z.SelectWorkspaceBody, req.body);
  const full = await findUser(user.id);
  assert(!["superAdmin", "patient"].includes(user.role) && (full?.clinicIds.length || 0) > 1, 403, "Workspace switching is not available for this account");
  if (body.clinicId) assert(full!.clinicIds.includes(body.clinicId), 403, "You are not assigned to that clinic");
  await db.transaction(async tx => {
    if (body.clinicId) await tx.insert(settings).values({ id: `workspace:${user.id}`, data: { clinicId: body.clinicId } }).onConflictDoUpdate({ target: settings.id, set: { data: { clinicId: body.clinicId } } });
    else await tx.delete(settings).where(eq(settings.id, `workspace:${user.id}`));
    await audit(user, "switchWorkspace", "users", { id: user.id, clinicId: body.clinicId || null }, tx);
  });
  res.json(await workspaceList({ ...user, activeClinicId: body.clinicId || null }));
});

workspaceFeaturesRouter.get("/search/records", async (req, res) => {
  const user = await requireUser(req), q = query(z.SearchRecordsQueryParams, req);
  const term = q.q.trim(); assert(term.length >= 2, 400, "Enter at least 2 characters");
  const like = `%${term.replace(/[\\%_]/g, "\\$&")}%`, token = /^\d{1,6}$/.test(term) ? Number(term) : -1;
  const today = localNow((await getSettings()).timezone).date;
  const result = await db.execute(sql`with a as (select doc from (${sourceSql(user, "appointments")}) s)
    select ap.id, ap.clinic_id as "clinicId", ap.branch_id as "branchId", ap.doctor_id as "doctorId",
      ap.data->>'startTime' as "startTime", ap.data->>'sessionId' as "sessionId", ap.data->>'reference' as reference, ap.token_number as "tokenNumber", ap.data->>'token' as token, ap.date, ap.status,
      coalesce(p.data->>'fullName', pu.full_name, '') as "patientName", coalesce(du.full_name, '') as "doctorName"
    from a join appointments ap on ap.id = a.doc->>'id'
    left join patients p on p.id = ap.patient_id left join users pu on pu.id = p.user_id
    left join doctors d on d.id = ap.doctor_id left join users du on du.id = d.user_id
    where ap.data->>'reference' ilike ${like} or ap.token_number = ${token} or coalesce(p.data->>'fullName', pu.full_name) ilike ${like}
    order by (ap.date = ${today}) desc, ap.date desc, ap.token_number limit 10`);
  res.json({ items: (result.rows as any[]).map(r => ({ ...r, reference: r.reference || "", token: r.token || undefined, today: r.date === today })) });
});

const viewOut = (v: any, user: any) => ({ id: v.id, tableKey: v.tableKey, name: v.name, filters: v.data?.filters || {}, columns: v.data?.columns, ownedByMe: v.userId === user.id, shared: !!v.sharedRole });
workspaceFeaturesRouter.get("/saved-views", async (req, res) => {
  const user = await requireUser(req), q = query(z.ListSavedViewsQueryParams, req);
  const own = await db.select().from(savedViews).where(and(eq(savedViews.userId, user.id), eq(savedViews.tableKey, q.tableKey)));
  const shared = (await db.select().from(savedViews).where(and(inArray(savedViews.sharedRole, [user.role, "staff"]), eq(savedViews.tableKey, q.tableKey))))
    .filter(v => v.userId !== user.id && receivesSharedView(user.role, v.sharedRole) && (user.role === "superAdmin" || (v.clinicIds || []).some(c => user.clinicIds.includes(c))));
  res.json({ items: [...own, ...shared].sort((a, b) => a.name.localeCompare(b.name)).map(v => viewOut(v, user)), canShare: SHARE_ROLES.has(user.role) });
});
workspaceFeaturesRouter.post("/saved-views", async (req, res) => {
  const user = await requireUser(req), body = parse(z.CreateSavedViewBody, req.body);
  let clean: ReturnType<typeof sanitizeSavedView>;
  try { clean = sanitizeSavedView(body); } catch (e) { assert(false, 400, (e as Error).message); }
  const share = !!body.shareWithRole;
  assert(!share || SHARE_ROLES.has(user.role), 403, "Your role cannot share views");
  const existing = await db.select().from(savedViews).where(and(eq(savedViews.userId, user.id), eq(savedViews.tableKey, clean!.tableKey)));
  assert(existing.length < 30, 400, "Delete an older view first (30 per list)");
  const same = existing.find(v => v.name === clean!.name);
  const row = { id: same?.id || uid(), userId: user.id, tableKey: clean!.tableKey, name: clean!.name, data: { filters: clean!.filters, columns: clean!.columns }, sharedRole: share ? shareAudience(user.role) : null, clinicIds: share ? user.clinicIds : [] };
  await db.insert(savedViews).values(row).onConflictDoUpdate({ target: savedViews.id, set: { data: row.data, sharedRole: row.sharedRole, clinicIds: row.clinicIds } });
  res.status(201).json(viewOut(row, user));
});
workspaceFeaturesRouter.delete("/saved-views/:id", async (req, res) => {
  const user = await requireUser(req);
  const [row] = await db.select().from(savedViews).where(eq(savedViews.id, String(req.params.id)));
  assert(row && row.userId === user.id, 404, "View not found");
  await db.delete(savedViews).where(eq(savedViews.id, row.id));
  res.status(204).end();
});
