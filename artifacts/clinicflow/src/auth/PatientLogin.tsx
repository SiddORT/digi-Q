import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { QrCode, CalendarDays } from "lucide-react";
import { authErrorMessage } from "./errors";
import { AuthCard, AuthShell } from "./AuthShell";
import { authRequest, useNativeAuth } from "./native-auth";

export function PatientLogin() {
  const [, navigate] = useLocation();
  const { refresh } = useNativeAuth();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    if (busy || (step === "code" && cooldown > 0)) return;
    setBusy(true); setError("");
    try {
      const result = await authRequest<{ challengeId: string }>("patient/start", { email: email.trim().toLowerCase() });
      if (!result.challengeId) throw new Error("Unable to start patient verification. Please retry.");
      setChallengeId(result.challengeId);
      setStep("code");
      setCooldown(30);
      setCode("");
    } catch (caught) { setError(authErrorMessage(caught, "Unable to send a login code.")); }
    finally { setBusy(false); }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await authRequest<{ authenticated: boolean }>("patient/verify", { challengeId, code: code.trim() });
      if (!result.authenticated) throw new Error("That code is invalid or expired. Request a new code.");
      setCode("");
      await refresh();
      navigate("/onboarding", { replace: true });
    } catch (caught) { setError(authErrorMessage(caught, "That code is invalid or expired. Request a new code.")); }
    finally { setBusy(false); }
  }

  return <AuthShell eyebrow="PATIENT ACCESS">
    <AuthCard title="Patient login" description={step === "email" ? "Enter your email and we’ll send a one-time login code." : `Enter the code sent to ${email}.`}>
      <div className="patient-entry-options" aria-label="Book without logging in">
        <p>Booking a visit? No account needed.</p>
        <Link className="button" href="/scan-qr" data-testid="link-patient-scan"><QrCode size={18}/> Scan QR code</Link>
        <Link className="button secondary" href="/guest-booking" data-testid="link-patient-guest"><CalendarDays size={18}/> Guest booking</Link>
      </div>
      <div className="patient-login-separator">Or sign in to your patient account</div>
      {step === "email" ? <form onSubmit={sendCode}>
        <label>Email address<input data-testid="input-patient-email" type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} /></label>
        {error && <div className="error-box" role="alert" data-testid="status-patient-login-error">{error}</div>}
        <button className="button auth-submit" data-testid="button-send-patient-code" type="submit" disabled={busy}>{busy ? "Sending…" : "Send login code"}</button>
      </form> : <form onSubmit={verifyCode}>
        <label>One-time code<input data-testid="input-patient-code" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value)} /></label>
        {error && <div className="error-box" role="alert" data-testid="status-patient-code-error">{error}</div>}
        <button className="button auth-submit" data-testid="button-verify-patient-code" type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and continue"}</button>
        <div className="auth-links"><button type="button" className="text-link" data-testid="button-change-patient-email" onClick={() => { setStep("email"); setCode(""); setChallengeId(""); setError(""); }}>Change email</button><button type="button" className="text-link" data-testid="button-resend-patient-code" disabled={busy || cooldown > 0} onClick={() => void sendCode()}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button></div>
      </form>}
      <div className="auth-links"><Link href="/sign-in" data-testid="link-staff-login">Staff login</Link></div>
    </AuthCard>
  </AuthShell>;
}