import { useEffect, useRef } from "react";

type WorkspaceTab = { id:string; label:string };

/** Automatic activation with focus following the committed selection.
 * A caller may reject a tab change to protect unsaved edits; in that case
 * focus stays on the original tab instead of moving into hidden content. */
export function WorkspaceTabs({tabs,area,onSelect,label,testIdPrefix="tab-"}:{tabs:WorkspaceTab[];area:string;onSelect:(id:string)=>void;label:string;testIdPrefix?:string}){
  const root=useRef<HTMLDivElement>(null);
  const keyboardTarget=useRef<string|null>(null);
  useEffect(()=>{
    if(keyboardTarget.current!==area)return;
    root.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')?.focus();
    keyboardTarget.current=null;
  },[area]);
  return <div ref={root} className="workspace-tabs" role="tablist" aria-label={label}>
    {tabs.map((tab,index)=><button key={tab.id} type="button" role="tab" aria-selected={area===tab.id} tabIndex={area===tab.id?0:-1} onClick={()=>{keyboardTarget.current=null;onSelect(tab.id);}} onKeyDown={event=>{
      let next:number;
      switch(event.key){
        case "ArrowRight":next=(index+1)%tabs.length;break;
        case "ArrowLeft":next=(index+tabs.length-1)%tabs.length;break;
        case "Home":next=0;break;
        case "End":next=tabs.length-1;break;
        default:return;
      }
      event.preventDefault();
      keyboardTarget.current=tabs[next].id;
      if(tabs[next].id===area)event.currentTarget.focus();
      else onSelect(tabs[next].id);
    }} data-testid={`${testIdPrefix}${tab.id}`}>{tab.label}</button>)}
  </div>;
}
