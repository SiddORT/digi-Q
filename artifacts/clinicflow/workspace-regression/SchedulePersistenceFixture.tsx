import * as api from "@workspace/api-client-react";
import { ResourcePage } from "../src/resources";
import { ClinicAdminOnboarding } from "../src/components/ClinicAdminOnboarding";
import { ToastHost } from "../src/components/ToastHost";
import { DateTimePreferencesProvider } from "../src/components/DateTimePreferences";

/** Test host only; identity and all schedule reads/writes use native sessions and disposable SQL. */
export function SchedulePersistenceFixture() {
  const me = api.useGetMe();
  if (!me.data) return <p role="status">Loading authenticated fixture…</p>;
  return <DateTimePreferencesProvider value={{timeFormat:"24h",dateFormat:"YYYY-MM-DD"}}>
    <ToastHost/><main className="content">
      {new URLSearchParams(window.location.search).get("onboard")==="1"
        ? <ClinicAdminOnboarding guided draftActor={me.data.userId}/>
        : <ResourcePage resource="availability" identity={me.data} defaults={{doctorId:"d1",clinicId:"c1",branchId:"b1"}}/>}
    </main>
  </DateTimePreferencesProvider>;
}
