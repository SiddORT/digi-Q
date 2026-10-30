import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { canRetryLoad, errorStatus, retryWaitSeconds } from "../lib/friendly-error";

/** Read recovery, or explicit reconciliation of an existing deduplicated request.
 * Never pass a new dispatch or an uncertain non-idempotent write here. */
export function RecoveryActions({error,onRetry,onClose,busy=false,label="Try again",testId}:{
  error:unknown;onRetry?:()=>unknown;onClose?:()=>void;busy?:boolean;label?:string;testId?:string;
}) {
  const [pending,setPending]=useState(false);
  const [wait,setWait]=useState(()=>retryWaitSeconds(error));
  const lock=useRef(false);
  useEffect(()=>{setWait(retryWaitSeconds(error));},[error]);
  useEffect(()=>{if(wait<=0)return;const timer=window.setTimeout(()=>setWait(n=>n-1),1000);return()=>window.clearTimeout(timer);},[wait]);
  async function retry(){
    if(lock.current||busy||wait>0||!onRetry)return;
    lock.current=true;setPending(true);
    try{await onRetry();}catch{/* Caller owns the error state. */}
    finally{lock.current=false;setPending(false);}
  }
  return <div className="et-actions">
    {errorStatus(error)===401?<><Link href="/sign-in" className="button secondary">Staff sign in</Link><Link href="/patient-login" className="text-link">Patient sign in</Link></>:
      onRetry&&canRetryLoad(error)&&<button type="button" className="button secondary" data-testid={testId} disabled={busy||pending||wait>0} aria-busy={busy||pending} onClick={()=>void retry()}>{pending||busy?"Trying again…":wait>0?`Try again in ${wait}s`:label}</button>}
    {onClose&&<button type="button" className="button secondary" onClick={onClose}>Close</button>}
  </div>;
}
