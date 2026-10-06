import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { BookingSteps } from "../BookingSteps";

/**
 * Section E shared staged booking: Visit details → Patient details → Confirmation → Ticket.
 * Every stage stays mounted (inactive ones are `hidden`), so Back never loses typed input.
 * No appointment is created before the Confirmation stage's explicit confirm action.
 */
export function StagedBooking({ step, visit, patient, confirmation, header, testId = "staged-booking" }: { step: 1 | 2 | 3; visit: ReactNode; patient: ReactNode; confirmation: ReactNode; header?: ReactNode; testId?: string }) {
  return <div className="staged-booking" data-testid={testId} data-step={step}>
    <BookingSteps step={step}/>
    {header}
    <section hidden={step !== 1} aria-label="Visit details" data-testid="stage-visit">{visit}</section>
    <section hidden={step !== 2} aria-label="Patient details" data-testid="stage-patient">{patient}</section>
    <section hidden={step !== 3} aria-label="Confirmation" data-testid="stage-confirmation">{step === 3 && confirmation}</section>
  </div>;
}

/** Shared stage footer: Back (and optional Change Visit) plus one primary action. */
export function BookingStageActions({ onBack, onChangeVisit, primaryLabel, onPrimary, primaryDisabled, busy, primaryTestId, primaryType = "button" }: { onBack?: () => void; onChangeVisit?: () => void; primaryLabel: string; onPrimary?: () => void; primaryDisabled?: boolean; busy?: boolean; primaryTestId?: string; primaryType?: "button" | "submit" }) {
  return <div className="form-footer form-actions">
    {onChangeVisit && <span className="form-actions-secondary"><button type="button" disabled={busy} onClick={onChangeVisit} data-testid="button-booking-change-visit">Change Visit</button></span>}
    {onBack && <button type="button" disabled={busy} onClick={onBack} data-testid="button-booking-back">Back</button>}
    <button className="button" type={primaryType} disabled={primaryDisabled || busy} onClick={onPrimary} data-testid={primaryTestId}>{primaryLabel}{primaryType === "button" && !busy && <ChevronRight size={17} aria-hidden/>}</button>
  </div>;
}

/** Shared confirmation summary rows. */
export function BookingSummary({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="review-grid booking-summary" data-testid="booking-summary">{rows.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => <div key={k}><dt><small>{k}</small></dt><dd><strong>{v}</strong></dd></div>)}</dl>;
}
