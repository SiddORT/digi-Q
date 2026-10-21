import { masters } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { assert } from "./http";

const own = (value: any, key: string) => Object.prototype.hasOwnProperty.call(value, key);
const canonical = (text: string) => text.trim().toLocaleLowerCase("en");
function customText(value: unknown): string | null {
  assert(value === null || typeof value === "string", 400, "Enter clinic metadata as text");
  if (value === null) return null;
  const text = (value as string).trim();
  assert(text.length <= 100 && !/[\u0000-\u001f\u007f]/.test(text), 400, "Use up to 100 characters without control characters");
  return text || null;
}

/** Mutates only supplied metadata; explicit null/[] clears, omitted fields preserve.
 * Selecting a standard category replaces custom text; nonempty custom text replaces
 * an omitted ID. Supplying both nonempty representations is always rejected.
 */
export async function normalizeClinicMetadata(body: any, conn: any, old: any = {}) {
  if (own(body, "customCategory")) body.customCategory = customText(body.customCategory);
  assert(!(body.categoryId && body.customCategory), 400, "Choose a standard category or a custom category, not both");
  if (body.categoryId) body.customCategory = null;
  else if (body.customCategory) body.categoryId = null;
  if (own(body, "customSpecialities")) {
    assert(Array.isArray(body.customSpecialities) && body.customSpecialities.length <= 30, 400, "Use up to 30 custom specialities");
    body.customSpecialities = body.customSpecialities.map((value: unknown) => {
      const text = customText(value);
      assert(text, 400, "Custom specialities cannot be blank");
      return text;
    });
    body.customSpecialities = [...new Map(body.customSpecialities.map((text: string) => [canonical(text), text])).values()];
  }
  if (own(body, "specialityIds")) {
    assert(Array.isArray(body.specialityIds) && body.specialityIds.length <= 30 && body.specialityIds.every((id: unknown) => typeof id === "string" && !!id), 400, "Use up to 30 standard specialities");
    body.specialityIds = [...new Set(body.specialityIds)];
  }
  const ids = [...new Set<string>([body.categoryId, ...(body.specialityIds || [])].filter(Boolean))];
  const records = ids.length ? await conn.select().from(masters).where(inArray(masters.id, ids)) : [];
  const validate = (id: string, category: string, retained: boolean) => {
    const row = records.find((row: any) => row.id === id);
    assert(row && row.category === category && (row.status === "active" || retained), 400, "Choose an available clinic category or speciality");
  };
  if (body.categoryId) validate(body.categoryId, "clinicCategory", body.categoryId === old.categoryId);
  for (const id of body.specialityIds || []) validate(id, "specialization", old.specialityIds?.includes(id));
  // Reject duplicates across standard and custom representations, including edits
  // where only one half of the list was supplied.
  const nextIds = body.specialityIds ?? old.specialityIds ?? [];
  const nextCustom = body.customSpecialities ?? old.customSpecialities ?? [];
  if (own(body, "specialityIds") || own(body, "customSpecialities")) {
    assert(nextIds.length + nextCustom.length <= 30, 400, "Use up to 30 clinic specialities in total");
    const selected = nextIds.length ? await conn.select().from(masters).where(inArray(masters.id, nextIds)) : [];
    const standardNames = new Set(selected.map((row: any) => canonical(row.data.name || row.code)));
    assert(!nextCustom.some((text: string) => standardNames.has(canonical(text))), 400, "A speciality is already selected from the standard list; remove the duplicate custom entry");
  }
}

export async function clinicMetadataNames(clinic: any, conn: any) {
  const ids = [clinic.categoryId, ...(clinic.specialityIds || [])].filter(Boolean);
  const records = ids.length ? await conn.select().from(masters).where(inArray(masters.id, ids)) : [];
  const name = (id: string) => records.find((row: any) => row.id === id)?.data?.name || "Saved option unavailable";
  return {
    categoryName: clinic.categoryId ? name(clinic.categoryId) : clinic.customCategory || null,
    specialityNames: [...(clinic.specialityIds || []).map(name), ...(clinic.customSpecialities || [])],
  };
}
