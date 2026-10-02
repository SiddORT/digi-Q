import { useEffect, useRef, useState } from "react";
import { useNativeAuth, authRequest } from "../auth/native-auth";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { AuthShell } from "../auth/AuthShell";
import { AuthAccess } from "../auth/AuthAccess";
import { ClinicAdminOnboarding } from "./ClinicAdminOnboarding";
import { ClinicRegistrationComplete } from "./ClinicRegistrationComplete";
import { ClinicRegistrationWizard, type RegistrationValues } from "./ClinicRegistrationWizard";
import { Logo } from "../App";
import { BRAND_NAME } from "../branding";
import "./ClinicRegistrationAccount.css";

export function ClinicRegistration() {
  const { isLoaded, isSignedIn } = useNativeAuth();
  useEffect(() => { const old = document.title; document.title = `Register a Clinic | ${BRAND_NAME}`; return () => { document.title = old; }; }, []);
  if (!isLoaded) return <div className="page-loading">Preparing secure registration…</div>;
  if (!isSignedIn) return <RegistrationAccount/>;
  return <RegistrationIdentity/>;
}

function RegistrationAccount() {
  const { refresh } = useNativeAuth();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (step === "details") {
        const result = await authRequest<{ challengeId: string }>("register/start", { email: email.trim().toLowerCase(), fullName: fullName.trim(), password });
        if (!result.challengeId) throw new Error("Could not send the verification code. Please retry.");
        setChallengeId(result.challengeId);
        setPassword("");
        setStep("verify");
      } else {
        const result = await authRequest<{ authenticated: boolean }>("register/verify", { challengeId, code: code.trim() });
        if (!result.authenticated) throw new Error("This code is invalid or expired.");
        setCode("");
        await refresh();
      }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to register your clinic account."); }
    finally { setBusy(false); }
  }
  return <AuthShell eyebrow="REGISTER A CLINIC" registration><div className="auth-card registration-account-card">
    <h1>Start with your secure account.</h1>
    <p>Create an account with a verified email and password. Then we’ll guide you through your clinic, locations and opening hours.</p>
    <div className="registration-account-container"><h2 className="registration-form-title">{step === "details" ? "Create your account" : "Verify your email"}</h2>
      <form onSubmit={submit}>
        {step === "details" ? <>
          <label>Your name<input type="text" autoComplete="name" required value={fullName} onChange={event => setFullName(event.target.value)}/></label>
          <label>Email address<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)}/></label>
          <label>Password<input type="password" autoComplete="new-password" minLength={8} pattern="(?=.*[A-Za-z])(?=.*[0-9]).{8,}" title="At least 8 characters, including letters and numbers" required value={password} onChange={event => setPassword(event.target.value)}/></label>
        </> : <label>Code emailed to {email}<input type="text" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value)}/></label>}
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="button auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : step === "details" ? "Send verification code" : "Verify and continue"}</button>
        {step === "verify" && <button className="text-link" type="button" disabled={busy} onClick={() => { setStep("details"); setCode(""); setChallengeId(""); setError(""); }}>Change details</button>}
      </form>
    </div><p className="registration-note"><span className="registration-existing-signin">Already have a staff account? <Link href="/sign-in">Sign in to your workspace.</Link> </span>Existing patient or staff accounts cannot be converted through clinic registration.</p>
  </div></AuthShell>;
}

function RegistrationIdentity() {
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), staleTime: 0 } });
  if (me.isLoading) return <div className="page-loading">Checking your account…</div>;
  if (me.error) return <div className="error-box" role="alert">Unable to check your account. {me.error.message}<button onClick={() => me.refetch()} data-testid="registration-retry-account">Try again</button></div>;
  if (me.data?.user?.role === "superAdmin") return <AuthAccess><ClinicAdminOnboarding guided/></AuthAccess>;
   if (me.data?.user?.role === "clinicAdmin" && !me.data.user.clinicIds?.length) return <RegistrationForm/>;
  if (me.data?.user) {
    const role = me.data.user.role === "clinicAdmin" ? "admin" : me.data.user.role;
    return <div className="clinic-registration"><Logo/><main className="registration-card"><h1>You already have a {BRAND_NAME} account.</h1><p>Clinic registration is for a new clinic owner. Your existing role and permissions will not change.</p><Link className="button" href={`/${role}/dashboard`} data-testid="registration-existing-workspace">Go to your workspace</Link></main></div>;
  }
   return <div className="error-box" role="alert">Unable to prepare clinic registration for this account. Please sign out and retry.</div>;
}

