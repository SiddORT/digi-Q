import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { useGetNotificationTemplates, getGetNotificationTemplatesQueryKey, useSaveNotificationTemplate, useRequestLogoUpload, useCompleteLogoUpload } from "@workspace/api-client-react";
import { logoFileError, putToSignedUrl, LOGO_TYPES } from "./logo-upload";
import { AppDialog } from "./AppDialog";
import { FormField } from "./FormField";
import { SearchableSelect } from "./SearchableSelect";
import { LoadingButton } from "./LoadingButton";
import { ResourceLookup } from "./ResourceLookup";
import "./email-templates.css";

type Content = api.NotificationTemplateContent;
type Mode = "draft" | "publish" | "reset";
const EVENTS = ["booking", "onboarding", "rescheduled", "cancelled", "completed", "reminder"] as const;
const FIELDS: [keyof Content, string, number, string][] = [
  ["subject", "Subject", 180, "Required. Variables such as {{clinic_name}} are kept as written."],
  ["prefix", "Subject prefix", 60, "Optional short label placed before the subject."],
  ["body", "Body", 8000, "Required. Plain text; variables are filled in at send time."],
  ["footer", "Footer", 500, "Optional closing text shown below the body."],
  ["logoUrl", "Logo", 1000, "Upload a PNG, JPEG or WebP (max 2 MB, max 2048×2048 px) or paste an https:// image address. Nothing is published until you save."],
];
const MODE_COPY: Record<Mode, { title: string; text: string; action: string }> = {
  draft: { title: "Save draft?", text: "The draft is stored for later review. Live emails keep using the published version.", action: "Save draft" },
  publish: { title: "Publish template?", text: "The published version replaces the current one for this scope. Delivery follows clinic notification settings. Publishing does not send a message.", action: "Publish" },
  reset: { title: "Reset to default?", text: "This removes the customised template and any draft for this scope and returns to the inherited default.", action: "Reset" },
};

/** Renders a readable preview: clinic_name uses the scope name, every other variable becomes an explicit placeholder. */
export function previewText(text: string, scopeName: string) {
  return text.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_m, name: string) => name === "clinic_name" ? scopeName : `[${name.replace(/_/g, " ")}]`);
}
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
const same = (a?: Content, b?: Content) => !!a && !!b && FIELDS.every(([k]) => a[k] === b[k]);
const status = (e: any) => e?.status ?? e?.response?.status;

