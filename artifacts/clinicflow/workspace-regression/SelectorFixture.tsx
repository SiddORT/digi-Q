import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import * as api from "@workspace/api-client-react";
import { SearchableSelect } from "../src/components/SearchableSelect";
import { SearchableMultiSelect } from "../src/components/SearchableMultiSelect";
import { ResourceLookup, ResourceMultiLookup } from "../src/components/ResourceLookup";
import { CareLookup } from "../src/components/CareLookup";
import { SessionQueue } from "../src/components/queue/SessionQueue";
import { WorkspaceBranchProvider } from "../src/components/WorkspaceBranch";

export const ids = {
  first: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
  second: "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb",
};
export function SelectorFixture({ queue = false, pinned = false, role = "doctor" }: { queue?: boolean; pinned?: boolean; role?: string }) {
  const client = useQueryClient();
  const [scope, setScope] = useState("selector-fixture");
  const identity = { user: { id: scope, role, fullName: "Fixture Staff" }, doctorId: ids.first } as api.Identity;
  client.setQueryData(api.getGetMeQueryKey(), identity);
  const [value, setValue] = useState(ids.first);
  const [options, setOptions] = useState([{ value: ids.first, label: "First fixture" }]);
  const [disabled, setDisabled] = useState(true);
  const [multi, setMulti] = useState([ids.first, ids.second]);
  if (queue) return pinned ? <WorkspaceBranchProvider identity={identity}><SessionQueue identity={identity}/></WorkspaceBranchProvider> : <SessionQueue identity={identity}/>;
  return <section>
    <SearchableSelect label="Local single" value={value} options={options} onChange={setValue} labelScope={scope}/>
    <SearchableMultiSelect label="Local multi" value={multi} options={options} onChange={setMulti} labelScope={scope}/>
    <button onClick={()=>{setOptions([]);}}>Search away</button>
    <button onClick={()=>{setValue(ids.second);}}>Change value</button>
    <button onClick={()=>setScope("next-actor")}>Change actor scope</button>
    <button onClick={()=>setOptions([{value:ids.second,label:"Second fixture"}])}>Resolve second</button>
    <button onClick={()=>setDisabled(!disabled)}>Toggle editable</button>
    <ResourceLookup resource="doctors" label="Saved doctor" value={value} disabled={disabled} onChange={setValue}/>
    <ResourceMultiLookup resource="assignment:branches" label="Assigned locations" params={{targetRole:"receptionist"}} value={multi} disabled={disabled} onChange={setMulti}/>
    <CareLookup publicAccess kind="branches" label="Public location" value={value} disabled={disabled} params={{clinicId:"fixture-clinic"}} onChange={setValue}/>
    <CareLookup kind="appointments" label="Your appointment" value={value} disabled={disabled} onChange={setValue}/>
    <output data-testid="submission-values">{JSON.stringify({value,multi})}</output>
  </section>;
}
