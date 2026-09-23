type ClinicRow = {
  id: string;
  name?: unknown;
  status?: string;
};

type BranchRow = ClinicRow & {
  clinicId: string;
};

export type InvitationMetadata = {
  clinicFlowRole: string;
  clinicFlowRoleLabel: string;
  clinicFlowClinicNames: string[];
  clinicFlowBranchNames: string[];
};

const roleLabels: Record<string, string> = {
  superAdmin: "Super Administrator",
  clinicAdmin: "Clinic Administrator",
  doctor: "Doctor",
  receptionist: "Receptionist",
  patient: "Patient",
};

function uniqueNames(ids: string[], rows: Map<string, ClinicRow>) {
  const names = ids.flatMap(id => {
    const name = rows.get(id)?.name;
    return typeof name === "string" && name.trim() ? [name] : [];
  });
  return [...new Set(names)];
}

export function invitationMetadata(
  role: string,
  clinicIds: string[],
  branchIds: string[],
  clinicRows: ClinicRow[],
  branchRows: BranchRow[],
): InvitationMetadata {
  const assignedClinicIds = new Set(clinicIds);
  const validClinics = new Map(
    clinicRows
      .filter(clinic => clinic.status === "active" && assignedClinicIds.has(clinic.id))
      .map(clinic => [clinic.id, clinic]),
  );
  const validBranches = new Map(
    branchRows
      .filter(branch =>
        branch.status === "active"
        && branchIds.includes(branch.id)
        && validClinics.has(branch.clinicId),
      )
      .map(branch => [branch.id, branch]),
  );

  return {
    clinicFlowRole: role,
    clinicFlowRoleLabel: roleLabels[role] || role,
    clinicFlowClinicNames: uniqueNames(clinicIds, validClinics),
    clinicFlowBranchNames: uniqueNames(branchIds, validBranches),
  };
}