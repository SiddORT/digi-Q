type ClinicalBranch = { id: string; status: string };

export function clinicalBranchSelection(selectedIds: string[], knownBranches: ClinicalBranch[]) {
  const unique = [...new Set(selectedIds)];
  const byId = new Map(knownBranches.map(branch => [branch.id, branch]));
  const inactive = unique.filter(id => byId.get(id)?.status !== "active" && byId.has(id));
  const unknown = unique.filter(id => !byId.has(id));
  const active = unique.filter(id => byId.get(id)?.status === "active");
  return { branchIds: unique, inactive, unknown, canSave: active.length > 0 && inactive.length === 0 && unknown.length === 0 };
}