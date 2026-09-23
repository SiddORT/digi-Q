import { useState } from "react";
import { useSignIn } from "@clerk/react";
import { Link, useLocation } from "wouter";
import * as api from "@workspace/api-client-react";
import { queryClient } from "../App";
import { authErrorMessage } from "./errors";
import { AuthCard, AuthShell } from "./AuthShell";

export function StaffLogin() {
  const { signIn, fetchStatus, errors } = useSignIn();
  const [, navigate] = useLocation();
  const staffEntry = api.usePrepareStaffEntry();
  const staffVerify = api.useVerifyStaffPassword();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const params = new URLSearchParams(window.location.search);
  const confirmation = params.get("passwordSet")
    ? "Your password is set. Sign in to continue."
    : params.get("passwordReset")
      ? "Your password was reset. Sign in with your new password."
      : "";
  const busy = fetchStatus === "fetching" || staffEntry.isPending || staffVerify.isPending;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const entry = await staffEntry.mutateAsync({ data: { email: email.trim().toLowerCase() } });
      const result = await signIn.password({ emailAddress: entry.email, password });
      if (result.error) throw result.error;
      if (signIn.status === "needs_client_trust") {
        throw new Error("Clerk requires new-device verification on this device. ClinicFlow staff login is password-only, so please ask your administrator to review the Clerk device trust configuration.");
      }
      if (signIn.status === "needs_second_factor") {
        throw new Error("Clerk requires multi-factor authentication for this account. ClinicFlow staff login is password-only, so please ask your administrator to review the Clerk MFA configuration.");
      }
      if (signIn.status === "needs_protect_check") {
        throw new Error("Clerk requires a security challenge before sign-in can continue. Reload the page and try again. If the challenge still cannot complete, contact your administrator.");
      }
      if (signIn.status !== "complete") throw new Error("Clerk could not complete password sign-in. Please contact your administrator.");
      const finalized = await signIn.finalize();
      if (finalized.error) throw finalized.error;
      await staffVerify.mutateAsync({ data: { password } });
      setPassword("");
      await queryClient.invalidateQueries({ queryKey: api.getGetAuthStatusQueryKey() });
      navigate("/onboarding", { replace: true });
    } catch (caught) {
      setPassword("");
      setError(authErrorMessage(caught, errors.fields.password?.message || "Unable to sign in. Check your email and password."));
    }
  }

  return (
    <AuthShell eyebrow="STAFF WORKSPACE">
      <AuthCard title="Staff login" description="Use your ClinicFlow staff email and password.">
        {confirmation && <div className="notice" data-testid="status-password-confirmation">{confirmation}</div>}
        <form onSubmit={submit}>
          <label>Email address<input data-testid="input-staff-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>
          <label>Password<input data-testid="input-staff-password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} /></label>
          {error && <div className="error-box" role="alert" data-testid="status-staff-login-error">{error}</div>}
          <button className="button auth-submit" data-testid="button-staff-login" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <div className="auth-links"><Link href="/forgot-password" data-testid="link-forgot-password">Forgot password?</Link><Link href="/patient-login" data-testid="link-patient-login">Patient login</Link></div>
      </AuthCard>
    </AuthShell>
  );
}