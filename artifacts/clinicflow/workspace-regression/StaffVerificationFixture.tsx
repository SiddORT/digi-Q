import { useState } from "react";
import { FirstLoginVerificationPrompt, StaffContactVerification } from "../src/components/StaffContactVerification";
import { NativeAuthProvider } from "../src/auth/native-auth";
import { StaffLogin } from "../src/auth/StaffLogin";

/** Fictional role fixtures. Tests intercept every request, never workspace accounts. */
export function StaffVerificationFixture({ login = false }: { login?: boolean }) {
  const [profile, setProfile] = useState(false);
  if (login) return <NativeAuthProvider><StaffLogin /></NativeAuthProvider>;
  return <main className="workspace">
    <div className="content">
      <p data-testid="fictional-staff-actor">Fictional receptionist · fixture-staff</p>
      <button className="button secondary" onClick={() => setProfile(p => !p)}>{profile ? "Workspace" : "My Profile"}</button>
      {profile ? <StaffContactVerification actor="fixture-staff" /> : <FirstLoginVerificationPrompt actor="fixture-staff" />}
    </div>
  </main>;
}
