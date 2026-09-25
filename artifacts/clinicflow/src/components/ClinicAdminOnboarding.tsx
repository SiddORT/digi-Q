import { useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Plus } from "lucide-react";
import { ClinicRegistrationWizard, type RegistrationValues } from "./ClinicRegistrationWizard";
import { Logo } from "../App";

export function ClinicAdminOnboarding({ guided = false }: { guided?: boolean }) {
  if (guided) return <GuidedAdminSetup/>;
  return <section className="panel padded" style={{ marginBottom: 20 }}><h3>Clinic Admin setup</h3><p className="muted">Invite a clinic owner and create their clinic, locations and hours together. Existing ownership is never transferred.</p><Link className="button small" href="/register-clinic" data-testid="button-setup-clinic-admin"><Plus size={17}/>Set up Clinic Admin</Link></section>;
}

function GuidedAdminSetup() {
  const client = useQueryClient();
  const locked = useRef(false);
  const [completed, setCompleted] = useState<api.ClinicAdminOnboardingResult | null>(null);
  const setup = api.useOnboardClinicAdmin();
  const references = api.useGetRegistrationOptions();
  async function finish(values: RegistrationValues) {
    if (locked.current) return;
    locked.current = true;
    try {
      const result = await setup.mutateAsync({ data: {
        admin: { fullName: values.fullName.trim(), email: values.email.trim(), ...(values.mobile.trim() ? { mobile: values.mobile.trim() } : {}) },
        clinic: { name: values.name.trim(), address: values.branches[0].address.trim(), slug: values.slug, email: values.clinicEmail.trim() || undefined, phone: values.phone.trim() || undefined, categoryId: values.categoryId || undefined, specialityIds: values.specialityIds, referralCode: values.referralCode.trim() || null },
        branches: values.branches.map(b => ({ name: b.name.trim(), slug: b.slug, address: b.address.trim(), city: b.city.trim(), timezone: b.timezone, email: b.email.trim() || null, phone: b.phone.trim() || null, inheritEmail: b.inheritEmail, inheritPhone: b.inheritPhone, openingHours: b.hours.filter(d => d.isOpen).flatMap(d => d.sessions.map(s => ({ dayOfWeek: d.dayOfWeek, ...s }))) })),
        ownDoctor: values.alsoConsult, ...(values.alsoConsult ? { specializationId: values.specializationId || undefined, qualificationIds: values.qualificationIds } : {}),
      } });
      setCompleted(result);
      await client.invalidateQueries();
    } finally { locked.current = false; }
  }
   if (completed) return <div className="clinic-registration"><Logo/><main className="registration-card"><span className="eyebrow">CLINIC SETUP SAVED</span><h1>{completed.clinic.name}</h1><p>{completed.admin.fullName} is the clinic’s sole Clinic Admin{completed.doctorId?" with a doctor profile on the same account":""}.</p><p role="status" className={completed.admin.invitationStatus === "failed" ? "error-box" : "notice"}>{completed.admin.invitationStatus === "sent" ? "The account invitation was sent." : completed.admin.invitationStatus === "failed" ? "The clinic was created, but the invitation failed. Retry the invitation in Staff management." : "No new account invitation was required."}</p><Link href="/admin/users" className="button" data-testid="admin-registration-users">Open Staff management</Link>{completed.clinic.slug && <Link href={`/${completed.clinic.slug}`} className="text-link" data-testid="admin-registration-public">View clinic page</Link>}</main></div>;
  if (references.isLoading) return <div className="page-loading">Loading clinic setup options…</div>;
  if (references.error && !references.data) return <div className="error-box" role="alert">Could not load clinic setup options. {references.error.message}<button data-testid="admin-registration-retry-options" onClick={() => references.refetch()}>Try again</button></div>;
   return <ClinicRegistrationWizard adminMode categories={references.data?.categories || []} specialities={references.data?.specialities || []} qualifications={references.data?.qualifications || []} checkSlug={async slug => (await api.checkSlugAvailability({ slug })).available} onSubmit={finish} busy={setup.isPending} error={setup.error?.message}/>;
}