import { PageDescription } from "./PageDescription";
import { VerificationCodeInput } from "./VerificationCodeInput";
import { EmailInput } from "@/components/EmailInput";
import { PhoneInput } from "./PhoneInput";
import { OwnerMobileProof } from "../auth/RegistrationMobileProof";
import { type SecurityChannels } from "../auth/SecurityChannelNotice";
import { registrationEmailAccepted, registrationEmailError } from "../auth/registration-email-feedback";
import { useEffect, useRef, useState } from "react";
import { useNativeAuth, authRequest } from "../auth/native-auth";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { AuthShell } from "../auth/AuthShell";
import { AuthAccess } from "../auth/AuthAccess";
import { ClinicAdminOnboarding } from "./ClinicAdminOnboarding";
import { ClinicRegistrationComplete } from "./ClinicRegistrationComplete";
import { ClinicRegistrationWizard, ownerSchedulePayload, type RegistrationValues } from "./ClinicRegistrationWizard";
import { Logo } from "../App";
import { BRAND_NAME } from "../branding";
import "./ClinicRegistrationAccount.css";
import { PasswordInput } from "./PasswordInput";
import { FormField } from "./FormField";
import { required, validatePersonName, validateEmail, validatePassword } from "../lib/validators";
import { friendlyError, retryWaitSeconds } from "../lib/friendly-error";
import { useServerWait } from "../lib/use-server-wait";
import { notifySuccess } from "../lib/notify";
import { ActionLabel } from "./ActionLabel";
import { accountDraftSchema, setupDraftSchema, registrationDraftKey, readRegistrationDraft, writeRegistrationDraft, clearRegistrationDraft } from "../lib/registration-draft";
import { registrationDoctorIssue, requireRegistrationDoctor } from "../lib/registration-doctor-completion";

export function ClinicRegistration() {
  const { isLoaded, isSignedIn } = useNativeAuth();
  useEffect(() => { if (isSignedIn) clearRegistrationDraft(registrationDraftKey("account", "anonymous")); }, [isSignedIn]);
  useEffect(() => { const old = document.title; document.title = `Register a Clinic | ${BRAND_NAME}`; return () => { document.title = old; }; }, []);
  if (!isLoaded) return <div className="page-loading">Preparing secure registration…</div>;
  if (!isSignedIn) return <RegistrationAccount/>;
  return <RegistrationIdentity/>;
}

