import { EmailInput } from "@/components/EmailInput";
import { VerificationCodeInput } from "../components/VerificationCodeInput";
import { FormField } from "../components/FormField";
import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { QrCode, CalendarDays } from "lucide-react";
import { authErrorMessage } from "./errors";
import { AuthCard, AuthShell } from "./AuthShell";
import { authRequest, useNativeAuth } from "./native-auth";
import { PhoneInput } from "../components/PhoneInput";
import { RegistrationMobileProof } from "./RegistrationMobileProof";
import { SecurityChannelNotice, type SecurityChannels } from "./SecurityChannelNotice";
import type { AuthChallenge } from "@workspace/api-client-react";
import { patientGuestDestination } from "./patient-access-links";

export function PatientLogin() {
  const [, navigate] = useLocation();
  const { refresh } = useNativeAuth();
  const search = useSearch();
  const mode = new URLSearchParams(search).get("mode");
  const signup = mode === "signup";
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [mobile, setMobile] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [channels, setChannels] = useState<SecurityChannels>();
  const [initialSms, setInitialSms] = useState<SecurityChannels>();
  useEffect(() => {
    setStep("email"); setChannel("email"); setChallengeId(""); setCode(""); setError("");
    setChannels(undefined); setInitialSms(undefined); setCooldown(0);
  }, [mode]);
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode(event?: React.FormEvent) {
    event?.preventDefault();
    if (busy || (step === "code" && cooldown > 0)) return;
    if (mobile.trim() && (signup || channel === "sms") && !/^\+[1-9]\d{6,14}$/.test(mobile.trim())) {
      setError("Enter a mobile number with country code, or leave the optional phone empty."); return;
    }
    setBusy(true); setError("");
    try {
      const resendEmail = step === "code" && channel === "email";
      const result = await authRequest<AuthChallenge>(resendEmail ? "patient/resend" : "patient/start",
        resendEmail ? {challengeId} : channel === "sms" ? { channel, mobile: mobile.trim() } : { email: email.trim().toLowerCase(),...(signup && mobile.trim() ? {mobile:mobile.trim()} : {}) });
      if (!result.challengeId) throw new Error("Unable to start patient verification. Please retry.");
      setChallengeId(result.challengeId);
      setChannels(result.channels ?? { [channel]: {status:"delivery_unknown"} });
      if (!resendEmail) setInitialSms(result.channels?.sms ? {sms:result.channels.sms} : undefined);
      setStep("code");
      setCooldown(60);
      setCode("");
    } catch (caught) {
      if ((caught as {data?:{code?:string}})?.data?.code === "PATIENT_SMS_NOT_REGISTERED") {
        setStep("email"); setChallengeId(""); setCode(""); setCooldown(0);
      }
      setError(authErrorMessage(caught, "Unable to send a login code."));
    }
    finally { setBusy(false); }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const result = await authRequest<{ authenticated: boolean }>("patient/verify", { challengeId, code: code.trim(), channel });
      if (!result.authenticated) throw new Error("That code is invalid or expired. Request a new code.");
      setCode("");
      await refresh();
      sessionStorage.removeItem("clinicflow-intent");
      // Only this exact value is honoured; the capability stays in per-tab storage, never in the URL.
      if (!signup && new URLSearchParams(search).get("returnTo") === "live-ticket" && sessionStorage.getItem("clinicflow-live-ticket"))
        sessionStorage.setItem("clinicflow-return-live-ticket", "yes");
      navigate("/onboarding", { replace: true });
    } catch (caught) { setError(authErrorMessage(caught, "That code is invalid or expired. Request a new code.")); }
    finally { setBusy(false); }
  }

  return <AuthShell eyebrow="Patient Access">
    <AuthCard title={mode === "access" ? "Patient Access" : signup ? "Patient Sign Up" : "Patient Login"} description={step === "email" ? (signup ? "Register with email. Mobile verification is optional." : "Choose guest booking, sign up, or log in to your patient account.") : "If this account is eligible, a code has been requested. Provider acceptance and delivery are not confirmed here."}>
      <div className="patient-entry-options" aria-label="Book without logging in">
        <p>Booking a visit? No account needed.</p>
        <Link className="button" href="/scan-qr" data-testid="link-patient-scan"><QrCode size={18}/> Scan QR Code</Link>
        <Link className="button secondary" href={patientGuestDestination(sessionStorage.getItem("clinicflow-qr"))} data-testid="link-patient-guest"><CalendarDays size={18}/> Guest Booking</Link>
      </div>
      <nav className="et-actions" aria-label="Patient account choices">
        <Link className={`button ${signup ? "" : "secondary"}`} href="/patient-login?mode=signup" aria-disabled={busy} onClick={event=>{if(busy)event.preventDefault();}} aria-current={signup ? "page" : undefined}>Patient Sign Up</Link>
        <Link className={`button ${!signup && mode !== "access" ? "" : "secondary"}`} href="/patient-login" aria-disabled={busy} onClick={event=>{if(busy)event.preventDefault();}} aria-current={!signup && mode !== "access" ? "page" : undefined}>Patient Login</Link>
      </nav>
      {mode !== "access" && <>
      <div className="patient-login-separator">{signup ? "Required email OTP · Separate optional SMS proof" : "Existing-account login"}</div>
      {step === "email" && !signup && <div className="et-actions" aria-label="Login code delivery">
        <button type="button" className={`button ${channel === "email" ? "" : "secondary"}`} aria-pressed={channel === "email"} disabled={busy} onClick={() => { setChannel("email"); setError(""); }} data-testid="button-patient-email-login">Email OTP</button>
        <button type="button" className={`button ${channel === "sms" ? "" : "secondary"}`} aria-pressed={channel === "sms"} disabled={busy} onClick={() => { setChannel("sms"); setError(""); }} data-testid="button-patient-sms-login">SMS OTP</button>
      </div>}
      {step === "email" ? <form onSubmit={sendCode}>
        {channel === "email" ? <FormField id="patient-login-email" label="Email address" required><EmailInput trimOnBlur={false} data-testid="input-patient-email" required value={email} onChange={event => setEmail(event.target.value)} /></FormField>
          : <FormField id="patient-login-mobile" label="Mobile number" required helper="Use the mobile number saved on your existing patient account. New patients can register using email."><PhoneInput data-testid="input-patient-mobile" required value={mobile} onChange={setMobile} autoComplete="tel" /></FormField>}
        {signup && <FormField label="Optional registration mobile" helper="Select a country code. Email OTP is required to create an account; a separate optional SMS code proves your phone. Existing accounts keep their saved details."><PhoneInput value={mobile} onChange={setMobile}/></FormField>}
        {signup && <p>After email verification, complete your name and consent. Already registered? Email verification opens your existing account; it does not create a duplicate or replace your phone.</p>}
        {error && <div className="error-box" role="alert" data-testid="status-patient-login-error">{error}</div>}
        <button className="button auth-submit" data-testid="button-send-patient-code" type="submit" disabled={busy}>{busy ? "Requesting…" : signup ? "Send required email code" : "Send login code"}</button>
      </form> : <form onSubmit={verifyCode}>
        <SecurityChannelNotice channels={channels?.email ? {email:channels.email} : channel === "sms" ? channels : undefined}/>
        <p>Codes expire within 10 minutes of the first request. Email resend keeps the same expiry. If expired, change details and start again. Check spam or use resend after the timer; if email remains unavailable, contact the clinic or System Admin.</p>
        <FormField id="patient-login-code" label={channel === "email" ? "Required email verification code" : "SMS login code"} required><VerificationCodeInput data-testid="input-patient-code" required value={code} onChange={setCode} /></FormField>
        {signup && channel === "email" && mobile && <RegistrationMobileProof key={challengeId} challengeId={challengeId} initialChannels={initialSms}/>}
        {error && <div className="error-box" role="alert" data-testid="status-patient-code-error">{error}</div>}
        <button className="button auth-submit" data-testid="button-verify-patient-code" type="submit" disabled={busy}>{busy ? "Verifying…" : "Verify and continue"}</button>
        <div className="auth-links"><button type="button" className="text-link" disabled={busy} data-testid="button-change-patient-email" onClick={() => { setStep("email"); setCode(""); setChallengeId(""); setError(""); }}>Change {channel === "sms" ? "Mobile" : "Email"}</button><button type="button" className="text-link" data-testid="button-resend-patient-code" disabled={busy || cooldown > 0} onClick={() => void sendCode()}>{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button></div>
      </form>}
      </>}
      <div className="auth-links"><Link href="/sign-in" data-testid="link-staff-login">Staff Login</Link></div>
    </AuthCard>
  </AuthShell>;
}