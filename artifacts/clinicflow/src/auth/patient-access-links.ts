/** Keep legacy signup links and the public clinic session context on one contract. */
export function patientSignupDestination(ticket: string | null) {
  return ticket ? `/set-password?token=${encodeURIComponent(ticket)}` : "/patient-login?mode=signup";
}

export function patientGuestDestination(reference: string | null) {
  return reference ? `/book/${encodeURIComponent(reference)}` : "/guest-booking";
}

export function postOnboardingDestination(role: string, reference: string | null) {
  const root = ["superAdmin", "clinicAdmin"].includes(role) ? "admin" : role;
  return reference ? `/book/${reference}` : `/${root}/dashboard`;
}
