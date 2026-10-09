import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { Plus } from "lucide-react";
import { ClinicRegistrationWizard, ownerSchedulePayload, type RegistrationValues } from "./ClinicRegistrationWizard";
import { ClinicRegistrationComplete } from "./ClinicRegistrationComplete";
import { friendlyError } from "../lib/friendly-error";
import { registrationDraftKey, readRegistrationDraft, setupDraftSchema, clearRegistrationDraft } from "../lib/registration-draft";

type SetupProps = { guided?: boolean; draftActor?: string; onDirtyChange?: (dirty: boolean) => void; onBusyChange?: (busy: boolean) => void; carry?: Partial<Record<"fullName"|"email"|"mobile", string>>; onSnapshot?: (values: Record<string, unknown>, defaults: Record<string, unknown>) => void };
export function ClinicAdminOnboarding({ guided = false, ...state }: SetupProps) {
  if (guided) return <GuidedAdminSetup {...state}/>;
  return <section className="panel padded" style={{ marginBottom: 24 }}><h3>Clinic Admin Setup</h3><p className="muted">Invite a clinic owner and create their clinic, locations and hours together. Existing ownership is never transferred.</p><Link className="button small" href="/register-clinic" data-testid="button-setup-clinic-admin"><Plus size={17}/>Set Up Clinic Admin</Link></section>;
}

function GuidedAdminSetup({ draftActor, onDirtyChange, onBusyChange, carry, onSnapshot }: Omit<SetupProps, "guided">) {
  const client = useQueryClient();
  const locked = useRef(false);
  const [completed, setCompleted] = useState<api.ClinicAdminOnboardingResult | null>(null);
  const setup = api.useOnboardClinicAdmin();
  const resend = useMutation({
    mutationFn: () => api.resendUserInvitation(completed!.admin.id),
    onSuccess: (admin) => { setCompleted(previous => previous ? {...previous, admin: {...previous.admin, ...admin}} : previous); },
    onSettled: () => { void client.invalidateQueries(); },
  });
  useEffect(() => { onBusyChange?.(setup.isPending||resend.isPending); }, [setup.isPending, resend.isPending, onBusyChange]);
  const references = api.useGetRegistrationOptions();
  const draftKey = draftActor ? registrationDraftKey("admin", draftActor) : undefined;
  const [pending] = useState(() => draftKey ? readRegistrationDraft(draftKey, setupDraftSchema).data : undefined);
  const recovery = api.useGetClinicAdminSetupCompletion({ requestId: pending?.requestId || "" }, { query: { queryKey: api.getGetClinicAdminSetupCompletionQueryKey({ requestId: pending?.requestId || "" }), enabled: !!pending, retry: false } });
  useEffect(() => { if (recovery.data?.result) { if (draftKey) clearRegistrationDraft(draftKey); setCompleted(recovery.data.result); } }, [recovery.data, draftKey]);
  async function finish(values: RegistrationValues, requestId: string) {
    if (locked.current) return;
    locked.current = true;
    try {
      const saved = await api.getClinicAdminSetupCompletion({ requestId });
      if (saved.result) { if (draftKey) clearRegistrationDraft(draftKey); setCompleted(saved.result); return; }
      const result = await setup.mutateAsync({ data: {
        requestId,
        admin: { fullName: values.fullName.trim(), email: values.email.trim(), ...(values.mobile.trim() ? { mobile: values.mobile.trim() } : {}) },
        clinic: { dateFormat: values.dateFormat, timeFormat: values.timeFormat, name: values.name.trim(), address: values.branches[0].address.trim(), slug: values.slug, email: values.clinicEmail.trim() || undefined, phone: values.phone.trim() || undefined, categoryId: values.categoryId || undefined, specialityIds: values.specialityIds, referralCode: values.referralCode.trim() || null },
        branches: values.branches.map(b => ({ name: b.name.trim(), slug: b.slug, address: b.address.trim(), city: b.city.trim(), state: b.state?.trim() || undefined, pincode: b.pincode?.trim() || undefined, country: b.country?.trim() || undefined, timezone: b.timezone, email: b.email.trim() || null, phone: b.phone.trim() || null, inheritEmail: b.inheritEmail, inheritPhone: b.inheritPhone, openingHours: b.hours.filter(d => d.isOpen).flatMap(d => d.sessions.map(s => ({ dayOfWeek: d.dayOfWeek, ...s }))) })),
        ownDoctor: values.alsoConsult, ...(values.alsoConsult ? { specializationId: values.specializationId || undefined, qualificationIds: values.qualificationIds } : {}),
        ...ownerSchedulePayload(values),
      } });
      setCompleted(result);
      onDirtyChange?.(false);
      await client.invalidateQueries();
    } catch (caught) {
      const saved = await api.getClinicAdminSetupCompletion({ requestId });
      if (!saved.result) throw caught;
      if (draftKey) clearRegistrationDraft(draftKey);
      setCompleted(saved.result); onDirtyChange?.(false); void client.invalidateQueries();
    } finally { locked.current = false; }
  }
   if (completed) return <><ClinicRegistrationComplete result={completed} invitationStatus={completed.admin.invitationStatus}/>
     {completed.admin.invitationStatus==="failed"&&<div className="notice" role="status">
       <p>The clinic and administrator are saved. Do not repeat setup. Retry the invitation after email service setup is restored.</p>
       <button type="button" data-testid="button-resend-admin-invitation" disabled={resend.isPending} onClick={()=>resend.mutate()}>{resend.isPending?"Sending…":"Resend Invitation"}</button>
       {resend.error&&<p role="alert">{friendlyError(resend.error,"save")}</p>}
     </div>}</>;
  if (pending && recovery.isLoading) return <div className="page-loading">Checking saved setup…</div>;
  if (pending && recovery.error) return <div className="error-box" role="alert">Could not check saved setup. No new creation will be attempted.<button onClick={() => void recovery.refetch()}>Try Again</button></div>;
  if (references.isLoading) return <div className="page-loading">Loading clinic setup options…</div>;
  if (references.error && !references.data) return <div className="error-box" role="alert">{friendlyError(references.error,"load")}<button type="button" data-testid="admin-registration-retry-options" onClick={() => references.refetch()}>Try Again</button></div>;
    return <ClinicRegistrationWizard key={draftKey || "memory"} draftKey={draftKey} adminMode carry={carry} onSnapshot={onSnapshot} onDirtyChange={onDirtyChange} onStepChange={setup.reset} categories={references.data?.categories || []} specialities={references.data?.specialities || []} qualifications={references.data?.qualifications || []} checkSlug={async slug => (await api.checkSlugAvailability({ slug })).available} onSubmit={finish} busy={setup.isPending} error={setup.error?friendlyError(setup.error,"save"):undefined}/>;
}