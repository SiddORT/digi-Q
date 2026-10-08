import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSaveCustomRoles, getGetCustomRolesQueryKey } from "@workspace/api-client-react";
import { AppDialog } from "./AppDialog";
import { type CustomRoleConfig, configsEqual, upsertRole } from "./custom-roles";
import { label, permKey } from "./permission-matrix";

/** An independent saved-config snapshot: this editor cannot publish the Roles tab's draft. */
export function CustomRolePermissions({config,id,policy,onDirtyChange}:{config:CustomRoleConfig;id:string;policy:{revision:number;modules:string[];actions:string[];denied:string[]};onDirtyChange?:(dirty:boolean)=>void}){
  const client=useQueryClient();const save=useSaveCustomRoles();
  const base=useRef(config);const [draft,setDraft]=useState(config);
  const [conflict,setConflict]=useState(false);const [confirm,setConfirm]=useState(false);const [notice,setNotice]=useState("");
  const policyRevision=useRef(policy.revision);
  const role=draft.roles.find(r=>r.id===id);
  const dirty=!configsEqual(base.current,draft);
  const dirtyCallback=useRef(onDirtyChange);dirtyCallback.current=onDirtyChange;
  useEffect(()=>{dirtyCallback.current?.(dirty);},[dirty]);
  useEffect(()=>()=>dirtyCallback.current?.(false),[]);
  useEffect(()=>{
    if(config.revision!==base.current.revision||policy.revision!==policyRevision.current){
      if(dirty){setConflict(true);return;}
      base.current=config;setDraft(config);policyRevision.current=policy.revision;
    }
  },[config,policy.revision,dirty]);
  const reload=()=>{base.current=config;setDraft(config);policyRevision.current=policy.revision;setConflict(false);save.reset();};
  if(!role)return <p role="alert">This custom role no longer exists. Choose another role.</p>;
  const toggle=(key:string,allow:boolean)=>{setNotice("");setDraft(upsertRole(draft,{...role,denied:allow?role.denied.filter(k=>k!==key):[...role.denied,key]}));};
  const run=()=>save.mutate({data:{revision:base.current.revision,roles:draft.roles,bindings:draft.bindings} as never},{
    onSuccess:next=>{const saved=next as CustomRoleConfig;base.current=saved;setDraft(saved);client.setQueryData(getGetCustomRolesQueryKey(),saved);setConfirm(false);setNotice("Custom role permissions saved.");},
    onError:(error:any)=>{setConfirm(false);if((error.status??error.response?.status)===409)setConflict(true);}
  });
  return <div data-testid="custom-role-permissions"><h3>{role.name} · Custom role</h3>
    <p>Inherited baseline: {label(role.baseRole)}. Inherited denials are read-only. Additional restrictions only remove capabilities; clinic ownership, assignments and workflow checks still apply.</p>
    <div className="table-scroll"><table className="perm-matrix"><thead><tr><th>Module</th>{policy.actions.map(a=><th key={a}>{label(a)}</th>)}</tr></thead><tbody>
      {policy.modules.map(m=><tr key={m}><th>{label(m)}</th>{policy.actions.map(a=>{
        const key=`${m}:${a}`;const inherited=policy.denied.includes(permKey(role.baseRole,m,a));
        return <td key={a} data-label={label(a)}><input type="checkbox" checked={!inherited&&!role.denied.includes(key)} disabled={inherited||conflict||save.isPending} onChange={e=>toggle(key,e.target.checked)} aria-label={`${role.name} ${label(m)} ${label(a)}`} data-testid={`custom-cap-${m}-${a}`}/>{inherited&&<small>Inherited denial</small>}{role.denied.includes(key)&&<small>Custom restriction</small>}</td>;
      })}</tr>)}
    </tbody></table></div>
    {conflict&&<p role="alert">Another administrator changed roles or baseline permissions. Your draft is kept. <button onClick={reload}>Load latest (discard my edits)</button></p>}
    {save.isError&&!conflict&&<p role="alert">Custom permissions were not saved. Try again.</p>}
    {notice&&<p role="status">{notice}</p>}
    <div className="button-group"><button disabled={!dirty||conflict||save.isPending} onClick={()=>setConfirm(true)} data-testid="button-save-custom-permissions">Save custom permissions</button><button disabled={!dirty||save.isPending} onClick={()=>{setDraft(base.current);save.reset();}}>Reset Changes</button></div>
    <AppDialog open={confirm} title={`Save permissions for ${role.name}?`} busy={save.isPending} onClose={()=>setConfirm(false)}><p>Restrictions take effect immediately for assigned staff. No other role draft will be published.</p><button disabled={save.isPending} onClick={run} data-testid="button-confirm-custom-permissions">{save.isPending?"Saving…":"Save now"}</button><button disabled={save.isPending} onClick={()=>setConfirm(false)}>Keep Editing</button></AppDialog>
  </div>;
}
