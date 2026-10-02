import { Link } from "wouter";
import { useState } from "react";
import { SearchInput } from "./ListingControls";

// A readable description of existing fixed role boundaries, NOT a grant editor.
const rules = [
  ["Platform configuration", "Super Admin", "Read and update platform preferences, provider configuration and platform templates", "Server-private bootstrap keys are never editable here."],
  ["Clinic configuration", "Super Admin / owning Clinic Admin", "Read and update clinic details, timezone, opening hours and display preferences", "Doctors and receptionists cannot change clinic configuration."],
  ["Clinic Admin accounts", "Super Admin", "Create with first clinic; manage account status and explicit ownership transfers", "Do not deactivate an owning admin until ownership is resolved."],
  ["Doctors", "Super Admin / managing Clinic Admin", "Create, update, assign and deactivate in authorized ownership scope", "A consulting Clinic Admin retains its own identity and cannot be transferred as an ordinary doctor."],
  ["Reception staff", "Super Admin / Clinic Admin / authorized Doctor", "Existing scoped staff-management permissions apply", "Doctors may manage receptionists only within the existing managing-admin and assignment rules."],
  ["Patients and appointments", "Scoped staff / patient", "Staff actions depend on clinic, clinical membership, status and appointment policy; patients access their own records", "A role alone never grants access to another clinic or patient."],
  ["Queue and consultation", "Scoped staff", "Desk and clinical operations remain governed by session membership and transition permissions", "Owning administration is distinct from doctor consultation capability."],
  ["Email templates", "Super Admin / owning Clinic Admin", "Read, save draft, publish and reset platform or own-clinic templates", "Publishing content is not an instruction to send email or enable automatic events."],
  ["Audit and integrations", "Super Admin", "View audit records and manage integrations through dedicated modules", "Audit records are not editable; credentials are not returned to the browser."],
  ["Deactivation and deletion", "Authorized managing role", "Deactivate supported entities while preserving historical records", "No general permanent-delete power; self-lockout and last-active-admin protections remain."],
];

export function AccessRules() {
  const [search, setSearch] = useState("");
  const rows = rules.filter(row => row.join(" ").toLowerCase().includes(search.toLowerCase()));
  return <section className="panel padded">
    <h2>Roles &amp; access rules</h2>
    <p>Current fixed role-policy summary. Record ownership, clinic assignments and workflow state are checked by the API on each operation.</p>
    <p className="notice">This is not a configurable permission editor or a complete per-action effective-permission matrix. Custom grants are not enabled.</p>
    <div className="filter-bar-row"><SearchInput value={search} onChange={setSearch} placeholder="Search access rules…"/><div className="filter-bar-tools"><Link className="button secondary" href="/admin/users">Manage users &amp; assignments</Link></div></div>
    <div className="table-scroll"><table><thead><tr><th>Module</th><th>Roles</th><th>Supported operations</th><th>Safeguards</th></tr></thead><tbody>{rows.map(([module, roles, actions, safeguards]) => <tr key={module}><td data-label="Module">{module}</td><td data-label="Roles">{roles}</td><td data-label="Supported operations">{actions}</td><td data-label="Safeguards">{safeguards}</td></tr>)}</tbody></table></div>
    {!rows.length && <p>No matching rules. <button type="button" onClick={() => setSearch("")}>Clear search</button></p>}
  </section>;
}