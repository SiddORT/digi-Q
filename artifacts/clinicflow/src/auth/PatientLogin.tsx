import { useEffect, useState } from "react";
import { useSignIn } from "@clerk/react";
import { Link, useLocation } from "wouter";
import * as api from "@workspace/api-client-react";
import { authErrorMessage } from "./errors";
import { AuthCard, AuthShell } from "./AuthShell";

export function PatientLogin() {
  const { signIn, fetchStatus, errors } = useSignIn();
  const [, navigate] = useLocation();
  const patientEntry = api.usePreparePatientEntry();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const busy = fetchStatus === "fetching" || patientEntry.isPending;

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError("");
    try {
      const entry = await patientEntry.mutateAsync({ data: { email: email.trim().toLowerCase() } });
      const result = await signIn.emailCode.sendCode({ emailAddress: entry.email });
      if (result.error) throw result.error;
      if (signIn.status === "needs_protect_check") {
        throw new Error("Clerk requires an additional security check. Reload the page and try again.");
      }
      setEmail(entry.email);
      setStep("code");
      setCooldown(30);
    } catch (caught) {
      setError(authErrorMessage(caught, errors.fields.identifier?.message || "Unable to send a login code."));
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await signIn.emailCode.verifyCode({ code: code.trim() });
      if (result.error) throw result.error;
      if (signIn.status !== "complete") throw new Error("Additional verification is required. Please request a new code.");
      const finalized = await signIn.finalize();
      if (finalized.error) throw finalized.error;
      setCode("");
      navigate("/onboarding", { replace: true });
    } catch (caught) {
      setError(authErrorMessage(caught, errors.fields.code?.message || "That code is invalid or expired. Request a new code."));
    }
  }

  return (
    <AuthShell eyebrow="PATIENT ACCESS">
      <AuthCard title="Patient login" description={step === "email" ? "Enter your email and we’ll send a one-time login code." : `Enter the code sent to ${email}.`}>
        {step === "email" ? (
          <form onSubmit={sendCode}>
            <label>Email address<input data-testid="input-patient-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
             {error && <div className="error-box" role="alert" data-testid="status-patient-login-error">{error}</div>}
            <button className="button auth-submit" data-testid="button-send-patient-code" type="submit" disabled={busy}>{busy ? "Sending…" : "Send login code"}</button>
          </form>
        ) : (
          <form onSubmit={verifyCode}>
            <label>One-time code<input data-testid="input-patient-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value)} /></label>
             {error && <div className="error-box" role="alert" data-testid="status-patient-code-error">{error}</div>}
            <button className="button auth-submit" data-testid="button-verify-patient-code" type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and continue"}</button>
            <div className="auth-links"><button type="button" className="text-link" data-testid="button-change-patient-email" onClick={() => { signIn.reset(); setStep("email"); setCode(""); setError(""); }}>Change email</button><button type="button" className="text-link" data-testid="button-resend-patient-code" disabled={busy || cooldown > 0} onClick={() => sendCode()}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button></div>
          </form>
        )}
        <div className="auth-links"><Link href="/sign-in" data-testid="link-staff-login">Staff login</Link></div>
      </AuthCard>
    </AuthShell>
  );
}