import { useEffect, useRef, useState, type ReactNode } from "react";
import { Redirect, useLocation } from "wouter";
import * as api from "@workspace/api-client-react";
import { useNativeAuth } from "./native-auth";
import { AuthCard, AuthShell } from "./AuthShell";
import { useQueryClient } from "@tanstack/react-query";
import { refreshSignedInContext } from "../lib/context-refresh";
import { DIRECTORY_FRESH_MS } from "../lib/directory-cache";
import { friendlyError } from "../lib/friendly-error";
import { RecoveryActions } from "../components/RecoveryActions";

function StaffPasswordConfirmation() {
  const { logout } = useNativeAuth();
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const lock=useRef(false);
  async function signIn(){
    if(lock.current)return;
    lock.current=true;setBusy(true);setError("");
    try{await logout();window.location.href=`${import.meta.env.BASE_URL}sign-in`;}
    catch{setError("We couldn’t sign you out. Try Sign out and use staff login again.");}
    finally{lock.current=false;setBusy(false);}
  }
  return (
    <AuthShell eyebrow="Staff Security Check">
      <AuthCard title="Staff Password Required" description="Your current session does not include staff password verification. Sign out and sign in with your staff password.">
         {error&&<p role="alert">{error}</p>}
         <button className="button auth-submit" disabled={busy} aria-busy={busy} onClick={()=>void signIn()}>{busy?"Signing out…":"Sign Out and Use Staff Login"}</button>
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
    const update=()=>void refreshSignedInContext(client);
    const timer=window.setInterval(()=>void refreshSignedInContext(client,true),DIRECTORY_FRESH_MS);
    window.addEventListener("focus",update);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",update);};
  },[isSignedIn,client]);
  useEffect(()=>{if(isSignedIn)void refreshSignedInContext(client);},[isSignedIn,location,client]);
  const status = api.useGetAuthStatus({ query: {
    queryKey: api.getGetAuthStatusQueryKey(),
    // NativeAuth owns session checks and publishes the exact status response to
    // this cache. This observer must not create a second status request.
    enabled: false,
    staleTime: DIRECTORY_FRESH_MS,
    refetchOnWindowFocus: false,
  } });
  useEffect(() => {
    if (isSignedIn && status.data && !status.data.role) void refresh().catch(() => undefined);
  }, [isSignedIn, status.data, refresh]);

  if (!isLoaded || (isSignedIn && !status.data && !error)) return <div className="page-loading">Checking secure access…</div>;
  if (error) return <div className="error-box auth-status-error" role="alert">{friendlyError(error,"load","We couldn’t check your access. Try again.")}<RecoveryActions error={error} onRetry={refresh}/></div>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (status.error) return <div className="error-box auth-status-error" role="alert">{friendlyError(status.error,"load","We couldn’t check your access.")}<RecoveryActions error={status.error} onRetry={refresh}/></div>;
  if (status.data && !status.data.role) return <Redirect to="/sign-in"/>;
  if (status.data?.requiresStaffPassword && !status.data.staffPasswordVerified) return <StaffPasswordConfirmation />;
  return children;
}