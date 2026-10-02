import { useEffect, useState } from "react";
import { Link } from "wouter";
import QRCode from "qrcode";
import { csrfToken } from "../lib/csrf";
import { BRAND_NAME } from "../branding";
import { useConfirm } from "./ConfirmDialog";
import { friendlyError } from "../lib/friendly-error";

type DemoStatus = {
  configured: boolean;
  enabled: boolean;
  clinicName?: string;
  clinicSlug?: string;
  branchSlug?: string;
  doctorName?: string;
  loginPath?: string;
  bookingPath?: string;
  clinicPath?: string;
  password?: string;
  username?: string;
};

const root = import.meta.env.BASE_URL.replace(/\/$/, "");
const endpoint = `${root}/api/demo/setup`;

async function jsonRequest(url: string, options: RequestInit): Promise<DemoStatus> {
  const response = await fetch(url, {
    ...options, credentials: "include", cache: "no-store",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.method && options.method !== "GET" ? { "X-CSRF-Token": await csrfToken() } : {}) },
  });
  const payload = await response.json() as DemoStatus & { error?: string; message?: string };
  if (!response.ok) throw new Error(payload.message || payload.error || "Demo setup failed. Try again.");
  return payload;
}

export function DemoClinicManagement() {
  const [status, setStatus] = useState<DemoStatus | null>(null);
  const [credentials, setCredentials] = useState<{ username: string; password: string } | null>(null);
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setError("");
    void jsonRequest(endpoint, {}).then(data => {
      if (active) setStatus(data);
    }).catch(caught => { if (active) setError(friendlyError(caught, "load", "Unable to load demo setup.")); });
    return () => { active = false; };
  }, [revision]);
  const absolute = (path?: string) => path ? new URL(`${root}${path.startsWith("/") ? path : `/${path}`}`, window.location.origin).href : "";
  const clinicUrl = absolute(status?.clinicPath);
  const bookingUrl = absolute(status?.bookingPath);
  const loginUrl = absolute(status?.loginPath);
  useEffect(() => {
    let active = true;
    setQr("");
    if (bookingUrl) void QRCode.toDataURL(bookingUrl, { width: 720, margin: 3 }).then(image => { if (active) setQr(image); }).catch(() => {
      if (active) setError("Could not generate the demo QR image. The booking link is still available.");
    });
    return () => { active = false; };
  }, [bookingUrl]);

  const confirmDialog = useConfirm();

  async function change(action: "create" | "enable" | "disable" | "rotate-password") {
    if (busy) return;
    if (action === "create" && !(await confirmDialog.ask({
      title: "Create demo clinic?",
      description: "Create a fictional demo clinic, location, doctor, schedule and staff identity on this environment?",
      confirmLabel: "Create demo clinic",
    }))) return;
    if (action === "rotate-password" && !(await confirmDialog.ask({
      title: "Rotate demo password?",
      description: "Rotate the demo password? The previous shared password will stop working.",
      confirmLabel: "Rotate password",
      tone: "danger",
    }))) return;
    setBusy(true); setError(""); setNotice(""); setCredentials(null);
    try {
      const data = await jsonRequest(endpoint, {
        method: action === "create" ? "POST" : "PATCH",
        ...(action !== "create" ? { body: JSON.stringify({ action }) } : {}),
      });
      setStatus(data);
      if (data.password) setCredentials({ username: data.username || "clinicflow-demo", password: data.password });
      setNotice(action === "create" ? "Demo clinic created on this environment. Save the password below now; it is shown only once." : action === "rotate-password" ? "Demo password rotated. Save the new password now; it is shown only once." : `Demo access ${action === "enable" ? "enabled" : "disabled"}.`);
      setRevision(value => value + 1);
    } catch (caught) {
      setError(friendlyError(caught, "generic", "Demo action failed. Try again."));
    } finally {
      setBusy(false);
    }
  }

  function download(filename: string, contents: string, type: string) {
    const blob = new Blob([contents], { type });
    const href = URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = href;
    element.download = filename;
    element.click();
    window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  const forward = `Try ${BRAND_NAME}' fictional demo clinic (please do not enter real patient information).\nClinic: ${clinicUrl}\nGuest booking: ${bookingUrl}\nYou can scan the booking QR on the clinic page or open the booking link directly. Guest booking requires no login and issues a ticket immediately.`;
  return <>{confirmDialog.dialog}<div className="panel padded" data-testid="demo-management">
    <span className="eyebrow">SUPER ADMIN ONLY · FICTIONAL DEMO</span>
    <h2>Published demo clinic</h2>
    <p>Setup applies only to the environment shown in your address bar. Preview and published accounts and clinics are separate. Never enter real patient details into the demo.</p>
    {error && <div className="error-box" role="alert">{error}<button onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    {!status && !error && <p role="status">Checking demo setup…</p>}
    {status && !status.configured && <button className="button" disabled={busy} onClick={() => void change("create")} data-testid="button-create-demo">Create demo clinic</button>}
    {status?.configured && <>
      <p><strong>{status.clinicName}</strong> · {status.doctorName} · {status.enabled ? "Demo access enabled" : "Demo access disabled"}</p>
      <div className="form-footer">
        <button className="button secondary" disabled={busy} onClick={() => void change(status.enabled ? "disable" : "enable")} data-testid="button-toggle-demo">{status.enabled ? "Disable demo access" : "Enable demo access"}</button>
        <button className="button secondary" disabled={busy} onClick={() => void change("rotate-password")} data-testid="button-rotate-demo-password">Rotate demo password</button>
      </div>
      {credentials && <section className="notice" aria-label="One-time demo credentials">
        <h3>Save these credentials now</h3><p>The password is shown only once. Share it privately, separately from the public clinic link.</p>
        <p>Username: <strong>{credentials.username}</strong></p>
        <p>Password: <strong data-testid="demo-one-time-password">{credentials.password}</strong></p>
        <button type="button" onClick={() => void navigator.clipboard.writeText(`Username: ${credentials.username}\nPassword: ${credentials.password}\nLogin: ${loginUrl}`).then(() => setNotice("Demo credentials copied. Keep them private.")).catch(() => setError("Clipboard access is unavailable; use the download option."))}>Copy private credentials</button>
        <button type="button" onClick={() => download("clinicflow-demo-credentials.txt", `Username: ${credentials.username}\nPassword: ${credentials.password}\nLogin: ${loginUrl}\n`, "text/plain")}>Download private credentials</button>
        <button type="button" onClick={() => setCredentials(null)}>Hide credentials</button>
      </section>}
      <h3>Shareable patient links</h3>
      <p><a href={clinicUrl} target="_blank" rel="noreferrer">{clinicUrl}</a></p>
      <p><a href={bookingUrl} target="_blank" rel="noreferrer">{bookingUrl}</a></p>
      <p>Staff login: <Link href={status.loginPath || "/demo-login"}>{loginUrl}</Link></p>
      {qr && <div><img src={qr} alt={`Booking QR for ${status.clinicName}`} width="220" height="220"/><br/><button type="button" onClick={() => {
        const anchor = document.createElement("a"); anchor.href = qr; anchor.download = "clinicflow-demo-booking-qr.png"; anchor.click();
      }}>Download booking QR</button></div>}
      <h3>Patient sharing message</h3>
      <textarea readOnly rows={6} value={forward} aria-label="Public demo sharing message"/>
      <button type="button" onClick={() => void navigator.clipboard.writeText(forward).then(() => setNotice("Public sharing message copied. Credentials are not included.")).catch(() => setError("Clipboard unavailable. Select and copy the message above."))}>Copy public message</button>
    </>}
  </div></>;
}