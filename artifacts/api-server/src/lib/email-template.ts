const brand = "DigiQ Doctors";
const footer = "This is an automated message from DigiQ Doctors. Please do not reply to this email.";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

/** Wrap caller-owned content without interpreting dates, verification codes, or URLs. */
export function systemEmailTemplate(subject: string, body: string): { text: string; html: string } {
  return {
    text: `${brand}\n\n${subject}\n\n${body}\n\n${footer}`,
    html: `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background-color:#f4f7fb;color:#17243b;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" style="width:100%;max-width:600px;margin:0 auto;border-collapse:collapse;background-color:#ffffff">
    <tr><td style="padding:24px 28px;background-color:#163b65;color:#ffffff;font-size:24px;font-weight:bold">${brand}</td></tr>
    <tr><td style="padding:28px">
      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.4">${escapeHtml(subject)}</h1>
      <div style="font-size:16px;line-height:1.6;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(body)}</div>
    </td></tr>
    <tr><td style="padding:20px 28px;border-top:1px solid #e4e9f0;color:#53647b;font-size:12px;line-height:1.6">${footer}</td></tr>
  </table>
</body>
</html>`,
  };
}