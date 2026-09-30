/** Only a confirmed mismatch invalidates a dependent selection. Missing records and
 * failed lookups are not evidence of invalidity (e.g. a temporary API failure). */
export function validDependentIds(
  resource: string,
  selected: string[],
  records: { id: string; clinicId?: string; clinicIds?: string[]; branchIds?: string[] }[],
  clinicIds: string[],
  branchId?: string,
): string[] {
  const byId = new Map(records.map(record => [record.id, record]));
  return selected.filter(id => {
    const record = byId.get(id);
    if (!record) return true;
    if (resource === "branches") return !record.clinicId || clinicIds.includes(record.clinicId);
    if (resource === "doctors") {
      return (!clinicIds.length || !record.clinicIds || clinicIds.some(clinic => record.clinicIds?.includes(clinic))) &&
        (!branchId || !record.branchIds || record.branchIds.includes(branchId));
    }
    return true;
  });
}

/** Both the selectedIds filter and pageSize are capped at 100 by the API. */
export function selectedIdBatches(ids: string[]): string[][] {
  const unique = [...new Set(ids)];
  const batches: string[][] = [];
  for (let offset = 0; offset < unique.length; offset += 100) batches.push(unique.slice(offset, offset + 100));
  return batches;
}