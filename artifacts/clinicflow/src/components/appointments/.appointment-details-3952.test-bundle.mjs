// <stdin>
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ../clinicflow/src/components/appointments/AppointmentDetails.tsx
import { useState as useState5 } from "react";
import { Copy, Check, QrCode } from "lucide-react";

// ../clinicflow/src/lib/date-time.ts
var DATE_FORMATS = ["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];
var TIME_FORMATS = ["12h", "24h"];
var DEFAULT_DATE_TIME_PREFERENCES = { dateFormat: "DD MMM YYYY", timeFormat: "12h" };
var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function resolveDateTimePreferences(value) {
  return {
    dateFormat: DATE_FORMATS.includes(value?.dateFormat) ? value.dateFormat : DEFAULT_DATE_TIME_PREFERENCES.dateFormat,
    timeFormat: TIME_FORMATS.includes(value?.timeFormat) ? value.timeFormat : DEFAULT_DATE_TIME_PREFERENCES.timeFormat
  };
}
function isCanonicalDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  return y >= 1 && m >= 1 && m <= 12 && d >= 1 && d <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}
function isCanonicalTime(value) {
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}
function formatDate(value, preferences) {
  if (!isCanonicalDate(value)) return "Invalid date";
  const [y, m, d] = value.split("-");
  switch (resolveDateTimePreferences(preferences).dateFormat) {
    case "YYYY-MM-DD":
      return value;
    case "DD/MM/YYYY":
      return `${d}/${m}/${y}`;
    case "MM/DD/YYYY":
      return `${m}/${d}/${y}`;
    default:
      return `${d} ${months[Number(m) - 1]} ${y}`;
  }
}
function formatTime(value, preferences) {
  if (!isCanonicalTime(value)) return "Invalid time";
  if (resolveDateTimePreferences(preferences).timeFormat === "24h") return value;
  const [h, m] = value.split(":");
  return `${Number(h) % 12 || 12}:${m} ${Number(h) < 12 ? "AM" : "PM"}`;
}
function formatConfiguredTimestamp(value, timezone, options = {}, preferences) {
  if (typeof value === "string" && (!/T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/i.test(value) || !isCanonicalDate(value.slice(0, 10)))) return "Invalid date";
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "Invalid date";
  if (!timezone) return utcFallback(date, options, preferences);
  try {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const day = formatDate(`${p.year.padStart(4, "0")}-${p.month}-${p.day}`, preferences);
    const time = formatTime(`${p.hour}:${p.minute}`, preferences);
    const onlyTime = (options.hour || options.timeStyle) && !(options.year || options.month || options.day || options.dateStyle);
    const onlyDate = (options.year || options.month || options.day || options.dateStyle) && !(options.hour || options.timeStyle);
    return onlyTime ? time : onlyDate ? day : `${day}, ${time}`;
  } catch {
    return "Invalid timezone";
  }
}
function utcFallback(date, options, preferences) {
  const iso = date.toISOString();
  const day = formatDate(iso.slice(0, 10), preferences);
  const time = `${formatTime(iso.slice(11, 16), preferences)} UTC`;
  const onlyTime = (options.hour || options.timeStyle) && !(options.year || options.month || options.day || options.dateStyle);
  const onlyDate = (options.year || options.month || options.day || options.dateStyle) && !(options.hour || options.timeStyle);
  return onlyTime ? time : onlyDate ? day : `${day}, ${time}`;
}

// fixture:title
var title = (value) => value;
var ErrorNotice = () => null;

// ../clinicflow/src/components/appointments/AppointmentTicket.tsx
import { useEffect as useEffect4, useState as useState4 } from "react";
import { Link as Link2 } from "wouter";
import * as api from "@workspace/api-client-react";

// ../clinicflow/src/components/tickets/VisitTicket.tsx
import { useEffect as useEffect2, useRef as useRef2, useState as useState2 } from "react";
import QRCode from "qrcode";
import { Download, Printer } from "lucide-react";

// ../clinicflow/src/components/IconAction.tsx
import { Link } from "wouter";

