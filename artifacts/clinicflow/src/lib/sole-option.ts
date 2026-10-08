export type PublicOption = { id: string; name?: string; slug?: string | null };
/** Only authoritative, unsearched scope results may establish cardinality. */
export function soleAssigned<T extends { id: string; status?: string }>(list?: { items: T[]; total: number }, failed = false): T | null {
  if (failed || !list || list.total !== 1 || list.items.length !== 1 || list.items[0].status === "inactive") return null;
  return list.items[0];
}
/**
 * Guest finder "sole option": the single bookable row (has a public slug) of a FULLY loaded public list.
 * Rows without a slug have no public booking address, so they never block or count as the sole option.
 */
export function soleBookable<T extends PublicOption>(list?: { items: T[]; total: number }): T | null {
  if (!list || list.total > list.items.length) return null;
  const bookable = list.items.filter(item => !!item.slug);
  return bookable.length === 1 ? bookable[0] : null;
}
