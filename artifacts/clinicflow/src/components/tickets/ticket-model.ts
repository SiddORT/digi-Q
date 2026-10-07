/** Single source of truth for the visit ticket: both the on-screen React card (visit-ticket.css) and the
 *  self-contained export/print HTML (ticketHtml) read these tokens and this content model, so the two
 *  presentations cannot drift in colour, size, order or wording. */
export const TICKET_THEME = {
  ink: "#10274e",
  paper: "#ffffff",
  accent: "#087cb7",
  soft: "#e9f8fc",
  head: "#edfaff",
  line: "#c9e3ed",
  badge: "#d9f2fb",
  radius: "16px",
  radiusInner: "8px",
  logoWidth: "108px",
  logoHeight: "54px",
  qrSize: "160px",
  numberSize: "56px",
  nameSize: "20px",
  visitSize: "16px",
  bodySize: "14px",
  smallSize: "12px",
  labelTracking: ".14em",
  cardWidth: "560px",
} as const;

export type TicketTheme = typeof TICKET_THEME;
const kebab = (k: string) => k.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
/** CSS custom properties (`--vt-ink`, `--vt-qr-size`, …) applied to the card root in both renderers. */
export function ticketCssVars(theme: TicketTheme = TICKET_THEME): Record<string, string> {
  return Object.fromEntries(Object.entries(theme).map(([k, v]) => [`--vt-${kebab(k)}`, v]));
}
export const ticketCssVarString = (theme: TicketTheme = TICKET_THEME) => Object.entries(ticketCssVars(theme)).map(([k, v]) => `${k}:${v}`).join(";");

export type TicketModelInput = {
  patientName: string; clinicName: string; branchName: string; address?: string | null; doctorName: string;
  waitingNumber?: string | null; reference?: string | null; statusLabel?: string;
  dateText: string; sessionText: string;
};
/** Ordered ticket content shared by screen and export. */
export function ticketModel(t: TicketModelInput) {
  return {
    title: "Visit Ticket",
    status: t.statusLabel || "Booked",
    numberLabel: "Waiting Number",
    number: t.waitingNumber || "—",
    reference: t.reference ? `Ref ${t.reference}` : "",
    patient: t.patientName,
    visitLabel: "Date · Location",
    visitPrimary: `${t.dateText} · ${t.branchName}`,
    visitSecondary: `Session ${t.sessionText}`,
    facts: [["Clinic", t.clinicName], ...(t.address ? [["Address", t.address]] : []), ["Doctor", t.doctorName]] as [string, string][],
    qrAlt: "Personal visit QR",
    qrCaption: "Personal QR for reception. Keep it private.",
    footer: "Show this ticket at reception. The session is a time range, not an exact consultation time.",
  };
}
