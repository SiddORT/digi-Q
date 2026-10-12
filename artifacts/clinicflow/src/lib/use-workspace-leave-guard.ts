import {useEffect,useRef} from "react";
import {useLocation,useSearch} from "wouter";
import {setSettingsExitGuard,settingsHistoryPosition} from "./settings-navigation";
import {internalHref} from "./settings-access";

/** Shared leave guard: sidebar/profile anchors and browser Back/Forward ask before leaving `path` with unsaved edits.
 * Moves inside the same path (tabs via query string) are never blocked. `ask` is the app confirm dialog. `onDiscard` runs once the user confirms. */
export function useWorkspaceLeaveGuard(path:string,dirty:boolean,ask:(o:any)=>Promise<boolean>,onDiscard?:()=>void){
 const askRef=useRef(ask);askRef.current=ask;
 const discardRef=useRef(onDiscard);discardRef.current=onDiscard;
 const [,navigateAway]=useLocation();
 const leavingRef=useRef(false);
 // Sidebar, profile menu and any other in-app anchor leaving Settings with unsaved drafts needs confirmation. Intra-settings panel changes keep history.
 useEffect(()=>{
  if(!dirty)return;
  const onClick=(e:MouseEvent)=>{
   if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
   const a=(e.target as Element|null)?.closest?.("a[href]") as HTMLAnchorElement|null;if(!a)return;
   const dest=internalHref(a,window.location,import.meta.env.BASE_URL);if(!dest)return;
   if(dest.pathname===path||dest.pathname.endsWith(path))return;
   e.preventDefault();e.stopPropagation();
   if(leavingRef.current)return;leavingRef.current=true;
   void askRef.current({title:"Leave this page?",description:"You have unsaved changes. Leaving this page discards them.",confirmLabel:"Discard and Leave",tone:"danger"}).then(ok=>{if(ok){discardRef.current?.();setSettingsExitGuard(null);navigateAway(dest.path);}}).finally(()=>{leavingRef.current=false;});
  };
  document.addEventListener("click",onClick,true);return()=>document.removeEventListener("click",onClick,true);
 },[dirty,navigateAway]);
 // Browser back/forward can otherwise unmount the workspace before an anchor guard runs.
 // Keep intra-settings history free to move; only an exit with unsaved edits is intercepted.
 const [settingsLocation]=useLocation();
 const settingsSearch=useSearch();
 const currentSettingsUrl=useRef(window.location.href);
 const currentSettingsPosition=useRef(settingsHistoryPosition());
 useEffect(()=>{
  if(window.location.pathname.endsWith(path)){
   currentSettingsUrl.current=window.location.href;currentSettingsPosition.current=settingsHistoryPosition();
  }
 },[settingsLocation,settingsSearch]);
 useEffect(()=>{
  if(!dirty)return;
  const requestExit=(destination:string)=>{
   const target=new URL(destination,window.location.origin),base=import.meta.env.BASE_URL.replace(/\/$/,"");
   const relative=base&&target.pathname.startsWith(base)?target.pathname.slice(base.length):target.pathname;
   if(relative===path)return;
   const targetPosition=settingsHistoryPosition(),currentPosition=currentSettingsPosition.current;
   const delta=targetPosition!==null&&currentPosition!==null?currentPosition-targetPosition:1;
   // Undo traversal, not the target entry's URL. Replacing that entry on Cancel
   // erases the dashboard entry and makes a repeated Back leave the document.
   if(delta)window.history.go(delta);
   else window.history.replaceState(window.history.state,"",currentSettingsUrl.current);
   if(leavingRef.current)return;leavingRef.current=true;
   void askRef.current({title:"Leave this page?",description:"Browser navigation will discard your unsaved edits.",confirmLabel:"Discard and Leave",tone:"danger"}).then(ok=>{
    if(ok){
     discardRef.current?.();setSettingsExitGuard(null);
     if(delta)window.history.go(-delta);
     else navigateAway(`${relative}${target.search}${target.hash}`,{replace:true});
    }
   }).finally(()=>{leavingRef.current=false;});
  };
  const pop=(event:PopStateEvent)=>{
   if(window.location.pathname.endsWith(path)){
    currentSettingsUrl.current=window.location.href;currentSettingsPosition.current=settingsHistoryPosition();return;
   }
   event.stopImmediatePropagation();requestExit(window.location.href);
  };
  setSettingsExitGuard({pathname:new URL(currentSettingsUrl.current).pathname,onExit:requestExit});
  window.addEventListener("popstate",pop,true);
  return()=>{setSettingsExitGuard(null);window.removeEventListener("popstate",pop,true);};
 },[dirty,navigateAway]);
}
