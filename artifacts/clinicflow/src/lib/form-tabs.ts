/**
 * Tabbed record forms (single Save). Pure mapping so tab placement, invalid-tab marking and the
 * "select the first invalid tab" rule are identical in the generic Editor, Users staff forms and Profile.
 */
export type FormTab = { id: string; label: string; fields: string[] };

/** Generic Editor tabs are defined over editor groups (see resources.tsx EDITOR_GROUPS / PATIENT_EDITOR_GROUPS). */
export const EDITOR_TABS: Record<string, [string, string[]][]> = {
  patients: [["Personal & Contact", ["Patient information", "Clinic and status"]], ["Additional Details", ["Address", "Emergency contact"]]],
  users: [["Personal", ["Details", "Status", "Address"]], ["Assignment", ["Assignment and scope"]]],
};
export function editorTabIndex(resourceName: string | undefined, group: string) {
  const tabs = resourceName ? EDITOR_TABS[resourceName] : undefined;
  if (!tabs) return 0;
  const i = tabs.findIndex(([, groups]) => groups.includes(group));
  return i < 0 ? 0 : i;
}

const PERSONAL: FormTab = { id: "personal", label: "Personal", fields: ["fullName", "email", "mobile", "status"] };
/** Doctor forms use visible sections; receptionist tabs and Clinic Admin forms stay unchanged. */
export const STAFF_TABS: Record<string, FormTab[]> = {
  receptionists: [PERSONAL, { id: "assignment", label: "Assignment", fields: ["clinicIds", "branchIds", "confirmInherited"] }],
};
export function tabOf(tabs: FormTab[], key: string) {
  const i = tabs.findIndex(tab => tab.fields.includes(key));
  return i < 0 ? 0 : i;
}
export function invalidTabs(tabs: FormTab[], errorKeys: string[]) {
  return tabs.map((_, i) => errorKeys.some(key => tabOf(tabs, key) === i));
}
/** First tab (in tab order, not error order) that holds an error, or -1. */
export function firstInvalidTab(tabs: FormTab[], errorKeys: string[]) {
  return invalidTabs(tabs, errorKeys).indexOf(true);
}
