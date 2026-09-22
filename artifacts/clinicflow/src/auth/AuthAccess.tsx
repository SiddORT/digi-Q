import { useState, type ReactNode } from "react";
import { useAuth, useClerk } from "@clerk/react";
import { Redirect, useLocation } from "wouter";
import * as api from "@workspace/api-client-react";
import { queryClient } from "../App";
import { authErrorMessage } from "./errors";
import { AuthCard, AuthShell } from "./AuthShell";

function StaffPasswordConfirmation() {
  const { signOut } = useClerk();
  const [, navigate] = useLocation();
  const verifyPassword = api.useVerifyStaffPassword();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await verifyPassword.mutateAsync({ data: { password } });
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: api.getGetAuthStatusQueryKey() });
      navigate("/onboarding", { replace: true });
    } catch (caught) {
      setError(authErrorMessage(caught, "That password is incorrect."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell eyebrow="STAFF SECURITY CHECK">
      <AuthCard title="Confirm your staff password" description="Your session is active. Confirm your password once to continue to the staff workspace.">
        <form onSubmit={submit}>
          <label>Password<input data-testid="input-confirm-staff-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
          {error && <div className="error-box" data-testid="status-confirm-password-error">{error}</div>}
          <button className="button auth-submit" data-testid="button-confirm-staff-password" disabled={busy}>{busy ? "Confirming…" : "Confirm password"}</button>
        </form>
        <div className="auth-links"><button type="button" className="text-link" data-testid="button-confirm-signout" onClick={() => { setPassword(""); signOut({ redirectUrl: `${window.location.origin}${import.meta.env.BASE_URL}` }); }}>Sign out</button></div>
      </AuthCard>
    </AuthShell>
  );
}

export function AuthAccess({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const status = api.useGetAuthStatus({ query: {
    queryKey: api.getGetAuthStatusQueryKey(),
    enabled: !!isSignedIn,
    staleTime: 0,
    refetchOnWindowFocus: true,
  } });

  if (!isLoaded || (isSignedIn && status.isLoading)) return <div className="page-loading">Checking secure access…</div>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  if (status.error) return <div className="error-box auth-status-error">Unable to verify access: {status.error.message}<button onClick={() => status.refetch()} data-testid="button-retry-auth-status">Try again</button></div>;
  if (status.data?.requiresStaffPassword && !status.data.staffPasswordVerified) return <StaffPasswordConfirmation />;
  return children;
}