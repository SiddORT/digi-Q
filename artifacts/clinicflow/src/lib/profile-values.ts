import { ageFromDateOfBirth, isBlank } from "./validators";
import { formatDate } from "./date-time";

export { isBlank as isMissingProfileValue };
export function patientAgeLabel(patient: { dateOfBirth?: string | null; age?: number | null; ageReferenceDate?: string | null }, now = new Date()) {
  if (patient.dateOfBirth) {
    const age = ageFromDateOfBirth(patient.dateOfBirth, now);
    return age === undefined ? "Invalid date" : `${age} years`;
  }
  if (patient.age == null) return "Not entered";
  return `Approximately ${patient.age} years (${patient.ageReferenceDate ? `as of ${formatDate(patient.ageReferenceDate)}` : "reference date unknown"})`;
}
export const completionLabels: Record<string, string> = {
  dateOfBirth: "date of birth", age: "approximate age", gender: "gender", mobile: "mobile number", email: "email",
  address: "address", country: "country", state: "state", city: "city", pincode: "PIN code",
  emergencyContactName: "emergency contact", emergencyContactPhone: "emergency contact phone",
  photoUrl: "photo", about: "about", specializationId: "specialization", qualificationIds: "qualifications",
  languages: "languages", registrationNumber: "registration number", experienceYears: "experience", consultationFee: "consultation fee",
};
