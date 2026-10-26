import { useEffect, useState } from "react";
import { VerificationCodeInput } from "./VerificationCodeInput";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck } from "lucide-react";
import { FormField } from "./FormField";
import { staffVerificationKey, confirmStaffVerification, deferStaffVerification, getStaffVerification, requestStaffVerification, STAFF_VERIFICATION_KEY, type VerificationChannel, type VerificationChallenge } from "../lib/staff-verification";
import { friendlyError } from "../lib/friendly-error";
import { noticeLabel } from "../lib/staff-account";

function Channel({ channel, label, value, verified }: { channel: VerificationChannel; label: string; value?: string | null; verified: boolean }) {
  const client = useQueryClient();
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  const [code, setCode] = useState("");
  const [wait, setWait] = useState(0);
  useEffect(() => { if (wait <= 0) return; const t = window.setTimeout(() => setWait(w => w - 1), 1000); return () => window.clearTimeout(t); }, [wait]);
  const request = useMutation({ mutationFn: () => requestStaffVerification(channel), onSuccess: c => { setChallenge(c); setCode(""); setWait(c.resendAfterSeconds); } });
  const confirm = useMutation({ mutationFn: () => confirmStaffVerification({ channel, challengeId: challenge!.challengeId, code }),
    onSuccess: () => { setChallenge(null); setCode(""); void client.invalidateQueries({ queryKey: STAFF_VERIFICATION_KEY }); } });
  // A changed contact or flipped verification invalidates any outstanding challenge, code and error.
  useEffect(() => { setChallenge(null); setCode(""); setWait(0); request.reset(); confirm.reset(); }, [value, verified]);
  const id = `staff-verify-${channel}`;
  return <div className="staff-verify-channel" data-testid={`verify-${channel}`}>
    <div><strong>{label}</strong><div className="muted">{value || "Not added"}</div></div>
    {verified ? <span className="badge" role="status"><BadgeCheck size={14} aria-hidden /> Verified</span> : !value ? <small className="muted">Add a {label.toLowerCase()} in your details to verify it.</small> : <>
      <button type="button" className="button secondary small" disabled={request.isPending || wait > 0} onClick={() => request.mutate()} data-testid={`button-send-code-${channel}`}>{request.isPending ? "Sending…" : challenge ? wait > 0 ? `Resend in ${wait}s` : "Resend Code" : "Send Code"}</button>
      {challenge && <form noValidate onSubmit={e => { e.preventDefault(); if (code.length === 6 && !confirm.isPending) confirm.mutate(); }}>
        <FormField id={id} label="Confirm Code" required><VerificationCodeInput required value={code} onChange={setCode} data-testid={`input-code-${channel}`} /></FormField>
        <button type="submit" className="button small" disabled={confirm.isPending || code.length !== 6} data-testid={`button-confirm-code-${channel}`}>{confirm.isPending ? "Verifying…" : "Confirm Code"}</button>
      </form>}
      {(request.error || confirm.error) && <p className="field-error" role="alert">{friendlyError(confirm.error || request.error, "save")}</p>}
    </>}
  </div>;
}

export function StaffContactVerification({ actor }: { actor: string }) {
  const state = useQuery({ queryKey: staffVerificationKey(actor), queryFn: getStaffVerification, retry: false });
  if (state.isLoading) return <section className="panel padded" role="status">Loading contact verification…</section>;
  if (state.error || !state.data) return <section className="panel padded"><p role="alert">{friendlyError(state.error, "load")}</p><button type="button" onClick={() => void state.refetch()}>Retry</button></section>;
  const d = state.data;
  return <section className="panel padded" data-testid="section-contact-verification" aria-labelledby="contact-verification-title">
    <h3 id="contact-verification-title">Contact verification</h3>
    <p className="muted">Verify your email and mobile separately. A code is sent only when you ask for one.</p>
    <Channel channel="email" label="Email" value={d.email} verified={d.emailVerified} />
    {d.welcomeEmailStatus && <p className="muted small" data-testid="status-welcome-email">Welcome email: {noticeLabel(d.welcomeEmailStatus)}</p>}
    <Channel channel="sms" label="Mobile" value={d.mobile} verified={d.mobileVerified} />
    {d.welcomeSmsStatus && <p className="muted small" data-testid="status-welcome-sms">Welcome SMS: {noticeLabel(d.welcomeSmsStatus)}</p>}
  </section>;
}

/** Shown once after sign-in when the server says a prompt is required; Later records a deferral. */
export function FirstLoginVerificationPrompt({ actor }: { actor: string }) {
  const client = useQueryClient();
  const state = useQuery({ queryKey: staffVerificationKey(actor), queryFn: getStaffVerification, retry: false });
  const [hidden, setHidden] = useState(false);
  const defer = useMutation({ mutationFn: deferStaffVerification, onSuccess: () => { setHidden(true); void client.invalidateQueries({ queryKey: STAFF_VERIFICATION_KEY }); } });
  if (hidden || !state.data?.promptRequired) return null;
  return <div className="notice" role="region" aria-label="Verify your contact details" data-testid="prompt-first-login-verification">
    <StaffContactVerification actor={actor} />
    <button type="button" className="button secondary small" disabled={defer.isPending} onClick={() => defer.mutate()} data-testid="button-defer-verification">{defer.isPending ? "Saving…" : "Do This Later"}</button>
    <small className="muted"> You can verify any time from My Profile.</small>
    {defer.error && <p role="alert">{friendlyError(defer.error, "save")}</p>}
  </div>;
}
