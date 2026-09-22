import { useEffect, useRef, useState } from "react";
import { useClerk, useSignIn, useSignUp } from "@clerk/react";
import { Link, useLocation } from "wouter";
import * as api from "@workspace/api-client-react";
import { authErrorMessage } from "./errors";
import { AuthCard, AuthShell } from "./AuthShell";

export function ForgotPassword() {
  const { signIn, fetchStatus, errors } = useSignIn();
  const clerk = useClerk();
  const [, navigate] = useLocation();
  const staffEntry = api.usePrepareStaffEntry();
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const busy = fetchStatus === "fetching" || staffEntry.isPending;

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const entry = await staffEntry.mutateAsync({ data: { email: email.trim().toLowerCase() } });
      const created = await signIn.create({ identifier: entry.email });
      if (created.error) throw created.error;
      const sent = await signIn.resetPasswordEmailCode.sendCode();
      if (sent.error) throw sent.error;
      if (signIn.status === "needs_protect_check") {
        throw new Error("Clerk requires an additional security check. Reload the page and try again.");
      }
      setEmail(entry.email);
      setStep("code");
    } catch (caught) {
      setError(authErrorMessage(caught, errors.fields.identifier?.message || "Unable to start password recovery."));
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await signIn.resetPasswordEmailCode.verifyCode({ code: code.trim() });
      if (result.error) throw result.error;
      if (signIn.status !== "needs_new_password") throw new Error("That recovery code is invalid or expired.");
      setCode("");
      setStep("password");
    } catch (caught) {
      setError(authErrorMessage(caught, errors.fields.code?.message || "That recovery code is invalid or expired."));
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await signIn.resetPasswordEmailCode.submitPassword({ password, signOutOfOtherSessions: true });
      if (result.error) throw result.error;
      if (signIn.status === "complete") {
        const finalized = await signIn.finalize();
        if (finalized.error) throw finalized.error;
      }
      setPassword("");
      await clerk.signOut();
      navigate("/sign-in?passwordReset=1", { replace: true });
    } catch (caught) {
      setPassword("");
      setError(authErrorMessage(caught, errors.fields.password?.message || "Unable to set the new password."));
    }
  }

  return (
    <AuthShell eyebrow="STAFF PASSWORD RECOVERY">
      <AuthCard title="Reset staff password" description={step === "email" ? "We’ll send a recovery code to your staff email." : step === "code" ? `Enter the recovery code sent to ${email}.` : "Choose a new password for your staff account."}>
        {step === "email" && <form onSubmit={start}><label>Staff email<input data-testid="input-reset-email" type="email" autoComplete="username" required value={email} onChange={event => setEmail(event.target.value)} /></label>{error && <div className="error-box">{error}</div>}<button className="button auth-submit" data-testid="button-send-reset-code" disabled={busy}>Send recovery code</button></form>}
        {step === "code" && <form onSubmit={verify}><label>Recovery code<input data-testid="input-reset-code" autoComplete="one-time-code" required value={code} onChange={event => setCode(event.target.value)} /></label>{error && <div className="error-box">{error}</div>}<button className="button auth-submit" data-testid="button-verify-reset-code" disabled={busy}>Verify code</button></form>}
        {step === "password" && <form onSubmit={save}><label>New password<input data-testid="input-new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} /></label>{error && <div className="error-box">{error}</div>}<button className="button auth-submit" data-testid="button-save-new-password" disabled={busy}>Set new password</button></form>}
        <div className="auth-links"><Link href="/sign-in" data-testid="link-return-staff-login">Return to Staff Login</Link></div>
      </AuthCard>
    </AuthShell>
  );
}

export function SetPassword() {
  const { signUp, fetchStatus, errors } = useSignUp();
  const clerk = useClerk();
  const [, navigate] = useLocation();
  const started = useRef(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const ticket = new URLSearchParams(window.location.search).get("__clerk_ticket") || new URLSearchParams(window.location.search).get("ticket");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!ticket) {
      setError("This invitation link is incomplete. Ask your administrator to send a new invitation.");
      return;
    }
    void signUp.ticket({ ticket }).then(result => {
      if (result.error) throw result.error;
      setReady(true);
    }).catch(caught => {
      setError(authErrorMessage(caught, "This invitation link has expired or has already been used. Ask your administrator to send a new invitation."));
    });
  }, [signUp, ticket]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const result = await signUp.password({ password });
      if (result.error) throw result.error;
      if (signUp.status !== "complete") throw new Error("Password setup could not be completed. Ask your administrator for a new invitation.");
      const finalized = await signUp.finalize();
      if (finalized.error) throw finalized.error;
      setPassword("");
      await clerk.signOut();
      navigate("/sign-in?passwordSet=1", { replace: true });
    } catch (caught) {
      setPassword("");
      setError(authErrorMessage(caught, errors.fields.password?.message || "Unable to set your password."));
    }
  }

  return (
    <AuthShell eyebrow="STAFF INVITATION">
      <AuthCard title="Set your staff password" description="Choose a secure password, then sign in from the Staff Login page.">
        <div id="clerk-captcha" data-testid="clerk-captcha" />
        {!ready && !error && <div className="page-loading auth-inline-loading">Checking invitation…</div>}
        {error && <div className="error-box" data-testid="status-invitation-error">{error}</div>}
        {ready && <form onSubmit={save}><label>New password<input data-testid="input-invitation-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={event => setPassword(event.target.value)} /></label><button className="button auth-submit" data-testid="button-set-invitation-password" disabled={fetchStatus === "fetching"}>Set password</button></form>}
        <div className="auth-links"><Link href="/sign-in" data-testid="link-invitation-staff-login">Staff Login</Link></div>
      </AuthCard>
    </AuthShell>
  );
}