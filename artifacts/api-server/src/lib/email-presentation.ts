/** Email-only presentation. Callers retain ownership of wording, values and delivery. */
export const emailBrand = "DigiQ Doctors";
export const automatedFooter = "This is an automated message from DigiQ Doctors. Please do not reply to this email.";
export const escapeEmailHtml = (value: string) => value.replace(/[&<>"']/g, c =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const ink = "#101d42";
export const emailText = (value: string) => escapeEmailHtml(value).replace(/\r?\n/g, "<br>");

export function safeEmailUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function emailAction(value: string, label: string) {
  const url = safeEmailUrl(value);
  if (!url) return emailText(value);
  return `<div style="margin:16px 0"><a href="${escapeEmailHtml(url)}" style="display:inline-block;padding:12px 22px;border-radius:7px;background:#0969da;color:#ffffff;font-weight:bold;text-decoration:none">${escapeEmailHtml(label)}</a><div style="margin-top:10px;font-size:12px;line-height:1.6">Or use this link:<br><a href="${escapeEmailHtml(url)}" style="color:#0969da;word-break:break-all">${escapeEmailHtml(value)}</a></div></div>`;
}

export function emailCard(content: string, label?: string) {
  return `<div style="margin:16px 0;padding:18px;background:#f7f9fc;border:1px solid #dfe7f1;border-radius:10px;overflow-wrap:anywhere;word-break:break-word">${label ? `<div style="font-size:12px;letter-spacing:1px;color:#53647b;font-weight:bold;margin-bottom:12px">${escapeEmailHtml(label)}</div>` : ""}${content}</div>`;
}

export type EmailVisit = {
  introduction: string; clinic: string; location: string; doctor: string; date: string;
  start: string; end: string; timezone: string; reference: string; token: string; contact: string; closing: string;
};
export type EmailContext = { event?: string; visit?: EmailVisit };

export function visitEmailCard(visit: EmailVisit, source: string) {
  const row = (label: string, value: string) => value ? `<tr><td style="padding:10px 8px 10px 0;width:30%;vertical-align:top;color:#596780;font-size:13px">${label}</td><td style="padding:10px 0;border-bottom:1px solid #e4eaf2;font-weight:bold;overflow-wrap:anywhere;word-break:break-word">${emailText(value)}</td></tr>` : "";
  // Explicit template fields stay in their authored positions rather than being
  // repeated inside the composite summary. Never infer the doctor from the summary.
  return emailCard(`<div style="margin-bottom:10px">${emailText(visit.introduction)}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="table-layout:fixed;border-collapse:collapse">
${row("Clinic", visit.clinic)}${row("Location", visit.location)}${row("Doctor", visit.doctor)}${row("Date", visit.date)}${row("Session", `${visit.start}–${visit.end} (${visit.timezone})`)}${/\{\{\s*reference\s*\}\}/.test(source) ? "" : row("Reference", visit.reference)}${row("Token", visit.token)}${/\{\{\s*clinic_contact\s*\}\}/.test(source) && visit.contact !== "Contact reception at the clinic" ? "" : row("Clinic contact", visit.contact)}
</table><div style="margin-top:16px;padding:12px;border-left:3px solid #0969da;background:#eef6ff;font-size:13px;line-height:1.7">${emailText(visit.closing)}</div>`);
}

export function otpEmailPanel(code: string, expiry?: string, punctuation = "") {
  // Adjacent spans have no intervening whitespace: selection copies one intact
  // code, including leading zeros. Assistive technology gets one accessible label.
  const cells = [...code].map(digit => `<span aria-hidden="true" style="display:inline-block;box-sizing:border-box;width:12%;max-width:54px;margin:0 1%;padding:14px 0;border:1px solid #d4e2f1;border-radius:7px;background:#ffffff;color:#0969da;font-size:28px;font-weight:bold;line-height:1.2;text-align:center">${escapeEmailHtml(digit)}</span>`).join("");
  return `<div style="margin:22px 0;padding:22px 8px;text-align:center;background:#eff7ff;border-radius:12px"><div style="font-size:12px;letter-spacing:2px;color:#596780;margin-bottom:16px;font-weight:bold">YOUR OTP</div><div role="text" aria-label="Verification code ${escapeEmailHtml(code)}" style="display:inline-block;width:94%;white-space:nowrap;user-select:all">${cells}</div>${punctuation ? `<span style="font-size:13px;user-select:none">${escapeEmailHtml(punctuation)}</span>` : ""}${expiry && /^\d+$/.test(expiry) && Number(expiry) > 0 ? `<div style="margin-top:16px;font-size:14px;color:#53647b">Valid for <strong>${escapeEmailHtml(expiry)} minutes</strong></div>` : ""}</div>`;
}

export function emailShell(subject: string, bodyHtml: string, options: {
  label?: string; logoUrl?: string; logoAlt?: string; footerHtml?: string; helpHtml?: string; security?: boolean;
} = {}) {
  const logo = options.logoUrl && (options.logoUrl === "cid:clinic-logo" || safeEmailUrl(options.logoUrl));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeEmailHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f2f5f9;color:${ink};font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f2f5f9"><tr><td align="center" style="padding:20px 8px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;table-layout:fixed;background:#ffffff;border:1px solid #e0e7f0;border-radius:10px">
<tr><td style="padding:24px 22px;border-bottom:1px solid #dfe7f1">
${logo ? `<img src="${escapeEmailHtml(options.logoUrl!)}" alt="${escapeEmailHtml(options.logoAlt || "Clinic logo")}" width="160" style="max-width:100%;height:auto;max-height:80px;object-fit:contain"><br>` : ""}
<div style="font-size:25px;font-weight:bold;color:#0c173d">${emailBrand}</div><div style="font-size:12px;color:#596780;margin-top:5px">Care. Plan. Care Together.</div>
${options.label ? `<div style="margin-top:16px;font-size:11px;font-weight:bold;letter-spacing:1.5px;color:#596780;text-transform:uppercase">${escapeEmailHtml(options.label)}</div>` : ""}</td></tr>
<tr><td style="padding:26px 22px;overflow-wrap:anywhere;word-break:break-word"><h1 style="margin:0 0 20px;font-size:26px;line-height:1.3;color:${ink}">${escapeEmailHtml(subject)}</h1>
<div style="font-size:15px;line-height:1.75;overflow-wrap:anywhere;word-break:break-word">${bodyHtml}</div>
${options.security ? `<div style="margin-top:22px;padding:16px;background:#f7faff;border-radius:8px"><span aria-hidden="true" style="display:inline-block;border:2px solid #0969da;border-radius:8px 8px 14px 14px;padding:2px 8px;color:#0969da">&#10003;</span> <strong style="font-size:14px">For your security</strong><div style="margin-top:8px;font-size:13px;color:#53647b">Do not share this code.</div></div>` : ""}
${options.helpHtml ? `<div style="margin-top:24px;padding-top:20px;border-top:1px solid #dfe7f1;font-size:13px"><strong>Need help?</strong><div style="margin-top:6px">${options.helpHtml}</div></div>` : ""}
</td></tr>
<tr><td style="padding:20px 22px;background:#f4f6fb;border-top:1px solid #e4e9f0;color:#596780;font-size:12px;line-height:1.7;overflow-wrap:anywhere;word-break:break-word"><strong style="color:${ink};font-size:16px">${emailBrand}</strong><br>Care. Plan. Care Together.<br><br>${options.footerHtml ?? automatedFooter}</td></tr>
</table></td></tr></table></body></html>`;
}
