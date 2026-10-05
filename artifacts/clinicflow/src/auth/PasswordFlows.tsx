import { EmailInput } from "@/components/EmailInput";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { authErrorMessage } from "./errors";
import { FormField } from "../components/FormField";
import { PasswordInput } from "../components/PasswordInput";
import { LoadingButton } from "../components/LoadingButton";
import { PASSWORD_RULE, validateEmail, validatePassword } from "../lib/validators";
import { AuthCard, AuthShell } from "./AuthShell";
import { authRequest, useNativeAuth } from "./native-auth";

export function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState<string | undefined>();
  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    const invalid = email.trim() ? validateEmail(email) : "This field is required";
    setEmailError(invalid);
    if (invalid) { document.querySelector<HTMLElement>('[name="reset-email"]')?.focus(); return; }
    setBusy(true); setError("");
    try {
      await authRequest("forgot-password", { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (caught) { setError(authErrorMessage(caught, "Unable to request password recovery. Please retry.")); }
    finally { setBusy(false); }
  }
  return <AuthShell eyebrow="Staff Password Recovery">
    <AuthCard title="Reset Staff Password" description="If this email belongs to an active staff account, we'll send a secure, single-use password reset link.">
      {sent ? <div className="notice" role="status" data-testid="status-password-reset-requested">If the account exists, check your email for a password reset link.</div> : <form onSubmit={send} noValidate>
        <FormField label="Staff Email" required error={emailError}>
          <EmailInput trimOnBlur={false} data-testid="input-reset-email" name="reset-email" autoComplete="username" disabled={busy} value={email} onChange={event => { setEmail(event.target.value); if (emailError) setEmailError(undefined); }} />
        </FormField>
        {error && <div className="error-box" role="alert">{error}</div>}
        <LoadingButton className="button auth-submit" data-testid="button-send-reset-code" type="submit" loading={busy} loadingText="Requesting…">Send password reset link</LoadingButton>
      </form>}
      <div className="auth-links"><Link href="/sign-in" data-testid="link-return-staff-login">Return to Staff Login</Link></div>
    </AuthCard>
  </AuthShell>;
}

export function SetPassword() {
  const [, navigate] = useLocation();
  const { refresh } = useNativeAuth();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const reset = params.get("flow") === "reset";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !token) return;
    const invalid = password ? validatePassword(password) : "This field is required";
    setFieldError(invalid);
    if (invalid) { document.querySelector<HTMLElement>('[name="new-password"]')?.focus(); return; }
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
  return <AuthShell eyebrow={reset ? "Staff Password Recovery" : "Staff Invitation"}>
    <AuthCard title={reset ? "Reset your staff password" : "Set your staff password"} description="Choose a secure password, then sign in from the staff login page.">
      {!token && <div className="error-box" role="alert" data-testid="status-invitation-error">This password setup link is incomplete. Request a new one.</div>}
      {error && <div className="error-box" role="alert" data-testid="status-invitation-error">{error}</div>}
      {token && <form onSubmit={save} noValidate>
        <FormField label="New Password" required helper={PASSWORD_RULE} error={fieldError}>
          <PasswordInput data-testid="input-invitation-password" name="new-password" autoComplete="new-password" showChecklist disabled={busy} value={password} onChange={event => { setPassword(event.target.value); if (fieldError) setFieldError(validatePassword(event.target.value)); }} />
        </FormField>
        <LoadingButton className="button auth-submit" data-testid="button-set-invitation-password" type="submit" loading={busy} loadingText="Setting password…">Set password</LoadingButton>
      </form>}
      <div className="auth-links">{reset && <Link href="/forgot-password" data-testid="link-request-new-reset">Request a new reset link</Link>}<Link href="/sign-in" data-testid="link-invitation-staff-login">Staff Login</Link></div>
    </AuthCard>
  </AuthShell>;
}