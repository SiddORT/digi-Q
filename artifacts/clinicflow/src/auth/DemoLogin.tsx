import { useState } from "react";
import { Link, Redirect, useLocation } from "wouter";
import { AuthCard, AuthShell } from "./AuthShell";
import { csrfToken } from "../lib/csrf";
import { useNativeAuth } from "./native-auth";

export function DemoLogin() {
  const { isLoaded, isSignedIn, refresh } = useNativeAuth();
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!isLoaded) return <div className="page-loading">Preparing demo sign-in…</div>;
  if (isSignedIn) return <Redirect to="/onboarding"/>;

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !password) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/demo/login", {
        method: "POST", credentials: "same-origin", cache: "no-store",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": await csrfToken() },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { authenticated?: boolean; error?: string; message?: string };
      if (!response.ok || !result.authenticated) throw new Error(result.message || result.error || "Demo login is unavailable.");
      setPassword("");
      await refresh();
      navigate("/onboarding", { replace: true });
    } catch (caught) {
      setPassword("");
      setError(caught instanceof Error ? caught.message : "Demo sign-in failed. Please try again.");
    } finally { setBusy(false); }
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