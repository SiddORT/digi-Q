import * as api from "@workspace/api-client-react";
import { ProfileRecordSummary } from "../src/components/ProfileCompletion";
import { DateTimePreferencesProvider } from "../src/components/DateTimePreferences";
import { ToastHost } from "../src/components/ToastHost";
import { useState } from "react";
import { resources, Editor } from "../src/resources";

function BirthDateRemovalFixture({full}:{full:boolean}) {
  const [saved,setSaved]=useState(false);
  const initial={id:"profile-fixture",fullName:"Fictional Patient",dateOfBirth:"2000-02-29",age:20};
  return <><Editor fields={resources.patients.fields.filter(field=>["fullName","dateOfBirth","age"].includes(field.key))}
    initial={initial} resourceName={full?"patients":undefined} submitLabel="Save" onSave={()=>setSaved(true)}/>
    {saved&&<output data-testid="dob-removal-saved">DOB removal saved</output>}</>;
}

/** Isolated test host. Every API request is intercepted by the browser regression; never a production route. */
export function ProfileCompletionFixture() {
  const params = new URLSearchParams(window.location.search);
  const kind = (params.get("kind") || "patients") as "patients"|"doctors"|"users";
  const identity = { user: {id:"fixture-admin",role:"superAdmin",fullName:"Fictional Administrator"} } as api.Identity;
  if (params.get("readonly")) identity.user!.role = "doctor";
  return <DateTimePreferencesProvider value={{dateFormat:"YYYY-MM-DD",timeFormat:"24h"}}>
    <ToastHost/><main className="content"><h1>Fictional profile</h1>
      {params.get("editor")?<BirthDateRemovalFixture full={params.get("editor")==="full"}/>:<ProfileRecordSummary kind={kind} id="profile-fixture" identity={identity}/>}
    </main>
  </DateTimePreferencesProvider>;
}
