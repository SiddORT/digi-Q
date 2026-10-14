import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Reviewed migrations only. Never replay table/column/index creation after push.
const guardSources = [
  "0002_sad_texas_twister.sql", "0005_ancient_ultron.sql",
  "0006_safe_staff_manager_guard.sql", "0008_consulting_admin_assignments.sql",
  "0019_retired_staff_history.sql", "0020_staff_deletion_receipts.sql",
  "0021_immutable_visit_transitions.sql",
  "0022_erased_asset_fences.sql",
  "0023_staff_identity_write_fences.sql",
];

export function sqlStatements(source) {
  const result = [];
  let start = 0, quote = "", dollar = "", line = false, block = 0;
  for (let i = 0; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (line) { if (c === "\n") line = false; continue; }
    if (block) {
      if (c === "/" && next === "*") { block++; i++; }
      else if (c === "*" && next === "/") { block--; i++; }
      continue;
    }
    if (dollar) {
      if (source.startsWith(dollar, i)) { i += dollar.length - 1; dollar = ""; }
      continue;
    }
    if (quote) {
      if (c === quote) {
        if (next === quote) i++;
        else quote = "";
      }
      continue;
    }
    if (c === "-" && next === "-") { line = true; i++; continue; }
    if (c === "/" && next === "*") { block = 1; i++; continue; }
    if (c === "'" || c === '"') { quote = c; continue; }
    if (c === "$") {
      const tag = source.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z_0-9]*)?\$/)?.[0];
      if (tag) { dollar = tag; i += tag.length - 1; continue; }
    }
    if (c === ";") { result.push(source.slice(start, i + 1)); start = i + 1; }
  }
  if (quote || dollar || block) throw new Error("Unterminated reviewed SQL");
  if (source.slice(start).trim()) result.push(source.slice(start));
  return result.map(s => s.replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)*/, "").trim()).filter(Boolean);
}

export async function developmentGuardSql() {
  const functions = new Map(), triggers = new Map();
  for (const name of guardSources) {
    const source = await readFile(new URL(`../lib/db/drizzle/${name}`, import.meta.url), "utf8");
    for (const statement of sqlStatements(source)) {
      const fn = statement.match(/^CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z_][a-z_0-9]*)\s*\(/i);
      if (fn) {
        functions.set(fn[1], statement.replace(/^CREATE\s+FUNCTION/i, "CREATE OR REPLACE FUNCTION"));
        continue;
      }
      const trigger = statement.match(/^CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\s+([a-z_][a-z_0-9]*)\b[\s\S]*?\bON\s+([a-z_][a-z_0-9]*)\b/i);
      if (trigger) triggers.set(`${trigger[2]}:${trigger[1]}`, { name: trigger[1], table: trigger[2], statement });
      else if (/^CREATE\s+(?:CONSTRAINT\s+)?TRIGGER\b/i.test(statement)) throw new Error("Unsupported reviewed trigger syntax");
    }
  }
  for (const name of ["clinicflow_no_retired_linked_hours", "clinicflow_receipt_requires_removed_account", "clinicflow_immutable_removal_receipt",
    "clinicflow_validate_visit_transition", "clinicflow_preserve_transition_visit", "clinicflow_immutable_handoff_marker",
    "clinicflow_asset_alias_fingerprints", "clinicflow_no_erased_asset_reference", "clinicflow_immutable_asset_fence",
    "clinicflow_json_identity_tokens", "clinicflow_no_erased_staff_reference"]) {
    if (!functions.has(name)) throw new Error("Required development guard missing");
  }
  // Reviewed DO-block triggers must also survive db:push.
  const assetTables = ["users", "clinics", "branches", "assignments", "masters", "doctors", "patients",
    "schedules", "availability_exceptions", "appointments", "appointment_history", "appointment_transitions",
    "guest_requests", "audit_logs", "qrs", "settings", "otp_challenges",
    "staff_session_proofs", "auth_sessions", "auth_challenges", "auth_rate_limits", "notification_reads",
    "patient_documents", "saved_views"];
  for (const table of assetTables) triggers.set(`${table}:erased_asset_reference_guard`, {
    name: "erased_asset_reference_guard", table,
    statement: `CREATE TRIGGER erased_asset_reference_guard BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION clinicflow_no_erased_asset_reference();`,
  });
  for (const table of assetTables) triggers.set(`${table}:erased_staff_reference_guard`, {
    name: "erased_staff_reference_guard", table,
    statement: `CREATE TRIGGER erased_staff_reference_guard BEFORE INSERT OR UPDATE ON ${table} FOR EACH ROW EXECUTE FUNCTION clinicflow_no_erased_staff_reference();`,
  });
  const ddl = [...functions.values(), ...[...triggers.values()].flatMap(t => [
    `DROP TRIGGER IF EXISTS ${t.name} ON ${t.table};`, t.statement,
  ])].join("\n");
  return { ddl, functions: [...functions.keys()], triggers: [...triggers.values()].map(t => ({ name: t.name, table: t.table })) };
}

async function main() {
  if (process.argv[2] !== "--development" || process.env.NODE_ENV === "production") {
    throw new Error("This installer is development-only");
  }
  if (!process.env.DATABASE_URL) throw new Error("Development database is not configured");
  const { Client } = createRequire(new URL("../lib/db/package.json", import.meta.url))("pg");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    const guards = await developmentGuardSql();
    await client.connect();
    await client.query("BEGIN; SET LOCAL lock_timeout='2s'; SET LOCAL statement_timeout='15s'");
    await client.query(guards.ddl);
    await client.query("COMMIT");
    console.log(`Development relational guards installed (${guards.functions.length} functions, ${guards.triggers.length} triggers).`);
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    throw new Error("Development guard installation failed; no changes committed");
  } finally { await client.end().catch(() => {}); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
