import { useState } from "react";
import { Link, useLocation } from "wouter";
import { authErrorMessage } from "./errors";
import { AuthCard, AuthShell } from "./AuthShell";
import { authRequest, useNativeAuth } from "./native-auth";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      await authRequest("forgot-password", { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (caught) { setError(authErrorMessage(caught, "Unable to request password recovery. Please retry.")); }
    finally { setBusy(false); }
  }
  return <AuthShell eyebrow="STAFF PASSWORD RECOVERY">
    <AuthCard title="Reset staff password" description="If this email belongs to an active staff account, we'll send a secure, single-use password reset link.">
      {sent ? <div className="notice" role="status" data-testid="status-password-reset-requested">If the account exists, check your email for a password reset link.</div> : <form onSubmit={send}>
        <label>Staff email<input data-testid="input-reset-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="button auth-submit" data-testid="button-send-reset-code" disabled={busy}>{busy ? "Requesting…" : "Send password reset link"}</button>
      </form>}
      <div className="auth-links"><Link href="/sign-in" data-testid="link-return-staff-login">Return to staff login</Link></div>
    </AuthCard>
  </AuthShell>;
}

export function SetPassword() {
  const [, navigate] = useLocation();
  const { refresh } = useNativeAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const reset = params.get("flow") === "reset";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !token) return;
    setBusy(true); setError("");
    try {
      const result = await authRequest<{ authenticated?: boolean }>(reset ? "reset-password" : "invitation/accept", { token, password });
      setPassword("");
      if (result.authenticated) { await refresh(); navigate("/onboarding", { replace: true }); }
      else navigate(`/sign-in?${reset ? "passwordReset" : "passwordSet"}=1`, { replace: true });
    } catch (caught) {
      setPassword("");
      setError(authErrorMessage(caught, "This link is invalid or expired. Request a new one."));
    } finally { setBusy(false); }
  }
  return <AuthShell eyebrow={reset ? "STAFF PASSWORD RECOVERY" : "STAFF INVITATION"}>
    <AuthCard title={reset ? "Reset your staff password" : "Set your staff password"} description="Choose a secure password, then sign in from the staff login page.">
      {!token && <div className="error-box" role="alert" data-testid="status-invitation-error">This password setup link is incomplete. Request a new one.</div>}
      {error && <div className="error-box" role="alert" data-testid="status-invitation-error">{error}</div>}
      {token && <form onSubmit={save}>
        <label>New password<input data-testid="input-invitation-password" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={event => setPassword(event.target.value)} /></label>
        <button className="button auth-submit" data-testid="button-set-invitation-password" disabled={busy}>{busy ? "Setting password…" : "Set password"}</button>
      </form>}
      <div className="auth-links"><Link href="/sign-in" data-testid="link-invitation-staff-login">Staff login</Link></div>
    </AuthCard>
  </AuthShell>;
}