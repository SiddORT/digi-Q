/** Render the self-contained print document, preserving Unicode text and scannable QR images. */
export async function ticketPdfBlob(html: string): Promise<Blob> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:640px;height:1000px;border:0";
  document.body.append(frame);
  try {
    const doc = frame.contentDocument!;
    doc.open(); doc.write(html); doc.close();
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map(img => img.decode()));
    const sections = Array.from(doc.querySelectorAll<HTMLElement>("body > section"));
    const targets = sections.length ? sections : [doc.body];
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    for (let index = 0; index < targets.length; index++) {
      const target = targets[index];
      frame.style.height = `${Math.max(1000, target.scrollHeight + 40)}px`;
      const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff", logging: false });
      if (!canvas.width || !canvas.height) throw new Error("Ticket could not be rendered.");
      if (index) pdf.addPage();
      const width = Math.min(190, 277 * canvas.width / canvas.height);
      const height = width * canvas.height / canvas.width;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", (210 - width) / 2, 10, width, height);
    }
    return pdf.output("blob");
  } finally { frame.remove(); }
}

export async function downloadTicketPdf(html: string, filename: string) {
  const blob = await ticketPdfBlob(html);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename.replace(/\.html$/i, "").replace(/(?:\.pdf)?$/i, ".pdf");
  document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
