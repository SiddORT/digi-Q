import { useEffect, useRef, useState } from "react";
import * as api from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Pencil } from "lucide-react";
import { AppDialog, useAppDialogClose } from "../AppDialog";
import { FormActions } from "../FormActions";
import { PhoneInput } from "../PhoneInput";
import { useFreshWorkspace } from "../queue/useFreshWorkspace";
import { VisitTicket, bookingStatusLabel } from "../tickets/VisitTicket";
import { PublicWebsiteStatus, usePublicWebsite } from "../../lib/public-website";
import { errorStatus, friendlyError } from "../../lib/friendly-error";
import { validatePhone } from "../../lib/validators";
import { formatConfiguredTimestamp } from "../../lib/date-time";
import { bookingFields } from "../booking/booking-fields";
import { canShowAppointmentTicket } from "./presentation";
import { clearBookingDraft, getBookingDraft, isBookingDraftDirty, setBookingDraft, type BookingDraft } from "./booking-drafts";
import { useAppointmentTicketActions } from "./ticket-actions";
import { refreshAppointmentObservers } from "./refresh";
import "./booking-tab.css";
import { ArrivalGuidance, LiveTicketAction } from "../tickets/ArrivalGuidance";

/** Booking tab: Booking Details left; Ticket & QR with its live strip directly beneath in the right column. Polling reuses the shared
 *  appointment query key, so this layout adds only the queue/QR reads the old stacked ticket already made. */
export function AppointmentBookingTab({ appointment: a }: { appointment: api.Appointment }) {
  const site = usePublicWebsite();
  const live = api.useGetAppointment(a.id, { query: { queryKey: api.getGetAppointmentQueryKey(a.id), retry: false, refetchInterval:30000 } });
  const freshness = useFreshWorkspace(live.dataUpdatedAt, !!live.error);
  const ticketVisible = canShowAppointmentTicket(a);
  const params = { doctorId: a.doctorId || "", branchId: a.branchId || "", date: a.date || "", sessionId: a.sessionId || undefined, startTime: a.startTime, appointmentId: a.id };
  const queue = api.useGetQueue(params, { query: { queryKey: api.getGetQueueQueryKey(params), enabled: ticketVisible, refetchInterval: 30000 } });
  const qr = api.useGetAppointmentQr(a.id, { query: { queryKey: api.getGetAppointmentQrQueryKey(a.id), enabled: ticketVisible } });
  const ctl = useAppointmentTicketActions();
  const online = freshness.online;
  const blocked = freshness.stale || !online || live.isFetching || !!live.error;
  const queueFresh = useFreshWorkspace(queue.dataUpdatedAt, !!queue.error);
  const presence = queue.data?.presence;
  return <div className="appt-booking" data-tooltip-boundary data-testid="section-detail-booking-layout">
    <div className="appt-booking-cards">
      <section className="appt-detail-block appt-booking-card" data-testid="section-detail-booking" aria-labelledby={`bk-h-${a.id}`}>
        <div className="appt-card-head"><h4 id={`bk-h-${a.id}`}>Booking Details</h4><BookingEditor appointment={a} blocked={freshness.stale || !online || !!live.error} /></div>
        <dl className="appt-detail-grid appt-booking-grid">
          <div className="span-2"><dt>Booked at</dt><dd data-testid="text-detail-booked">{formatConfiguredTimestamp(a.createdAt, a.timezone || undefined, {}, a)}<small>When the booking was created, not the visit time.</small></dd></div>
          <div className="span-2"><dt>Arrival guidance</dt><dd><ArrivalGuidance estimate={queue.data?.ownEntry?.estimate || live.data?.estimate} stale={queueFresh.stale} timezone={a.timezone} timeFormat={a.timeFormat}/></dd></div>
          <div className="span-2"><dt>Visit contact mobile</dt><dd data-testid="text-detail-booking-mobile">{a.bookingMobile?.trim() || "Not recorded for this visit."}<small>Saved for this visit only; separate from profile/login contact. Does not determine notification recipients.</small></dd></div>
          <div className="span-2"><dt>{bookingFields.notes.label}</dt><dd><p className={`appt-detail-notes${a.notes?.trim() ? "" : " appt-detail-empty"}`} data-testid="text-detail-notes">{a.notes?.trim() || "No notes recorded."}</p></dd></div>
        </dl>
      </section>
      <div className="appt-booking-side" data-testid="section-detail-ticket-column">
      <section className="appt-detail-block appt-booking-card appt-detail-ticket" id={`appt-ticket-${a.id}`} data-testid="section-detail-ticket" aria-labelledby={`tk-h-${a.id}`}>
        <h4 id={`tk-h-${a.id}`} className="sr-only-heading">Ticket &amp; QR</h4>
        {ticketVisible ? <>
          <VisitTicket compact testId="appointment-ticket" actions={ctl.buttons(a, blocked)} exportDisabled={blocked}
            ticket={{ dateFormat: a.dateFormat, timeFormat: a.timeFormat, patientName: a.patientName, clinicName: a.clinicName, branchName: a.branchName, address: a.branchAddress, doctorName: a.doctorName, date: a.date, startTime: a.startTime, endTime: a.endTime, timezone: a.timezone, waitingNumber: a.token, reference: a.reference, statusLabel: bookingStatusLabel(a.status), qrUrl: qr.data?.checkInUrl }} />
          {ctl.errorFor(a.id)}
          {qr.error && <p role="alert">Personal QR unavailable. <button type="button" onClick={() => void qr.refetch()} data-testid="button-retry-appointment-qr">Retry QR</button></p>}
        </> : <p className="appt-detail-empty" data-testid="text-detail-ticket-unavailable">Completed visits do not need a ticket. The booking reference remains available for records.</p>}
      </section>
      {ticketVisible && <div className="appt-booking-strip" data-testid="ticket-information">
      <div data-testid="text-ticket-booking-status"><span className="strip-label">Live ticket</span><LiveTicketAction appointmentId={a.id}/><small>Read-only status. Personal details require the booking owner's account.</small></div>
      <div data-testid="text-ticket-doctor-status"><span className="strip-label">Doctor status</span>{!queue.error && online && presence ? <p>{presence.status === "onBreak" ? "On break" : presence.status === "away" ? "Away" : "Available"}{presence.status !== "available" && <small>Calling is paused; the booking is kept.</small>}</p> : <p className="muted">Unavailable</p>}</div>
      {freshness.stale && <p role="alert" className="strip-wide">Ticket is offline or stale. Reconnect and refresh before printing. <button type="button" disabled={!online} onClick={() => void live.refetch()}>Refresh Ticket</button></p>}
      <p className="strip-wide muted" data-testid="text-ticket-qr-warning">QR is for authorized staff validation, not public access to patient details. Printed tickets do not update; status refreshes every 30 seconds while connected.</p>
    </div>}
      </div>
    </div>
    {ctl.dialogs}
  </div>;
}

