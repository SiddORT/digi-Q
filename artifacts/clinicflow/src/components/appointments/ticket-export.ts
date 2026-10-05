import * as api from "@workspace/api-client-react";
import QRCode from "qrcode";
import { absoluteUrl, bookingStatusLabel, embeddedTicketLogo, ticketHtml } from "../tickets/VisitTicket";
import { downloadTicketPdf } from "../tickets/ticket-pdf";
import { canShowAppointmentTicket } from "./presentation";

/** Real PDF download through the shared ticket PDF helper. */
export const downloadPdf = (html: string, filename: string) => downloadTicketPdf(html, filename);

/** Fresh appointment + QR revalidation (same rule as the on-screen ticket), returned as self-contained ticket HTML. */
export async function freshTicketHtml(id: string, logo?: string) {
  if (!navigator.onLine) throw new Error("Offline. Reconnect and try again.");
  const fresh = await api.getAppointment(id);
  if (!canShowAppointmentTicket(fresh)) throw new Error("Completed visits do not need a ticket.");
  const code = await api.getAppointmentQr(id);
  const confirmed = await api.getAppointment(id);
  if (fresh.revision !== confirmed.revision || fresh.status !== confirmed.status) throw new Error("Appointment changed while preparing the ticket. Refresh and try again.");
  if (!code.checkInUrl) throw new Error("Personal QR unavailable. Refresh and try again.");
  const image = await QRCode.toDataURL(absoluteUrl(code.checkInUrl), { width: 300, margin: 2 });
  const a = confirmed;
  const html = ticketHtml({ dateFormat: a.dateFormat, timeFormat: a.timeFormat, patientName: a.patientName, clinicName: a.clinicName, branchName: a.branchName, address: a.branchAddress, doctorName: a.doctorName, date: a.date, startTime: a.startTime, endTime: a.endTime, timezone: a.timezone, waitingNumber: a.token, reference: a.reference, statusLabel: bookingStatusLabel(a.status), qrUrl: code.checkInUrl }, image, logo ?? await embeddedTicketLogo());
  return { html, appointment: a };
}
