import { EmailInput } from "@/components/EmailInput";
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
import { PasswordInput } from "./PasswordInput";
import { FormField } from "./FormField";
import { required, validatePersonName, validateEmail, validatePassword } from "../lib/validators";
import { friendlyError } from "../lib/friendly-error";
import { notifySuccess } from "../lib/notify";

export function ClinicRegistration() {
  const { isLoaded, isSignedIn } = useNativeAuth();
  useEffect(() => { const old = document.title; document.title = `Register a Clinic | ${BRAND_NAME}`; return () => { document.title = old; }; }, []);
  if (!isLoaded) return <div className="page-loading">Preparing secure registration…</div>;
  if (!isSignedIn) return <RegistrationAccount/>;
  return <RegistrationIdentity/>;
}

function RegistrationAccount() {
  const { refresh } = useNativeAuth();
  const [step, setStep] = useState<"details" | "review" | "verify">("details");
  const stepHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { stepHeading.current?.focus(); }, [step]);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown,setCooldown]=useState(0);
  const [resendNotice,setResendNotice]=useState("");
  useEffect(()=>{if(cooldown<=0)return;const timer=window.setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>window.clearTimeout(timer);},[cooldown]);
  async function resendCode(){
    if(busy||cooldown>0||!challengeId)return;
    setBusy(true);setError("");setResendNotice("");
    try{
      const result=await authRequest<{challengeId:string}>("registration/resend",{challengeId});
      if(!result.challengeId)throw new Error("Could not resend the verification code. Please retry.");
      setChallengeId(result.challengeId);setCode("");setCooldown(60);setResendNotice("A new verification code was sent. Use the latest email; the original expiry time still applies.");notifySuccess("Verification code resent");
    }catch(caught){const message=caught instanceof Error?caught.message:"";setError(/invalid or expired verification/i.test(message)?"This registration challenge is no longer valid. Choose Change details to restart registration.":friendlyError(caught,"auth"));if((caught as {status?:number})?.status===429||/wait before requesting another code/i.test(message))setCooldown(60);}
    finally{setBusy(false);}
  }
  const [fieldErrors,setFieldErrors]=useState<Record<string,string|undefined>>({});
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    if(step==="details"){
      const errors={fullName:required()(fullName)||validatePersonName(fullName),email:required()(email)||validateEmail(email),password:required()(password)||validatePassword(password)};
      setFieldErrors(errors);
      const first=Object.entries(errors).find(([,message])=>message);
      if(first){document.getElementById(`registration-account-${first[0]}`)?.focus();return;}
       setError("");
       setStep("review");
       return;
    }
    setBusy(true); setError("");
    try {
      if (step === "review") {
        const result = await authRequest<{ challengeId: string }>("register/start", { email: email.trim().toLowerCase(), fullName: fullName.trim(), password });
        if (!result.challengeId) throw new Error("Could not send the verification code. Please retry.");
        setChallengeId(result.challengeId);
        setCooldown(60);setResendNotice("");
        setPassword("");
        setStep("verify");
      } else {
        const result = await authRequest<{ authenticated: boolean }>("register/verify", { challengeId, code: code.trim() });
        if (!result.authenticated) throw new Error("This code is invalid or expired.");
        setCode("");
        await refresh();
      }
    } catch (caught) { setError(friendlyError(caught,"auth")); }
    finally { setBusy(false); }
  }
  return <AuthShell eyebrow="Register a Clinic" registration><div className="auth-card registration-account-card">
    <h1>Start with your secure account.</h1>
    <p>Create an account with a verified email and password. Then we’ll guide you through your clinic, locations and opening hours.</p>
    <nav aria-label="Account registration progress"><ol className="registration-account-steps">
      {(["details", "review", "verify"] as const).map((item, index) => <li key={item} aria-current={step === item ? "step" : undefined}><span>{index + 1}.</span> {item === "details" ? "Account details" : item === "review" ? "Review" : "Verify email"}</li>)}
    </ol></nav>
    <div className="registration-account-container"><h2 ref={stepHeading} tabIndex={-1} className="registration-form-title">{step === "details" ? "Create your account" : step === "review" ? "Review your account" : "Verify your email"}</h2>
      <form onSubmit={submit}>
        {step === "details" ? <>
          <FormField label="Your Name" required id="registration-account-fullName" error={fieldErrors.fullName}><input type="text" autoComplete="name" value={fullName} onChange={event => {setFullName(event.target.value);setFieldErrors(current=>({...current,fullName:undefined}));}}/></FormField>
          <FormField label="Email Address" required id="registration-account-email" error={fieldErrors.email}><EmailInput data-testid="input-registration-email" value={email} onChange={event => {setEmail(event.target.value);setFieldErrors(current=>({...current,email:undefined}));}}/></FormField>
          <FormField label="Password" required id="registration-account-password" error={fieldErrors.password}><PasswordInput autoComplete="new-password" showChecklist value={password} onChange={event => {setPassword(event.target.value);setFieldErrors(current=>({...current,password:undefined}));}}/></FormField>
        </> : step === "review" ? <section aria-label="Account details review">
          <p>Check your details before we send your verification code.</p>
          <dl className="registration-account-review">
            <dt>Your name</dt><dd>{fullName.trim()}</dd>
            <dt>Email address</dt><dd>{email.trim().toLowerCase()}</dd>
            <dt>Password</dt><dd>Entered securely. Not displayed in this summary.</dd>
          </dl>
          <button className="text-link" type="button" disabled={busy} onClick={() => { setError(""); setFieldErrors({}); setStep("details"); }}>Edit Account Details</button>
        </section> : <FormField label={`Code Emailed to ${email.trim().toLowerCase()}`} required id="registration-account-code"><input type="text" inputMode="numeric" autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value)}/></FormField>}
        {error && <div className="error-box" role="alert">{error}</div>}
        {step==="verify"&&resendNotice&&<p role="status">{resendNotice}</p>}
        <button className="button auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : step === "details" ? "Review account details" : step === "review" ? "Send verification code" : "Verify and continue"}</button>
        {step === "verify" && <><button className="text-link" type="button" disabled={busy||cooldown>0} onClick={()=>void resendCode()} data-testid="registration-resend-code">{cooldown>0?`Resend in ${cooldown}s`:"Resend code"}</button><button className="text-link" type="button" disabled={busy} onClick={() => { setStep("details"); setCode(""); setChallengeId(""); setError("");setResendNotice("");setCooldown(0); }}>Change Details</button></>}
      </form>
    </div><p className="registration-note"><span className="registration-existing-signin">Already have a staff account? <Link href="/sign-in">Sign in to your workspace.</Link> </span>Existing patient or staff accounts cannot be converted through clinic registration.</p>
  </div></AuthShell>;
}

