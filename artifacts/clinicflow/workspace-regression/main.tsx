import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ResourcePage } from "../src/resources";
import { ClinicSettings } from "../src/components/ClinicSettings";
import { Users } from "../src/Users";
import "./workspace.css";

// No Clerk provider, real account, live API, test bypass or production data is used.
// Browser tests intercept *all* /api/ requests before opening this page.
const identity = {
  user: { id: "fixture-admin", role: "superAdmin", fullName: "Fixture Administrator" },
  doctorId: "doctor-1",
} as React.ComponentProps<typeof ClinicSettings>["identity"];
const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");
if (mode !== "resource" && mode !== "settings" && mode !== "staff") throw new Error(`Unknown isolated fixture mode: ${mode}`);
const resource = params.get("resource") || "clinics";
const fixedClinicId = params.get("fixedClinicId") || undefined;
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, refetchInterval: false }, mutations: { retry: false } } });
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={queryClient}>
    <div className="workspace">
      <aside className="sidebar" aria-label="Fixture workspace navigation">
        <div className="workspace-label">WORKSPACE</div>
        <nav>Clinic management</nav>
      </aside>
      <div className="workspace-main">
        <header className="topbar"><div className="breadcrumb">Workspace · {mode === "settings" ? "Settings" : mode === "staff" ? "Staff" : resource}</div></header>
        <main className="content">
          <div className="page-heading"><h1>{mode === "settings" ? "Clinic settings" : mode === "staff" ? "Staff" : resource}</h1></div>
          {mode === "settings" ? <ClinicSettings identity={identity}/> : mode === "staff" ? <Users identity={identity} clinicId={fixedClinicId} embedded={!!fixedClinicId}/> : <ResourcePage resource={resource} identity={identity} embedded={!!fixedClinicId} fixedClinicId={fixedClinicId}/>}
        </main>
      </div>
    </div>
  </QueryClientProvider>,
);