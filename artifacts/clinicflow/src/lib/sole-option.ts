export type PublicOption = { id: string; name?: string; slug?: string | null };
/**
 * Guest finder "sole option": the single bookable row (has a public slug) of a FULLY loaded public list.
 * Rows without a slug have no public booking address, so they never block or count as the sole option.
 */
export function soleBookable<T extends PublicOption>(list?: { items: T[]; total: number }): T | null {
  if (!list || list.total > list.items.length) return null;
  const bookable = list.items.filter(item => !!item.slug);
  return bookable.length === 1 ? bookable[0] : null;
}
