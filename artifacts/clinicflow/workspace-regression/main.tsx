import React, { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResourcePage } from "../src/resources";
import { ClinicSettings } from "../src/components/ClinicSettings";
import { WorkspaceNav } from "../src/components/WorkspaceNav";
import { Redirect, useLocation, useSearch } from "wouter";
import { clinicLandingDestination } from "../src/lib/clinic-navigation";
import { Users } from "../src/Users";
import { UsersWorkspace, Appointments } from "../src/clinic";
import { SchedulingWorkspace } from "../src/components/SchedulingWorkspace";
import { ListPageTitleContext } from "../src/components/ListingControls";
import "./workspace.css";

// No Clerk provider, real account, live API, test bypass or production data is used.
// Browser tests intercept *all* /api/ requests before opening this page.
const identity = {
  user: { id: "fixture-admin", role: "superAdmin", fullName: "Fixture Administrator" },
  doctorId: "doctor-1",
} as React.ComponentProps<typeof ClinicSettings>["identity"];
function FixtureWorkspace(){
const titleOwner=useRef<string|null>(null);
const [location]=useLocation();
const search=useSearch();
const params = new URLSearchParams(search);
const browsing=location.startsWith("/admin/");
const [initialMode]=useState(()=>params.get("mode"));
const mode = browsing?(location==="/admin/clinic"?"settings":location==="/admin/users"?"users":location==="/admin/staff"?"staff":location==="/admin/appointments"?"appointments":"resource"):params.get("mode")||initialMode;
if (!["resource","settings","staff","users","appointments","schedule"].includes(mode||"")) throw new Error(`Unknown isolated fixture mode: ${mode}`);
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
          {["settings","users","schedule"].includes(mode||"")&&<div className="page-heading"><h1>{mode === "settings" ? "Clinic settings" : mode === "users" ? "Users" : "Schedule"}</h1></div>}
          <ListPageTitleContext.Provider value={["resource","staff","appointments"].includes(mode||"")?{title:mode==="staff"?"Staff":mode==="appointments"?"Appointments":resource==="clinics"?"Clinic":resource,owner:titleOwner}:null}>
            {redirect?<Redirect to={redirect}/>:mode === "appointments" ? <Appointments role={navigationRole}/> : mode === "schedule" ? <SchedulingWorkspace identity={fixtureIdentity} page={resource==="exceptions"?"exceptions":"availability"} clinicId={fixedClinicId}/> : mode === "users" ? <UsersWorkspace identity={fixtureIdentity}/> : mode === "settings" ? <ClinicSettings identity={fixtureIdentity}/> : mode === "staff" ? <Users identity={fixtureIdentity} clinicId={fixedClinicId} embedded={!!fixedClinicId}/> : <ResourcePage resource={resource} identity={fixtureIdentity} allowCreate={!(fixtureRole==="doctor"&&resource==="patients")} embedded={!!fixedClinicId} fixedClinicId={fixedClinicId}/>}
          </ListPageTitleContext.Provider>
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