function RegistrationAccount() {
  const { refresh } = useNativeAuth();
  const draftKey = registrationDraftKey("account", "anonymous");
  const [draft] = useState(() => readRegistrationDraft(draftKey, accountDraftSchema));
  const [stored, setStored] = useState(draft.stored);
   const [step, setStep] = useState<"details" | "verify">(draft.data?.step === "verify" ? "verify" : "details");
   const submitLock = useRef(false);
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const initialStep = useRef(true);
  useEffect(() => { if (initialStep.current) initialStep.current = false; else stepHeading.current?.focus(); }, [step]);
  const [email, setEmail] = useState(draft.data?.email || "");
  const [fullName, setFullName] = useState(draft.data?.fullName || "");
  const [password, setPassword] = useState("");
  const [verifyEmailNow, setVerifyEmailNow] = useState(false);
  const [code, setCode] = useState("");
  const [mobile,setMobile] = useState(draft.data?.mobile || "");
  const [mobileProofId,setMobileProofId] = useState("");
  const [mobilePending,setMobilePending] = useState(false);
  const [channels,setChannels] = useState<SecurityChannels>();
  const [challengeId, setChallengeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown,setCooldown]=useState(0);
  const limit=useServerWait();
  const [resendNotice,setResendNotice]=useState("");
  const optionalEmailError = (caught: unknown, action: "start" | "resend" | "verify") =>
    registrationEmailError(caught,action).replace(/Email verification is still required\./gi,"You can continue with your verified mobile.");
  useEffect(() => { if (!fullName && !email && !mobile && step === "details") { clearRegistrationDraft(draftKey); return; } setStored(writeRegistrationDraft(draftKey, accountDraftSchema, { fullName, email, mobile, step })); }, [draftKey, fullName, email, mobile, step]);
  useEffect(() => {
    if (draft.data?.step !== "verify") return;
    let active = true;
    setBusy(true);
    authRequest<{ challengeId: string | null;mobilePending?:boolean }>("registration/resume", { email: draft.data.email.trim().toLowerCase(), fullName: draft.data.fullName.trim() })
      .then(result => { if (!active) return; if (result.challengeId) { setChallengeId(result.challengeId); setMobilePending(Boolean(result.mobilePending)); setCooldown(60); } else { setStep("details"); setError("Verification could not be resumed. Your name and email are retained; re-enter your password to request a code."); } })
      .catch(() => { if (active) { setStep("details"); setError("Verification could not be resumed. Re-enter your password to continue securely."); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [draft]);
  useEffect(()=>{if(cooldown<=0)return;const timer=window.setTimeout(()=>setCooldown(value=>Math.max(0,value-1)),1000);return()=>window.clearTimeout(timer);},[cooldown]);
  async function resendCode(){
    if(submitLock.current||busy||limit.wait>0||cooldown>0||!challengeId)return;
    submitLock.current=true;
    setBusy(true);setError("");setResendNotice("");setChannels(current=>current?.sms?{sms:current.sms}:undefined);setCooldown(60);
    try{
      const result=await authRequest<{challengeId:string;channels?:SecurityChannels}>("registration/resend",{challengeId});
      if(!result.challengeId)throw new Error("Could not resend the verification code. Please retry.");
      setChannels(current=>({...current,...result.channels}));
      setChallengeId(result.challengeId);
      if(registrationEmailAccepted(result.channels)){setCode("");setResendNotice("Use the code in the latest verification email. Earlier codes no longer work.");notifySuccess("Verification email accepted for sending");}
     }catch(caught){limit.record(caught);setError(optionalEmailError(caught,"resend"));if((caught as {status?:number})?.status===429)setCooldown(Math.max(60,retryWaitSeconds(caught)));}
    finally{submitLock.current=false;setBusy(false);}
  }
  const [fieldErrors,setFieldErrors]=useState<Record<string,string|undefined>>({});
  async function finishWithMobile(id: string) {
    const result = await authRequest<{authenticated:boolean}>("register/verify", {challengeId:id,skipEmailVerification:true});
    if (!result.authenticated) throw new Error("Registration could not be completed. Please try again.");
    clearRegistrationDraft(draftKey);
    setCode(""); setPassword("");
    await refresh();
  }
  async function skipEmail() {
    if (submitLock.current || busy || limit.wait > 0 || !challengeId) return;
    submitLock.current=true; setBusy(true); setError("");
    try { await finishWithMobile(challengeId); }
    catch (caught) { limit.record(caught); setError(friendlyError(caught,"auth","Could not continue. Verify your mobile again if this registration has expired.")); }
    finally {submitLock.current=false;setBusy(false);}
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
     if (submitLock.current||busy||limit.wait>0) return;
    if(step==="details"){
      if (!mobileProofId) { setError("Verify your mobile first."); return; }
      const errors={fullName:required()(fullName)||validatePersonName(fullName),email:required()(email)||validateEmail(email),password:required()(password)||validatePassword(password)};
      setFieldErrors(errors);
      const first=Object.entries(errors).find(([,message])=>message);
      if(first){document.getElementById(`registration-account-${first[0]}`)?.focus();return;}
    }
     submitLock.current = true;
     setBusy(true); setError("");
    try {
       if (step === "details") {
        if (!password) { setStep("details"); throw new Error("Re-enter your password; passwords are never retained in temporary drafts."); }
         const result = await authRequest<{ challengeId: string;channels?:SecurityChannels }>("register/start", { email: email.trim().toLowerCase(), fullName: fullName.trim(), password, mobile, mobileProofId, skipEmailVerification: !verifyEmailNow });
        if (!result.challengeId) throw new Error("Could not prepare registration. Please retry.");
        setChallengeId(result.challengeId);
        setMobilePending(Boolean(mobile));
        if (!verifyEmailNow) {
          // Retain a resumable intent if session completion is interrupted.
          setStep("verify");
          await finishWithMobile(result.challengeId);
          return;
        }
        setChannels(result.channels);
        setCooldown(60);setResendNotice("");
        setPassword("");
        setStep("verify");
      } else {
        const result = await authRequest<{ authenticated: boolean }>("register/verify", { challengeId, code: code.trim() });
        if (!result.authenticated) throw new Error("This code is invalid or expired.");
        setCode("");
        clearRegistrationDraft(draftKey);
        await refresh();
      }
    } catch (caught) { limit.record(caught);setError(step === "details" && !verifyEmailNow
      ? friendlyError(caught,"auth","Registration could not be completed. Please try again.")
      : optionalEmailError(caught,step === "details" ? "start" : "verify")); }
     finally { submitLock.current = false; setBusy(false); }
  }
  return <AuthShell eyebrow="Register a Clinic" registration><div className="auth-card registration-account-card">
    <h1>Start with your secure account.</h1>
    <PageDescription text="Create your clinic-owner account with a verified mobile." help="Enter your email for sign-in. Email verification is optional after mobile verification; then set up your clinic, locations and opening hours." label="About clinic registration"/>
    <nav aria-label="Account registration progress"><ol className="registration-account-steps">
       {(["details", "verify"] as const).map((item, index) => <li key={item} aria-current={step === item ? "step" : undefined}><span>{index + 1}.</span> {item === "details" ? "Account details" : "Verify email (optional)"}</li>)}
    </ol></nav>
     <div className="registration-account-container"><h2 ref={stepHeading} tabIndex={-1} className="registration-form-title">{step === "details" ? "Create your account" : "Verify your email"}</h2>
      <form onSubmit={submit}>
        <div hidden={step!=="details"}><OwnerMobileProof flow="public" mobile={mobile} onChange={setMobile} onProof={setMobileProofId}/></div>
        {step === "details" ? <>
          <fieldset hidden={!mobileProofId} disabled={!mobileProofId} style={{border:0,padding:0,minWidth:0}}>
          <FormField label="Your Name" required id="registration-account-fullName" error={fieldErrors.fullName}><input type="text" autoComplete="name" value={fullName} onChange={event => {setFullName(event.target.value);setFieldErrors(current=>({...current,fullName:undefined}));}}/></FormField>
          <FormField label="Email Address" required id="registration-account-email" error={fieldErrors.email} helper="Used for email/password sign-in. Verification is optional after your mobile is verified."><EmailInput data-testid="input-registration-email" value={email} onChange={event => {setEmail(event.target.value);setFieldErrors(current=>({...current,email:undefined}));}}/></FormField>
          <label className="check-label"><input type="checkbox" checked={verifyEmailNow} onChange={event=>setVerifyEmailNow(event.target.checked)}/> Verify email now (optional)</label>
          <FormField label="Password" required id="registration-account-password" error={fieldErrors.password}><PasswordInput autoComplete="new-password" showChecklist value={password} onChange={event => {setPassword(event.target.value);setFieldErrors(current=>({...current,password:undefined}));}}/></FormField>
          </fieldset>
         </> : <><p>Email: <strong>{email.trim().toLowerCase()}</strong></p><p>Your mobile has been verified. Email verification is optional; you can continue to register your clinic without an email code.</p><FormField label="Email verification code" id="registration-account-code"><VerificationCodeInput value={code} onChange={setCode}/></FormField></>}
         {step === "verify" && channels?.email?.status && channels.email.status !== "provider_accepted" && <p role="status">The verification email was not confirmed as sent. You can continue with your verified mobile.</p>}
        {error && <div className="error-box" role="alert">{error}</div>}
        {step==="verify"&&resendNotice&&<p role="status">{resendNotice}</p>}
          <button className="button auth-submit" type="submit" disabled={busy||limit.wait>0||(step==="details"?!mobileProofId:code.length!==6)}><ActionLabel>{busy ? "Please wait…" : limit.wait>0?`Try again in ${limit.wait}s`:step === "details" ? verifyEmailNow ? "Send email verification code" : "Continue to register clinic" : "Verify email and continue"}</ActionLabel></button>
          {step==="verify"&&<button type="button" className="button secondary auth-submit" disabled={busy||limit.wait>0||!challengeId} onClick={()=>void skipEmail()}><ActionLabel>Continue without verifying email</ActionLabel></button>}
        <p className="registration-note" role="status">{stored ? fullName || email || mobile || step !== "details" ? "Name, email, mobile and stage are temporarily saved in this tab for up to 24 hours. Re-enter passwords and codes after reload." : "New non-secret details will be temporarily saved in this tab as you enter them." : "Browser storage is unavailable. Details remain only while this page is open."}</p>
        <button type="button" className="text-link" disabled={busy} onClick={() => { clearRegistrationDraft(draftKey); setMobile("");setMobileProofId("");setFullName(""); setEmail(""); setPassword(""); setCode(""); setChallengeId(""); setStep("details"); setError(""); setResendNotice(""); setCooldown(0); }}><ActionLabel>Discard account draft</ActionLabel></button>
         {step === "verify" && <><button className="text-link" type="button" disabled={busy||cooldown>0} onClick={()=>void resendCode()} data-testid="registration-resend-code"><ActionLabel>{cooldown>0?`Resend in ${cooldown}s`:"Resend code"}</ActionLabel></button><button className="text-link" type="button" disabled={busy} onClick={() => { setStep("details"); setPassword(""); setCode(""); setChallengeId(""); setChannels(undefined); setMobilePending(false); setError("");setResendNotice("");setCooldown(0); requestAnimationFrame(()=>document.getElementById("registration-account-email")?.focus()); }}><ActionLabel>Change email</ActionLabel></button></>}
      </form>
    </div><p className="registration-note">This journey creates a new clinic-owner account. Already have a staff account? <Link href="/sign-in">Sign in to your workspace instead.</Link> Patient accounts cannot be converted into clinic-owner accounts here.</p>
  </div></AuthShell>;
}

function RegistrationIdentity() {
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), staleTime: 0 } });
  if (me.isLoading) return <div className="page-loading">Checking your account…</div>;
  if (me.error) return <div className="error-box" role="alert">{friendlyError(me.error,"load")}<button type="button" onClick={() => me.refetch()} data-testid="registration-retry-account">Try Again</button></div>;
   if (me.data?.user?.role === "superAdmin") return <AuthAccess><ClinicAdminOnboarding key={me.data.user.id} guided draftActor={me.data.user.id}/></AuthAccess>;
    if (me.data?.user?.role === "clinicAdmin") return <RegistrationForm key={me.data.user.id} actorId={me.data.user.id}/>;
  if (me.data?.user) {
    const role = me.data.user.role;
    return <div className="clinic-registration"><Logo/><main className="registration-card registration-existing"><h1>You already have a {BRAND_NAME} account.</h1><p>Clinic registration is for a new clinic owner. Your existing role and permissions will not change.</p><Link className="button" href={`/${role}/dashboard`} data-testid="registration-existing-workspace">Go to Your Workspace</Link></main></div>;
  }
   return <div className="error-box" role="alert">Unable to prepare clinic registration for this account. Please sign out and retry.</div>;
}

