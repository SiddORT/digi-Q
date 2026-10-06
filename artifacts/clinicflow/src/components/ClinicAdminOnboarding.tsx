import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Plus } from "lucide-react";
import { ClinicRegistrationWizard, ownerSchedulePayload, type RegistrationValues } from "./ClinicRegistrationWizard";
import { ClinicRegistrationComplete } from "./ClinicRegistrationComplete";
import { friendlyError } from "../lib/friendly-error";

type SetupProps = { guided?: boolean; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void };
export function ClinicAdminOnboarding({ guided = false, ...state }: SetupProps) {
  if (guided) return <GuidedAdminSetup {...state}/>;
  return <section className="panel padded" style={{ marginBottom: 24 }}><h3>Clinic Admin Setup</h3><p className="muted">Invite a clinic owner and create their clinic, locations and hours together. Existing ownership is never transferred.</p><Link className="button small" href="/register-clinic" data-testid="button-setup-clinic-admin"><Plus size={17}/>Set Up Clinic Admin</Link></section>;
}

function GuidedAdminSetup({ onDirtyChange, onBusyChange }: Omit<SetupProps, "guided">) {
  const client = useQueryClient();
  const locked = useRef(false);
  const [completed, setCompleted] = useState<api.ClinicAdminOnboardingResult | null>(null);
  const setup = api.useOnboardClinicAdmin();
  useEffect(() => { onBusyChange?.(setup.isPending); }, [setup.isPending, onBusyChange]);
  const references = api.useGetRegistrationOptions();
  async function finish(values: RegistrationValues) {
    if (locked.current) return;
    locked.current = true;
    try {
      const result = await setup.mutateAsync({ data: {
        admin: { fullName: values.fullName.trim(), email: values.email.trim(), ...(values.mobile.trim() ? { mobile: values.mobile.trim() } : {}) },
        clinic: { dateFormat: values.dateFormat, timeFormat: values.timeFormat, name: values.name.trim(), address: values.branches[0].address.trim(), slug: values.slug, email: values.clinicEmail.trim() || undefined, phone: values.phone.trim() || undefined, categoryId: values.categoryId || undefined, specialityIds: values.specialityIds, referralCode: values.referralCode.trim() || null },
        branches: values.branches.map(b => ({ name: b.name.trim(), slug: b.slug, address: b.address.trim(), city: b.city.trim(), state: b.state?.trim() || undefined, pincode: b.pincode?.trim() || undefined, country: b.country?.trim() || undefined, timezone: b.timezone, email: b.email.trim() || null, phone: b.phone.trim() || null, inheritEmail: b.inheritEmail, inheritPhone: b.inheritPhone, openingHours: b.hours.filter(d => d.isOpen).flatMap(d => d.sessions.map(s => ({ dayOfWeek: d.dayOfWeek, ...s }))) })),
        ownDoctor: values.alsoConsult, ...(values.alsoConsult ? { specializationId: values.specializationId || undefined, qualificationIds: values.qualificationIds } : {}),
        ...ownerSchedulePayload(values),
      } });
      setCompleted(result);
      onDirtyChange?.(false);
      await client.invalidateQueries();
    } finally { locked.current = false; }
  }
   if (completed) return <ClinicRegistrationComplete result={completed} invitationStatus={completed.admin.invitationStatus}/>;
  if (references.isLoading) return <div className="page-loading">Loading clinic setup options…</div>;
  if (references.error && !references.data) return <div className="error-box" role="alert">{friendlyError(references.error,"load")}<button data-testid="admin-registration-retry-options" onClick={() => references.refetch()}>Try Again</button></div>;
   return <ClinicRegistrationWizard adminMode onDirtyChange={onDirtyChange} onStepChange={setup.reset} categories={references.data?.categories || []} specialities={references.data?.specialities || []} qualifications={references.data?.qualifications || []} checkSlug={async slug => (await api.checkSlugAvailability({ slug })).available} onSubmit={finish} busy={setup.isPending} error={setup.error?friendlyError(setup.error,"save"):undefined}/>;
}