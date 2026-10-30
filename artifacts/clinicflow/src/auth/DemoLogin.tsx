import { useState } from "react";
import { FormField } from "../components/FormField";
import { PasswordInput } from "../components/PasswordInput";
import { Link, Redirect, useLocation } from "wouter";
import { AuthCard, AuthShell } from "./AuthShell";
import { csrfFetch } from "../lib/csrf";
import { useNativeAuth } from "./native-auth";
import { friendlyError } from "../lib/friendly-error";
import { useServerWait } from "../lib/use-server-wait";

export function DemoLogin() {
  const { isLoaded, isSignedIn, refresh } = useNativeAuth();
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const limit=useServerWait();
  if (!isLoaded) return <div className="page-loading">Preparing demo sign-in…</div>;
  if (isSignedIn) return <Redirect to="/onboarding"/>;

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (busy || limit.wait>0 || !password) return;
    setBusy(true); setError("");
    try {
      const response = await csrfFetch("/api/demo/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json() as { authenticated?: boolean; error?: string; message?: string };
      if (!response.ok || !result.authenticated) throw { status: response.status, data: result,headers:response.headers };
      setPassword("");
      await refresh();
      navigate("/onboarding", { replace: true });
    } catch (caught) {
      limit.record(caught);
      setPassword("");
      setError(friendlyError(caught, "auth", "Demo sign-in failed. Check the demo password and try again."));
    } finally { setBusy(false); }
  }
  return <AuthShell eyebrow="Demo Staff Access"><AuthCard title="Demo Clinic Login" description="Explore the fictional clinic with its dedicated demo account.">
    <p className="notice">Never enter real patient information.</p>
    <div className="notice"><strong>Demo login:</strong> clinicflow-demo · no email inbox needed</div>
    <form onSubmit={signIn}>
      <FormField id="demo-password" label="Demo Password" required><PasswordInput autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} required data-testid="input-demo-password"/></FormField>
      {error && <div className="error-box" role="alert">{error}</div>}
      <button className="button" type="submit" disabled={busy || limit.wait>0 || !password} data-testid="button-demo-login">{busy ? "Signing in…" : limit.wait>0?`Try again in ${limit.wait}s`:"Enter demo workspace"}</button>
    </form>
    <p className="registration-note">This login is for the designated demo account only. <Link href="/sign-in">Regular Staff Login</Link></p>
  </AuthCard></AuthShell>;
}