function RegistrationForm() {
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey() } });
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const [completed, setCompleted] = useState<api.ClinicSettingsResult | null>(null);
  const locked = useRef(false);
  const registration = api.useRegisterClinic();
  const references = api.useGetRegistrationOptions();
  async function finish(values: RegistrationValues) {
    if (locked.current) return;
    if (!password) throw new Error("Confirm your account password to finish registration.");
    locked.current = true;
    try {
      const result = await registration.mutateAsync({ data: {
        fullName: values.fullName.trim(), ...(values.mobile.trim() ? { mobile: values.mobile.trim() } : {}), password,
        clinic: { name: values.name.trim(), slug: values.slug, address: values.branches[0].address.trim(), email: values.clinicEmail.trim() || null, phone: values.phone.trim() || null, categoryId: values.categoryId || null, specialityIds: values.specialityIds, referralCode: values.referralCode.trim() || null },
        branches: values.branches.map(b => ({ name: b.name.trim(), slug: b.slug, address: b.address.trim(), city: b.city.trim(), timezone: b.timezone, email: b.email.trim() || null, phone: b.phone.trim() || null, inheritEmail: b.inheritEmail, inheritPhone: b.inheritPhone, openingHours: b.hours.filter(d => d.isOpen).flatMap(d => d.sessions.map(s => ({ dayOfWeek: d.dayOfWeek, ...s }))) })),
        ownDoctor: values.alsoConsult, ...(values.alsoConsult ? { specializationId: values.specializationId || undefined, qualificationIds: values.qualificationIds } : {}),
        ...(values.alsoConsult && values.linkConsultationHours ? { ownerSchedule: { maxTokens: Number(values.sessionCapacity), consultationMinutes: Number(values.consultationMinutes), tokenPrefix: "A", queueMode: "mixed" as const } } : {}),
      } });
      setPassword("");
      setCompleted(result);
      // Do not invalidate /me here: that would unmount the success confirmation.
      client.removeQueries({ queryKey: api.getGetAuthStatusQueryKey() });
      client.invalidateQueries({ predicate: q => q.queryKey[0] !== api.getGetMeQueryKey()[0] });
    } finally { setPassword(""); locked.current = false; }
  }
    if (completed) return <ClinicRegistrationComplete result={completed}/>;
   if (me.isLoading) return <div className="page-loading">Loading your account…</div>;
   if (me.error || !me.data?.user) return <div className="error-box" role="alert">Unable to load your account. <button onClick={() => me.refetch()}>Retry</button></div>;
  if (references.isLoading) return <div className="page-loading">Loading clinic setup options…</div>;
  if (references.error && !references.data) return <div className="error-box" role="alert">Could not load clinic setup options. {references.error.message}<button data-testid="registration-retry-options" onClick={() => references.refetch()}>Try again</button></div>;
    return <ClinicRegistrationWizard initial={{ fullName: me.data.user.fullName || "", email: me.data.user.email || "" }} categories={references.data?.categories || []} specialities={references.data?.specialities || []} qualifications={references.data?.qualifications || []} checkSlug={async slug => (await api.checkSlugAvailability({ slug })).available} onSubmit={finish} busy={registration.isPending} error={registration.error?.message} finishSecurity={<label style={{ marginTop: 20 }}>Confirm your account password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} data-testid="registration-confirm-password"/><small className="registration-note">Verified securely before staff access is created. Never stored in your registration draft.</small></label>}/>;
}