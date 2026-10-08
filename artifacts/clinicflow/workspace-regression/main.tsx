import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResourcePage } from "../src/resources";
import { ClinicSettings } from "../src/components/ClinicSettings";
import { WorkspaceNav } from "../src/components/WorkspaceNav";
import { Redirect, useLocation, useSearch } from "wouter";
import { clinicLandingDestination } from "../src/lib/clinic-navigation";
import { Users } from "../src/Users";
import "./workspace.css";

// No Clerk provider, real account, live API, test bypass or production data is used.
// Browser tests intercept *all* /api/ requests before opening this page.
const identity = {
  user: { id: "fixture-admin", role: "superAdmin", fullName: "Fixture Administrator" },
  doctorId: "doctor-1",
} as React.ComponentProps<typeof ClinicSettings>["identity"];
function FixtureWorkspace(){
const [location]=useLocation();
const search=useSearch();
const params = new URLSearchParams(search);
const browsing=location.startsWith("/admin/");
const mode = browsing?(location==="/admin/clinic"?"settings":"resource"):params.get("mode");
if (mode !== "resource" && mode !== "settings" && mode !== "staff") throw new Error(`Unknown isolated fixture mode: ${mode}`);
const resource = params.get("resource") || "clinics";
const fixedClinicId = params.get("fixedClinicId") || undefined;
const fixtureRole=params.get("fixtureRole")==="clinicAdmin"?"clinicAdmin":params.get("fixtureRole")==="doctor"?"doctor":"superAdmin";
const fixtureIdentity={...identity,user:{...identity.user!,role:fixtureRole}} as typeof identity;
const navigationRole=fixtureRole==="doctor"?"doctor":"admin";
const navigation=fixtureRole==="clinicAdmin"?["clinic"]:["clinics"];
const redirect=clinicLandingDestination(location.split("/").pop()||"",fixtureRole,search);
return (
    <div className="workspace">
      <aside className="sidebar" aria-label="Fixture workspace navigation">
        <div className="workspace-label">WORKSPACE</div>
        <WorkspaceNav navigation={navigation} role={navigationRole} page={mode==="settings"?"clinic":"clinics"} onNavigate={()=>{}}/>
      </aside>
      <div className="workspace-main">
        <header className="topbar"><div className="breadcrumb">Workspace · {mode === "settings" ? "Settings" : mode === "staff" ? "Staff" : resource}</div></header>
        <main className="content">
          <div className="page-heading"><h1>{mode === "settings" ? "Clinic settings" : mode === "staff" ? "Staff" : resource}</h1></div>
          {redirect?<Redirect to={redirect}/>:mode === "settings" ? <ClinicSettings identity={fixtureIdentity}/> : mode === "staff" ? <Users identity={fixtureIdentity} clinicId={fixedClinicId} embedded={!!fixedClinicId}/> : <ResourcePage resource={resource} identity={fixtureIdentity} embedded={!!fixedClinicId} fixedClinicId={fixedClinicId}/>}
        </main>
      </div>
    </div>
);
}
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, refetchInterval: false }, mutations: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <FixtureWorkspace/>
  </QueryClientProvider>,
);