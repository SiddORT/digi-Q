import { EmailInput } from "@/components/EmailInput";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { BRAND_NAME } from "../branding";
import { AuthCard, AuthShell } from "./AuthShell";
import { authErrorMessage } from "./errors";
import { authRequest, useNativeAuth } from "./native-auth";
import { FormField } from "../components/FormField";
import { PasswordInput } from "../components/PasswordInput";
import { LoadingButton } from "../components/LoadingButton";
import { validateEmail } from "../lib/validators";
import "../components/clinic-registration.css";

type LoginResponse = { authenticated: boolean };

export function StaffLogin() {
  const [, navigate] = useLocation();
  const { refresh } = useNativeAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const params = new URLSearchParams(window.location.search);
  const confirmation = params.get("passwordSet")
    ? "Your password is set. Sign in to continue."
    : params.get("passwordReset") ? "Your password was reset. Sign in with your new password." : "";

  async function complete() {
    await refresh();
    setPassword("");
    const redirect = params.get("redirect");
    navigate(redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/onboarding", { replace: true });
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    // Login only checks presence/format; the password policy applies to new passwords, so existing credentials keep working.
    const errs = { email: email.trim() ? validateEmail(email) : "Enter your email address.", password: password ? undefined : "Enter your password." };
    setFieldErrors(errs);
    if (errs.email || errs.password) { (document.querySelector<HTMLElement>(errs.email ? '[name="email"]' : '[name="password"]'))?.focus(); return; }
    setBusy(true); setError("");
    try {
      const result = await authRequest<LoginResponse>("login", { email: email.trim().toLowerCase(), password });
      setPassword("");
      if (result.authenticated !== true) throw new Error("Unable to complete sign-in. Please retry.");
      await complete();
    } catch (caught) {
      setPassword("");
      setError(authErrorMessage(caught, "Unable to sign in. Check your email and password."));
    } finally { setBusy(false); }
  }

  return <AuthShell eyebrow="Staff Workspace">
    <AuthCard title="Staff Login" description={`Use your ${BRAND_NAME} staff email and password.`}>
      {confirmation && <div className="notice" data-testid="status-password-confirmation">{confirmation}</div>}
        <form onSubmit={submit} noValidate>
          <FormField label="Email Address" required error={fieldErrors.email}>
            <EmailInput trimOnBlur={false} data-testid="input-staff-email" name="email" autoComplete="username" disabled={busy} value={email} onChange={event => { setEmail(event.target.value); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: undefined })); }} />
          </FormField>
          <FormField label="Password" required error={fieldErrors.password}>
            <PasswordInput data-testid="input-staff-password" name="password" autoComplete="current-password" disabled={busy} value={password} onChange={event => { setPassword(event.target.value); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined })); }} />
          </FormField>
          {error && <div className="error-box" role="alert" data-testid="status-staff-login-error">{error}</div>}
          <LoadingButton className="button auth-submit" data-testid="button-staff-login" type="submit" loading={busy} loadingText="Signing in…">Sign In</LoadingButton>
        </form>
        <div className="auth-links"><Link href="/forgot-password" data-testid="link-forgot-password">Forgot password?</Link><Link href="/patient-login" data-testid="link-patient-login">Patient Login</Link></div>
        <div className="register-clinic-entry"><div><strong>Bring your clinic together.</strong><p>Set up your locations, hours and care team.</p></div><Link className="button register-clinic-button" href="/register-clinic" data-testid="link-register-clinic">Register a Clinic</Link></div>
    </AuthCard>
  </AuthShell>;
}