import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import { IconAction } from "./IconAction";
import { Link } from "wouter";
import QRCode from "qrcode";
import { csrfToken } from "../lib/csrf";
import { BRAND_NAME } from "../branding";
import { useConfirm } from "./ConfirmDialog";
import { friendlyError } from "../lib/friendly-error";
import { HelpTip } from "./HelpTip";

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
      title: "Create Demo Clinic?",
      description: "Create a fictional demo clinic, location, doctor, schedule and staff identity on this environment?",
      confirmLabel: "Create Demo Clinic",
    }))) return;
    if (action === "rotate-password" && !(await confirmDialog.ask({
      title: "Rotate Demo Password?",
      description: "Rotate the demo password? The previous shared password will stop working.",
      confirmLabel: "Rotate Password",
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
    <div className="panel-heading demo-head section-head"><div><span className="eyebrow">Super Admin Only · Fictional Demo</span><h2>Published Demo Clinic <HelpTip text="Setup applies only to the environment shown in your address bar. Preview and published accounts and clinics are separate. Never enter real patient details into the demo."/></h2></div>
      {status?.configured && <div className="row-actions">
        <span className={`badge ${status.enabled ? "" : "muted"}`} data-testid="status-demo-access">{status.enabled ? "Demo access enabled" : "Demo access disabled"}</span>
        <button type="button" className="button secondary small" disabled={busy} onClick={() => void change(status.enabled ? "disable" : "enable")} data-testid="button-toggle-demo">{status.enabled ? "Disable demo access" : "Enable demo access"}</button>
        <button type="button" className="button secondary small" disabled={busy} onClick={() => void change("rotate-password")} data-testid="button-rotate-demo-password">Rotate Demo Password</button>
      </div>}
    </div>
    {error && <div className="error-box" role="alert">{error}<button type="button" onClick={() => setRevision(value => value + 1)}>Retry</button></div>}
    {notice && <div className="notice" role="status">{notice}</div>}
    {!status && !error && <p role="status">Checking demo setup…</p>}
    {status && !status.configured && <button type="button" className="button" disabled={busy} onClick={() => void change("create")} data-testid="button-create-demo">Create Demo Clinic</button>}
    {status?.configured && <>
      <p><strong>{status.clinicName}</strong> · {status.doctorName}</p>
      {credentials && <section className="notice" aria-label="One-time demo credentials">
        <h3>Save These Credentials Now</h3><p>The password is shown only once. Share it privately, separately from the public clinic link.</p>
        <p>Username: <strong>{credentials.username}</strong></p>
        <p>Password: <strong data-testid="demo-one-time-password">{credentials.password}</strong></p>
        <button type="button" onClick={() => void navigator.clipboard.writeText(`Username: ${credentials.username}\nPassword: ${credentials.password}\nLogin: ${loginUrl}`).then(() => setNotice("Demo credentials copied. Keep them private.")).catch(() => setError("Clipboard access is unavailable; use the download option."))}>Copy Private Credentials</button>
        <button type="button" onClick={() => download("clinicflow-demo-credentials.txt", `Username: ${credentials.username}\nPassword: ${credentials.password}\nLogin: ${loginUrl}\n`, "text/plain")}>Download Private Credentials</button>
        <button type="button" onClick={() => setCredentials(null)}>Hide Credentials</button>
      </section>}
      <div className="demo-share">
      <div className="demo-share-main">
      <dl className="settings-facts">
        {([["Clinic page", clinicUrl], ["Booking link", bookingUrl]] as const).map(([name, url]) => <div key={name}><dt>{name}</dt><dd className="demo-link-actions">
          <IconAction label={`Copy ${name.toLowerCase()}: ${url}`} hint={`Copy ${name.toLowerCase()}`} icon={<Copy size={15} aria-hidden/>} onClick={() => void navigator.clipboard.writeText(url).then(() => setNotice(`${name} copied.`)).catch(() => setError("Clipboard unavailable."))}/>
          <a className="button secondary small" href={url} target="_blank" rel="noreferrer" title={url} aria-label={`Open ${name.toLowerCase()}: ${url}`}>Open</a></dd></div>)}
        <div><dt>Staff login</dt><dd className="demo-link-actions"><IconAction label={`Copy staff login: ${loginUrl}`} hint="Copy staff login" icon={<Copy size={15} aria-hidden/>} onClick={() => void navigator.clipboard.writeText(loginUrl).then(() => setNotice("Staff login copied.")).catch(() => setError("Clipboard unavailable."))}/><Link className="button secondary small" href={status.loginPath || "/demo-login"} title={loginUrl} aria-label={`Open staff login: ${loginUrl}`}>Open</Link></dd></div>
      </dl>
      <h3>Patient Sharing Message</h3>
      <textarea readOnly rows={4} value={forward} aria-label="Public demo sharing message"/>
      <button type="button" onClick={() => void navigator.clipboard.writeText(forward).then(() => setNotice("Public sharing message copied. Credentials are not included.")).catch(() => setError("Clipboard unavailable. Select and copy the message above."))}>Copy Public Message</button>
      </div>
      {qr && <div className="demo-qr"><img src={qr} alt={`Booking QR for ${status.clinicName}`} width="220" height="220"/><br/><button type="button" onClick={() => {
        const anchor = document.createElement("a"); anchor.href = qr; anchor.download = "clinicflow-demo-booking-qr.png"; anchor.click();
      }}>Download Booking QR</button></div>}
      </div>
    </>}
  </div></>;
}