// ../clinicflow/src/components/HelpTip.tsx
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";
import { jsx, jsxs } from "react/jsx-runtime";
var DISMISS_TOOLTIPS = "dq:dismiss-tooltips";
function Bubble({ anchor, text, id }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    const place = () => {
      const a = anchor.current, b = ref.current;
      if (!a || !b) return;
      const r = a.getBoundingClientRect(), w = b.offsetWidth, h = b.offsetHeight, m = 8, gap = 6;
      const vw = document.documentElement.clientWidth, vh = window.innerHeight;
      let top = r.top - h - gap;
      if (top < m) top = r.bottom + gap <= vh - h - m ? r.bottom + gap : Math.max(m, Math.min(vh - h - m, r.bottom + gap));
      const left = Math.max(m, Math.min(vw - w - m, r.left + r.width / 2 - w / 2));
      setPos({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor, text]);
  return createPortal(
    /* @__PURE__ */ jsx(
      "span",
      {
        ref,
        role: "tooltip",
        id,
        "aria-hidden": "true",
        className: "helptip-bubble",
        "data-measuring": pos ? void 0 : "",
        style: pos ? { transform: `translate(${Math.round(pos.left)}px, ${Math.round(pos.top)}px)` } : void 0,
        children: text
      }
    ),
    document.body
  );
}
function HelpTip({ text, children, icon, label }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const id = useId();
  const ref = useRef(null);
  const timer = useRef(void 0);
  const close = () => {
    setOpen(false);
    setPinned(false);
  };
  useEffect(() => {
    const dismiss = () => {
      setOpen(false);
      setPinned(false);
    };
    window.addEventListener(DISMISS_TOOLTIPS, dismiss);
    return () => window.removeEventListener(DISMISS_TOOLTIPS, dismiss);
  }, []);
  useEffect(() => {
    if (!open) return;
    const key = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    const down = (e) => {
      if (ref.current && !ref.current.contains(e.target)) close();
    };
    window.addEventListener("keydown", key, true);
    document.addEventListener("pointerdown", down);
    return () => {
      window.removeEventListener("keydown", key, true);
      document.removeEventListener("pointerdown", down);
    };
  }, [open]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const bubble = open ? /* @__PURE__ */ jsx(Bubble, { anchor: ref, text }) : null;
  const hoverProps = { onMouseEnter: () => setOpen(true), onMouseLeave: () => {
    if (!pinned) setOpen(false);
  } };
  if (isValidElement(children)) {
    const child = children;
    const p = child.props;
    const disabled = !!p.disabled || p["aria-disabled"] === true || p["aria-disabled"] === "true";
    const describedBy = [p["aria-describedby"], id].filter(Boolean).join(" ");
    if (disabled) {
      return /* @__PURE__ */ jsxs("span", { className: "helptip helptip-disabled", ref, ...hoverProps, children: [
        /* @__PURE__ */ jsx(
          "span",
          {
            tabIndex: 0,
            className: "helptip-focus",
            "aria-describedby": id,
            "aria-label": text,
            onFocus: () => setOpen(true),
            onBlur: () => {
              if (!pinned) setOpen(false);
            },
            onClick: () => {
              const n = !pinned;
              setPinned(n);
              setOpen(n);
            },
            "data-testid": "helptip-disabled-wrapper",
            children: child
          }
        ),
        /* @__PURE__ */ jsx("span", { id, className: "sr-only-helptip", children: text }),
        bubble
      ] });
    }
    const trigger = cloneElement(child, {
      "aria-describedby": describedBy,
      onMouseEnter: (e) => {
        p.onMouseEnter?.(e);
        setOpen(true);
      },
      onMouseLeave: (e) => {
        p.onMouseLeave?.(e);
        if (!pinned) setOpen(false);
      },
      onFocus: (e) => {
        p.onFocus?.(e);
        setOpen(true);
      },
      onBlur: (e) => {
        p.onBlur?.(e);
        if (!pinned) setOpen(false);
      },
      onPointerDown: (e) => {
        p.onPointerDown?.(e);
        if (e.pointerType === "touch") {
          setOpen(true);
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setOpen(false), 2500);
        }
      }
    });
    return /* @__PURE__ */ jsxs("span", { className: "helptip", ref, children: [
      trigger,
      /* @__PURE__ */ jsx("span", { id, className: "sr-only-helptip", children: text }),
      bubble
    ] });
  }
  return /* @__PURE__ */ jsxs("span", { className: "helptip", ref, ...hoverProps, children: [
    /* @__PURE__ */ jsx(
      "button",
      {
        type: "button",
        className: "helptip-trigger",
        "aria-label": label ?? "Help",
        "aria-describedby": id,
        "aria-expanded": open,
        onFocus: () => setOpen(true),
        onBlur: () => {
          if (!pinned) setOpen(false);
        },
        onClick: () => {
          const n = !pinned;
          setPinned(n);
          setOpen(n);
        },
        "data-testid": "button-help-tip",
        children: children ?? icon ?? /* @__PURE__ */ jsx(HelpCircle, { size: 15, "aria-hidden": "true" })
      }
    ),
    /* @__PURE__ */ jsx("span", { id, className: "sr-only-helptip", children: text }),
    bubble
  ] });
}

// ../clinicflow/src/components/IconAction.tsx
import { jsx as jsx2 } from "react/jsx-runtime";
function IconAction({ label, icon, onClick, href, disabled, disabledReason, testId, tone, className, hint }) {
  const tip = disabled && disabledReason ? `${hint || label}. ${disabledReason}` : hint || label;
  const cls = ["icon-action", tone === "danger" ? "danger" : "", className].filter(Boolean).join(" ");
  if (href && !disabled) return /* @__PURE__ */ jsx2(HelpTip, { text: tip, children: /* @__PURE__ */ jsx2(Link, { href, className: cls, "aria-label": label, "data-testid": testId, children: icon }) });
  return /* @__PURE__ */ jsx2(HelpTip, { text: tip, children: /* @__PURE__ */ jsx2("button", { type: "button", className: cls, "aria-label": label, disabled, onClick, "data-testid": testId, children: icon }) });
}

// ../clinicflow/src/branding.ts
var BRAND_NAME = "DigiQ Doctors";
var BRAND_LOGO_URL = `${"/"}digiq-doctors-logo.png`;

// ../clinicflow/src/components/tickets/ticket-pdf.ts
async function ticketPdfBlob(html) {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import("jspdf"), import("html2canvas")]);
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;left:-10000px;top:0;width:640px;height:1000px;border:0";
  document.body.append(frame);
  try {
    const doc = frame.contentDocument;
    doc.open();
    doc.write(html);
    doc.close();
    await doc.fonts.ready;
    await Promise.all(Array.from(doc.images).map((img) => img.decode()));
    const sections = Array.from(doc.querySelectorAll("body > section"));
    const targets = sections.length ? sections : [doc.body];
    const pdf = new jsPDF({ unit: "mm", format: "a4" });
    for (let index = 0; index < targets.length; index++) {
      const target = targets[index];
      frame.style.height = `${Math.max(1e3, target.scrollHeight + 40)}px`;
      const canvas = await html2canvas(target, { scale: 2, backgroundColor: "#ffffff", logging: false });
      if (!canvas.width || !canvas.height) throw new Error("Ticket could not be rendered.");
      if (index) pdf.addPage();
      const width = Math.min(190, 277 * canvas.width / canvas.height);
      const height = width * canvas.height / canvas.width;
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", (210 - width) / 2, 10, width, height);
    }
    return pdf.output("blob");
  } finally {
    frame.remove();
  }
}
async function downloadTicketPdf(html, filename) {
  const blob = await ticketPdfBlob(html);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename.replace(/\.html$/i, "").replace(/(?:\.pdf)?$/i, ".pdf");
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3e4);
}

