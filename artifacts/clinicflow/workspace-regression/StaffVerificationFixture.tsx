import { useState } from "react";
import { FirstLoginVerificationPrompt, StaffContactVerification } from "../src/components/StaffContactVerification";
import { NativeAuthProvider } from "../src/auth/native-auth";
import { StaffLogin } from "../src/auth/StaffLogin";
import { Editor, profileFields } from "../src/resources";
import { updateMe } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

/** Fictional role fixtures. Tests intercept every request, never workspace accounts. */
export function StaffVerificationFixture({ login = false, superAdminProfile = false }: { login?: boolean; superAdminProfile?: boolean }) {
  const [profile, setProfile] = useState(false);
  const [account,setAccount]=useState({id:"fixture-super",role:"superAdmin",fullName:"Fictional Super Admin",mobile:""});
  const [busy,setBusy]=useState(false);
  const client=useQueryClient();
  if (login) return <NativeAuthProvider><StaffLogin /></NativeAuthProvider>;
  if(superAdminProfile) return <main className="content"><h2>My Profile</h2><StaffContactVerification actor={account.id}/>
    <Editor key={account.mobile} fields={profileFields} initial={account} mobileVerificationHelp busy={busy}
      onSave={async values=>{setBusy(true);try{const saved=await updateMe(values);setAccount({...account,...saved});await client.invalidateQueries();}finally{setBusy(false);}}}/></main>;
  return <main className="workspace">
    <div className="content">
      <p data-testid="fictional-staff-actor">Fictional receptionist · fixture-staff</p>
      <button className="button secondary" onClick={() => setProfile(p => !p)}>{profile ? "Workspace" : "My Profile"}</button>
      {profile ? <StaffContactVerification actor="fixture-staff" /> : <FirstLoginVerificationPrompt actor="fixture-staff" />}
    </div>
  </main>;
}
