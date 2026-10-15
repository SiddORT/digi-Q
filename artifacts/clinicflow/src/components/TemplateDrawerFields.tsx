import { useState, type ReactNode } from "react";
import * as api from "@workspace/api-client-react";
import { FormField } from "./FormField";
import { previewText } from "../lib/template-preview";
import { HelpTip } from "./HelpTip";
import { NotificationInfo } from "./NotificationInfo";

type Content = api.NotificationTemplateContent;
type Key = "subject" | "body" | "dltTemplateId";

/** Compact primary fields for the template drawer. Email body is plain text (escaped by the server), not HTML. */
export function TemplateDrawerFields({ form, sms, errors, variables, scopeName, set, templateKey, savedDltTemplateId, active, compact = false }: {
  form: Content; sms: boolean; errors: { subject?: string; body?: string };
  variables: string[]; scopeName: string; set: (k: Key, v: string) => void;
  templateKey: string; savedDltTemplateId?: string; active: ReactNode; compact?: boolean;
}) {
  const [preview, setPreview] = useState(false);
  const bodyLabel = sms ? "SMS Body" : "Email Body";
   const hint = <p className="td-hint" data-testid="text-variable-hint">Use {"{{variable}}"} placeholders; they are filled in when sent.</p>;
  return <>
    <dl className="td-summary" data-testid="panel-template-summary">
      {!compact && <div><dt>Template Key</dt><dd>{templateKey}</dd></div>}
       <div><dt>Variables {compact ? <NotificationInfo label="About Template Variables">Dates and session times follow the clinic format and visit timezone; session times are not promised consultation times. Previews use placeholders, never real login codes.</NotificationInfo> : <HelpTip text="Dates and session times use the clinic's display format and the visit's local timezone. Session times are not guaranteed consultation times. recipient_name is the actual recipient, while patient_name remains the patient. queue_token includes the prefix (Q-007); token_number is numeric (7). Previous date/time fields apply only to rescheduling; appointment fields do not apply to clinic onboarding. Missing required visit values prevent dispatch. otp and expiry_minutes are supported only for the patient login SMS security template. Previews use example codes, never real login codes." />}</dt><dd>{variables.length ? variables.map(v => `{{${v}}}`).join(" ") : "None"}</dd></div>
      {sms && !compact && <div><dt>DLT Template ID</dt><dd data-testid="text-saved-dlt">{savedDltTemplateId || "Not set"}</dd></div>}
    </dl>
    {active}
    {sms && <fieldset className="td-dlt" data-testid="block-dlt">
      <legend>DLT Registration (Indian SMS Compliance)</legend>
      <FormField label="DLT Template ID" optional helper="Required to enable SMS. Sender ID is taken from Communication Settings; Keep in Touch does not need an Entity ID.">{a => <input {...a} type="text" maxLength={50} value={form.dltTemplateId ?? ""} onChange={e => set("dltTemplateId", e.target.value)} data-testid="input-dltTemplateId" />}</FormField>
    </fieldset>}
    {!sms && <FormField label="Subject" required error={errors.subject}>{a => <input {...a} type="text" maxLength={180} value={form.subject} onChange={e => set("subject", e.target.value)} data-testid="input-subject" />}</FormField>}
    <div className="td-body">
      <div className="td-body-head"><span>{bodyLabel}</span>
        <button type="button" className="td-link" aria-pressed={preview} onClick={() => setPreview(p => !p)} data-testid="button-toggle-preview">{preview ? "Edit" : "Preview"}</button></div>
      {preview ? <div className="et-body td-preview" data-testid="text-preview-body">{previewText(form.body, scopeName)}</div>
        : <FormField label={bodyLabel} required error={errors.body}>{a => <textarea {...a} className="td-textarea" rows={sms ? 8 : 14} maxLength={sms ? 1600 : 8000} value={form.body} onChange={e => set("body", e.target.value)} data-testid="input-body" />}</FormField>}
       {hint}
    </div>
  </>;
}
