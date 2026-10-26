import { useEffect, useState } from "react";
import { VerificationCodeInput } from "../components/VerificationCodeInput";
import { authRequest } from "./native-auth";
import { FormField } from "../components/FormField";
import { SecurityChannelNotice, type SecurityChannels } from "./SecurityChannelNotice";
import { authErrorMessage } from "./errors";
/** Separate from email verification. A successful phone code never authenticates. */
export function RegistrationMobileProof({challengeId,initialChannels}:{challengeId:string;initialChannels?:SecurityChannels}) {
  const [code,setCode] = useState("");
  const [verified,setVerified] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [channels,setChannels] = useState<SecurityChannels | undefined>(initialChannels);
  const [cooldown,setCooldown] = useState(60);
  useEffect(()=>{
    if(cooldown<=0)return;
    const timer=window.setTimeout(()=>setCooldown(n=>n-1),1000);
    return ()=>window.clearTimeout(timer);
  },[cooldown]);
  async function act(verify:boolean) {
    if (busy || (!verify && cooldown>0) || (verify && !/^\d{6}$/.test(code))) return;
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
    } catch(e) {setError(authErrorMessage(e,"Unable to verify mobile. Continue with email, or wait and request SMS again."));}
    finally {setBusy(false);}
  }
  return <fieldset disabled={busy || verified}>
    <legend>Optional mobile verification</legend>
    <p>Email verification is still required. You may continue without verifying a mobile. Only a verified mobile is saved for a new account. Existing accounts keep their saved mobile.</p>
    {!verified && <p role="status">Mobile not verified. SMS unavailable or not arriving? Continue with the required email code. To save this phone now, verify SMS before continuing with email. SMS expires with this registration; requesting another SMS replaces the previous SMS code.</p>}
    {verified ? <p role="status">Mobile verified for this registration intent.</p> : <>
      {/* This separately submitted optional proof must not validate or implicitly submit the enclosing email-login form. */}
      <FormField label="Separate SMS code"><VerificationCodeInput form="registration-mobile-proof-code" value={code} onChange={setCode}/></FormField>
      <button className="button secondary" type="button" disabled={code.length !== 6 || busy} onClick={()=>void act(true)}>Verify mobile only</button>
      <button className="text-link" type="button" disabled={busy || cooldown>0} onClick={()=>void act(false)}>{cooldown>0 ? `Request SMS again in ${cooldown}s` : "Request SMS again"}</button>
    </>}
    {channels?.sms?.status === "disabled"
      ? <p role="status">Optional SMS is disabled by the System Admin; no SMS was sent. Continue with required email verification.</p>
      : <SecurityChannelNotice channels={channels}/>}
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}
