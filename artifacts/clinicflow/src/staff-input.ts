import type { UserInput, DoctorInput } from "@workspace/api-client-react";

export type StaffTab = "admins" | "doctors" | "receptionists";

export function assignmentTargetRole(tab: StaffTab): "doctor" | "receptionist" {
  return tab === "receptionists" ? "receptionist" : "doctor";
}

export function staffInput(tab: StaffTab, values: Record<string, unknown>, options: { create?: boolean } = {}) {
  const body: UserInput & Partial<DoctorInput> & Record<string, any> = {
    fullName: typeof values.fullName === "string" ? values.fullName : "",
    email: typeof values.email === "string" ? values.email : "",
    role: tab === "admins" ? "clinicAdmin" : tab === "doctors" ? "doctor" : "receptionist",
    status: values.status === "inactive" ? "inactive" : "active",
  };
  const fields = ["fullName", "email", "mobile"];
  if (tab !== "admins") fields.push("clinicIds", "branchIds");
  if (tab === "doctors") fields.push("registrationNumber");
  for (const field of fields) {
    if (values[field] !== undefined) body[field] = values[field];
  }
  // Credentials are create-only; edits never submit them.
  if (options.create && typeof values.password === "string" && typeof values.confirmPassword === "string") {
    body.password = values.password;
    body.confirmPassword = values.confirmPassword;
  }
  if (tab === "doctors" && typeof values.experienceYears === "number" && Number.isFinite(values.experienceYears)) {
    body.experienceYears = values.experienceYears;
  }
  return body;
}