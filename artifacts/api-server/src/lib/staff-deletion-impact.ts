import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { assert } from "./http";
import { accountSubjectFingerprint, classifyHistoryForRemoval } from "./notification-history-provenance";

/**
 * This is a read-only planner. It deliberately does not authorize or perform
 * deletion. Raw rows are used only for the version digest, never returned
 * to the browser. Unknown relationships are blockers, not cascade candidates.
 */
type Action = "erase" | "anonymize" | "retire" | "resolve" | "disable";
type Reference = { table: string; columns: string[]; action: Action };
export const userReferences: Reference[] = [
  { table: "users", columns: ["managing_admin_id"], action: "resolve" },
  { table: "clinics", columns: ["admin_id"], action: "resolve" },
  { table: "clinics", columns: ["owner_id"], action: "anonymize" },
  { table: "assignments", columns: ["user_id"], action: "erase" },
  { table: "doctors", columns: ["user_id", "owner_admin_id"], action: "retire" },
  { table: "patients", columns: ["user_id"], action: "resolve" },
  { table: "appointments", columns: ["actor_id"], action: "anonymize" },
  { table: "appointment_history", columns: ["actor_id"], action: "anonymize" },
  { table: "appointment_transitions", columns: ["actor_id"], action: "anonymize" },
  { table: "guest_requests", columns: ["decided_by"], action: "anonymize" },
  { table: "auth_sessions", columns: ["user_id"], action: "erase" },
  { table: "auth_challenges", columns: ["user_id"], action: "erase" },
  { table: "otp_challenges", columns: ["user_id"], action: "erase" },
  { table: "notification_reads", columns: ["user_id"], action: "erase" },
  { table: "patient_documents", columns: ["uploaded_by"], action: "anonymize" },
  { table: "saved_views", columns: ["user_id"], action: "anonymize" },
  { table: "audit_logs", columns: ["actor_id"], action: "anonymize" },
];
const doctorReferences: Reference[] = [
  { table: "appointment_transitions", columns: ["from_doctor_id", "to_doctor_id"], action: "anonymize" },
  { table: "appointments", columns: ["doctor_id"], action: "anonymize" },
  { table: "guest_requests", columns: ["doctor_id"], action: "anonymize" },
  { table: "schedules", columns: ["doctor_id"], action: "erase" },
  { table: "availability_exceptions", columns: ["doctor_id"], action: "erase" },
  { table: "qrs", columns: ["doctor_id"], action: "disable" },
];
const identifier = (value: string) => sql.raw(`"${value.replaceAll('"', '""')}"`);
const rawRows = async (conn: any, query: ReturnType<typeof sql>) => (await conn.execute(query)).rows as any[];
function canonical(value: any): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(",")}}`;
  return JSON.stringify(value) ?? "null";
}
function contains(value: any, needles: Set<string>): boolean {
  if (typeof value === "string") return needles.has(value);
  if (Array.isArray(value)) return value.some(v => contains(v, needles));
  if (value && typeof value === "object") return Object.entries(value).some(([k, v]) => needles.has(k) || contains(v, needles));
  return false;
}
const rowKey = (row: any) => String(row.id ?? row.token_hash ?? row.session_id ?? row.key ?? `${row.user_id}:${row.notification_id}`);
const closedVisits = new Set(["completed", "noShow", "cancelled"]);
export type StaffDeletionImpact = {
  target: { id: string; fullName: string; email: string; role: string; status: string };
  version: string;
  groups: { source: string; action: Action; ids: string[]; count: number }[];
  blockers: { code: string; message: string; source?: string; ids?: string[] }[];
  warnings: string[];
  ready: false;
};
export async function computeStaffDeletionImpact(conn: any, actorId: string, targetId: string): Promise<StaffDeletionImpact> {
  const [actor] = await rawRows(conn, sql`select id,role,status,data from users where id=${actorId}`);
  assert(actor?.role === "superAdmin" && actor.status === "active" && !actor.data?.demo && !actor.data?.demoFixture, 403, "Real Superadmin access required");
  const [target] = await rawRows(conn, sql`select * from users where id=${targetId}`);
  assert(target, 404, "Staff account not found");
  const blockers: StaffDeletionImpact["blockers"] = [];
  const warn = (code: string, message: string, source?: string, ids?: string[]) => blockers.push({ code, message, ...(source ? { source } : {}), ...(ids?.length ? { ids: ids.sort() } : {}) });
  if (targetId === actorId) warn("SELF_DELETION", "You cannot permanently delete your signed-in account.");
  if (target.role === "patient") warn("PATIENT_ACCOUNT", "Patient-account deletion is outside this operation.");
  if (target.data?.demo || target.data?.demoFixture) warn("DEMO_ACCOUNT", "Demo accounts cannot use permanent staff deletion.");
  if (target.role === "superAdmin" && target.status === "active") {
    const rows = await rawRows(conn, sql`select id from users where role='superAdmin' and status='active'
      and not coalesce((data->>'demo')::boolean,false) and not (data ? 'demoFixture')`);
    if (rows.length < 2) warn("LAST_SUPERADMIN", "The last active Superadmin cannot be removed.");
  }
  // Registry completeness is checked against the real migrated relational schema,
  // not only the TypeScript schema. A new FK fails closed until classified here.
  const fkRows = await rawRows(conn, sql`
    select ns.nspname as source_schema, src.relname as source, dst.relname as destination, a.attname as column,
      cardinality(c.conkey) as width, c.confdeltype as delete_rule
    from pg_constraint c
    join pg_class src on src.oid=c.conrelid
    join pg_namespace ns on ns.oid=src.relnamespace
    join pg_class dst on dst.oid=c.confrelid
    join pg_attribute a on a.attrelid=src.oid and a.attnum=c.conkey[1]
    where c.contype='f' and dst.oid in (to_regclass('public.users'),to_regclass('public.doctors'))
    order by ns.nspname,src.relname,a.attname,dst.relname`);
  for (const fk of fkRows) {
    const registry = fk.destination === "users" ? userReferences : doctorReferences;
    if (fk.source_schema !== "public" || Number(fk.width) !== 1 || !registry.some(r => r.table === fk.source && r.columns.includes(fk.column)))
      warn("UNKNOWN_RELATION", "An unclassified database relationship prevents deletion.", `${fk.source_schema === "public" ? "" : fk.source_schema + "."}${fk.source}.${fk.column}`);
  }
  const tableRows = await rawRows(conn, sql`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') order by c.relname`);
  const presentTables = new Set(tableRows.map(r => r.relname));
  for (const table of new Set([...userReferences, ...doctorReferences].map(r => r.table))) {
    if (!presentTables.has(table)) warn("REQUIRED_SCHEMA_MISSING", "A required data source is not installed; removal is unavailable.", table);
  }
  const snapshots: { source: string; rows: any[] }[] = [
    { source: "target", rows: [target] },
    { source: "relational-schema", rows: fkRows },
    { source: "installed-tables", rows: tableRows },
  ];
  const groups: StaffDeletionImpact["groups"] = [];
  const add = (source: string, action: Action, rows: any[]) => {
    if (!rows.length) return;
    snapshots.push({ source, rows: [...rows].sort((a, b) => rowKey(a).localeCompare(rowKey(b))) });
    const sensitive = source.startsWith("user:auth_") || source === "user:staff_session_proofs";
    const ids = [...new Set(rows.map(row => sensitive ? createHash("sha256").update(source + ":" + rowKey(row)).digest("hex") : rowKey(row)))].sort();
    groups.push({ source, action, ids, count: ids.length });
  };
  for (const ref of userReferences) {
    if (!presentTables.has(ref.table)) continue;
    const rows = await rawRows(conn, sql`select * from ${identifier(ref.table)} where ${sql.join(ref.columns.map(c => sql`${identifier(c)}=${targetId}`), sql.raw(" or "))}`);
    add(`user:${ref.table}${ref.table === "clinics" ? "." + ref.columns[0] : ""}`, ref.action, rows);
    if (ref.table === "patients" && rows.length) warn("PATIENT_LINK", "This staff login is linked to a patient profile; this operation cannot erase or detach that profile.", ref.table, rows.map(rowKey));
    if (ref.table === "clinics" && ref.columns.includes("admin_id")) {
      const owned = rows.filter(r => r.admin_id === targetId);
      if (owned.length) warn("CLINIC_RESPONSIBILITY", "Review and transfer each clinic's administration before deleting this account.", ref.table, owned.map(rowKey));
    }
    if (ref.table === "users" && rows.length) warn("STAFF_RESPONSIBILITY", "Review and transfer the management of these staff accounts first.", ref.table, rows.map(rowKey));
    if (ref.table === "doctors") {
      const managed = rows.filter(r => r.owner_admin_id === targetId && r.user_id !== targetId && r.status !== "retired");
      if (managed.length) warn("DOCTOR_RESPONSIBILITY", "Review and transfer the management of these doctors first.", ref.table, managed.map(rowKey));
    }
  }
  // Legacy Clerk proof rows have no FK. Native user IDs are not a substitute
  // for the exact saved external identity; include both only when present.
  const proofIdentities = [...new Set([target.id, target.clerk_id].filter(Boolean))];
  const proofs = await rawRows(conn, sql`select * from staff_session_proofs where clerk_user_id in (${sql.join(proofIdentities.map(id => sql`${id}`), sql.raw(","))})`);
  add("user:staff_session_proofs", "erase", proofs);
  const ownDoctors = await rawRows(conn, sql`select * from doctors where user_id=${targetId}`);
  const doctorIds = ownDoctors.map(r => r.id);
  if (doctorIds.length) {
    for (const ref of doctorReferences) {
      if (!presentTables.has(ref.table)) continue;
      const rows = await rawRows(conn, sql`select * from ${identifier(ref.table)} where ${sql.join(ref.columns.map(column =>
        sql`${identifier(column)} in (${sql.join(doctorIds.map(id => sql`${id}`), sql.raw(","))})`), sql.raw(" or "))}`);
      add(`doctor:${ref.table}`, ref.action, rows);
      if (ref.table === "appointments") {
        const active = rows.filter(r => !closedVisits.has(r.status));
        if (active.length) warn("OPEN_VISITS", "Resolve or explicitly hand off every unfinished visit. Visits already called or in consultation must be resolved in the queue first.", ref.table, active.map(rowKey));
      }
      if (ref.table === "guest_requests") {
        const pending = rows.filter(r => r.status === "pending");
        if (pending.length) warn("PENDING_REQUESTS", "Resolve pending guest requests before retiring this doctor.", ref.table, pending.map(rowKey));
      }
    }
  }
  const needles = new Set<string>([targetId, target.clerk_id, ...doctorIds, target.email, target.mobile, target.full_name].filter(Boolean));
  const settings = await rawRows(conn, sql`select * from settings order by id`);
  // Until every JSON writer and encrypted payload has an explicit classifier,
  // do not claim a generic string replacement is a safe erasure algorithm.
  const knownPrivatePrefixes = ["workspace:", "staff-invitation:", "staff-recovery:", "notification-read:", "notification-preferences:"];
  for (const row of settings) {
    if (row.id.startsWith("staff-handoff:") && row.data?.sourceFingerprint === accountSubjectFingerprint(targetId))
      snapshots.push({ source: "completed-handoff-evidence", rows: [row] });
    if (row.id.startsWith("notification-history:")) {
      const classification = classifyHistoryForRemoval(row.id, row.data, accountSubjectFingerprint(targetId));
      if (classification === "erase") add("settings:notification-history", "erase", [row]);
      else if (classification === "blocked") {
        add("settings:notification-history", "resolve", [row]);
        warn("ENCRYPTED_HISTORY_REVIEW", "Notification history lacks verified captured identity evidence; reconcile it before removal.", "settings", [row.id]);
      }
      // Even unrelated encrypted rows participate in the review fingerprint:
      // no new or changed unclassified envelope can appear between review/write.
      snapshots.push({ source: "history-evidence", rows: [row] });
      continue;
    }
    const keyLinked = [...needles].some(n => row.id.split(":").includes(n));
    const valueLinked = contains(row.data, needles);
    const encrypted = row.id.startsWith("notification-history:") && (row.data?.encrypted || row.data?.snapshots?.some((s: any) => s.encrypted));
    if (!keyLinked && !valueLinked && !encrypted) continue;
    const privateRow = keyLinked && knownPrivatePrefixes.some(p => row.id.startsWith(p));
    add("settings:" + row.id.split(":")[0], privateRow ? "erase" : "resolve", [row]);
    if (!privateRow) warn(encrypted ? "ENCRYPTED_HISTORY_REVIEW" : "JSON_REFERENCE_REVIEW",
      encrypted ? "Encrypted notification history must be classified and safely cleaned before deletion." : "A settings reference needs explicit cleanup classification before deletion.",
      "settings", [row.id]);
    if (["sending", "delivery_unknown"].includes(row.data?.state) || row.data?.status === "sending")
      warn("DISPATCH_IN_PROGRESS", "A staff media operation or notification dispatch is active or uncertain; account removal must wait for safe reconciliation.", "settings", [row.id]);
  }
  const linkedBranches = doctorIds.length ? await rawRows(conn, sql`select * from branches where data->'linkedSchedule'->>'doctorId' in (${sql.join(doctorIds.map(id => sql`${id}`), sql.raw(","))})`) : [];
  add("doctor:linked_branches", "disable", linkedBranches);
  // No caller can use this preliminary planner as permission to remove data.
  warn("IMPLEMENTATION_GATED", "Permanent deletion is not enabled until dispatch barriers, media verification and acceptance tests are complete.");
  const version = createHash("sha256").update(canonical({ snapshots, blockers, fkRows: [...fkRows].sort((a, b) => canonical(a).localeCompare(canonical(b))) })).digest("hex");
  return {
    target: { id: target.id, fullName: target.full_name, email: target.email, role: target.role, status: target.status },
    version, groups, blockers, ready: false,
    warnings: [
      "Clinical documents and shared care records must remain unchanged.",
      ...(doctorIds.length ? ["Historical visits retain an anonymous Deleted doctor reference. Only reviewed unfinished visits may be handed off."] : []),
      "Physical personal-file cleanup may remain pending after the account is removed; that state must be shown explicitly.",
    ],
  };
}
