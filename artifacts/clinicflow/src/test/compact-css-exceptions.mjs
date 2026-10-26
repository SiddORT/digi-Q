// Existing compact component geometry, audited separately from the central v3
// scale. Exact declarations only: adding a selector/property/value still fails.
// This is a debt inventory, NOT a claim that these values meet the v3 scale.
// Do not widen it to a filename exclusion when a future screen changes.
const entries = `
clinic-listing-toolbar.css|.workspace .list-header.list-header--compact .listing-icon-trigger .filter-count|padding|0 3px
email-templates.css|.et-test-values|gap|10px
email-templates.css|.event-controls .ec-event|margin-top|18px
email-templates.css|.event-controls .ec-table th,.event-controls .ec-table td|padding|8px 10px
email-templates.css|.event-controls .ec-table td|padding|3px 0
email-templates.css|.td-summary|padding|10px 12px
email-templates.css|.td-summary|gap|6px
email-templates.css|.td-dlt|padding|10px 12px
email-templates.css|.td-body .form-field-label|margin|-1px
notification-settings.css|.ns-cell|gap|3px
notification-settings.css|.ns-cell label|gap|6px
notification-settings.css|.ns-table tr|padding|6px 0
communication.css|.cm-notification-gate.ns|gap|2px
communication.css|.event-controls .cm-row-actions .button|padding|6px 12px
communication.css|.event-controls button.cm-switch|padding|2px
communication.css|.cm-notification-scope .form-field-label|padding-top|10px
communication.css|.cm-event-toolbar|padding-right|10px
communication.css|.cm-group-status|padding|0 6px
notification-page.css|.event-controls .cm-notification-scope > .ov-text|padding-block|10px
notification-page.css|.event-controls .ns-gate|gap|10px
notification-page.css|.event-controls .cm-row-meta|gap|6px
notification-page.css|.event-controls .cm-required-note|padding|4px 12px 10px
notification-page.css|.cm-template-editor .cm-wording-details p|margin|0 0 6px
notification-page.css|.event-controls .cm-event-toolbar > .cm-switch|margin|10px 0
notification-page.css|.event-controls .cm-row-actions|gap|10px
notification-page.css|.event-controls .ns-heading p|margin-top|2px
notification-page.css|.event-controls .cm-inline-filters .ns-search input[type=search]|padding-left|36px
notification-page.css|.event-controls .cm-event|border-radius|10px
notification-page.css|.event-controls .cm-event-trigger|gap|10px
notification-page.css|.event-controls .cm-count|padding|2px 8px
notification-page.css|.event-controls .cm-managed-note|padding|10px 16px 14px
notification-page.css|.event-controls .cm-cols|padding-block|6px
notification-page.css|.event-controls .cm-cell|gap|6px
notification-page.css|.event-controls .cm-edit.button|padding|0 14px
notification-page.css|.event-controls[data-testid="page-notification-templates"] button.cm-switch|padding|2px
notification-page.css|.event-controls .cm-row|border-radius|10px
notification-page.css|.event-controls .cm-enabled::before|margin-right|6px
clinic-settings.css|.cs-title|gap|10px
clinic-settings.css|.cs-status|padding|2px 10px
clinic-settings.css|.cs-address|gap|6px
clinic-settings.css|.cs-address|margin|6px 0 12px
clinic-settings.css|.cs-address svg|margin-top|2px
clinic-settings.css|.cs-actions .button|gap|6px
clinic-settings.css|.cs-linked-card|border-radius|10px
clinic-settings.css|.cs-linked-main|padding|12px 14px
clinic-settings.css|.cs-readiness|gap|6px
clinic-settings.css|.cs-linked-card .cs-readiness|padding|6px 14px
clinic-settings.css|.cs-card-head|padding-bottom|10px
clinic-settings.css|.cs-list>div|gap|10px
clinic-settings.css|.cs-list dd|gap|6px
clinic-settings.css|.cs-hours-note|padding|12px 14px
clinic-settings.css|.cs-list>div|gap|2px
workspace-consolidation.css|.staff-verify|gap|6px
workspace-consolidation.css|.staff-create .doctor-context-value|padding|6px 12px
workspace-consolidation.css|.staff-create .staff-assignment-row :is(.searchable-select-control,.searchable-multi-select-control)|padding-block|6px
communication-usage.css|.cu-card|border-radius|10px
communication-usage.css|.cu-skel|border-radius|10px
uniformity.css|.appt-detail .appt-tab|padding|6px 8px
clinic-listing-toolbar.css|.workspace .list-header.list-header--compact .listing-icon-trigger .filter-count|font-size|10px
notification-settings.css|.ns-restore|font-size|12px
communication.css|.nl-table|font-size|.85rem
communication-usage.css|.cu-total span|font-size|1.9rem
communication-usage.css|.cu-card strong|font-size|1.5rem
communication-usage.css|.cu-channel-breakdown button|font-size|.8rem
communication.css|.event-controls button.cm-info|height|36px
communication.css|.event-controls button.cm-info|min-height|36px
notification-page.css|.event-controls .cm-row-meta button.cm-info|height|36px
notification-page.css|.event-controls .cm-row-meta button.cm-info|min-height|36px
notification-page.css|.event-controls .cm-edit.button|height|36px
notification-page.css|.event-controls .cm-edit.button|min-height|36px
uniformity.css|.appt-detail .appt-tab|min-height|36px
`.trim().split("\n");
const normalize = value => value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").replace(/\s*,\s*/g, ",").trim();
export const compactCssExceptions = new Set(entries.map(entry => entry.split("|").map(normalize).join("|")));
export function cssExceptionKey(file, selector, prop, value) {
  return [file.split("/").at(-1), selector, prop, value].map(normalize).join("|");
}
