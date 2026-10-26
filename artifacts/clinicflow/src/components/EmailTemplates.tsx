import { FormActions } from "./FormActions";
import { UrlInput } from "./UrlInput";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { titleCase } from "../lib/title-case";
import * as api from "@workspace/api-client-react";
import { useGetNotificationTemplates, getGetNotificationTemplatesQueryKey, useSaveNotificationTemplate, useRequestLogoUpload, useCompleteLogoUpload } from "@workspace/api-client-react";
import { logoFileError, putToSignedUrl, LOGO_TYPES } from "./logo-upload";
import { AppDialog, useAppDialogClose } from "./AppDialog";
import { TemplateDrawerFields } from "./TemplateDrawerFields";
import { FormField } from "./FormField";
import { HelpTip } from "./HelpTip";
import { SearchableSelect } from "./SearchableSelect";
import { ResourceLookup } from "./ResourceLookup";
import "./email-templates.css";
import { previewText } from "../lib/template-preview";
import { BookingMailOutcomes } from "./BookingMailOutcomes";
import { EventTemplateTest } from "./EventTemplateTest";
import { isRealSuperAdmin } from "../lib/settings-access";
import { templateSaveError } from "../lib/communication-routes";
import { templateContentForSave } from "../lib/notification-template-input";
import { refreshNotificationManagement } from "../lib/notification-management";
import { SECURITY_EVENTS, requiredSecurityEvent, securityTemplateTarget } from "../lib/security-template-events";
import { eventVariables } from "@workspace/api-zod/notification-variable-contract";

type Content = api.NotificationTemplateContent;
type Mode = "draft" | "publish" | "reset";
const EVENTS = ["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder", "patient_login_otp",...SECURITY_EVENTS] as const;
type Recipient = "patient" | "clinicAdmin" | "doctor" | "receptionist" | "superAdmin";
export const RECIPIENTS: { value: Recipient; label: string; who: string }[] = [
  { value: "superAdmin", label: "System Admin", who: "active platform Superadmins" },
  { value: "patient", label: "Patient", who: "the patient on the appointment" },
  { value: "clinicAdmin", label: "Clinic Admin", who: "the admin who owns the clinic" },
  { value: "doctor", label: "Doctor", who: "the doctor on the appointment" },
  { value: "receptionist", label: "Receptionist", who: "receptionists assigned to the clinic" },
];
/** Onboarding is addressed to the clinic admin only; every other recipient omits it. */
export function eventsFor(recipient: Recipient, channel: "email" | "sms" = "email") { return EVENTS.filter(e => (SECURITY_EVENTS as readonly string[]).includes(e) ? securityTemplateTarget(e,recipient,channel) : recipient === "superAdmin" ? e === "onboarding" : e === "patient_login_otp" ? recipient === "patient" && channel === "sms" : e !== "onboarding" || recipient === "clinicAdmin"); }
/** Event switches may force a recipient: onboarding always targets the clinic admin. */
export function recipientForEvent(event: string, current: Recipient): Recipient { return event === "patient_login_otp" ? "patient" : event === "onboarding" && current !== "superAdmin" ? "clinicAdmin" : current; }
const SMS_BODY_MAX_C = 1600;
type TextKey = Exclude<keyof Content, "enabled">;
const FIELDS: [TextKey, string, number, string][] = [
  ["subject", "Subject", 180, "Required. Variables such as {{clinic_name}} are kept as written."],
  ["prefix", "Subject Prefix", 60, "Optional short label placed before the subject."],
  ["body", "Body", 8000, "Required. Plain text; variables are filled in at send time."],
  ["footer", "Footer", 500, "Optional closing text shown below the body."],
  ["logoUrl", "Logo", 1000, "Upload a PNG, JPEG or WebP (max 2 MB, max 2048×2048 px) or paste an https:// image address. Nothing is published until you save."],
];
const SMS_FIELDS: [TextKey, string, number, string][] = [
  ["body", "Message", SMS_BODY_MAX_C, "Required. Plain text up to 1600 characters; variables are filled in at send time."],
  ["dltTemplateId", "DLT Template ID", 50, "Registered template identifier for this message. Saving an ID does not confirm approval."],
];
const MODE_COPY: Record<Mode, { title: string; text: string; action: string }> = {
  draft: { title: "Save Draft?", text: "The draft is stored for later review. Live emails keep using the published version.", action: "Save Draft" },
  publish: { title: "Publish Template?", text: "The published version replaces the current one for this scope. Delivery follows clinic notification settings. Publishing does not send a message.", action: "Publish" },
  reset: { title: "Reset to Default?", text: "This removes the customised template and any draft for this scope and returns to the inherited default.", action: "Reset" },
};

