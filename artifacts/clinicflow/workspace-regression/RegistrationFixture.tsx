import * as api from "@workspace/api-client-react";
import { Booking } from "../src/clinic";
import { ResourcePage, ErrorNotice } from "../src/resources";
import { BranchScopeGate, LocationSelector, WorkspaceBranchProvider } from "../src/components/WorkspaceBranch";
import { useSearch } from "wouter";

/** Browser journey uses real migrated PostgreSQL routers supplied by the test.
 * No role is inferred here: the fixture must return its actual /me identity. */
export function RegistrationFixture() {
  const params = new URLSearchParams(useSearch());
  const me = api.useGetMe();
  if (me.error) return <ErrorNotice error={me.error}/>;
  if (!me.data?.user) return <p>Loading fixture identity…</p>;
  const page = params.get("registrationPage") === "booking" ? "book" : "patients";
  const content = page === "book" ? <Booking identity={me.data}/> :
    <ResourcePage resource="patients" identity={me.data} allowCreate={me.data.user.role !== "doctor"}/>;
  return <div className="workspace-main"><main className="content">
    {params.get("pinned") === "1" ? <WorkspaceBranchProvider identity={me.data}><LocationSelector/><BranchScopeGate page={page}>{content}</BranchScopeGate></WorkspaceBranchProvider> : content}
  </main></div>;
}
