import { Check } from "lucide-react";

/** Section E: the one booking progression shared by staff, patient and guest booking. */
export const BOOKING_STEPS = ["Visit details", "Patient details", "Confirmation", "Ticket"] as const;

/** `step` is 1-based; steps before it are done. */
export function BookingSteps({ step }: { step: number }) {
  return <ol className="booking-steps" aria-label="Booking progress" data-testid="booking-steps">{BOOKING_STEPS.map((label, i) =>
    <li className={step === i + 1 ? "active" : step > i + 1 ? "done" : ""} key={label} aria-current={step === i + 1 ? "step" : undefined}><span>{step > i + 1 ? <Check size={15} aria-hidden/> : i + 1}</span>{label}</li>)}</ol>;
}
