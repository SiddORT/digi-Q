import { useEffect, useState } from "react";
import { VerificationCodeInput } from "../components/VerificationCodeInput";
import { authRequest } from "./native-auth";
import { FormField } from "../components/FormField";
import { SecurityChannelNotice, type SecurityChannels } from "./SecurityChannelNotice";
import { authErrorMessage } from "./errors";
import { retryWaitSeconds } from "../lib/friendly-error";
import { useServerWait } from "../lib/use-server-wait";
import { useRef } from "react";
import { PhoneInput } from "../components/PhoneInput";
import { accountMobileProblem } from "@workspace/api-zod/account-mobile";

/** Required in-place mobile-first action; no identity or permanent new field is created. */
export function OwnerMobileProof({ flow, mobile, onChange, onProof }: {
  flow: "public" | "admin"; mobile: string; onChange: (mobile: string) => void; onProof: (id: string) => void;
}) {
  const [challenge, setChallenge] = useState("");
  const [code, setCode] = useState("");
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [wait, setWait] = useState(0);
  const sequence = useRef(0);
  const lock = useRef(false);
  const proofCallback = useRef(onProof); proofCallback.current = onProof;
  useEffect(() => {
    sequence.current++; setChallenge(""); setCode(""); setVerified(false); setNotice(""); setError("");
    proofCallback.current("");
  }, [mobile]);
  useEffect(() => { if (wait > 0) { const timer = setTimeout(() => setWait(n => n - 1), 1000); return () => clearTimeout(timer); } return undefined; }, [wait]);
  async function act(confirm: boolean) {
    if (lock.current || busy || (!confirm && wait > 0)) return;
    const problem = accountMobileProblem(mobile);
    if (problem) { setError(problem); return; }
    const revision = sequence.current;
    lock.current = true; setBusy(true); setError("");
    try {
      if (confirm) {
        const result = await authRequest<{mobileVerified: boolean}>("owner-mobile/verify", { flow, challengeId: challenge, code });
        if (revision !== sequence.current) return;
        if (result.mobileVerified !== true) throw new Error("Mobile verification was not confirmed.");
        setVerified(true); setCode(""); setNotice(""); onProof(challenge);
      } else {
        setWait(60); setCode(""); setChallenge(""); onProof("");
        const result = await authRequest<{challengeId: string; sms: {status: string}}>("owner-mobile/start", { flow, mobile });
        if (revision !== sequence.current) return;
        const status = result.sms.status;
        if (status === "provider_accepted") {
          setChallenge(result.challengeId);
          setNotice("The provider accepted the code request. Enter the received SMS code; handset receipt is not yet confirmed.");
        } else setError(status === "provider_rejected"
          ? "The SMS provider rejected the request. Please try again later."
          : status === "disabled" || status === "unavailable" || status === "pre_dispatch_failed"
            ? "We couldn’t send the SMS code. Please try again later."
            : "We couldn’t confirm whether the SMS was sent. Please wait and check your phone before trying again.");
      }
    } catch (e) { if (revision === sequence.current) { setError(authErrorMessage(e, "Mobile verification could not be completed.")); setWait(n => Math.max(n, retryWaitSeconds(e))); } }
    finally { lock.current = false; setBusy(false); }
  }
  return <div data-testid="owner-mobile-proof">
    <FormField label={flow === "admin" ? "Administrator mobile" : "Your mobile"} required helper="Verify this account mobile first. Email verification and email/password access remain separate.">
      <PhoneInput accountMobile value={mobile} disabled={busy} onChange={value=>{
        if(challenge) void authRequest("owner-mobile/invalidate",{flow,challengeId:challenge})
          .catch(()=>setError("The previous attempt could not be retired. Verification of the new number is still required."));
        onChange(value);
      }}/>
    </FormField>
    {flow==="admin"&&<p className="muted">The new clinic owner must supply the code received on their mobile.</p>}
    {verified ? <><p role="status">Mobile verified. Continue with the existing account and clinic details.</p><button type="button" className="text-link" onClick={()=>{setVerified(false);setChallenge("");setCode("");setNotice("");onProof("");}}>Verify mobile again</button></> : <>
      <button type="button" className="button secondary" disabled={busy || wait > 0} onClick={() => void act(false)}>{busy ? "Please wait…" : wait > 0 ? `Request SMS in ${wait}s` : challenge ? "Resend SMS code" : "Send SMS code"}</button>
      {challenge && <>
        <FormField label="SMS verification code"><VerificationCodeInput form="owner-mobile-code" value={code} onChange={setCode}/></FormField>
        <button type="button" className="button secondary" disabled={busy || code.length !== 6} onClick={() => void act(true)}>Verify mobile</button>
      </>}
    </>}
    {notice && <p role="status">{notice}</p>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
/** Separate from email verification. A successful phone code never authenticates. */
export function RegistrationMobileProof({challengeId,initialChannels}:{challengeId:string;initialChannels?:SecurityChannels}) {
  const [code,setCode] = useState("");
  const [verified,setVerified] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [channels,setChannels] = useState<SecurityChannels | undefined>(initialChannels);
  const [cooldown,setCooldown] = useState(60);
  const limit=useServerWait();
  useEffect(()=>{
    if(cooldown<=0)return;
    const timer=window.setTimeout(()=>setCooldown(n=>n-1),1000);
    return ()=>window.clearTimeout(timer);
  },[cooldown]);
  async function act(verify:boolean) {
    if (busy || limit.wait>0 || (!verify && cooldown>0) || (verify && !/^\d{6}$/.test(code))) return;
    setBusy(true);setError("");
    try {
      if (verify) {
        const result = await authRequest<{mobileVerified:boolean}>("registration/mobile/verify",{challengeId,code});
        if (result.mobileVerified !== true) throw new Error("Mobile verification was not confirmed. Try again or continue with email.");
        setVerified(true);setCode("");
      } else {
        setCooldown(60);setCode("");
        setChannels({sms:{status:"delivery_unknown"}});
        const result = await authRequest<{sms:{status:string;destination?:string}}>("registration/mobile/request",{challengeId});
        setChannels({sms:result.sms});
      }
    } catch(e) {limit.record(e);setCooldown(value=>Math.max(value,retryWaitSeconds(e)));setError(authErrorMessage(e,"Unable to verify mobile. Continue with email, or wait and request SMS again."));}
    finally {setBusy(false);}
  }
  return <fieldset disabled={busy || verified}>
    <legend>Optional mobile verification</legend>
    <p>Email verification is still required. You may continue without verifying a mobile. Only a verified mobile is saved for a new account. Existing accounts keep their saved mobile.</p>
    {!verified && <p role="status">Mobile not verified. SMS unavailable or not arriving? Continue with the required email code. To save this phone now, verify SMS before continuing with email. SMS expires with this registration; requesting another SMS replaces the previous SMS code.</p>}
    {verified ? <p role="status">Mobile verified for this registration.</p> : <>
      {/* This separately submitted optional proof must not validate or implicitly submit the enclosing email-login form. */}
      <FormField label="Separate SMS code"><VerificationCodeInput form="registration-mobile-proof-code" value={code} onChange={setCode}/></FormField>
      <button className="button secondary" type="button" disabled={code.length !== 6 || busy||limit.wait>0} onClick={()=>void act(true)}>{limit.wait>0?`Try again in ${limit.wait}s`:"Verify mobile only"}</button>
      <button className="text-link" type="button" disabled={busy || cooldown>0||limit.wait>0} onClick={()=>void act(false)}>{Math.max(cooldown,limit.wait)>0 ? `Request SMS again in ${Math.max(cooldown,limit.wait)}s` : "Request SMS again"}</button>
    </>}
    {channels?.sms?.status === "disabled"
      ? <p role="status">Optional SMS is disabled by the System Admin; no SMS was sent. Continue with required email verification.</p>
      : <SecurityChannelNotice channels={channels}/>}
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}