function RegistrationForm({ actorId }: { actorId: string }) {
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey() } });
  const client = useQueryClient();
  const [password, setPassword] = useState("");
  const [completed, setCompleted] = useState<api.ClinicSettingsResult | null>(null);
  const locked = useRef(false);
  const registration = api.useRegisterClinic();
  const references = api.useGetRegistrationOptions();
  const draftKey = registrationDraftKey("self", actorId);
  const [pending] = useState(() => readRegistrationDraft(draftKey, setupDraftSchema).data);
  const recovery = api.useGetClinicRegistrationCompletion({ requestId: pending?.requestId || "" }, { query: { queryKey: api.getGetClinicRegistrationCompletionQueryKey({ requestId: pending?.requestId || "" }), enabled: !!pending, retry: false, staleTime: 0 } });
  const recovered = recovery.data?.result;
  const recoveryIssue = recovered ? registrationDoctorIssue(recovered, pending?.values.alsoConsult === true) : undefined;
  useEffect(() => { if (recovered && !recoveryIssue) { clearRegistrationDraft(draftKey); setCompleted(recovered); } }, [recovered, recoveryIssue, draftKey]);
  async function finish(values: RegistrationValues, requestId: string) {
    if (locked.current) return;
    locked.current = true;
    try {
      const saved = await api.getClinicRegistrationCompletion({ requestId });
      if (saved.result) { requireRegistrationDoctor(saved.result, values.alsoConsult); clearRegistrationDraft(draftKey); setCompleted(saved.result); return; }
      if (!password) throw new Error("Confirm your account password to finish registration.");
      const result = await registration.mutateAsync({ data: {
        requestId,
        fullName: values.fullName.trim(), ...(values.mobile.trim() ? { mobile: values.mobile.trim() } : {}), password,
        clinic: { dateFormat: values.dateFormat, timeFormat: values.timeFormat, name: values.name.trim(), slug: values.slug, address: values.branches[0].address.trim(), email: values.clinicEmail.trim() || null, phone: values.phone.trim() || null, categoryId: values.categoryId || null, customCategory: values.customCategory?.trim() || null, specialityIds: values.specialityIds, customSpecialities: values.customSpecialities.map(text => text.trim()), referralCode: values.referralCode.trim() || null },
        branches: values.branches.map(b => ({ name: b.name.trim(), slug: b.slug, address: b.address.trim(), city: b.city.trim(), state: b.state?.trim() || undefined, pincode: b.pincode?.trim() || undefined, country: b.country?.trim() || undefined, timezone: b.timezone, email: b.email.trim() || null, phone: b.phone.trim() || null, inheritEmail: b.inheritEmail, inheritPhone: b.inheritPhone, openingHours: b.hours.filter(d => d.isOpen).flatMap(d => d.sessions.map(s => ({ dayOfWeek: d.dayOfWeek, ...s }))) })),
        ownDoctor: values.alsoConsult, ...(values.alsoConsult ? { specializationId: values.specializationId || undefined, qualificationIds: values.qualificationIds } : {}),
        ...ownerSchedulePayload(values),
      } });
      setPassword("");
      requireRegistrationDoctor(result, values.alsoConsult);
      setCompleted(result);
      // Do not invalidate /me here: that would unmount the success confirmation.
       // NativeAuth owns this session snapshot; AuthAccess only observes it.
       // The account stays Clinic Admin, so preserve status for Open Workspace.
      client.invalidateQueries({ predicate: q => q.queryKey[0] !== api.getGetMeQueryKey()[0] });
    } catch (caught) {
      const saved = await api.getClinicRegistrationCompletion({ requestId });
      if (!saved.result) throw caught;
      requireRegistrationDoctor(saved.result, values.alsoConsult);
      clearRegistrationDraft(draftKey); setCompleted(saved.result);
      void client.invalidateQueries({ predicate: q => q.queryKey[0] !== api.getGetMeQueryKey()[0] });
    } finally { setPassword(""); locked.current = false; }
  }
    if (completed) return <ClinicRegistrationComplete result={completed}/>;
    if (recoveryIssue) return <div className="error-box" role="alert">{recoveryIssue}</div>;
   if (pending && recovery.isLoading) return <div className="page-loading">Checking whether registration already completed…</div>;
   if (pending && recovery.error) return <div className="error-box" role="alert">Could not check saved registration. No new creation will be attempted.<button onClick={() => void recovery.refetch()}>Try Again</button></div>;
   if (me.isLoading) return <div className="page-loading">Loading your account…</div>;
   if (me.error || !me.data?.user) return <div className="error-box" role="alert">Unable to load your account. <button type="button" onClick={() => me.refetch()}>Retry</button></div>;
   if (me.data.user.clinicIds?.length) return <div className="clinic-registration"><main className="registration-card"><h1>Your clinic is already registered.</h1><p>Open your saved workspace. Do not register again.</p><Link className="button" href="/admin/dashboard"><ActionLabel>Open Workspace</ActionLabel></Link></main></div>;
      return <ClinicRegistrationWizard referenceError={references.error ? "Healthcare suggestions could not be loaded. Custom clinic entry remains available." : undefined} referenceLoading={references.isFetching} onRetryReferences={() => void references.refetch()} draftKey={draftKey} onStepChange={registration.reset} initial={{ fullName: me.data.user.fullName || "", email: me.data.user.email || "" }} categories={references.data?.categories || []} specialities={references.data?.specialities || []} qualifications={references.data?.qualifications || []} checkSlug={async slug => (await api.checkSlugAvailability({ slug })).available} onSubmit={finish} busy={registration.isPending} error={registration.error?friendlyError(registration.error,"save"):undefined} finishSecurity={<FormField label="Confirm Your Account Password" required helper="Verified securely before staff access is created. Never stored in your registration draft."><PasswordInput autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} data-testid="registration-confirm-password"/></FormField>}/>;
}
