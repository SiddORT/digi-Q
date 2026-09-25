import { useEffect, useRef, useState } from "react";
import { SignUp, useAuth, useClerk, useUser } from "@clerk/react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { AuthShell } from "../auth/AuthShell";
import { AuthAccess } from "../auth/AuthAccess";
import { ClinicAdminOnboarding } from "./ClinicAdminOnboarding";
import { ClinicRegistrationWizard, type RegistrationValues } from "./ClinicRegistrationWizard";
import { Logo } from "../App";
import "./ClinicRegistrationAccount.css";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
export function ClinicRegistration() {
  const { isLoaded, isSignedIn } = useAuth();
  useEffect(() => { const old = document.title; document.title = "Register a Clinic | ClinicFlow"; return () => { document.title = old; }; }, []);
  if (!isLoaded) return <div className="page-loading">Preparing secure registration…</div>;
  if (!isSignedIn) return <AuthShell eyebrow="REGISTER A CLINIC" registration><div className="auth-card registration-account-card"><h1>Start with your secure account.</h1><p>Create an account with a verified email and password. Then we’ll guide you through your clinic, locations and opening hours.</p><div className="registration-clerk-container"><h2 className="registration-form-title">Create your account</h2><SignUp routing="path" path={`${basePath}/register-clinic`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/register-clinic`} appearance={{ elements: {
    rootBox: { width: "100%", minWidth: 0, maxWidth: "100%" },
    cardBox: { width: "100%", minWidth: 0, maxWidth: "100%" },
    card: { width: "100%", minWidth: 0, maxWidth: "100%", padding: "20px 16px" },
    main: { minWidth: 0, width: "100%" },
    form: { minWidth: 0, width: "100%" },
    formFieldRow: { minWidth: 0, maxWidth: "100%" },
    formFieldInput: { minWidth: 0, maxWidth: "100%" },
    footer: { minWidth: 0, maxWidth: "100%", paddingLeft: 16, paddingRight: 16, boxSizing: "border-box" },
    socialButtons: { display: "none" },
    socialButtonsBlockButton: { display: "none" },
    socialButtonsIconButton: { display: "none" },
    dividerRow: { display: "none" },
  } }}/></div><p className="registration-note"><span className="registration-existing-signin">Already have a staff account? <Link href="/sign-in">Sign in to your workspace.</Link> </span>Existing patient or staff accounts cannot be converted through clinic registration.</p></div></AuthShell>;
  return <RegistrationIdentity/>;
}

function RegistrationIdentity() {
  const me = api.useGetMe({ query: { queryKey: api.getGetMeQueryKey(), staleTime: 0 } });
  const { user } = useUser();
  const { signOut, openUserProfile } = useClerk();
  if (me.isLoading) return <div className="page-loading">Checking your account…</div>;
  if (me.error) return <div className="error-box" role="alert">Unable to check your account. {me.error.message}<button onClick={() => me.refetch()} data-testid="registration-retry-account">Try again</button></div>;
  if (me.data?.user?.role === "superAdmin") return <AuthAccess><ClinicAdminOnboarding guided/></AuthAccess>;
  if (me.data?.user) {
    const role = me.data.user.role === "clinicAdmin" ? "admin" : me.data.user.role;
    return <div className="clinic-registration"><Logo/><main className="registration-card"><h1>You already have a ClinicFlow account.</h1><p>Clinic registration is for a new clinic owner. Your existing role and permissions will not change.</p><Link className="button" href={`/${role}/dashboard`} data-testid="registration-existing-workspace">Go to your workspace</Link></main></div>;
  }
  if (!user?.passwordEnabled) return <div className="clinic-registration"><Logo/><main className="registration-card"><h1>A staff password is required.</h1><p>Clinic administration requires an email-and-password account. This identity does not have a password enabled. Open secure account settings and add a password under Security, then return here.</p><button className="button" onClick={() => openUserProfile()} data-testid="registration-account-security">Open secure account settings</button><p className="registration-note">If password setup is unavailable for this identity, sign out and create a new email-and-password account with a different email. Staff password recovery is only available after a staff account exists.</p><button className="text-link" onClick={() => signOut()} data-testid="registration-signout">Sign out</button></main></div>;
  return <RegistrationForm key={user.id}/>;
}

function RegistrationForm() {
  const { user } = useUser();
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
      } });
      setPassword("");
      setCompleted(result);
      // Do not invalidate /me here: that would unmount the success confirmation.
      client.removeQueries({ queryKey: api.getGetAuthStatusQueryKey() });
      client.invalidateQueries({ predicate: q => q.queryKey[0] !== api.getGetMeQueryKey()[0] });
    } finally { setPassword(""); locked.current = false; }
  }
   if (completed) return <div className="clinic-registration"><Logo/><main className="registration-card"><span className="eyebrow">YOUR CLINIC IS REGISTERED</span><h1>{completed.clinic.name} is ready to set up.</h1><p>Your clinic and {completed.branches.length} location{completed.branches.length === 1 ? "" : "s"} were saved together.</p><p>{completed.doctorId?"Your doctor profile is attached to this Clinic Admin account. Set up your weekly schedule before accepting bookings.":"Add doctor availability before accepting bookings."} Invite your team through Staff management whenever you need to.</p><div className="public-clinic-actions"><Link className="button" href="/admin/dashboard" onClick={() => client.invalidateQueries()} data-testid="registration-open-workspace">Open workspace</Link>{completed.doctorId&&<Link className="button secondary" href="/admin/profile" onClick={()=>client.invalidateQueries()} data-testid="registration-own-profile">My consultation</Link>}<Link className="button secondary" href="/admin/users" onClick={() => client.invalidateQueries()} data-testid="registration-invite-staff">Invite staff</Link>{completed.clinic.slug && <Link href={`/${completed.clinic.slug}`} data-testid="registration-public-page">View clinic page</Link>}</div></main></div>;
  if (references.isLoading) return <div className="page-loading">Loading clinic setup options…</div>;
  if (references.error && !references.data) return <div className="error-box" role="alert">Could not load clinic setup options. {references.error.message}<button data-testid="registration-retry-options" onClick={() => references.refetch()}>Try again</button></div>;
   return <ClinicRegistrationWizard initial={{ fullName: user?.fullName || "", email: user?.primaryEmailAddress?.emailAddress || "" }} categories={references.data?.categories || []} specialities={references.data?.specialities || []} qualifications={references.data?.qualifications || []} checkSlug={async slug => (await api.checkSlugAvailability({ slug })).available} onSubmit={finish} busy={registration.isPending} error={registration.error?.message} finishSecurity={<label style={{ marginTop: 20 }}>Confirm your account password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} data-testid="registration-confirm-password"/><small className="registration-note">Verified securely before staff access is created. Never stored in your registration draft.</small></label>}/>;
}