/** Limited editor: visit contact mobile and notes only. Drafts live outside the tab so tab and row switches keep them;
 *  the revision snapshot is taken when editing starts and is never replaced by polling. */
function BookingEditor({ appointment: a, blocked }: { appointment: api.Appointment; blocked: boolean }) {
  const client = useQueryClient();
  const [draft, setDraftState] = useState<BookingDraft | undefined>(() => getBookingDraft(a.id));
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  const dirty = isBookingDraftDirty(draft);
  if (!a.canEditBooking && !draft) return null;
  const update = (patch: Partial<BookingDraft>) => { const next = { ...draft!, ...patch }; setBookingDraft(a.id, next); setDraftState(next); };
  const start = () => {
    const existing = getBookingDraft(a.id);
    const next = existing || { mobile: a.bookingMobile || "", notes: a.notes || "", baseRevision: a.revision ?? 0, baseBookingRevision: a.bookingDetailsRevision || 0, baseMobile: a.bookingMobile || "", baseNotes: a.notes || "", open: true };
    setBookingDraft(a.id, next); setDraftState(next); setError(""); setOpen(true);
  };
  const close = () => { clearBookingDraft(a.id); setDraftState(undefined); setOpen(false); setError(""); };
  const mobileProblem = draft ? (!draft.mobile.trim() ? "Enter a mobile number for this visit." : validatePhone(draft.mobile)) : undefined;
  async function save() {
    if (!draft || !a.canEditBooking || lock.current || mobileProblem || blocked || !navigator.onLine) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const saved = await api.updateAppointmentBooking(a.id, { expectedRevision: draft.baseRevision, expectedBookingDetailsRevision: draft.baseBookingRevision, bookingMobile: draft.mobile.trim(), notes: draft.notes.trim() });
      client.setQueryData(api.getGetAppointmentQueryKey(a.id), saved);
      void refreshAppointmentObservers(client);
      close();
    } catch (e) {
      if ([401, 403, 404].includes(errorStatus(e) || 0)) {
        if (errorStatus(e) === 403) {
          try {
            await client.fetchQuery({ queryKey: api.getGetAppointmentQueryKey(a.id), queryFn: () => api.getAppointment(a.id), staleTime: 0, retry: false });
            setError("Edit access changed. Your unsaved draft is kept for review; it has not been saved.");
            return;
          } catch { /* Read authorization is also gone: remove all private draft content. */ }
        }
        clearBookingDraft(a.id); setDraftState(undefined); setOpen(false);
        void client.invalidateQueries({ queryKey: api.getGetAppointmentQueryKey(a.id) });
        return;
      }
      setError(errorStatus(e) === 409 ? "This booking changed since you started editing. Cancel to discard, reopen Edit to see the latest, then re-enter your change." : friendlyError(e, "save"));
    } finally { lock.current = false; setBusy(false); }
  }
  return <>
    <button type="button" className="button secondary appt-edit-button" onClick={start} data-testid="button-edit-booking" disabled={blocked} title={blocked ? "Unavailable while offline or stale. Refresh first." : undefined} aria-label={`Edit booking details for ${a.patientName}`}><Pencil size={14} aria-hidden />{dirty ? "Resume Edit" : "Edit"}</button>
    {dirty && !open && <small className="appt-draft-note" role="status" data-testid="text-booking-draft">Unsaved changes kept.</small>}
    <AppDialog open={open && !!draft} onClose={close} title="Edit Booking Details" description="Only this visit's contact mobile and notes change. Profile, scheduling and notification recipients are not affected." dirty={dirty} busy={busy}>
      {draft && <form onSubmit={e => { e.preventDefault(); void save(); }} data-testid="form-edit-booking">
        {!a.canEditBooking && <p role="alert">This visit can no longer be edited. Your draft is kept here to review or copy; saving is disabled.</p>}
        <label>Visit contact mobile<PhoneInput value={draft.mobile} onChange={mobile => update({ mobile })} data-testid="input-booking-mobile" aria-invalid={!!mobileProblem} /></label>
        {mobileProblem && <p role="alert" data-testid="error-booking-mobile">{mobileProblem}</p>}
        <label>{bookingFields.notes.label}<textarea value={draft.notes} maxLength={1000} rows={5} onChange={e => update({ notes: e.target.value })} data-testid="input-booking-notes" /></label>
        {error && <p role="alert" data-testid="error-booking-save">{error}</p>}
        <BookingFormActions close={close} blocked={blocked || !a.canEditBooking} dirty={dirty} busy={busy} problem={!!mobileProblem} />
      </form>}
    </AppDialog>
  </>;
}

