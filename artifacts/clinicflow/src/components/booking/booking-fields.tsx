import { FormField, type FormFieldProps } from "../FormField";
import { validateEmail, validatePersonName, validatePhone } from "../../lib/validators";

/** Booking terminology only; staff profile registration retains its additional fields. */
export const bookingFields = {
  clinic: { label: "Clinic group", required: true },
  location: { label: "Location", required: true },
  doctor: { label: "Doctor", required: true },
  date: { label: "Visit date", required: true },
  session: { label: "Session", required: true },
  patient: { label: "Patient", required: true },
  fullName: { label: "Patient's name", required: true, placeholder: "Enter the patient's full name" },
  email: { label: "Email", optional: true, placeholder: "name@example.com" },
  mobile: { label: "Mobile", optional: true },
  notes: { label: "Notes for your visit", optional: true, placeholder: "Add information for the clinic about this visit (optional)" },
  reason: { label: "Reason", optional: true, placeholder: "Explain the change to this visit (optional)" },
} as const;

export type BookingFieldName = keyof typeof bookingFields;
export function BookingField({ name, ...props }: Omit<FormFieldProps, "label"> & { name: BookingFieldName }) {
  const { label, ...metadata } = bookingFields[name];
  return <FormField {...metadata} {...props} label={label}/>;
}
export const bookingValidation = {
  fullName: (value: string) => value.trim() ? validatePersonName(value) || true : "Enter the patient's name.",
  email: (value: unknown) => validateEmail(value) || true,
  mobile: (value: string) => !value?.trim() || validatePhone(value) || true,
};
