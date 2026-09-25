import { useEffect, useRef, useState } from "react";
import { useClerk, useSignIn } from "@clerk/react";
import { OTPInput, REGEXP_ONLY_DIGITS } from "input-otp";
import { Link, useLocation } from "wouter";
import * as api from "@workspace/api-client-react";
import { queryClient } from "../App";
import { BRAND_NAME } from "../branding";
import { authErrorMessage } from "./errors";
import { AuthCard, AuthShell } from "./AuthShell";
import "../components/clinic-registration.css";
import {
  activateAndProveStaffSession,
  createAsyncActionLock,
  DEVICE_CODE_LENGTH,
  sendDeviceTrustEmailCode,
} from "./staff-device-trust";

export function StaffLogin() {
  const { signIn, fetchStatus, errors } = useSignIn();
  const authClient = useClerk();
  const [, navigate] = useLocation();
  const staffEntry = api.usePrepareStaffEntry();
  const staffVerify = api.useVerifyStaffPassword();
  const [step, setStep] = useState<"credentials" | "device">("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const emailFactorId = useRef("");
  const actionLock = useRef(createAsyncActionLock(setWorking));
  const params = new URLSearchParams(window.location.search);
  const confirmation = params.get("passwordSet")
    ? "Your password is set. Sign in to continue."
    : params.get("passwordReset")
      ? "Your password was reset. Sign in with your new password."
      : "";
  const busy = working || fetchStatus === "fetching" || staffEntry.isPending || staffVerify.isPending;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function runLocked(task: () => Promise<void>) {
    await actionLock.current.run(task);
  }

  async function finishSignIn(createdSessionId?: string | null) {
    let authenticationComplete = false;
    try {
      await activateAndProveStaffSession({
        createdSessionId,
        setActive: sessionId => authClient.setActive({ session: sessionId }),
        finalize: () => signIn.finalize(),
        provePassword: () => staffVerify.mutateAsync({ data: { password } }),
        cleanup: async () => {
          await authClient.signOut().catch(() => undefined);
          signIn.reset();
        },
      });
      authenticationComplete = true;
      setPassword("");
      setCode("");
      await queryClient.invalidateQueries({ queryKey: api.getGetAuthStatusQueryKey() });
      navigate("/onboarding", { replace: true });
    } catch (caught) {
      if (authenticationComplete) {
        await authClient.signOut().catch(() => undefined);
        signIn.reset();
      }
      setPassword("");
      setCode("");
      setStep("credentials");
      throw new Error(authErrorMessage(caught, "Sign-in could not be verified safely. Please sign in again."));
    }
  }

  async function sendDeviceCodeUnlocked() {
    setError("");
    setCodeSent(false);
    try {
      const factor = signIn.supportedSecondFactors?.find(candidate => candidate.strategy === "email_code");
      const factorId = emailFactorId.current || (factor?.strategy === "email_code" ? factor.emailAddressId : "");
      if (!factorId) {
        throw new Error("Email verification is not available for this account. Contact your administrator for help signing in.");
      }
      if (factor?.strategy === "email_code") {
        emailFactorId.current = factor.emailAddressId;
        setMaskedEmail(factor.safeIdentifier);
      }
      await sendDeviceTrustEmailCode({
        prepare: () => authClient.client.signIn.prepareSecondFactor({ strategy: "email_code", emailAddressId: factorId }),
        setCodeSent,
        clearCode: () => setCode(""),
        startCooldown: setCooldown,
      });
    } catch (caught) {
      setError(authErrorMessage(caught, "Unable to send a verification code. Try again or change accounts."));
    }
  }

  async function sendDeviceCode() {
    await runLocked(sendDeviceCodeUnlocked);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    await runLocked(async () => {
      setError("");
      try {
        const entry = await staffEntry.mutateAsync({ data: { email: email.trim().toLowerCase() } });
        const result = await signIn.password({ emailAddress: entry.email, password });
        if (result.error) throw result.error;
        if (signIn.status === "needs_client_trust") {
          const factor = signIn.supportedSecondFactors?.find(candidate => candidate.strategy === "email_code");
          if (!factor || factor.strategy !== "email_code") {
            throw new Error("This new device needs verification, but email verification is not available for this account. Contact your administrator.");
          }
          emailFactorId.current = factor.emailAddressId;
          setMaskedEmail(factor.safeIdentifier);
          setStep("device");
          await sendDeviceCodeUnlocked();
          return;
        }
        if (signIn.status === "needs_second_factor") {
          throw new Error("Multi-factor authentication is required for this account. Contact your administrator for help signing in.");
        }
        if (signIn.status === "needs_protect_check") {
          throw new Error("An additional security check is required. Reload the page and try again. If it still cannot complete, contact your administrator.");
        }
        if (signIn.status !== "complete") throw new Error("Password sign-in could not be completed. Please contact your administrator.");
        await finishSignIn();
      } catch (caught) {
        if (signIn.status !== "needs_client_trust") setPassword("");
        setError(authErrorMessage(caught, errors.fields.password?.message || "Unable to sign in. Check your email and password."));
      }
    });
  }

  async function verifyDevice(event: React.FormEvent) {
    event.preventDefault();
    await runLocked(async () => {
      setError("");
      try {
        const result = await authClient.client.signIn.attemptSecondFactor({ strategy: "email_code", code: code.trim() });
        if (result.status !== "complete" || !result.createdSessionId) {
          throw new Error("That verification code is invalid or expired. Request a new code and try again.");
        }
        // The classic attempt result is authoritative here. Activating its returned
        // session avoids relying on the future hook signal updating before finalize.
        await finishSignIn(result.createdSessionId);
      } catch (caught) {
        setError(authErrorMessage(caught, errors.fields.code?.message || "That verification code is invalid or expired. Request a new code and try again."));
      }
    });
  }

  function changeAccount() {
    if (actionLock.current.isLocked()) return;
    signIn.reset();
    emailFactorId.current = "";
    setStep("credentials");
    setPassword("");
    setCode("");
    setMaskedEmail("");
    setCodeSent(false);
    setCooldown(0);
    setError("");
  }

  return (
    <AuthShell eyebrow="STAFF WORKSPACE">
      <AuthCard
        title={step === "credentials" ? "Staff login" : "Verify this device"}
        description={step === "credentials"
          ? `Use your ${BRAND_NAME} staff email and password.`
          : codeSent
            ? `For your security, enter the code sent to ${maskedEmail}.`
            : working
              ? `Sending a verification code to ${maskedEmail}…`
              : `We couldn't send a code to ${maskedEmail}. Retry or change accounts.`}
      >
        {confirmation && <div className="notice" data-testid="status-password-confirmation">{confirmation}</div>}
        {step === "credentials" ? (
          <>
            <form onSubmit={submit}>
              <label>Email address<input data-testid="input-staff-email" type="email" autoComplete="username" required disabled={busy} value={email} onChange={event => setEmail(event.target.value)} /></label>
              <label>Password<input data-testid="input-staff-password" type="password" autoComplete="current-password" required disabled={busy} value={password} onChange={event => setPassword(event.target.value)} /></label>
              {error && <div className="error-box" role="alert" data-testid="status-staff-login-error">{error}</div>}
              <button className="button auth-submit" data-testid="button-staff-login" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
            </form>
            <div className="auth-links"><Link href="/forgot-password" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }} data-testid="link-forgot-password">Forgot password?</Link><Link href="/patient-login" aria-disabled={busy} onClick={event => { if (busy) event.preventDefault(); }} data-testid="link-patient-login">Patient login</Link></div>
            <div className="register-clinic-entry"><div><strong>Bring your clinic together.</strong><p>Set up your locations, hours and care team.</p></div><Link className="button register-clinic-button" href="/register-clinic" aria-disabled={busy} data-testid="link-register-clinic" onClick={event => { if (busy) event.preventDefault(); }}>Register a Clinic</Link></div>
          </>
        ) : (
          <form onSubmit={verifyDevice}>
            {codeSent && <div className="notice" role="status" data-testid="status-device-code-sent">A verification code was sent to {maskedEmail}.</div>}
            <label>
              Verification code
              <OTPInput
                data-testid="input-device-code"
                value={code}
                onChange={setCode}
                maxLength={DEVICE_CODE_LENGTH}
                pattern={REGEXP_ONLY_DIGITS}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                disabled={busy}
                containerClassName="otp-input"
                render={({ slots }) => (
                  <span className="otp-slots">
                    {slots.map((slot, index) => (
                      <span className={`otp-slot${slot.isActive ? " active" : ""}`} key={index}>
                        {slot.char}
                        {slot.hasFakeCaret && <span className="otp-caret" />}
                      </span>
                    ))}
                  </span>
                )}
              />
            </label>
            {error && <div className="error-box" role="alert" data-testid="status-device-verification-error">{error}</div>}
            <button className="button auth-submit" data-testid="button-verify-device" type="submit" disabled={busy || !codeSent || code.length !== DEVICE_CODE_LENGTH}>{busy ? "Verifying…" : "Verify and Sign In"}</button>
            <div className="auth-links">
              <button type="button" className="text-link" data-testid="button-change-staff-account" disabled={busy} onClick={changeAccount}>Change account</button>
              <button type="button" className="text-link" data-testid="button-resend-device-code" disabled={busy || cooldown > 0} onClick={() => void sendDeviceCode()}>{!codeSent ? "Retry sending code" : cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button>
            </div>
          </form>
        )}
      </AuthCard>
    </AuthShell>
  );
}