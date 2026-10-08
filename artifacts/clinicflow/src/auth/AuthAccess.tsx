import { useEffect, type ReactNode } from "react";
import { Redirect, useLocation } from "wouter";
import * as api from "@workspace/api-client-react";
import { useNativeAuth } from "./native-auth";
import { AuthCard, AuthShell } from "./AuthShell";
import { useQueryClient } from "@tanstack/react-query";

function StaffPasswordConfirmation() {
  const { logout } = useNativeAuth();
  return (
    <AuthShell eyebrow="Staff Security Check">
      <AuthCard title="Staff Password Required" description="Your current session does not include staff password verification. Sign out and sign in with your staff password.">
        <button className="button auth-submit" onClick={() => void logout().then(() => { window.location.href = `${import.meta.env.BASE_URL}sign-in`; })}>Sign Out and Use Staff Login</button>
      </AuthCard>
    </AuthShell>
  );
}

export function AuthAccess({ children }: { children: ReactNode }) {
  const client=useQueryClient();
  const [location]=useLocation();
  const { isLoaded, isSignedIn, error, refresh } = useNativeAuth();
  // Existing HTTP/query transport; no extra real-time channel. Invalidate only
  // persisted shared context, never reset mounted form state or unsaved drafts.
  useEffect(()=>{
    if(!isSignedIn)return;
    const update=()=>void client.invalidateQueries({predicate:q=>{
      const key=String(q.queryKey[0]);
      return /(?:\/me$|\/doctors|\/clinics|\/clinic-settings|\/branches)/.test(key)||["remote-options","remote-selected","selected-care","operational-cardinality","workspaces","workspace-branches","weekly-overview","editor-session-overlap","exception-base-sessions"].includes(key);
    }});
    update();
    const timer=window.setInterval(update,60000);
    window.addEventListener("focus",update);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",update);};
  },[isSignedIn,location,client]);
  const status = api.useGetAuthStatus({ query: {
    queryKey: api.getGetAuthStatusQueryKey(),
    enabled: !!isSignedIn,
    staleTime: 0,
    refetchOnWindowFocus: true,
  } });
  useEffect(() => {
    if (isSignedIn && status.data && !status.data.role) void refresh().catch(() => undefined);
  }, [isSignedIn, status.data, refresh]);

  if (!isLoaded || (isSignedIn && status.isLoading)) return <div className="page-loading">Checking secure access…</div>;
  if (error) return <div className="error-box auth-status-error" role="alert">{error}<button onClick={() => void refresh().catch(() => undefined)}>Retry</button></div>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (status.error) return <div className="error-box auth-status-error">Unable to verify access: {status.error.message}<button onClick={() => status.refetch()} data-testid="button-retry-auth-status">Try Again</button></div>;
  if (status.data && !status.data.role) return <div className="page-loading">Your session has ended…</div>;
  if (status.data?.requiresStaffPassword && !status.data.staffPasswordVerified) return <StaffPasswordConfirmation />;
  return children;
}