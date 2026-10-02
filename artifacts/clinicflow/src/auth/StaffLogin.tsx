import { useEffect, useState } from "react";
import { OTPInput, REGEXP_ONLY_DIGITS } from "input-otp";
import { Link, useLocation } from "wouter";
import { BRAND_NAME } from "../branding";
import { AuthCard, AuthShell } from "./AuthShell";
import { authErrorMessage } from "./errors";
import { authRequest, useNativeAuth } from "./native-auth";
import { DEVICE_CODE_LENGTH } from "./staff-device-trust";
import { FormField } from "../components/FormField";
import { PasswordInput } from "../components/PasswordInput";
import { LoadingButton } from "../components/LoadingButton";
import { validateEmail } from "../lib/validators";
import "../components/clinic-registration.css";

type LoginResponse = { authenticated?: boolean; challengeId?: string; requiresVerification?: boolean; maskedEmail?: string };

export function StaffLogin() {
  const [, navigate] = useLocation();
  const { refresh } = useNativeAuth();
  const [step, setStep] = useState<"credentials" | "device">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const params = new URLSearchParams(window.location.search);
  const confirmation = params.get("passwordSet")
    ? "Your password is set. Sign in to continue."
    : params.get("passwordReset") ? "Your password was reset. Sign in with your new password." : "";

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function complete() {
    await refresh();
    setPassword("");
    setCode("");
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
      if (result.authenticated) { await complete(); return; }
      if (!result.requiresVerification || !result.challengeId) throw new Error("Unable to complete sign-in. Please retry.");
      setChallengeId(result.challengeId);
      setMaskedEmail(result.maskedEmail || email.trim());
      setStep("device");
      setCooldown(30);
    } catch (caught) {
      setPassword("");
      setError(authErrorMessage(caught, "Unable to sign in. Check your email and password."));
    } finally { setBusy(false); }
  }

  async function verifyDevice(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (code.length !== DEVICE_CODE_LENGTH) { setError(`Enter the ${DEVICE_CODE_LENGTH}-digit verification code.`); return; }
    setBusy(true); setError("");
    try {
      const result = await authRequest<LoginResponse>("verify-device", { challengeId, code: code.trim() });
      if (!result.authenticated) throw new Error("The verification code could not be confirmed. Please retry.");
      await complete();
    } catch (caught) {
      setError(authErrorMessage(caught, "That verification code is invalid or expired."));
    } finally { setBusy(false); }
  }

  return <AuthShell eyebrow="STAFF WORKSPACE">
    <AuthCard title={step === "credentials" ? "Staff login" : "Verify this device"}
      description={step === "credentials" ? `Use your ${BRAND_NAME} staff email and password.` : `Enter the code sent to ${maskedEmail}.`}>
      {confirmation && <div className="notice" data-testid="status-password-confirmation">{confirmation}</div>}
      {step === "credentials" ? <>
        <form onSubmit={submit} noValidate>
          <FormField label="Email address" required error={fieldErrors.email}>
            <input data-testid="input-staff-email" name="email" type="email" autoComplete="username" disabled={busy} value={email} onChange={event => { setEmail(event.target.value); if (fieldErrors.email) setFieldErrors(p => ({ ...p, email: undefined })); }} />
          </FormField>
          <FormField label="Password" required error={fieldErrors.password}>
            <PasswordInput data-testid="input-staff-password" name="password" autoComplete="current-password" disabled={busy} value={password} onChange={event => { setPassword(event.target.value); if (fieldErrors.password) setFieldErrors(p => ({ ...p, password: undefined })); }} />
          </FormField>
          {error && <div className="error-box" role="alert" data-testid="status-staff-login-error">{error}</div>}
          <LoadingButton className="button auth-submit" data-testid="button-staff-login" type="submit" loading={busy} loadingText="Signing in…">Sign in</LoadingButton>
        </form>
        <div className="auth-links"><Link href="/forgot-password" data-testid="link-forgot-password">Forgot password?</Link><Link href="/patient-login" data-testid="link-patient-login">Patient login</Link></div>
        <div className="register-clinic-entry"><div><strong>Bring your clinic together.</strong><p>Set up your locations, hours and care team.</p></div><Link className="button register-clinic-button" href="/register-clinic" data-testid="link-register-clinic">Register a Clinic</Link></div>
      </> : <form onSubmit={verifyDevice}>
        <label>Verification code<OTPInput data-testid="input-device-code" value={code} onChange={setCode} maxLength={DEVICE_CODE_LENGTH} pattern={REGEXP_ONLY_DIGITS} inputMode="numeric" autoComplete="one-time-code" required disabled={busy} containerClassName="otp-input" render={({ slots }) => <span className="otp-slots">{slots.map((slot, index) => <span className={`otp-slot${slot.isActive ? " active" : ""}`} key={index}>{slot.char}{slot.hasFakeCaret && <span className="otp-caret" />}</span>)}</span>} /></label>
        {error && <div className="error-box" role="alert" data-testid="status-device-verification-error">{error}</div>}
        <LoadingButton className="button auth-submit" data-testid="button-verify-device" type="submit" loading={busy} loadingText="Verifying…" disabled={code.length !== DEVICE_CODE_LENGTH}>Verify and Sign In</LoadingButton>
        <div className="auth-links">
          <button type="button" className="text-link" data-testid="button-change-staff-account" disabled={busy} onClick={() => { setStep("credentials"); setCode(""); setChallengeId(""); setError(""); }}>Change account</button>
          <button type="button" className="text-link" data-testid="button-resend-device-code" disabled={busy || cooldown > 0} onClick={() => { setStep("credentials"); setCode(""); setChallengeId(""); setError(""); }}>{cooldown > 0 ? `Try again in ${cooldown}s` : "Sign in again to request a new code"}</button>
        </div>
      </form>}
    </AuthCard>
  </AuthShell>;
}