import { useState, type ReactNode } from "react";
import * as api from "@workspace/api-client-react";
import { FormField } from "./FormField";
import { previewText } from "../lib/template-preview";
import { HelpTip } from "./HelpTip";
import { NotificationInfo } from "./NotificationInfo";
import { RegistrationSmsGuidance } from "./RegistrationSmsGuidance";

type Content = api.NotificationTemplateContent;
type Key = "subject" | "body" | "dltTemplateId";

/** Compact primary fields for the template drawer. Email body is plain text (escaped by the server), not HTML. */
export function TemplateDrawerFields({ form, sms, errors, variables, scopeName, set, templateKey, savedDltTemplateId, active, compact = false, recipient }: {
  form: Content; sms: boolean; errors: { subject?: string; body?: string };
  variables: string[]; scopeName: string; set: (k: Key, v: string) => void;
  templateKey: string; savedDltTemplateId?: string; active: ReactNode; compact?: boolean; recipient?: string;
}) {
  const [preview, setPreview] = useState(false);
  const bodyLabel = sms ? "SMS Body" : "Email Body";
   const hint = <p className="td-hint" data-testid="text-variable-hint">Use {"{{variable}}"} placeholders; they are filled in when sent.</p>;
  return <>
    <dl className="td-summary" data-testid="panel-template-summary">
      {!compact && <div><dt>Template Key</dt><dd>{templateKey}</dd></div>}
       <div><dt>Variables {compact ? <NotificationInfo label="About Template Variables">Only the listed placeholders are supported for this event. OTP events use code and expiry values; patient SMS login requires the code but supports expiry optionally. Dates and session times follow the clinic format and visit timezone; session times are not promised consultation times. Previews use fictional values, never real codes.</NotificationInfo> : <HelpTip text="Only the listed placeholders are supported for this event. OTP events require otp and expiry_minutes, except patient SMS login where expiry_minutes is optional. Dates and session times use the clinic's display format and visit timezone, not a promised consultation time. recipient_name is the recipient; patient_name is the patient. queue_token includes its prefix; token_number is numeric. Previous fields apply only to rescheduling. Previews use fictional values, never real codes." />}</dt><dd>{variables.length ? variables.map(v => `{{${v}}}`).join(" ") : "None"}</dd></div>
      {sms && !compact && <div><dt>DLT Template ID</dt><dd data-testid="text-saved-dlt">{savedDltTemplateId || "Not set"}</dd></div>}
    </dl>
    {active}
    {sms && templateKey === "registration_mobile_otp" && <RegistrationSmsGuidance recipient={recipient}/>}
    {sms && <fieldset className="td-dlt" data-testid="block-dlt">
      <legend>DLT Registration (Indian SMS Compliance)</legend>
      <FormField label="DLT Template ID" optional helper="Publish the matching approved ID with this wording. Keep in Touch requires it and the configured Sender ID, but no Entity ID. Generic mappings require sender/entity/template metadata when DLT is required. Saving does not confirm approval.">{a => <input {...a} type="text" maxLength={50} value={form.dltTemplateId ?? ""} onChange={e => set("dltTemplateId", e.target.value)} data-testid="input-dltTemplateId" />}</FormField>
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
