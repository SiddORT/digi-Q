import { useEffect, useState } from "react";
import { authRequest } from "./native-auth";
import { FormField } from "../components/FormField";
import { SecurityChannelNotice, type SecurityChannels } from "./SecurityChannelNotice";
/** Separate from email verification. A successful phone code never authenticates. */
export function RegistrationMobileProof({challengeId}:{challengeId:string}) {
  const [code,setCode] = useState("");
  const [verified,setVerified] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [channels,setChannels] = useState<SecurityChannels>();
  const [cooldown,setCooldown] = useState(60);
  useEffect(()=>{
    if(cooldown<=0)return;
    const timer=window.setTimeout(()=>setCooldown(n=>n-1),1000);
    return ()=>window.clearTimeout(timer);
  },[cooldown]);
  async function act(verify:boolean) {
    if (busy) return;
    setBusy(true);setError("");
    try {
      if (verify) {
        await authRequest("registration/mobile/verify",{challengeId,code});
        setVerified(true);setCode("");
      } else {
        setCooldown(60);
        const result = await authRequest<{sms:{status:string;destination?:string}}>("registration/mobile/request",{challengeId});
        setChannels({sms:result.sms});
      }
    } catch(e) {setError(e instanceof Error ? e.message : "Unable to verify mobile");}
    finally {setBusy(false);}
  }
  return <fieldset disabled={busy || verified}>
    <legend>Optional mobile verification</legend>
    <p>Email verification is still required. You may continue without verifying a mobile. Only a verified mobile is saved for a new account. Existing accounts keep their saved mobile.</p>
    {verified ? <p role="status">Mobile verified for this registration intent.</p> : <>
      <FormField label="Separate SMS code"><input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)}/></FormField>
      <button className="button secondary" type="button" disabled={!code || busy} onClick={()=>void act(true)}>Verify mobile only</button>
      <button className="text-link" type="button" disabled={busy || cooldown>0} onClick={()=>void act(false)}>{cooldown>0 ? `Request SMS again in ${cooldown}s` : "Request SMS again"}</button>
    </>}
    <SecurityChannelNotice channels={channels}/>
    {error && <p role="alert">{error}</p>}
  </fieldset>;
}
