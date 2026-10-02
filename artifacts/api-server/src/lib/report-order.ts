import { sql } from "drizzle-orm";
import { z } from "zod";

const fields = ["key", "label", "appointments", "outcomes", "other", "registrations", "waiting", "checkedIn", "completed", "noShow", "cancelled", "averageWaitMinutes", "averageConsultationMinutes"] as const;
export const reportListControls = z.object({
  search: z.string().trim().max(200).optional(),
  sort: z.string().refine(value => fields.includes(value.replace(/^-/, "") as typeof fields[number]), "Unsupported report sort field").optional(),
});

/** Use the same residual counts as the displayed/exported report, after grouping. */
export function reportOrder(sort = "key") {
  reportListControls.parse({ sort });
  const key = sort.replace(/^-/, "");
  const direction = sort.startsWith("-") ? sql`desc` : sql`asc`;
  const other = sql`(appointments - completed - cancelled - "noShow")`;
  const values = key === "outcomes"
    ? [sql.identifier("cancelled"), sql.identifier("noShow"), other]
    : [key === "other" ? other : sql.identifier(key)];
  return sql`${sql.join(values.map(value => sql`${value} ${direction} nulls last`), sql`, `)}, key asc`;
}