// ../clinicflow/src/components/tickets/VisitTicket.tsx
import { Fragment, jsx as jsx3, jsxs as jsxs2 } from "react/jsx-runtime";
var esc = (v) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var sessionRange = (t) => t.startTime || t.endTime ? `${t.startTime ? formatTime(t.startTime, t) : "\u2014"} \u2013 ${t.endTime ? formatTime(t.endTime, t) : "\u2014"}${t.timezone ? ` (${t.timezone})` : ""}` : "Session time set by clinic";
var absoluteUrl = (u) => u.startsWith("/") ? `${window.location.origin}${"/".replace(/\/$/, "")}${u}` : u;
var logoPromise;
function embeddedTicketLogo() {
  if (!logoPromise) logoPromise = fetch(BRAND_LOGO_URL).then(async (response) => {
    if (!response.ok) throw new Error(`Logo request failed (${response.status}).`);
    if (!response.headers.get("content-type")?.toLowerCase().startsWith("image/png")) throw new Error("Logo response is not a PNG image.");
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Logo could not be read."));
      reader.readAsDataURL(blob);
    });
  }).catch(() => {
    logoPromise = void 0;
    throw new Error("DigiQ Doctors logo could not be loaded. Try exporting again.");
  });
  return logoPromise;
}
function ticketHtml(t, qr, logo = BRAND_LOGO_URL) {
  const rows = [["Clinic", t.clinicName], ...t.address ? [["Address", t.address]] : [], ["Doctor", t.doctorName]];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${BRAND_NAME} ticket ${esc(t.reference || "")}</title>
 <style>body{font-family:system-ui,sans-serif;background:#f0f9fd;color:#10274e;margin:0;padding:16px}.t{max-width:560px;margin:auto;background:#fff;border:1px solid #c9e3ed;border-radius:16px;overflow:hidden}.h{background:#edfaff;color:#10274e;padding:4px 18px;border-bottom:1px solid #c9e3ed;display:flex;align-items:center;gap:8px;font-weight:700}.h img{display:block;width:108px;height:54px;object-fit:contain;flex:none}.b{padding:16px 18px}.n{font:700 56px/1 ui-monospace,monospace;color:#087cb7;margin:4px 0 8px}.l{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.7}.visit{border:1px solid #c9e3ed;background:#edfaff;padding:10px 12px;border-radius:9px;margin:8px 0 12px;overflow-wrap:anywhere}.visit strong{display:block;font-size:16px}.visit small{display:block;margin-top:4px}td{padding:2px 12px 2px 0;vertical-align:top}td:first-child{opacity:.65}.f{border-top:2px dashed #c9e3ed;padding:10px 18px;font-size:13px;background:#e9f8fc}.qr{display:block;margin:12px auto 0;width:180px}@media(max-width:420px){.h{flex-wrap:wrap;gap:0 8px}}@media print{body{background:none;padding:0}}</style></head><body><div class="t"><div class="h"><img src="${esc(logo)}" alt="DigiQ Doctors logo"><span>Visit ticket</span></div><div class="b">
<p>Status: <strong>${esc(t.statusLabel || "Booked")}</strong></p><div class="l">Waiting number</div><div class="n">${esc(t.waitingNumber || "\u2014")}</div>${t.reference ? `<div>Reference <strong>${esc(t.reference)}</strong></div>` : ""}
 <h2 style="margin:10px 0 8px;overflow-wrap:anywhere">${esc(t.patientName)}</h2><div class="visit"><span class="l">Date \xB7 Location</span><strong>${esc(formatDate(t.date, t))} \xB7 ${esc(t.branchName)}</strong><small>Session ${esc(sessionRange(t))}</small></div><table style="width:100%;table-layout:fixed;overflow-wrap:anywhere">${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table>
${qr ? `<img class="qr" src="${qr}" alt="Personal visit QR">` : ""}</div><div class="f">Show this ticket at reception. The session time is a range, not an exact consultation time. Keep the QR private.</div></div></body></html>`;
}
function bookingStatusLabel(status) {
  switch (status) {
    case "booked":
    case "waiting":
      return "Booked";
    case "checkedIn":
      return "Checked in";
    case "called":
      return "Called";
    case "inConsultation":
      return "In consultation";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "noShow":
      return "Missed";
    case "skipped":
      return "Skipped";
    default:
      return status ? status.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()) : "Booked";
  }
}
async function qrImage(url) {
  if (!url) throw new Error("Your personal QR is not available yet. Refresh and try again.");
  try {
    return await QRCode.toDataURL(absoluteUrl(url), { width: 320, margin: 1 });
  } catch {
    throw new Error("Your personal QR could not be generated. Try again.");
  }
}
function VisitTicket({ ticket, testId = "visit-ticket", note, prepareExport, exportDisabled }) {
  const [qr, setQr] = useState2(null);
  const [qrError, setQrError] = useState2("");
  const [qrTry, setQrTry] = useState2(0);
  const [err, setErr] = useState2("");
  const [busy, setBusy] = useState2("");
  const lock = useRef2(false);
  useEffect2(() => {
    let live = true;
    setQr(null);
    setQrError("");
    qrImage(ticket.qrUrl).then((v) => {
      if (live) setQr(v);
    }).catch((e) => {
      if (live) setQrError(e.message);
    });
    return () => {
      live = false;
    };
  }, [ticket.qrUrl, qrTry]);
  const file = `clinicflow-ticket-${(ticket.reference || ticket.waitingNumber || "visit").replace(/[^a-z0-9-]/gi, "")}.pdf`;
  async function run(kind) {
    if (lock.current) return;
    lock.current = true;
    setErr("");
    setBusy(kind);
    const w = kind === "print" ? window.open("", "_blank", "width=680,height=820") : null;
    try {
      if (kind === "print" && !w) throw new Error("Allow pop-ups to print this ticket, or use Download.");
      if (w) {
        w.opener = null;
        w.document.body.textContent = "Checking your ticket\u2026";
      }
      const fresh = prepareExport ? await prepareExport() : ticket;
      const image = await qrImage(fresh.qrUrl);
      const html = ticketHtml(fresh, image, await embeddedTicketLogo());
      if (w) {
        if (w.closed) throw new Error("Print window closed. Try again.");
        w.document.open();
        w.document.write(html);
        w.document.close();
        await Promise.all(Array.from(w.document.images).map((img) => img.decode()));
        if (w.closed) throw new Error("Print window closed. Try again.");
        w.focus();
        w.print();
      } else {
        await downloadTicketPdf(html, file);
      }
    } catch (e) {
      w?.close();
      setErr(e instanceof Error ? e.message : "Ticket could not be prepared. Try again.");
    } finally {
      lock.current = false;
      setBusy("");
    }
  }
  const disabled = !!busy || exportDisabled || !qr;
  return /* @__PURE__ */ jsxs2("article", { className: "vt", "data-testid": testId, "aria-label": "Visit ticket", children: [
    /* @__PURE__ */ jsxs2("header", { className: "vt-head", children: [
      /* @__PURE__ */ jsxs2("div", { className: "vt-head-brand", children: [
        /* @__PURE__ */ jsx3("img", { src: BRAND_LOGO_URL, alt: "DigiQ Doctors logo" }),
        /* @__PURE__ */ jsx3("h2", { children: "Visit Ticket" })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "vt-head-tools", children: [
        /* @__PURE__ */ jsx3("span", { className: "vt-badge", "data-testid": "ticket-status", "aria-label": `Booking Status: ${ticket.statusLabel || "Booked"}`, children: ticket.statusLabel || "Booked" }),
        /* @__PURE__ */ jsxs2("div", { className: "vt-actions", role: "group", "aria-label": "Ticket Actions", children: [
          /* @__PURE__ */ jsx3(IconAction, { className: "vt-icon-action", testId: "button-download-ticket", label: busy === "download" ? "Preparing PDF\u2026" : "Download Ticket PDF", icon: /* @__PURE__ */ jsx3(Download, { size: 16, "aria-hidden": true }), onClick: () => void run("download"), disabled, disabledReason: busy ? "Checking the latest ticket first." : !qr ? "Personal QR is still loading." : "Reconnect and refresh the ticket first." }),
          /* @__PURE__ */ jsx3(IconAction, { className: "vt-icon-action", testId: "button-print-ticket", label: busy === "print" ? "Checking Ticket\u2026" : "Print Ticket", icon: /* @__PURE__ */ jsx3(Printer, { size: 16, "aria-hidden": true }), onClick: () => void run("print"), disabled, disabledReason: busy ? "Checking the latest ticket first." : !qr ? "Personal QR is still loading." : "Reconnect and refresh the ticket first." })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ jsxs2("div", { className: "vt-body", children: [
      /* @__PURE__ */ jsxs2("div", { className: "vt-info", children: [
        /* @__PURE__ */ jsxs2("div", { className: "vt-main", children: [
          /* @__PURE__ */ jsx3("p", { className: "vt-number-label", children: "Waiting Number" }),
          /* @__PURE__ */ jsx3("p", { className: "vt-number", "data-testid": "ticket-waiting-number", children: ticket.waitingNumber || "\u2014" }),
          ticket.reference && /* @__PURE__ */ jsxs2("p", { className: "vt-ref", "data-testid": "ticket-reference", children: [
            "Ref ",
            ticket.reference
          ] }),
          /* @__PURE__ */ jsx3("p", { className: "vt-name", "data-testid": "ticket-patient-name", children: ticket.patientName })
        ] }),
        /* @__PURE__ */ jsxs2("div", { className: "vt-facts", children: [
          /* @__PURE__ */ jsxs2("div", { className: "vt-visit", children: [
            /* @__PURE__ */ jsx3("small", { children: "Date \xB7 Location" }),
            /* @__PURE__ */ jsxs2("strong", { children: [
              formatDate(ticket.date, ticket),
              " \xB7 ",
              ticket.branchName
            ] }),
            /* @__PURE__ */ jsxs2("span", { children: [
              "Session ",
              sessionRange(ticket)
            ] })
          ] }),
          /* @__PURE__ */ jsxs2("dl", { className: "vt-dl", children: [
            /* @__PURE__ */ jsx3("dt", { children: "Clinic" }),
            /* @__PURE__ */ jsx3("dd", { children: ticket.clinicName }),
            ticket.address && /* @__PURE__ */ jsxs2(Fragment, { children: [
              /* @__PURE__ */ jsx3("dt", { children: "Address" }),
              /* @__PURE__ */ jsx3("dd", { children: ticket.address })
            ] }),
            /* @__PURE__ */ jsx3("dt", { children: "Doctor" }),
            /* @__PURE__ */ jsx3("dd", { children: ticket.doctorName })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs2("div", { className: "vt-qr", children: [
        qr ? /* @__PURE__ */ jsx3("img", { src: qr, alt: "Personal visit QR" }) : qrError ? /* @__PURE__ */ jsxs2("div", { role: "alert", style: { width: 160 }, children: [
          /* @__PURE__ */ jsx3("p", { style: { margin: "0 0 8px" }, children: qrError }),
          /* @__PURE__ */ jsx3("button", { type: "button", className: "button secondary", "data-testid": "button-retry-ticket-qr", onClick: () => setQrTry((n) => n + 1), children: "Retry QR" })
        ] }) : /* @__PURE__ */ jsx3("div", { style: { width: 160, height: 160 }, role: "status", "aria-label": "Loading QR" }),
        /* @__PURE__ */ jsx3("small", { children: "Personal QR for reception. Keep it private." })
      ] })
    ] }),
    /* @__PURE__ */ jsxs2("footer", { className: "vt-foot", children: [
      /* @__PURE__ */ jsx3("p", { children: note || "Show this ticket at reception. The session is a time range, not an exact consultation time." }),
      err && /* @__PURE__ */ jsx3("p", { role: "alert", "data-testid": "ticket-export-error", children: err })
    ] })
  ] });
}

// ../clinicflow/src/components/queue/useFreshWorkspace.ts
import { useEffect as useEffect3, useState as useState3 } from "react";
function useFreshWorkspace(updatedAt, failed = false) {
  const [now, setNow] = useState3(Date.now());
  const [online, setOnline] = useState3(navigator.onLine);
  useEffect3(() => {
    const update = () => {
      setOnline(navigator.onLine);
      setNow(Date.now());
    };
    const interval = window.setInterval(update, 1e4);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      clearInterval(interval);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return { online, stale: !online || failed || !updatedAt || now - updatedAt > 9e4 };
}

// ../clinicflow/src/components/appointments/confirmation-email.ts
function confirmationEmailMessage(outcome) {
  if (outcome === "provider_accepted") return "Confirmation email accepted for sending. Inbox delivery is not guaranteed.";
  if (outcome === "unavailable" || outcome === "not_attempted") return "Booking confirmed. Confirmation email could not be confirmed; keep your ticket.";
  if (outcome === "no_recipient") return "Booking confirmed. No email recipient was available; keep your ticket.";
  if (outcome === "disabled") return "Booking confirmed. Email notifications are disabled; keep your ticket.";
  return null;
}

// ../clinicflow/src/components/appointments/AppointmentTicket.tsx
import { Fragment as Fragment2, jsx as jsx4, jsxs as jsxs3 } from "react/jsx-runtime";
var statusLabel = (status) => status === "called" ? "Called next" : ["booked", "checkedIn", "waiting"].includes(status) ? "Waiting" : title(status);
function AppointmentTicket({ id }) {
  const appointment = api.useGetAppointment(id, { query: { queryKey: api.getGetAppointmentQueryKey(id), refetchInterval: 3e4 } });
  const me = api.useGetMe();
  const a = appointment.data;
  const params = { doctorId: a?.doctorId || "", branchId: a?.branchId || "", date: a?.date || "", sessionId: a?.sessionId || void 0, startTime: a?.startTime, appointmentId: id };
  const queue = api.useGetQueue(params, { query: { queryKey: api.getGetQueueQueryKey(params), enabled: !!a, refetchInterval: 3e4 } });
  const qr = api.useGetAppointmentQr(id, { query: { queryKey: api.getGetAppointmentQrQueryKey(id) } });
  const freshness = useFreshWorkspace(appointment.dataUpdatedAt, !!appointment.error);
  const [online, setOnline] = useState4(navigator.onLine);
  useEffect4(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  const role = me.data?.user?.role;
  const root = role === "superAdmin" || role === "clinicAdmin" ? "admin" : role;
  const patientLiveUrl = `${window.location.origin}${"/".replace(/\/$/, "")}/patient/queue?appointment=${encodeURIComponent(id)}`;
  async function prepareExport() {
    if (freshness.stale || !navigator.onLine) throw new Error("Ticket is offline or stale. Reconnect and refresh first.");
    const fresh = await api.getAppointment(id);
    const code = await api.getAppointmentQr(id);
    const confirmed = await api.getAppointment(id);
    if (!navigator.onLine) throw new Error("Connection lost. Reconnect and try again.");
    if (fresh.revision !== confirmed.revision || fresh.status !== confirmed.status) throw new Error("Appointment changed while preparing the ticket. Refresh and try again.");
    if (!code.checkInUrl) throw new Error("Personal QR unavailable. Refresh and try again.");
    void appointment.refetch();
    return { dateFormat: confirmed.dateFormat, timeFormat: confirmed.timeFormat, patientName: confirmed.patientName, clinicName: confirmed.clinicName, branchName: confirmed.branchName, address: confirmed.branchAddress, doctorName: confirmed.doctorName, date: confirmed.date, startTime: confirmed.startTime, endTime: confirmed.endTime, timezone: confirmed.timezone, waitingNumber: confirmed.token, reference: confirmed.reference, statusLabel: bookingStatusLabel(confirmed.status), qrUrl: code.checkInUrl };
  }
  const estimate = queue.error || !online ? /* @__PURE__ */ jsxs3("p", { role: "alert", className: "span-2", children: [
    "Booking status updates unavailable or offline. No estimate is shown. ",
    /* @__PURE__ */ jsx4("button", { onClick: () => queue.refetch(), children: "Retry" })
  ] }) : queue.isLoading ? /* @__PURE__ */ jsx4("p", { role: "status", children: "Loading booking status\u2026" }) : queue.data?.ownEntry ? /* @__PURE__ */ jsxs3("p", { className: "notice", "data-testid": "text-ticket-estimate", children: [
    queue.data.ownEntry.patientsAhead,
    " patients ahead \xB7 Approx. wait ",
    queue.data.ownEntry.estimatedWaitMinutes == null ? "unavailable \u2014 duration not configured" : `${queue.data.ownEntry.estimatedWaitMinutes} minutes`,
    /* @__PURE__ */ jsx4("br", {}),
    /* @__PURE__ */ jsx4("small", { children: "An estimate only, not a countdown or appointment time. Breaks and delays may extend the wait." })
  ] }) : null;
  return /* @__PURE__ */ jsxs3("div", { className: "appt-ticket", children: [
    /* @__PURE__ */ jsx4(ErrorNotice, { error: appointment.error }),
    appointment.error && /* @__PURE__ */ jsx4("button", { onClick: () => appointment.refetch(), children: "Refresh Ticket" }),
    !a ? /* @__PURE__ */ jsx4("p", { role: "status", children: "Loading ticket\u2026" }) : /* @__PURE__ */ jsxs3(Fragment2, { children: [
      (() => {
        const message = confirmationEmailMessage(a.confirmationEmail);
        const delivery = message?.replace(/^Booking confirmed\.\s*/, "");
        const heading = ["booked", "waiting", "checkedIn", "called", "inConsultation"].includes(a.status) ? "Booking Confirmed" : a.status === "completed" ? "Visit Completed" : `Booking ${bookingStatusLabel(a.status)}`;
        return /* @__PURE__ */ jsxs3("div", { className: "appt-ticket-confirmation", role: "status", "data-testid": "text-ticket-confirmation", children: [
          /* @__PURE__ */ jsx4("strong", { children: heading }),
          root && /* @__PURE__ */ jsx4(Link2, { className: "text-link appt-ticket-status-link", href: `/${root}/queue?appointment=${encodeURIComponent(id)}`, "data-testid": "link-ticket-open-status", children: "Open Booking Status" }),
          delivery && /* @__PURE__ */ jsx4("p", { className: "appt-ticket-delivery", "data-testid": "text-ticket-delivery", children: delivery })
        ] });
      })(),
      /* @__PURE__ */ jsx4(VisitTicket, { testId: "appointment-ticket", ticket: { dateFormat: a.dateFormat, timeFormat: a.timeFormat, patientName: a.patientName, clinicName: a.clinicName, branchName: a.branchName, address: a.branchAddress, doctorName: a.doctorName, date: a.date, startTime: a.startTime, endTime: a.endTime, timezone: a.timezone, waitingNumber: a.token, reference: a.reference, statusLabel: bookingStatusLabel(a.status), qrUrl: qr.data?.checkInUrl }, prepareExport, exportDisabled: freshness.stale || !online || appointment.isFetching || !!appointment.error }),
      qr.error && /* @__PURE__ */ jsxs3(Fragment2, { children: [
        /* @__PURE__ */ jsx4(ErrorNotice, { error: qr.error }),
        /* @__PURE__ */ jsx4("button", { onClick: () => qr.refetch(), "data-testid": "button-retry-appointment-qr", children: "Retry QR" })
      ] }),
      /* @__PURE__ */ jsx4(ErrorNotice, { error: queue.error }),
      /* @__PURE__ */ jsxs3("div", { className: "appt-ticket-info", "data-testid": "ticket-information", children: [
        /* @__PURE__ */ jsxs3("p", { className: "span-2 appt-ticket-live", "data-testid": "text-ticket-booking-status", children: [
          /* @__PURE__ */ jsx4("span", { children: "Booking status (sign in with the account that owns this booking):" }),
          " ",
          /* @__PURE__ */ jsx4("a", { className: "text-link", "data-testid": "link-ticket-patient-live", href: patientLiveUrl, title: patientLiveUrl, children: "Patient Booking Status Page" })
        ] }),
        !queue.error && online && queue.data?.presence && /* @__PURE__ */ jsxs3("p", { className: "notice", "data-testid": "text-ticket-doctor-status", children: [
          "Doctor status: ",
          queue.data.presence.status === "onBreak" ? "On break" : queue.data.presence.status === "away" ? "Away" : "Available",
          queue.data.presence.status !== "available" && " \xB7 Calling is paused; your booking is kept."
        ] }),
        estimate,
        (root || !!a.history?.length) && /* @__PURE__ */ jsx4("div", { className: "appt-ticket-links span-2", children: !!a.history?.length && /* @__PURE__ */ jsxs3("details", { children: [
          /* @__PURE__ */ jsx4("summary", { children: "Appointment History" }),
          /* @__PURE__ */ jsx4("ul", { children: a.history.map((event, index) => /* @__PURE__ */ jsxs3("li", { children: [
            new Date(event.occurredAt).toLocaleString(),
            " \xB7 ",
            statusLabel(event.status),
            event.reason && ` \xB7 ${event.reason}`
          ] }, index)) })
        ] }) }),
        freshness.stale && /* @__PURE__ */ jsxs3("p", { role: "alert", className: "span-2", children: [
          "Ticket is offline or stale. Reconnect and refresh before printing. ",
          /* @__PURE__ */ jsx4("button", { disabled: !online, onClick: () => appointment.refetch(), children: "Refresh Ticket" })
        ] }),
        /* @__PURE__ */ jsxs3("div", { className: "appt-ticket-guidance span-2", children: [
          /* @__PURE__ */ jsx4("p", { "data-testid": "text-ticket-qr-warning", children: "QR is for authorized staff validation, not public access to patient details. Staff check you in when your consultation begins." }),
          /* @__PURE__ */ jsx4("p", { "data-testid": "text-ticket-refresh-notice", children: "Status refreshes every 30 seconds while connected. Printed tickets do not update." })
        ] })
      ] })
    ] })
  ] });
}

// ../clinicflow/src/components/appointments/presentation.ts
function canShowAppointmentTicket(appointment) {
  return appointment.status !== "completed";
}

// ../clinicflow/src/components/appointments/AppointmentDetails.tsx
import { jsx as jsx5, jsxs as jsxs4 } from "react/jsx-runtime";
var statusText = (status) => status === "called" ? "Called next" : title(status);
function AppointmentDetails({ appointment: a }) {
  const timestamp = (value) => formatConfiguredTimestamp(value, a.timezone || void 0, {}, a);
  const [copied, setCopied] = useState5("");
  const copyReference = () => {
    if (!navigator.clipboard) {
      setCopied("failed");
      return;
    }
    navigator.clipboard.writeText(a.reference).then(() => setCopied("done"), () => setCopied("failed"));
  };
  const session = `${a.startTime ? formatTime(a.startTime, a) : "\u2014"}\u2013${a.endTime ? formatTime(a.endTime, a) : "\u2014"}`;
  const [ticketOpen, setTicketOpen] = useState5(false);
  return /* @__PURE__ */ jsxs4("section", { "aria-label": "Appointment details", className: "appt-detail", "data-testid": "appointment-details", children: [
    /* @__PURE__ */ jsxs4("header", { className: "appt-detail-summary", children: [
      /* @__PURE__ */ jsxs4("div", { children: [
        /* @__PURE__ */ jsx5("h3", { "data-testid": "text-detail-patient", children: a.patientName }),
        /* @__PURE__ */ jsxs4("div", { className: "appt-detail-status", children: [
          /* @__PURE__ */ jsx5("span", { children: "Current status" }),
          /* @__PURE__ */ jsx5("span", { className: `badge ${a.status}`, "data-testid": "text-detail-status", children: statusText(a.status) })
        ] })
      ] }),
      /* @__PURE__ */ jsxs4("div", { className: "appt-detail-token", "data-testid": "text-detail-token", children: [
        /* @__PURE__ */ jsx5("small", { children: "Token" }),
        /* @__PURE__ */ jsx5("strong", { children: a.token || "Not assigned" })
      ] })
    ] }),
    /* @__PURE__ */ jsxs4("div", { className: "appt-detail-cols", children: [
      /* @__PURE__ */ jsxs4("div", { className: "appt-detail-block", "data-testid": "section-detail-patient", children: [
        /* @__PURE__ */ jsx5("h4", { children: "Patient" }),
        /* @__PURE__ */ jsxs4("dl", { className: "appt-detail-grid", children: [
          /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsx5("dt", { children: "Name" }),
            /* @__PURE__ */ jsx5("dd", { children: a.patientName })
          ] }),
          /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsx5("dt", { children: "Patient ID" }),
            /* @__PURE__ */ jsx5("dd", { className: "mono", "data-testid": "text-detail-patient-code", children: a.patientCode || "Not recorded" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs4("div", { className: "appt-detail-block", "data-testid": "section-detail-visit", children: [
        /* @__PURE__ */ jsx5("h4", { children: "Visit" }),
        /* @__PURE__ */ jsxs4("dl", { className: "appt-detail-grid", children: [
          /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsx5("dt", { children: "Visit date" }),
            /* @__PURE__ */ jsx5("dd", { "data-testid": "text-detail-date", children: formatDate(a.date, a) })
          ] }),
          /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsx5("dt", { children: "Session" }),
            /* @__PURE__ */ jsxs4("dd", { "data-testid": "text-detail-session", children: [
              session,
              a.timezone ? ` \xB7 ${a.timezone}` : "",
              /* @__PURE__ */ jsx5("small", { children: "Session window, not a promised consultation time." })
            ] })
          ] }),
          /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsx5("dt", { children: "Clinic group" }),
            /* @__PURE__ */ jsx5("dd", { "data-testid": "text-detail-clinic", children: a.clinicName })
          ] }),
          /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsx5("dt", { children: "Location" }),
            /* @__PURE__ */ jsxs4("dd", { "data-testid": "text-detail-location", children: [
              a.branchName,
              a.branchAddress && /* @__PURE__ */ jsx5("small", { children: a.branchAddress })
            ] })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsxs4("div", { className: "appt-detail-block", "data-testid": "section-detail-provider", children: [
        /* @__PURE__ */ jsx5("h4", { children: "Provider" }),
        /* @__PURE__ */ jsx5("dl", { className: "appt-detail-grid", children: /* @__PURE__ */ jsxs4("div", { className: "span-2", children: [
          /* @__PURE__ */ jsx5("dt", { children: "Doctor" }),
          /* @__PURE__ */ jsx5("dd", { "data-testid": "text-detail-doctor", children: a.doctorName })
        ] }) })
      ] }),
      /* @__PURE__ */ jsxs4("div", { className: "appt-detail-block", "data-testid": "section-detail-booking", children: [
        /* @__PURE__ */ jsx5("h4", { children: "Booking" }),
        /* @__PURE__ */ jsxs4("dl", { className: "appt-detail-grid", children: [
          /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsx5("dt", { children: "Reference" }),
            /* @__PURE__ */ jsxs4("dd", { className: "appt-detail-ref", children: [
              /* @__PURE__ */ jsx5("code", { "data-testid": "text-detail-reference", children: a.reference }),
              /* @__PURE__ */ jsxs4("button", { type: "button", onClick: copyReference, "aria-label": `Copy reference ${a.reference}`, "data-testid": "button-copy-reference", children: [
                copied === "done" ? /* @__PURE__ */ jsx5(Check, { size: 13, "aria-hidden": true }) : /* @__PURE__ */ jsx5(Copy, { size: 13, "aria-hidden": true }),
                copied === "done" ? "Copied" : "Copy"
              ] }),
              canShowAppointmentTicket(a) && /* @__PURE__ */ jsxs4("button", { type: "button", className: "appt-detail-jump", "aria-expanded": ticketOpen, "aria-controls": `appt-ticket-${a.id}`, onClick: () => setTicketOpen((v) => !v), "data-testid": "button-detail-jump-ticket", children: [
                /* @__PURE__ */ jsx5(QrCode, { size: 13, "aria-hidden": true }),
                ticketOpen ? "Hide Ticket & QR" : "Ticket & QR"
              ] }),
              copied === "failed" && /* @__PURE__ */ jsx5("small", { role: "alert", children: "Copy unavailable. Select the reference to copy it." })
            ] })
          ] }),
          /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsx5("dt", { children: "Booked at" }),
            /* @__PURE__ */ jsxs4("dd", { "data-testid": "text-detail-booked", children: [
              timestamp(a.createdAt),
              /* @__PURE__ */ jsx5("small", { children: "When the booking was created, not the visit time." })
            ] })
          ] }),
          /* @__PURE__ */ jsxs4("div", { className: "span-2", children: [
            /* @__PURE__ */ jsx5("dt", { children: "Notes" }),
            /* @__PURE__ */ jsx5("dd", { children: /* @__PURE__ */ jsx5("p", { className: `appt-detail-notes${a.notes?.trim() ? "" : " appt-detail-empty"}`, "data-testid": "text-detail-notes", children: a.notes?.trim() || "No notes recorded." }) })
          ] })
        ] })
      ] }),
      (ticketOpen || !canShowAppointmentTicket(a)) && /* @__PURE__ */ jsxs4("div", { className: "appt-detail-block appt-detail-ticket span-2", style: { gridColumn: "1/-1" }, id: `appt-ticket-${a.id}`, "data-testid": "section-detail-ticket", children: [
        /* @__PURE__ */ jsx5("h4", { children: "Ticket & QR" }),
        canShowAppointmentTicket(a) ? /* @__PURE__ */ jsx5(AppointmentTicket, { id: a.id }) : /* @__PURE__ */ jsx5("p", { className: "appt-detail-empty", "data-testid": "text-detail-ticket-unavailable", children: "Completed visits do not need a ticket. The booking reference above remains available for records." })
      ] }),
      /* @__PURE__ */ jsxs4("div", { className: "appt-detail-block", children: [
        /* @__PURE__ */ jsx5("h4", { children: "Consultation" }),
        /* @__PURE__ */ jsxs4("dl", { className: "appt-detail-grid", children: [
          /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsx5("dt", { children: "Consultation check-in" }),
            /* @__PURE__ */ jsx5("dd", { "data-testid": "text-detail-checked-in", children: a.checkedInAt ? timestamp(a.checkedInAt) : "Not recorded" })
          ] }),
          /* @__PURE__ */ jsxs4("div", { children: [
            /* @__PURE__ */ jsx5("dt", { children: "Consultation completed" }),
            /* @__PURE__ */ jsx5("dd", { "data-testid": "text-detail-completed", children: a.completedAt ? timestamp(a.completedAt) : "Not recorded" })
          ] })
        ] }),
        /* @__PURE__ */ jsx5("p", { className: "muted", style: { marginTop: 8, fontSize: "var(--type-label)" }, children: "Consultation check-in records entry into consultation, not arrival at the clinic." })
      ] }),
      /* @__PURE__ */ jsxs4("div", { className: "appt-detail-block", children: [
        /* @__PURE__ */ jsx5("h4", { children: "Status and Reason History" }),
        a.history?.length ? /* @__PURE__ */ jsx5("ol", { className: "appt-detail-history", children: a.history.map((event, index) => /* @__PURE__ */ jsxs4("li", { children: [
          /* @__PURE__ */ jsx5("strong", { children: title(event.action || event.status) }),
          " \xB7 ",
          timestamp(event.occurredAt),
          event.reason && /* @__PURE__ */ jsx5("p", { children: event.reason })
        ] }, `${event.occurredAt}-${index}`)) }) : /* @__PURE__ */ jsx5("p", { className: "appt-detail-empty", children: "No history recorded." })
      ] })
    ] })
  ] });
}

// <stdin>
var render = (appointment) => renderToStaticMarkup(createElement(AppointmentDetails, { appointment }));
export {
  render,
  sessionRange,
  ticketHtml
};