/** Renders a readable preview: clinic_name uses the scope name, every other variable becomes an explicit placeholder. */
export { previewText };
/** Same-origin logo stored by ClinicFlow: /api/branding/logos/<uuid>. Embedded as an attachment when sent. */
export const INTERNAL_LOGO = /^\/api\/branding\/logos\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isInternalLogo(value: string) { return INTERNAL_LOGO.test(value); }
export function isValidLogo(value: string) { return isInternalLogo(value) || isHttpsUrl(value); }
/** Preview-only resolution; the stored value stays the relative internal path. */
export function logoPreviewSrc(value: string) { return value; } // API is served at the site root, so the relative path previews as-is.
export function isHttpsUrl(value: string) {
  if (!value) return true;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}
export function unknownVariables(content: Content, allowed: string[]) {
  const found = new Set<string>();
  for (const v of Object.values(content)) for (const m of String(v).matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)) if (!allowed.includes(m[1])) found.add(m[1]);
  return [...found];
}
function ActivationNote({ on, required }: { on: boolean; required: boolean }) {
  return <span className="muted" data-testid="text-activation-note">{required && "Platform security message. "}Currently {on ? "on" : "off"}. Wording saves keep this setting.</span>;
}
const same = (a?: Content, b?: Content) => !!a && !!b && FIELDS.every(([k]) => a[k] === b[k]) && (["senderId", "dltEntityId", "dltTemplateId"] as const).every(k => (a[k] ?? "") === (b[k] ?? "")) && (a.enabled ?? null) === (b.enabled ?? null);
const status = (e: any) => e?.status ?? e?.response?.status;

