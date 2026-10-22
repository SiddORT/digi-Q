import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSearch } from "wouter";
import * as api from "@workspace/api-client-react";
import { ResourcePage, ErrorNotice } from "../src/resources";
import { ClinicSettings } from "../src/components/ClinicSettings";
import { Users } from "../src/Users";
import { Appointments, Booking } from "../src/clinic";
import { ResourceLookup, ResourceMultiLookup } from "../src/components/ResourceLookup";
import { CareLookup } from "../src/components/CareLookup";
import { FilterBar } from "../src/components/ListingControls";
import { SystemUsers } from "../src/components/SystemUsers";
import { AccessRules } from "../src/components/AccessRules";
import { CommunicationUsage } from "../src/components/CommunicationUsage";
import { GuestClinicFinder } from "../src/components/GuestClinicFinder";
import { ProfileMenu } from "../src/components/WorkspaceShell";
import { PatientDocuments } from "../src/components/PatientDocuments";

/** Real components, identity obtained from the real native-session /me route.
 * Browser routes are connected only to a disposable local database by the spec. */
export function DropdownWorkspaceFixture() {
  const search = useSearch();
  const client = useQueryClient();
  const [area] = useState(() => new URLSearchParams(search).get("area") || "selectors");
  const [guest] = useState(() => new URLSearchParams(search).get("guest") === "1");
  const me = api.useGetMe({ query: { enabled: !guest } });
  const [value, setValue] = useState("");
  const [many, setMany] = useState<string[]>([]);
  const [clinicId, setClinic] = useState("");
  const [branchId, setBranch] = useState("");
  const [saved, setSaved] = useState("c2");
  if (guest) return <GuestClinicFinder/>;
  if (me.error) return <ErrorNotice error={me.error}/>;
  if (!me.data?.user) return <p>Loading fixture identity…</p>;
  const identity = me.data, user = identity.user!;
  const role = user.role === "superAdmin" || user.role === "clinicAdmin" ? "admin" : user.role;
  return <main className="content">
    <output data-testid="dropdown-actor">{JSON.stringify({ id: user.id, role: user.role, doctorId: identity.doctorId })}</output>
    <button onClick={async () => { await client.cancelQueries(); client.clear(); await me.refetch(); }}>Refresh identity</button>
    {area === "clinic" ? <ClinicSettings identity={identity}/> :
      area === "staff" ? <Users identity={identity}/> :
      area === "appointments" ? <Appointments role={role}/> :
      area === "booking" ? <Booking entryPoint={user.role === "patient" ? "public-patient" : "staff-workspace"} identity={identity}/> :
      area === "system-users" ? <SystemUsers/> :
      area === "access" ? <AccessRules/> :
      area === "usage" ? <CommunicationUsage userId={user.id} role={user.role}/> :
      area === "documents" ? <PatientDocuments patientId="p1"/> :
      ["doctors", "patients", "branches", "masters", "availability", "exceptions", "qrs", "audit"].includes(area) ?
        <ResourcePage resource={area} identity={identity} allowCreate={user.role !== "doctor" || area !== "patients"}/> :
      user.role === "patient" ? <>
        <CareLookup publicAccess kind="clinics" label="Clinic options" value={clinicId} onChange={setClinic}/>
        <CareLookup publicAccess kind="branches" label="Public location" value={branchId} onChange={setBranch} disabled={!clinicId} params={{ clinicId }}/>
      </> : <>
        <ProfileMenu name={user.fullName} roleLabel={user.role} role={role} actualRole={user.role} navigation={[]} page="clinics" userId={user.id} onSignOut={() => {}}/>
        <FilterBar label="Readiness filters" advanced={<>
          <ResourceLookup resource="clinics" label="Filter Clinic" value={clinicId} onChange={id => { setClinic(id); setBranch(""); }}/>
          <ResourceLookup resource="branches" label="Filter Location" params={{ clinicId }} disabled={!clinicId} value={branchId} onChange={setBranch}/>
        </>}/>
        <ResourceLookup resource="clinics" label="Clinic options" value={value} onChange={setValue}/>
        <ResourceMultiLookup resource="clinics" label="Clinic multi" value={many} onChange={setMany}/>
        <ResourceLookup resource="clinics" label="Saved clinic" value={saved} disabled onChange={setSaved}/>
        <CareLookup kind="doctors" label="Scoped doctor" value="" disabled={!branchId} params={{ clinicId, branchId }} onChange={() => {}}/>
        <output data-testid="dropdown-draft">{JSON.stringify({ value, many, clinicId, branchId, saved })}</output>
      </>}
  </main>;
}
