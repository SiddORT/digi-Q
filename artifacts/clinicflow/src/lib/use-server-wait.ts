import { useEffect, useState } from "react";
import { errorStatus, retryWaitSeconds } from "./friendly-error";

/** A blocked action stays blocked for the server's wait, independent of form edits. */
export function useServerWait() {
  const [until,setUntil]=useState(0);
  const [now,setNow]=useState(()=>Date.now());
  const wait=Math.max(0,Math.ceil((until-now)/1000));
  useEffect(()=>{
    if(!until)return;
    const timer=window.setInterval(()=>{const time=Date.now();setNow(time);if(time>=until)setUntil(0);},1000);
    return()=>window.clearInterval(timer);
  },[until]);
  const record=(error:unknown)=>{
    const seconds=retryWaitSeconds(error);
    if(seconds>0||errorStatus(error)===429){
      const time=Date.now();setNow(time);setUntil(value=>Math.max(value,time+(seconds||60)*1000));
    }
  };
  return {wait,record};
}