function RegistrationIdentity() {
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), staleTime: 0 } });
  if (me.isLoading) return <div className="page-loading">Checking your account…</div>;
  if (me.error) return <div className="error-box" role="alert">{friendlyError(me.error,"load")}<button onClick={() => me.refetch()} data-testid="registration-retry-account">Try Again</button></div>;
  if (me.data?.user?.role === "superAdmin") return <AuthAccess><ClinicAdminOnboarding guided/></AuthAccess>;
   if (me.data?.user?.role === "clinicAdmin" && !me.data.user.clinicIds?.length) return <RegistrationForm/>;
  if (me.data?.user) {
    const role = me.data.user.role === "clinicAdmin" ? "admin" : me.data.user.role;
    return <div className="clinic-registration"><Logo/><main className="registration-card"><h1>You already have a {BRAND_NAME} account.</h1><p>Clinic registration is for a new clinic owner. Your existing role and permissions will not change.</p><Link className="button" href={`/${role}/dashboard`} data-testid="registration-existing-workspace">Go to Your Workspace</Link></main></div>;
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
        clinic: { dateFormat: values.dateFormat, timeFormat: values.timeFormat, name: values.name.trim(), slug: values.slug, address: values.branches[0].address.trim(), email: values.clinicEmail.trim() || null, phone: values.phone.trim() || null, categoryId: values.categoryId || null, specialityIds: values.specialityIds, referralCode: values.referralCode.trim() || null },
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
  if (references.error && !references.data) return <div className="error-box" role="alert">{friendlyError(references.error,"load")}<button data-testid="registration-retry-options" onClick={() => references.refetch()}>Try Again</button></div>;
    return <ClinicRegistrationWizard onStepChange={registration.reset} initial={{ fullName: me.data.user.fullName || "", email: me.data.user.email || "" }} categories={references.data?.categories || []} specialities={references.data?.specialities || []} qualifications={references.data?.qualifications || []} checkSlug={async slug => (await api.checkSlugAvailability({ slug })).available} onSubmit={finish} busy={registration.isPending} error={registration.error?friendlyError(registration.error,"save"):undefined} finishSecurity={<FormField label="Confirm Your Account Password" required helper="Verified securely before staff access is created. Never stored in your registration draft."><PasswordInput autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} data-testid="registration-confirm-password"/></FormField>}/>;
}