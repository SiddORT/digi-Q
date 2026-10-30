import { useEffect, useRef, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { BookingSteps } from "../BookingSteps";

/**
 * Shared staged booking: Visit details → Patient details → Ticket.
 * Every stage stays mounted (inactive ones are `hidden`), so Back never loses typed input.
 * Only the explicit booking action on Patient details creates an appointment.
 */
export function StagedBooking({ step, visit, patient, finalAction, header, testId = "staged-booking" }: { step: 1 | 2; visit: ReactNode; patient: ReactNode; finalAction: ReactNode; header?: ReactNode; testId?: string }) {
  const root = useRef<HTMLDivElement>(null);
  const initial = useRef(true);
  useEffect(() => {
    if (initial.current) { initial.current = false; return; }
    const heading = root.current?.querySelector<HTMLElement>(`[data-testid="stage-${step === 1 ? "visit" : "patient"}"] h2`);
    heading?.setAttribute("tabindex", "-1");
    heading?.focus();
  }, [step]);
  return <div ref={root} className="staged-booking" data-testid={testId} data-step={step}>
    <BookingSteps step={step}/>
    {header}
    <section hidden={step !== 1} aria-label="Visit details" data-testid="stage-visit">{visit}</section>
    <section hidden={step !== 2} aria-label="Patient details" data-testid="stage-patient">{patient}{step === 2 && finalAction}</section>
  </div>;
}

/** Shared stage footer: Back (and optional Change Visit) plus one primary action. */
export function BookingStageActions({ onBack, onChangeVisit, primaryLabel, onPrimary, primaryDisabled, busy, primaryTestId, primaryType = "button", blockedReason }: { blockedReason?: string; onBack?: () => void; onChangeVisit?: () => void; primaryLabel: string; onPrimary?: () => void; primaryDisabled?: boolean; busy?: boolean; primaryTestId?: string; primaryType?: "button" | "submit" }) {
  return <div className="form-footer form-actions booking-stage-actions">
    {blockedReason && primaryDisabled && <p className="booking-blocked-reason" role="status" data-testid="text-booking-continue-reason">{blockedReason}</p>}
    {onChangeVisit && <span className="form-actions-secondary"><button type="button" disabled={busy} onClick={onChangeVisit} data-testid="button-booking-change-visit">Change Visit</button></span>}
    {onBack && <button type="button" disabled={busy} onClick={onBack} data-testid="button-booking-back">Back</button>}
    <button className="button" type={primaryType} disabled={primaryDisabled || busy} onClick={onPrimary} data-testid={primaryTestId}>{primaryLabel}{primaryType === "button" && !busy && <ChevronRight size={17} aria-hidden/>}</button>
  </div>;
}

/** Shared confirmation summary rows. */
export function BookingSummary({ rows }: { rows: [string, ReactNode][] }) {
  return <dl className="review-grid booking-summary" data-testid="booking-summary">{rows.filter(([, v]) => v !== null && v !== undefined && v !== "").map(([k, v]) => <div key={k}><dt><small>{k}</small></dt><dd><strong>{v}</strong></dd></div>)}</dl>;
}