/** Cancel goes through the dialog's guarded close so unsaved edits always get the discard confirmation. */
function BookingFormActions({ close, blocked, dirty, busy, problem }: { close: () => void; blocked: boolean; dirty: boolean; busy: boolean; problem: boolean }) {
  const guarded = useAppDialogClose();
  return <FormActions wide={false} onCancel={guarded || close} cancelLabel="Cancel" busy={busy} busyLabel="Saving…" submitLabel="Save" submitTestId="button-save-booking" cancelTestId="button-cancel-booking" disabled={!dirty || problem || blocked || !navigator.onLine} />;
}

/** Reference with copy, shown in Details > Additional information. */
export function CopyReference({ reference }: { reference: string }) {
  const [copied, setCopied] = useState<"" | "done" | "failed">("");
  const token = useRef(0);
  useEffect(() => { token.current += 1; setCopied(""); }, [reference]);
  const copy = () => {
    const mine = ++token.current; const set = (v: "done" | "failed") => { if (token.current === mine) setCopied(v); };
    if (!navigator.clipboard) { set("failed"); return; }
    try { navigator.clipboard.writeText(reference).then(() => set("done"), () => set("failed")); } catch { set("failed"); }
  };
  return <span className="appt-detail-ref"><code data-testid="text-detail-reference">{reference}</code><button type="button" onClick={copy} aria-label={`Copy reference ${reference}`} data-testid="button-copy-reference">{copied === "done" ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}{copied === "done" ? "Copied" : "Copy"}</button>{copied === "failed" && <small role="alert">Copy unavailable. Select the reference to copy it.</small>}</span>;
}
