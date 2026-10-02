/** A failed or pending lookup is never evidence that a selected doctor is invalid. */
export function bookingDoctorMembership(input: {
  pending: boolean;
  error: boolean;
  publicIds?: string[];
  doctor?: { clinicIds?: unknown; branchIds?: unknown; status?: unknown };
  doctorId: string;
  clinicId: string;
  branchId: string;
}): "checking" | "error" | "valid" | "invalid" {
  if (!input.doctorId || !input.clinicId || !input.branchId || input.pending) return "checking";
  if (input.error) return "error";
  if (input.publicIds) return input.publicIds.includes(input.doctorId) ? "valid" : "invalid";
  const { doctor } = input;
  if (!doctor || !Array.isArray(doctor.clinicIds) || !Array.isArray(doctor.branchIds)) return "error";
  return doctor.status !== "inactive" && doctor.clinicIds.includes(input.clinicId) && doctor.branchIds.includes(input.branchId) ? "valid" : "invalid";
}