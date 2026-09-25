import { useState } from "react";
import { useAuth, useClerk } from "@clerk/react";
import { Link, Redirect, useLocation } from "wouter";
import * as api from "@workspace/api-client-react";
import { queryClient } from "../App";
import { AuthCard, AuthShell } from "./AuthShell";

const apiPath = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/demo/login`;

export function DemoLogin() {
  const { isLoaded, isSignedIn } = useAuth();
  const clerk = useClerk();
  const [, navigate] = useLocation();
  const verify = api.useVerifyStaffPassword();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!isLoaded) return <div className="page-loading">Preparing demo sign-in…</div>;
  if (isSignedIn) return <Redirect to="/onboarding"/>;

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true);
    setError("");
    let activated = false;
    try {
      const response = await fetch(apiPath, {
        method: "POST", credentials: "include", cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { ticket?: string; error?: string; message?: string };
      if (!response.ok || !result.ticket) throw new Error(result.message || result.error || "Demo login is unavailable.");
      const attempt = await clerk.client.signIn.create({ strategy: "ticket", ticket: result.ticket });
      if (attempt.status !== "complete" || !attempt.createdSessionId) throw new Error("Demo session could not be completed.");
      await clerk.setActive({ session: attempt.createdSessionId });
      activated = true;
      await verify.mutateAsync({ data: { password } });
      await queryClient.invalidateQueries({ queryKey: api.getGetAuthStatusQueryKey() });
      setPassword("");
      navigate("/onboarding", { replace: true });
    } catch (caught) {
      if (activated) await clerk.signOut().catch(() => undefined);
      setPassword("");
      setError(caught instanceof Error ? caught.message : "Demo sign-in failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return <AuthShell eyebrow="DEMO STAFF ACCESS"><AuthCard title="Demo clinic login" description="Explore the fictional clinic with the dedicated demo account. Never enter real patient information.">
    <div className="notice"><strong>Demo login:</strong> clinicflow-demo · no email inbox needed</div>
    <form onSubmit={signIn}>
      <label>Demo password<input type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required data-testid="input-demo-password"/></label>
      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="button" type="submit" disabled={busy || !password} data-testid="button-demo-login">{busy ? "Signing in…" : "Enter demo workspace"}</button>
    </form>
    <p className="registration-note">This login is for the designated demo account only. <Link href="/sign-in">Regular staff login</Link></p>
  </AuthCard></AuthShell>;
}