/** SMS keeps one body plus the event's DLT Template ID; Sender ID comes from configuration. */
export const SMS_BODY_MAX = 1600;
export function EmailTemplates({ identity, channel = "email", onDirtyChange, onBusyChange, fixed, initialClinicId, notificationPage = false }: { notificationPage?: boolean; initialClinicId?: string; onBusyChange?: (busy: boolean) => void; identity: api.Identity; channel?: "email" | "sms"; onDirtyChange?: (dirty: boolean) => void; fixed?: { clinicId: string; event: string; recipient: Recipient } }) {
  const sms = channel === "sms";
  const dialogClose = useAppDialogClose();
  const superAdmin = identity.user?.role === "superAdmin";
  const [clinicId, setClinicId] = useState(fixed?.clinicId ?? initialClinicId ?? "");
  const [event, setEvent] = useState<string>(fixed?.event ?? "booking");
  const [recipient, setRecipient] = useState<Recipient>(fixed?.recipient ?? "patient");
  const [form, setForm] = useState<Content | null>(null);
  const [serverOpen, setServerOpen] = useState(false);
  const [confirm, setConfirm] = useState<Mode | null>(null);
  const [pendingNav, setPendingNav] = useState<null | (() => void)>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const [showLogo, setShowLogo] = useState(false);
  const [upload, setUpload] = useState<{ state: "idle" | "requesting" | "uploading" | "verifying" | "done" | "error"; pct: number; msg: string }>({ state: "idle", pct: 0, msg: "" });
  const uploadAbort = useRef<AbortController | null>(null);
  useEffect(() => {
    setUpload({ state: "idle", pct: 0, msg: "" });
    return () => { uploadAbort.current?.abort(); };
  }, [clinicId, event, recipient]);
  const requestLogo = useRequestLogoUpload();
  const completeLogo = useCompleteLogoUpload();
  const loadedFor = useRef("");
  const editBase = useRef<{ scope: string; revision: number; content: Content } | null>(null);
  const queryClient = useQueryClient();
  const params = clinicId ? { clinicId, recipient, channel } : { recipient, channel };
  const enabled = superAdmin || !!clinicId;
  const queryKey = getGetNotificationTemplatesQueryKey(params);
  const catalog = useGetNotificationTemplates(params, { query: { enabled, queryKey, staleTime: 15000 } });
  const save = useSaveNotificationTemplate();
  const saveInFlight = useRef(false);
  const item = catalog.data?.items.find(i => i.event === event && (i.recipient ?? "patient") === recipient);
  const base = item ? (item.draft ?? item.content) : undefined;
  const key = `${clinicId}|${event}|${recipient}|${item?.revision ?? ""}`;

  useEffect(() => {
    if (item && loadedFor.current !== key && !conflict) {
      const scope = `${clinicId}|${event}|${recipient}`;
      if (editBase.current?.scope === scope && form && !same(form, editBase.current.content)) {
        setConflict(true);
        return;
      }
      const content = { ...(item.draft ?? item.content) };
      editBase.current = { scope, revision: item.revision, content };
      loadedFor.current = key; setForm(content); setShowLogo(false);
    }
  }, [item, key, conflict, clinicId, event, recipient, form]);

  const dirty = !!form && !!base && !same(form, base);
  const dirtyRef = useRef(onDirtyChange); dirtyRef.current = onDirtyChange;
  useEffect(() => { dirtyRef.current?.(dirty); }, [dirty]);
  useEffect(() => () => dirtyRef.current?.(false), []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const variables = (catalog.data?.variables ?? []).filter(v => eventVariables(item?.event || "").includes(v));
  const scopeName = catalog.data?.scopeName ?? "";
  const unknown = useMemo(() => form ? unknownVariables(sms ? { ...form, subject: "", prefix: "", footer: "", logoUrl: "" } : form, variables) : [], [form, variables, sms]);
  const errors = form ? {
    subject: !sms && !form.subject.trim() ? "Subject is required." : undefined,
    body: !form.body.trim() ? "Body is required." : sms && form.body.length > SMS_BODY_MAX ? `Message is limited to ${SMS_BODY_MAX} characters.` : undefined,
    logoUrl: !sms && !isValidLogo(form.logoUrl) ? "Upload an image or use an https:// address." : undefined,
  } : {};
  const invalid = Object.values(errors).some(Boolean) || unknown.length > 0;

  const guard = (go: () => void) => { if (dirty) setPendingNav(() => go); else go(); };
  const resetLocal = () => { uploadAbort.current?.abort(); setUpload({ state: "idle", pct: 0, msg: "" }); loadedFor.current = ""; editBase.current = null; save.reset(); setConflict(false); setNotice(""); setForm(null); };

  function run(mode: Mode) {
    if (!item || !form || saveInFlight.current || busyNow || conflict || (mode !== "reset" && invalid)) return;
    saveInFlight.current = true;
    setNotice("");
    save.mutate({ data: { channel, clinicId: clinicId || undefined, event: event as api.NotificationTemplateSaveEvent, recipient, revision: editBase.current?.revision ?? item.revision, mode, content: mode === "reset" ? undefined : templateContentForSave({...form,enabled:item.content.enabled}, channel, item.title) } }, {
      onSuccess: next => {
        queryClient.setQueryData(queryKey, next);
        void refreshNotificationManagement(queryClient);
        const fresh = next.items.find(i => i.event === event && (i.recipient ?? "patient") === recipient);
        loadedFor.current = "";
        if (fresh) {
          const content = { ...(fresh.draft ?? fresh.content) };
          editBase.current = { scope: `${clinicId}|${event}|${recipient}`, revision: fresh.revision, content };
          setForm(content);
        }
        setConfirm(null); setConflict(false);
        setNotice(mode === "draft" ? "Draft saved." : mode === "publish" ? "Template published." : "Template reset to default.");
      },
      onError: e => { setConfirm(null); if (status(e) === 409) setConflict(true); },
      onSettled: () => { saveInFlight.current = false; },
    });
  }

  const busyNow = save.isPending || upload.state === "requesting" || upload.state === "uploading" || upload.state === "verifying";
  const busyRef = useRef(onBusyChange); busyRef.current = onBusyChange;
  useEffect(() => { busyRef.current?.(busyNow); }, [busyNow]);
  useEffect(() => () => busyRef.current?.(false), []);
  const uploading = upload.state === "requesting" || upload.state === "uploading" || upload.state === "verifying";
  async function onLogoFile(file: File | undefined) {
    if (!file) return;
    const bad = logoFileError(file);
    if (bad) { setUpload({ state: "error", pct: 0, msg: bad }); return; }
    uploadAbort.current?.abort();
    const ctrl = new AbortController(); uploadAbort.current = ctrl;
    try {
      setUpload({ state: "requesting", pct: 0, msg: "Preparing upload…" });
      const { id, uploadUrl } = await requestLogo.mutateAsync({ data: { name: file.name, size: file.size, contentType: file.type, clinicId: clinicId || undefined } });
      if (ctrl.signal.aborted) return;
      setUpload({ state: "uploading", pct: 0, msg: "Uploading…" });
      await putToSignedUrl(uploadUrl, file, pct => setUpload({ state: "uploading", pct, msg: "Uploading…" }), ctrl.signal);
      if (ctrl.signal.aborted) return;
      setUpload({ state: "verifying", pct: 100, msg: "Checking image…" });
      const { logoUrl } = await completeLogo.mutateAsync({ id });
      if (ctrl.signal.aborted) return;
      set("logoUrl", logoUrl); setShowLogo(true);
      setUpload({ state: "done", pct: 100, msg: "Logo uploaded. Save a draft or publish to use it." });
    } catch (e: any) {
      if (ctrl.signal.aborted) return;
      const code = status(e);
      setUpload({ state: "error", pct: 0, msg: code === 400 || code === 413 || code === 422 ? "The server rejected this image. Use PNG, JPEG or WebP up to 2 MB and 2048×2048 px." : e?.message && !code ? e.message : "The logo could not be uploaded. Try again." });
    }
  }

  const set = (k: TextKey, v: string) => { setNotice(""); setForm(f => f ? { ...f, [k]: v } : f); };
  const recipientInfo = RECIPIENTS.find(r => r.value === recipient)!;
  const isOn = item?.content.enabled ?? false;
  const preview = form ? { subject: previewText(`${form.prefix ? form.prefix + " " : ""}${form.subject}`, scopeName), body: previewText(form.body, scopeName), footer: previewText(form.footer, scopeName) } : null;

  const renderField = ([k, label, max, help]: [TextKey, string, number, string]) => form &&  <FormField key={k} label={label} required={k === "subject" || k === "body"} optional={k !== "subject" && k !== "body"} helper={help} error={(errors as any)[k]}>
            {(a) => k === "body" || k === "footer"
              ? <textarea {...a} rows={k === "body" ? (sms ? 5 : 10) : 3} maxLength={max} value={form[k] ?? ""} onChange={e => set(k, e.target.value)} data-testid={`input-${k}`} />
              : k === "logoUrl" ? <div className="et-logo-field">
                <UrlInput {...a} validationMessage={errors.logoUrl} maxLength={max} value={form[k]} onChange={e => { set(k, e.target.value); setShowLogo(false); }} placeholder="https://… or upload below" data-testid="input-logoUrl" disabled={uploading} />
                <div className="et-actions">
                  <label className="button secondary" data-testid="label-logo-file">{uploading ? "Uploading…" : "Choose Image File"}
                    <input type="file" hidden accept={LOGO_TYPES.join(",")} disabled={uploading} onChange={e => { void onLogoFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-logo-file" /></label>
                  {uploading && <button type="button" className="button secondary" onClick={() => { uploadAbort.current?.abort(); setUpload({ state: "idle", pct: 0, msg: "Upload cancelled." }); }} data-testid="button-cancel-upload">Cancel Upload</button>}
                  {form.logoUrl && !uploading && <button type="button" className="button secondary" onClick={() => { set(k, ""); setUpload({ state: "idle", pct: 0, msg: "" }); }} data-testid="button-remove-logo">Remove Logo</button>}
                </div>
                <small>PNG, JPEG or WebP · max 2 MB · max 2048×2048 px (checked by the server)</small>
                {upload.state === "uploading" && <progress max={100} value={upload.pct} aria-label="Upload progress" data-testid="progress-logo" />}
                {upload.msg && <p role={upload.state === "error" ? "alert" : "status"} className={upload.state === "error" ? "error-box" : "et-notice"} data-testid="status-logo-upload">{upload.msg}</p>}
              </div>
              : <input {...a} type="text" maxLength={max} value={form[k] ?? ""} onChange={e => set(k, e.target.value)} data-testid={`input-${k}`} />}
          </FormField>;
  const actionReason = busyNow ? "Wait for the current save or upload to finish." : conflict ? "Resolve the conflict before saving or resetting. Your edits are kept." : invalid ? "Correct the field errors and unknown variables before saving." : "";
  const resetUnavailable = item?.source === "default" && !item?.draft;
  const drawerFooter = (cancelDisabled: boolean) => notificationPage ? <>
    {actionReason && <p className="muted" role="status" id="notification-template-action-help">{actionReason}</p>}
    <div className="et-drawer-footer cm-template-footer">
      <button type="button" className="button secondary" onClick={() => dialogClose?.()} disabled={busyNow} data-testid="button-cancel">Cancel</button>
      <button type="button" className="button secondary danger" disabled={busyNow || conflict || resetUnavailable} title={resetUnavailable ? "Already Using Default Wording; No Saved Draft" : "Remove This Wording and Its Saved Draft"} onClick={() => setConfirm("reset")} data-testid="button-reset">Reset to Default</button>
      <button type="button" className="button secondary" disabled={busyNow || invalid || conflict || !dirty} title={!dirty ? "No Unsaved Wording Changes" : actionReason || "Store an Unpublished Draft"} onClick={() => setConfirm("draft")} data-testid="button-save-draft">Save Draft</button>
      <button type="submit" className="button" disabled={busyNow || invalid || conflict} title={actionReason || "Publish Wording Without Changing Activation"} data-testid="button-publish">{save.isPending && confirm === "publish" ? "Publishing…" : "Publish"}</button>
    </div>
  </> : <div className="et-drawer-footer"><button type="button" className="button secondary" onClick={() => dialogClose ? dialogClose() : undefined} disabled={cancelDisabled} data-testid="button-cancel">Cancel</button><button type="submit" className="button" disabled={busyNow || invalid || conflict} data-testid="button-publish">{save.isPending && confirm === "publish" ? "Saving…" : "Save Template"}</button></div>;
  return <section className={`email-templates${notificationPage ? " cm-template-editor" : ""}`} data-testid="email-templates">
    {!fixed && <p className="et-intro muted">Edit the wording each recipient receives per event. Saving here never sends {sms ? "an SMS" : "an email"}.{sms && <> Enabled templates stay off for every recipient until you switch them on; a draft may be incomplete, but publishing an enabled template requires DLT IDs when your provider mapping requires them.</>} <span role="note" className="et-limit-tip" data-testid="text-delivery-limit"><HelpTip text="Booking confirmations use the existing delivery flow. Other events are queued when clinic notifications are enabled and delivered by the production worker. Reminders refer to the session start, not an exact consultation time. Development never sends these queued emails automatically." /></span></p>}
    {!fixed && <div className="et-scope">
      {superAdmin ? <FormField label="Scope" optional helper="Leave empty to edit platform defaults.">
        {(a) => <ResourceLookup resource="clinics" {...a} value={clinicId} onChange={v => guard(() => { setClinicId(v); resetLocal(); })} placeholder="Platform defaults" />}
      </FormField> : <FormField label="Clinic Group" required helper="Choose a clinic group you manage.">
        {(a) => <ResourceLookup resource="clinics" {...a} value={clinicId} onChange={v => guard(() => { setClinicId(v); resetLocal(); })} />}
      </FormField>}
      <FormField label="Recipient" helper={`Sent to ${recipientInfo.who}.`}>
        {(a) => <SearchableSelect {...a} value={recipient} onChange={v => guard(() => { const r = v as Recipient; setRecipient(r); const events = eventsFor(r,sms?"sms":"email"); if (!events.includes(event as any)) setEvent(events[0]); resetLocal(); })}
          options={RECIPIENTS.map(r => ({ value: r.value, label: r.label }))} />}
      </FormField>
      <FormField label="Event" helper={recipient === "clinicAdmin" ? undefined : "Onboarding is available for the Clinic admin recipient."}>
        {(a) => <SearchableSelect {...a} value={event} onChange={v => guard(() => { setEvent(v); setRecipient(r => recipientForEvent(v, r)); resetLocal(); })}
          options={eventsFor(recipient,sms?"sms":"email").map(e => ({ value: e, label: titleCase(catalog.data?.items.find(i => i.event === e)?.title ?? e) }))} />}
      </FormField>
    </div>}

    {!fixed && !sms && identity.user?.role === "clinicAdmin" && clinicId && <BookingMailOutcomes key={`${identity.user.id}:${clinicId}`} actorId={identity.user.id} clinicId={clinicId} />}

    {!enabled ? <div className="et-empty" data-testid="state-select-clinic">Select a clinic group to view its templates.</div>
      : catalog.isLoading ? <div className="et-skeleton" aria-busy="true" data-testid="state-loading"><span /><span /><span /></div>
      : catalog.isError ? <div role="alert" className="error-box" data-testid="state-error">Templates could not be loaded. <button type="button" onClick={() => catalog.refetch()} data-testid="button-retry">Retry</button></div>
      : !item || !form ? <div className="et-empty" data-testid="state-empty">This event has no template for the selected scope.</div>
      : fixed ? <form className="et-drawer" onSubmit={e => { e.preventDefault(); if (!busyNow && !invalid && !conflict) setConfirm("publish"); }}>
        {notificationPage && <div className="cm-wording-details" data-testid="text-wording-source">
          <p><strong>Wording:</strong> {item.source === "clinic" ? "Saved clinic wording" : item.source === "platform" ? clinicId ? "Inherited system wording" : "Saved system wording" : "Default wording"}{item.draft ? " · Unpublished Draft Loaded" : ""} · Revision {item.revision}</p>
          <p className="muted">Publishing changes wording only, not activation or delivery readiness. No message is sent.</p>
          <p className="muted">Reset is {resetUnavailable ? "unavailable: this template already uses default wording and has no saved draft." : "available: remove this scope’s saved wording and draft to use the inherited default."} {!dirty && "Save Draft is unavailable until wording changes."}</p>
        </div>}
        <TemplateDrawerFields compact={notificationPage} form={form} templateKey={item.event} savedDltTemplateId={item.content.dltTemplateId} sms={sms} errors={errors} variables={variables} scopeName={scopeName} set={set}
          active={<div className="td-active" data-testid="row-enabled"><ActivationNote on={isOn} required={requiredSecurityEvent(event)} /></div>} />
        {unknown.length > 0 && <p role="alert" className="error-box">Unknown variables: {unknown.join(", ")}. Use only the variables listed above.</p>}
        {conflict && <div role="alert" className="error-box" data-testid="state-conflict">Someone else changed this template. Your edits are kept here.
          <button type="button" onClick={() => { resetLocal(); void catalog.refetch(); }} data-testid="button-reload">Discard My Edits and Reload</button></div>}
        {save.isError && !conflict && <p role="alert" className="error-box" data-testid="status-template-save-error">{templateSaveError(save.error)}</p>}
        {notice && <p role="status" className="et-notice" data-testid="status-save">{notice}</p>}
        <details className="td-adv" data-testid="details-advanced"><summary>Advanced</summary>
          {!sms && identity.user?.role === "clinicAdmin" && clinicId && <BookingMailOutcomes key={`${identity.user.id}:${clinicId}`} actorId={identity.user.id} clinicId={clinicId} />}
          {(sms ? SMS_FIELDS.filter(f => f[0] === "senderId") : FIELDS.filter(f => f[0] !== "subject" && f[0] !== "body")).map(renderField)}
          {!notificationPage && <div className="et-actions">
            <button type="button" className="button secondary" disabled={save.isPending || invalid || conflict || !dirty} onClick={() => setConfirm("draft")} data-testid="button-save-draft">Save Draft</button>
            <button type="button" className="button secondary danger" disabled={save.isPending || conflict || (item.source === "default" && !item.draft)} onClick={() => setConfirm("reset")} data-testid="button-reset">Reset to Default</button>
          </div>}
          {isRealSuperAdmin(identity.user) && <EventTemplateTest key={`${channel}|${clinicId}|${event}|${recipient}`} channel={channel} event={event} recipient={recipient} clinicId={clinicId} revision={editBase.current?.revision ?? item.revision} content={templateContentForSave(form, channel, item.title)} />}
        </details>
        {drawerFooter(save.isPending)}
      </form>
      : <div className="et-grid">
        <form className="panel padded et-form" onSubmit={e => { e.preventDefault(); setConfirm("publish"); }}>
          <div className="et-meta" data-testid="text-template-meta">
            <strong>{titleCase(item.title)}</strong>
            <span className="et-chip">{titleCase(item.source.replace(/[_-]/g, " "))}</span>
            <span className={`et-chip ${item.delivery === "active" || event === "booking" ? "live" : ""}`}>{titleCase(item.delivery.replace(/[_-]/g, " "))}</span>
            {item.draft && <span className="et-chip draft">Unpublished Draft</span>}
            <span className="et-rev">Revision {item.revision}</span>
          </div>
          <div className="et-toggle" data-testid="row-enabled"><ActivationNote on={isOn} required={requiredSecurityEvent(event)} /></div>
          {(sms ? SMS_FIELDS : FIELDS).map(renderField)}
          <div className="et-vars" data-testid="list-variables">
            <span>Available Variables</span>
            {variables.map(v => <button type="button" key={v} className="et-var" onClick={() => set("body", `${form.body}{{${v}}}`)} data-testid={`button-variable-${v}`}>{`{{${v}}}`}</button>)}
          </div>
          {unknown.length > 0 && <p role="alert" className="error-box">Unknown variables: {unknown.join(", ")}. Use only the variables listed above.</p>}
          {conflict && <div role="alert" className="error-box" data-testid="state-conflict">Someone else changed this template. Your edits are kept here.
            <button type="button" onClick={() => { resetLocal(); void catalog.refetch(); }} data-testid="button-reload">Discard My Edits and Reload</button></div>}
          {save.isError && !conflict && <p role="alert" className="error-box" data-testid="status-template-save-error">{templateSaveError(save.error)}</p>}
          {notice && <p role="status" className="et-notice" data-testid="status-save">{notice}</p>}
          <div className="et-actions">
            <FormActions wide={false} secondary={<button type="button" className="button secondary danger" disabled={save.isPending || conflict || (item.source === "default" && !item.draft)} onClick={() => setConfirm("reset")} data-testid="button-reset">Reset to Default</button>}
              onCancel={() => guard(() => { setForm({ ...base! }); setNotice(""); })} cancelLabel="Cancel Changes" cancelDisabled={save.isPending || !dirty} cancelTestId="button-cancel"
              extra={<button type="button" className="button secondary" disabled={save.isPending || invalid || conflict || !dirty} onClick={() => setConfirm("draft")} data-testid="button-save-draft">Save Draft</button>}
              busy={save.isPending && confirm === "publish"} busyLabel="Publishing…" disabled={save.isPending || invalid || conflict} submitLabel="Publish" submitTestId="button-publish" />
          </div>
        </form>

        <aside className="panel padded et-preview" aria-label="Live preview" data-testid="panel-preview">
          <h3>Preview <HelpTip text="Sample placeholders only. No patient data is used."/></h3>
          {!sms && form.logoUrl && isValidLogo(form.logoUrl) && ((showLogo || isInternalLogo(form.logoUrl))
            ? <img src={logoPreviewSrc(form.logoUrl)} alt="Logo preview" className="et-logo" referrerPolicy="no-referrer" data-testid="img-logo" />
            : <button type="button" className="button secondary" onClick={() => setShowLogo(true)} data-testid="button-load-logo">Load Logo Preview (Contacts the Image Host)</button>)}
          <div className="et-mail">
            {!sms && <div className="et-subject" data-testid="text-preview-subject">{preview!.subject}</div>}
            <div className="et-body" data-testid="text-preview-body">{preview!.body}</div>
            {preview!.footer && <div className="et-footer">{preview!.footer}</div>}
          </div>
          {!dirty && <button type="button" className="button secondary small et-server-open" aria-haspopup="dialog" onClick={() => setServerOpen(true)} data-testid="button-server-rendering">Server Rendering</button>}
          {serverOpen && <AppDialog open variant="drawer" onClose={() => setServerOpen(false)} title="Server Rendering"><div className="et-server"><div>{item.previewSubject}</div><pre>{item.previewBody}</pre></div></AppDialog>}
        </aside>
        {isRealSuperAdmin(identity.user) && <EventTemplateTest key={`${channel}|${clinicId}|${event}|${recipient}`} channel={channel} event={event} recipient={recipient} clinicId={clinicId} revision={editBase.current?.revision ?? item.revision} content={templateContentForSave(form, channel, item.title)} />}
      </div>}

    <AppDialog open={!!confirm} onClose={() => !save.isPending && setConfirm(null)} title={confirm ? MODE_COPY[confirm].title : ""} busy={save.isPending}>
      {confirm && <div className="et-dialog"><p>{notificationPage && confirm === "publish" ? "Publish this wording for the selected scope. Activation and Optional Delivery are unchanged. Publishing does not enable delivery or send a message." : MODE_COPY[confirm].text}</p>
        <FormActions wide={false} onCancel={() => setConfirm(null)} cancelLabel="Go Back" cancelTestId="button-confirm-cancel" busy={save.isPending} onSubmit={() => run(confirm)} submitClassName={confirm === "reset" ? "danger" : undefined} submitLabel={MODE_COPY[confirm].action} submitTestId="button-confirm-save" /></div>}
    </AppDialog>
    <AppDialog open={!!pendingNav} onClose={() => setPendingNav(null)} title="Discard unsaved changes?">
      <div className="et-dialog"><p>You have edits that are not saved. Leaving this template discards them.</p>
        <FormActions wide={false} onCancel={() => setPendingNav(null)} cancelLabel="Keep Editing" cancelTestId="button-keep-editing" onSubmit={() => { const go = pendingNav; setPendingNav(null); go?.(); }} submitClassName="danger" submitLabel="Discard and Continue" submitTestId="button-discard" /></div>
    </AppDialog>
  </section>;
}
export default EmailTemplates;
