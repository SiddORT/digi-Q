/** Parent choices follow the clinic hierarchy, not a freely selected doctor.
 * Only a genuinely fixed doctor (doctor workspace / QR) restricts parents. */
export function bookingCareScope(clinicId: string, branchId: string, fixedDoctorId = "") {
  const parents = { status: "active" as const, doctorId: fixedDoctorId || undefined };
  return {
    clinics: parents,
    branches: { ...parents, clinicId },
    doctors: { status: "active" as const, clinicId, branchId },
  };
}
