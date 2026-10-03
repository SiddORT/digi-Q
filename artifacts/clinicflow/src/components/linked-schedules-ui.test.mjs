import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = name => readFileSync(new URL(name, import.meta.url), "utf8");

test("both onboarding callers include explicit linked settings in the atomic request", () => {
  for (const name of ["ClinicRegistration.tsx", "ClinicAdminOnboarding.tsx"]) {
    const text = source(name);
    assert.match(text, /values\.alsoConsult && values\.linkConsultationHours/);
    assert.match(text, /ownerSchedule: \{ maxTokens: Number\(values\.sessionCapacity\), consultationMinutes: Number\(values\.consultationMinutes\)/);
    assert.doesNotMatch(text, /createSchedule\(/);
  }
});
test("linked mode is selected by default but capacity is explicit", () => {
  const text = source("ClinicRegistrationWizard.tsx");
  assert.match(text, /linkConsultationHours: true, sessionCapacity: "", consultationMinutes: ""/);
  assert.match(text, /Number\.isSafeInteger/);
  assert.match(text, /Custom consultation hours:/);
});
test("settings requires preview and blocks conflicting apply", () => {
  const text = source("LinkedScheduleControls.tsx");
  assert.match(text, /previewClinicSettings/);
  assert.match(text, /disabled=\{busy \|\| !result.allowed\}/);
  assert.match(text, /result.conflicts.map/);
  assert.match(source("ClinicSettings.tsx"), /submitLabel="Review changes"/);
});
test("all clinic configuration sections have retained-clinic navigation", () => {
  const text = source("ClinicSettings.tsx");
  for (const label of ["General", "Locations & Hours", "Doctors & Sessions", "Booking Rules", "Staff", "Booking Links & QR", "Activity history"]) assert.ok(text.includes(label));
  assert.match(text, /searchParams\.set\("clinicId",clinicId\)/);
  assert.match(text, /window.history.replaceState/);
});
test("clinic workspace embeds real scoped management instead of link-only sections", () => {
  const text = source("ClinicSettings.tsx");
  for (const name of ["branches","qrs","audit"]) assert.match(text, new RegExp(`resource="${name}"[^\\n]*fixedClinicId=\\{clinicId\\}`));
  assert.match(text, /<Users[^>]*clinicId=\{clinicId\}[^>]*embedded/);
  assert.match(text, /onEdit=\{row=>\{const item=data\.branches\.find/);
  assert.match(text, /clinic-section-menu/);
  assert.doesNotMatch(text, /clinic-settings-tabs/);
  assert.doesNotMatch(text, /Open staff management|Open booking QR codes/);
});
test("legacy routes remain, while navigation consolidates clinic, staff and schedule", () => {
  const text = readFileSync(new URL("../clinic.tsx", import.meta.url), "utf8");
  const navigation = readFileSync(new URL("./WorkspaceNav.tsx", import.meta.url), "utf8");
  assert.match(text, /page==="users"\?<Users/);
  assert.match(text, /page==="clinics"&&role==="doctor"\?<DoctorClinics/);
  assert.match(text, /page==="settings"\?<WorkspaceSettings/);
  assert.match(text, /page==="availability"\|\|page==="exceptions"/);
  assert.match(text, /<ConsultationManagement identity=\{identity\}/);
  assert.match(text, /<DoctorClinics identity=\{identity\} embedded/);
  assert.match(navigation, /My profile & consultation/);
  // Approved explicit management modules are visible in admin navigation.
  assert.match(text, /admin:\["dashboard","appointments","queue","patients","clinics","branches","users","system-users","availability","reports","masters","settings","templates","permissions","integrations","audit","demo"\]/);
});
test("appointment and report filters apply drafts, with status-only tabs and column sorting", () => {
  const text = readFileSync(new URL("../clinic.tsx", import.meta.url), "utf8");
  const appointments=text.slice(text.indexOf("function Appointments(){"),text.indexOf("function Booking("));
  const reports=text.slice(text.indexOf("function Reports(){"));
  for(const source of [appointments,reports]){
    assert.match(source, /onOpen=\{openFilters\} onApply=\{applyFilters\}/);
    assert.match(source, /const \[draft,setDraft\]=useState/);
    assert.doesNotMatch(source, /<SearchableSelect label="Sort"/);
  }
  assert.match(appointments, /onSortChange=\{setSort\}/);
  // Status tabs sit in the compact toolbar's status slot; range and sort use the accessible SearchableSelect.
  assert.match(appointments, /status=\{<StatusTabs value=\{status\}/);
  assert.match(appointments, /<SearchableSelect label="Visit range" value=\{view\}/);
  assert.match(appointments, /<SearchableSelect label="Sort appointments" value=\{sort\}/);
  assert.match(appointments, /\{value:"-createdAt",label:"Newest created"\}/);
  assert.match(appointments, /\{value:"date",label:"Visit date: earliest first"\}/);
});
test("old branch list edit opens the authorised clinic hours editor instead of generic CRUD", () => {
  const portal = readFileSync(new URL("../clinic.tsx", import.meta.url), "utf8");
  const settings = source("ClinicSettings.tsx");
  assert.match(portal, /page==="branches"&&role==="admin"\?row=>navigate\(`\/admin\/settings\?clinicId=/);
  assert.match(settings, /data\.branches\.find\(branch=>branch\.id===target\)/);
  assert.match(settings, /setBranch\(item\);setMissingBranch\(false\)/);
  assert.match(settings, /const closeBranch=\(\)=>\{setBranch\(null\)/);
  assert.match(settings, /This location is not available in the selected clinic/);
});
test("custom-hour setup is a drawer in the one scheduling workspace", () => {
  const settings=source("ClinicSettings.tsx");
  const scheduling=source("SchedulingWorkspace.tsx");
  assert.match(settings, /<SchedulingWorkspace[^>]*clinicId=\{clinicId\} onLinkOwner=/);
  assert.doesNotMatch(settings, /<ClinicSessionSetup/);
  assert.match(scheduling, /<AppDialog open variant="drawer"[\s\S]*?title="Copy opening hours into custom doctor sessions"/);
  assert.match(scheduling, /<ClinicSessionSetup[^>]*clinicId=\{clinicId\}/);
  assert.match(scheduling, /resource=\{selectedPage\}/);
  assert.match(scheduling, /url\.searchParams\.set\("schedule",target\)/);
  assert.match(scheduling, /Edit linked owner hours/);
});