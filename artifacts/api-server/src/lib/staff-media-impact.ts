import { sql } from "drizzle-orm";
import { assert } from "./http";
import { logoStorageConfiguration, isExclusiveLogoJob, type ExclusiveLogoJob } from "./exclusive-media-cleanup";
import { accountSubjectFingerprint, classifyHistoryForRemoval } from "./notification-history-provenance";
import { historyAssetSnapshots } from "./notification-history";

const ident = (name: string) => sql.raw(`"${name.replaceAll('"', '""')}"`);
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
function assetId(key: string) {
  const match = key.match(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i);
  return match?.[0].toLowerCase();
}
function strings(value: any): string[] {
  if (typeof value === "string") return [value.toLowerCase().replace(/%2d|&#45;|&#x2d;/g, "-")];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.entries(value).flatMap(([k, v]) => [k, ...strings(v)]);
  return [];
}
/** Read every application text/JSON row, including inactive and soft-deleted
 * records. UUID matching intentionally over-preserves ambiguous aliases. Never
 * infer exclusive ownership just because a logo says who uploaded it. */
export async function staffMediaGraph(conn: any) {
  const result = await conn.execute(sql`select c.table_name,jsonb_agg(c.column_name::text order by c.column_name) as columns
    from information_schema.columns c join information_schema.tables t
      on t.table_schema=c.table_schema and t.table_name=c.table_name and t.table_type='BASE TABLE'
    where c.table_schema='public' and c.data_type in ('text','character varying','json','jsonb','ARRAY')
      and c.table_name not in ('staff_deletion_receipts')
    group by c.table_name order by c.table_name`);
  const graph: { table: string; row: any; texts: string[] }[] = [];
  for (const source of result.rows as any[]) {
    const rows = await conn.execute(sql`select ${sql.join(source.columns.map(ident), sql.raw(","))} from ${ident(source.table_name)}`);
    assert(graph.length + rows.rows.length <= 100_000, 409, "Media impact is too large for a safe bounded review");
    for (const row of rows.rows as any[]) graph.push({ table: source.table_name, row, texts: strings(row) });
  }
  return graph;
}
export async function planStaffMedia(conn: any, userId: string, doctorIds: string[] = []) {
  const graph = await staffMediaGraph(conn), fingerprint = accountSubjectFingerprint(userId);
  const logos = graph.filter(g => g.table === "settings" && g.row.id?.startsWith("logo:") && g.row.data?.ownerId === userId);
  const exclusive: ExclusiveLogoJob[] = [], sharedLogoIds: string[] = [], exclusiveLogoIds: string[] = [];
  for (const logo of logos) {
    const data = logo.row.data, logoId = String(logo.row.id).slice(5);
    assert(uuid.test(logoId), 409, "A staff asset has an unverified locator");
    const keys = [...new Set([data.objectPath, data.validatedPath, data.plannedPath,
      ...(data.provider === "object" && data.objectPath ? [`${data.objectPath}-validated.png`] : [])].filter(Boolean))] as string[];
    // Pending local upload has no bytes until its key is allocated. Unknown
    // ready variants must not be silently forgotten.
    assert(data.state !== "ready" || keys.length > 0, 409, "A staff asset is missing its verified storage locator");
    const aliases = new Set([logoId.toLowerCase(), ...keys.map(assetId).filter(Boolean)] as string[]);
    let shared = false;
    for (const candidate of graph) {
      if (candidate === logo ||
        candidate.table === "users" && candidate.row.id === userId ||
        candidate.table === "doctors" && doctorIds.includes(candidate.row.id) ||
        candidate.table === "saved_views" && candidate.row.user_id === userId && !candidate.row.shared_role ||
        candidate.table === "settings" && candidate.row.id === "workspace:" + userId) continue;
      if (candidate.table === "settings" && candidate.row.id?.startsWith("notification-history:")) {
        const ownership = classifyHistoryForRemoval(candidate.row.id, candidate.row.data, fingerprint);
        if (ownership === "erase") continue;
        assert(ownership !== "blocked", 409, "Encrypted history prevents exclusive-media proof");
        candidate.texts = [...candidate.texts, ...strings(historyAssetSnapshots(candidate.row.id, candidate.row.data))];
      }
      if (candidate.texts.some(text => [...aliases].some(id => text.toLowerCase().includes(id)))) { shared = true; break; }
    }
    if (shared) { sharedLogoIds.push(logo.row.id); continue; }
    exclusiveLogoIds.push(logo.row.id);
    for (const key of keys) {
      const job: ExclusiveLogoJob = { provider: data.provider, key,
        configuration: logoStorageConfiguration(data.provider),
        notBefore: data.provider === "object" ? Number(data.expiresAt) : 0 };
      assert(isExclusiveLogoJob(job), 409, "A staff asset variant cannot be verified");
      if (!exclusive.some(j => j.provider === job.provider && j.key === job.key)) exclusive.push(job);
    }
  }
  return { exclusive, sharedLogoIds: sharedLogoIds.sort(), exclusiveLogoIds: exclusiveLogoIds.sort(),
    // Exact relational and encrypted graph evidence is internal to review hashing.
    evidence: graph.map(g => ({ table: g.table, row: g.row })) };
}