export function EmailTemplates({ identity }: { identity: api.Identity }) {
  const superAdmin = identity.user?.role === "superAdmin";
  const [clinicId, setClinicId] = useState("");
  const [event, setEvent] = useState<string>("booking");
  const [form, setForm] = useState<Content | null>(null);
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
  }, [clinicId, event]);
  const requestLogo = useRequestLogoUpload();
  const completeLogo = useCompleteLogoUpload();
  const loadedFor = useRef("");
  const editBase = useRef<{ scope: string; revision: number; content: Content } | null>(null);
  const queryClient = useQueryClient();
  const params = clinicId ? { clinicId } : undefined;
  const enabled = superAdmin || !!clinicId;
  const queryKey = getGetNotificationTemplatesQueryKey(params);
  const catalog = useGetNotificationTemplates(params, { query: { enabled, queryKey } });
  const save = useSaveNotificationTemplate();
  const item = catalog.data?.items.find(i => i.event === event);
  const base = item ? (item.draft ?? item.content) : undefined;
  const key = `${clinicId}|${event}|${item?.revision ?? ""}`;

  useEffect(() => {
    if (item && loadedFor.current !== key && !conflict) {
      const scope = `${clinicId}|${event}`;
      if (editBase.current?.scope === scope && form && !same(form, editBase.current.content)) {
        setConflict(true);
        return;
      }
      const content = { ...(item.draft ?? item.content) };
      editBase.current = { scope, revision: item.revision, content };
      loadedFor.current = key; setForm(content); setShowLogo(false);
    }
  }, [item, key, conflict, clinicId, event, form]);

  const dirty = !!form && !!base && !same(form, base);
  const variables = catalog.data?.variables ?? [];
  const scopeName = catalog.data?.scopeName ?? "";
  const unknown = useMemo(() => form ? unknownVariables(form, variables) : [], [form, variables]);
  const errors = form ? {
    subject: !form.subject.trim() ? "Subject is required." : undefined,
    body: !form.body.trim() ? "Body is required." : undefined,
    logoUrl: !isValidLogo(form.logoUrl) ? "Upload an image or use an https:// address." : undefined,
  } : {};
  const invalid = Object.values(errors).some(Boolean) || unknown.length > 0;

  const guard = (go: () => void) => { if (dirty) setPendingNav(() => go); else go(); };
  const resetLocal = () => { uploadAbort.current?.abort(); setUpload({ state: "idle", pct: 0, msg: "" }); loadedFor.current = ""; editBase.current = null; save.reset(); setConflict(false); setNotice(""); setForm(null); };

  function run(mode: Mode) {
    if (!item || !form) return;
    save.mutate({ data: { clinicId: clinicId || undefined, event: event as api.NotificationTemplateSaveEvent, revision: editBase.current?.revision ?? item.revision, mode, content: mode === "reset" ? undefined : form } }, {
      onSuccess: next => {
        queryClient.setQueryData(queryKey, next);
        const fresh = next.items.find(i => i.event === event);
        loadedFor.current = "";
        if (fresh) {
          const content = { ...(fresh.draft ?? fresh.content) };
          editBase.current = { scope: `${clinicId}|${event}`, revision: fresh.revision, content };
          setForm(content);
        }
        setConfirm(null); setConflict(false);
        setNotice(mode === "draft" ? "Draft saved." : mode === "publish" ? "Template published." : "Template reset to default.");
      },
      onError: e => { setConfirm(null); if (status(e) === 409) setConflict(true); },
    });
  }

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

  const set = (k: keyof Content, v: string) => { setNotice(""); setForm(f => f ? { ...f, [k]: v } : f); };
  const preview = form ? { subject: previewText(`${form.prefix ? form.prefix + " " : ""}${form.subject}`, scopeName), body: previewText(form.body, scopeName), footer: previewText(form.footer, scopeName) } : null;

  return <section className="email-templates" data-testid="email-templates">
    <header className="et-head">
      <div><h2>Email templates</h2><p>Edit the wording patients receive. Saving here never sends an email.</p></div>
    </header>
    <p role="note" className="et-limit" data-testid="text-delivery-limit">Booking confirmations use the existing delivery flow. Other events are queued when clinic notifications are enabled and delivered by the production worker. Reminders refer to the session start, not an exact consultation time. Development never sends these queued emails automatically.</p>

    <div className="et-scope">
      {superAdmin ? <FormField label="Scope" optional helper="Leave empty to edit platform defaults.">
        {(a) => <ResourceLookup resource="clinics" {...a} value={clinicId} onChange={v => guard(() => { setClinicId(v); resetLocal(); })} placeholder="Platform defaults" />}
      </FormField> : <FormField label="Clinic group" required helper="Choose a clinic group you manage.">
        {(a) => <ResourceLookup resource="clinics" {...a} value={clinicId} onChange={v => guard(() => { setClinicId(v); resetLocal(); })} />}
      </FormField>}
      <FormField label="Event">
        {(a) => <SearchableSelect {...a} value={event} onChange={v => guard(() => { setEvent(v); resetLocal(); })}
          options={EVENTS.map(e => ({ value: e, label: catalog.data?.items.find(i => i.event === e)?.title ?? e }))} />}
      </FormField>
    </div>

    {!enabled ? <div className="et-empty" data-testid="state-select-clinic">Select a clinic group to view its templates.</div>
      : catalog.isLoading ? <div className="et-skeleton" aria-busy="true" data-testid="state-loading"><span /><span /><span /></div>
      : catalog.isError ? <div role="alert" className="error-box" data-testid="state-error">Templates could not be loaded. <button type="button" onClick={() => catalog.refetch()} data-testid="button-retry">Retry</button></div>
      : !item || !form ? <div className="et-empty" data-testid="state-empty">This event has no template for the selected scope.</div>
      : <div className="et-grid">
        <form className="panel padded et-form" onSubmit={e => { e.preventDefault(); setConfirm("publish"); }}>
          <div className="et-meta" data-testid="text-template-meta">
            <strong>{item.title}</strong>
            <span className="et-chip">{item.source}</span>
            <span className={`et-chip ${item.delivery === "active" || event === "booking" ? "live" : ""}`}>{item.delivery}</span>
            {item.draft && <span className="et-chip draft">Unpublished draft</span>}
            <span className="et-rev">Revision {item.revision}</span>
          </div>
          {FIELDS.map(([k, label, max, help]) => <FormField key={k} label={label} required={k === "subject" || k === "body"} optional={k !== "subject" && k !== "body"} helper={help} error={(errors as any)[k]}>
            {(a) => k === "body" || k === "footer"
              ? <textarea {...a} rows={k === "body" ? 10 : 3} maxLength={max} value={form[k]} onChange={e => set(k, e.target.value)} data-testid={`input-${k}`} />
              : k === "logoUrl" ? <div className="et-logo-field">
                <input {...a} type="text" inputMode="url" maxLength={max} value={form[k]} onChange={e => { set(k, e.target.value); setShowLogo(false); }} placeholder="https://… or upload below" data-testid="input-logoUrl" spellCheck={false} disabled={uploading} />
                <div className="et-actions">
                  <label className="button secondary" data-testid="label-logo-file">{uploading ? "Uploading…" : "Choose image file"}
                    <input type="file" hidden accept={LOGO_TYPES.join(",")} disabled={uploading} onChange={e => { void onLogoFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-logo-file" /></label>
                  {uploading && <button type="button" className="secondary" onClick={() => { uploadAbort.current?.abort(); setUpload({ state: "idle", pct: 0, msg: "Upload cancelled." }); }} data-testid="button-cancel-upload">Cancel upload</button>}
                  {form.logoUrl && !uploading && <button type="button" className="secondary" onClick={() => { set(k, ""); setUpload({ state: "idle", pct: 0, msg: "" }); }} data-testid="button-remove-logo">Remove logo</button>}
                </div>
                <small>PNG, JPEG or WebP · max 2 MB · max 2048×2048 px (checked by the server)</small>
                {upload.state === "uploading" && <progress max={100} value={upload.pct} aria-label="Upload progress" data-testid="progress-logo" />}
                {upload.msg && <p role={upload.state === "error" ? "alert" : "status"} className={upload.state === "error" ? "error-box" : "et-notice"} data-testid="status-logo-upload">{upload.msg}</p>}
              </div>
              : <input {...a} type="text" maxLength={max} value={form[k]} onChange={e => set(k, e.target.value)} data-testid={`input-${k}`} />}
          </FormField>)}
          <div className="et-vars" data-testid="list-variables">
            <span>Available variables</span>
            {variables.map(v => <button type="button" key={v} className="et-var" onClick={() => set("body", `${form.body}{{${v}}}`)} data-testid={`button-variable-${v}`}>{`{{${v}}}`}</button>)}
          </div>
          {unknown.length > 0 && <p role="alert" className="error-box">Unknown variables: {unknown.join(", ")}. Use only the variables listed above.</p>}
          {conflict && <div role="alert" className="error-box" data-testid="state-conflict">Someone else changed this template. Your edits are kept here.
            <button type="button" onClick={() => { resetLocal(); void catalog.refetch(); }} data-testid="button-reload">Discard my edits and reload</button></div>}
          {save.isError && !conflict && <p role="alert" className="error-box">The template was not saved. Check the fields and try again.</p>}
          {notice && <p role="status" className="et-notice" data-testid="status-save">{notice}</p>}
          <div className="et-actions">
            <LoadingButton type="submit" loading={save.isPending && confirm === "publish"} disabled={save.isPending || invalid || conflict} data-testid="button-publish">Publish</LoadingButton>
            <button type="button" className="secondary" disabled={save.isPending || invalid || conflict || !dirty} onClick={() => setConfirm("draft")} data-testid="button-save-draft">Save draft</button>
            <button type="button" className="secondary" disabled={save.isPending || !dirty} onClick={() => { setForm({ ...base! }); setNotice(""); }} data-testid="button-cancel">Cancel changes</button>
            <button type="button" className="secondary danger" disabled={save.isPending || conflict || (item.source === "default" && !item.draft)} onClick={() => setConfirm("reset")} data-testid="button-reset">Reset to default</button>
          </div>
        </form>

        <aside className="panel padded et-preview" aria-label="Live preview" data-testid="panel-preview">
          <h3>Preview</h3>
          <p className="et-hint">Sample placeholders only. No patient data is used.</p>
          {form.logoUrl && isValidLogo(form.logoUrl) && ((showLogo || isInternalLogo(form.logoUrl))
            ? <img src={logoPreviewSrc(form.logoUrl)} alt="Logo preview" className="et-logo" referrerPolicy="no-referrer" data-testid="img-logo" />
            : <button type="button" className="secondary" onClick={() => setShowLogo(true)} data-testid="button-load-logo">Load logo preview (contacts the image host)</button>)}
          <div className="et-mail">
            <div className="et-subject" data-testid="text-preview-subject">{preview!.subject}</div>
            <div className="et-body" data-testid="text-preview-body">{preview!.body}</div>
            {preview!.footer && <div className="et-footer">{preview!.footer}</div>}
          </div>
          {!dirty && <details className="et-server"><summary>Server rendering</summary><div>{item.previewSubject}</div><pre>{item.previewBody}</pre></details>}
        </aside>
      </div>}

    <AppDialog open={!!confirm} onClose={() => !save.isPending && setConfirm(null)} title={confirm ? MODE_COPY[confirm].title : ""} busy={save.isPending}>
      {confirm && <div className="et-dialog"><p>{MODE_COPY[confirm].text}</p>
        <div className="et-actions">
          <LoadingButton type="button" loading={save.isPending} onClick={() => run(confirm)} className={confirm === "reset" ? "danger" : undefined} data-testid="button-confirm-save">{MODE_COPY[confirm].action}</LoadingButton>
          <button type="button" className="secondary" disabled={save.isPending} onClick={() => setConfirm(null)} data-testid="button-confirm-cancel">Go back</button>
        </div></div>}
    </AppDialog>
    <AppDialog open={!!pendingNav} onClose={() => setPendingNav(null)} title="Discard unsaved changes?">
      <div className="et-dialog"><p>You have edits that are not saved. Leaving this template discards them.</p>
        <div className="et-actions">
          <button type="button" className="danger" onClick={() => { const go = pendingNav; setPendingNav(null); go?.(); }} data-testid="button-discard">Discard and continue</button>
          <button type="button" className="secondary" onClick={() => setPendingNav(null)} data-testid="button-keep-editing">Keep editing</button>
        </div></div>
    </AppDialog>
  </section>;
}
export default EmailTemplates;
