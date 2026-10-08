import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Identity } from "@workspace/api-client-react";
import { LocationSelector, WorkspaceBranchProvider, useRegisterUnsaved, useWorkspaceBranchContext } from "../src/components/WorkspaceBranch";
import "../src/index.css";

const identity = { user: { id: "location-fixture", role: "clinicAdmin" } } as Identity;
const branches = Array.from({ length: 5000 }, (_, i) => ({
  id: `location-${i}`, clinicId: `clinic-${Math.floor(i / 100)}`,
  name: `Location ${String(i).padStart(4, "0")}`,
  clinicName: `Clinic ${String(Math.floor(i / 100)).padStart(2, "0")}`,
}));

function Controls() {
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useRegisterUnsaved(dirty, busy);
  const ctx = useWorkspaceBranchContext();
  return <main style={{ padding: 32 }}>
    <div style={{ display: "flex", justifyContent: "flex-end" }}><LocationSelector /></div>
    <label><input type="checkbox" checked={dirty} onChange={e => setDirty(e.target.checked)} />Unsaved draft</label>
    <label><input type="checkbox" checked={busy} onChange={e => setBusy(e.target.checked)} />Saving draft</label>
    <button onClick={() => void ctx.select("unauthorized-location")}>Attempt unauthorized selection</button>
    <output data-testid="selected-location">{ctx.pin?.branchId}</output>
  </main>;
}

export function LocationFixture() {
  const client = useQueryClient();
  useState(() => {
    localStorage.setItem("dq.workspace.branch.location-fixture", "location-4500");
    client.setQueryData(["workspace-branches", "location-fixture", "clinicAdmin", ""], branches);
    return true;
  });
  return <WorkspaceBranchProvider identity={identity}><Controls /></WorkspaceBranchProvider>;
}
