/** Ticket export format. "ticket" (default) produces a page sized to the ticket card itself, so a saved
 *  PDF reads like a ticket on a phone; "a4" deliberately centres the same card on an A4 sheet for office printing. */
export type TicketPdfFormat = "ticket" | "a4";
export const TICKET_PAGE_WIDTH_MM = 105; // A6-width ticket
export const TICKET_MARGIN_MM = 5;

/** Page geometry for one rendered card (pure; unit tested). */
export function ticketPageLayout(canvasWidth: number, canvasHeight: number, format: TicketPdfFormat) {
  const ratio = canvasHeight / canvasWidth;
  if (format === "a4") {
    const width = Math.min(120, 277 / ratio);
    return { page: [210, 297] as [number, number], x: (210 - width) / 2, y: 16, width, height: width * ratio };
  }
  const width = TICKET_PAGE_WIDTH_MM - TICKET_MARGIN_MM * 2;
  const height = width * ratio;
  return { page: [TICKET_PAGE_WIDTH_MM, Math.ceil(height + TICKET_MARGIN_MM * 2)] as [number, number], x: TICKET_MARGIN_MM, y: TICKET_MARGIN_MM, width, height };
}

/** Render the self-contained ticket document, preserving Unicode text and scannable QR images.
 *  Each ticket card (`.t`, or each `body > section` for multi-ticket exports) becomes its own page. */
export async function ticketPdfBlob(html: string, format: TicketPdfFormat = "ticket"): Promise<Blob> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  // Ticket width keeps the on-screen proportions; the QR is rendered at 2x for reliable scanning.
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:460px;height:1000px;border:0";
  document.body.append(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map(img => img.decode()));
    const sections = Array.from(doc.querySelectorAll<HTMLElement>("body > section"));
    const cards = Array.from(doc.querySelectorAll<HTMLElement>(".t"));
    const targets = sections.length ? sections : cards.length ? cards : [doc.body];
    let pdf: InstanceType<typeof jsPDF> | null = null;
    for (const target of targets) {
      frame.style.height = `${Math.max(1000, target.scrollHeight + 40)}px`;
      const canvas = await html2canvas(target, { scale: 3, backgroundColor: "#ffffff", logging: false });
      if (!canvas.width || !canvas.height) throw new Error("Ticket could not be rendered.");
      const layout = ticketPageLayout(canvas.width, canvas.height, format);
      if (!pdf) pdf = new jsPDF({ unit: "mm", format: layout.page, orientation: "portrait", compress: true });
      else pdf.addPage(layout.page, "portrait");
      // Lossless PNG with Flate ("FAST") stream compression: QR edges stay exact while file size drops sharply.
      pdf.addImage(canvas, "PNG", layout.x, layout.y, layout.width, layout.height, undefined, "FAST");
    }
    return pdf!.output("blob");
  } finally { frame.remove(); }
}

export async function downloadTicketPdf(html: string, filename: string, format: TicketPdfFormat = "ticket") {
  const blob = await ticketPdfBlob(html, format);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const base = filename.replace(/\.html$/i, "").replace(/\.pdf$/i, "");
  link.href = url; link.download = `${base}${format === "a4" ? "-A4" : ""}.pdf`;
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
