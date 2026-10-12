import {useEffect} from "react";
import {useBrowserLocation,navigate as browserNavigate} from "wouter/use-browser-location";

type ExitGuard={pathname:string;onExit:(destination:string)=>void};
let settingsGuard:ExitGuard|null=null;
const POSITION="digiqHistoryPosition";
export function settingsHistoryPosition():number|null{
  const value=typeof window!=="undefined"?window.history.state?.[POSITION]:undefined;
  return Number.isSafeInteger(value)?value:null;
}
// Tag only this app's SPA entries, never add a sentinel/duplicate history entry.
if(typeof window!=="undefined"&&settingsHistoryPosition()===null)
  window.history.replaceState({...window.history.state,[POSITION]:0},"",window.location.href);
function navigate(to:Parameters<typeof browserNavigate>[0],options:Parameters<typeof browserNavigate>[1]={}){
  const position=settingsHistoryPosition()??0;
  browserNavigate(to,{...options,state:{...(options?.state||{}),[POSITION]:options?.replace?position:position+1}});
}
export function setSettingsExitGuard(guard:ExitGuard|null){settingsGuard=guard;}
export function settingsGuardedPath(pathname:string){
  return settingsGuard&&pathname!==settingsGuard.pathname?settingsGuard.pathname:pathname;
}
/** Native history can notify React before a component's event listener runs.
 * Freeze the router's settings route until its owner resolves the exit prompt,
 * so the form/dialog cannot unmount and lose its draft in that interval.
 * No non-settings route is blocked, and no history entries are added.
 */
export function useSettingsBrowserLocation(options?:Parameters<typeof useBrowserLocation>[0]):ReturnType<typeof useBrowserLocation>{
  const [pathname]=useBrowserLocation(options);
  useEffect(()=>{
    if(settingsGuard&&pathname!==settingsGuard.pathname)
      settingsGuard.onExit(`${window.location.pathname}${window.location.search}${window.location.hash}`);
  },[pathname]);
  return [settingsGuardedPath(pathname),navigate];
}
