export const MISSING_REGISTRATION_DOCTOR = "The clinic was saved, but its requested consulting doctor profile could not be confirmed. Do not register again. The existing setup needs recovery.";

export function registrationDoctorIssue(result: { doctorId?: string | null }, requested: boolean) {
  return requested && !result.doctorId ? MISSING_REGISTRATION_DOCTOR : undefined;
}

export function requireRegistrationDoctor<T extends { doctorId?: string | null }>(result: T, requested: boolean): T {
  const issue = registrationDoctorIssue(result, requested);
  if (issue) throw new Error(issue);
  return result;
}
