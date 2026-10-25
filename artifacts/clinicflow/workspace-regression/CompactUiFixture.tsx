import { useState } from "react";
import { FormField, FormErrorSummary } from "../src/components/FormField";
import { PhoneInput } from "../src/components/PhoneInput";
import { AddressFields, type AddressValue } from "../src/components/AddressFields";
import { DateFormatInput, TimeFormatInput } from "../src/components/DateFormatInput";
import { SearchableSelect } from "../src/components/SearchableSelect";
import { SearchableMultiSelect } from "../src/components/SearchableMultiSelect";
import { Switch } from "../src/components/ui/switch";
import { HelpTip } from "../src/components/HelpTip";
import { OverflowText } from "../src/components/OverflowText";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../src/components/ui/tooltip";
import { WorkspaceNav } from "../src/components/WorkspaceNav";
import { ProfileMenu } from "../src/components/WorkspaceShell";
import { RowMenu } from "../src/components/RowMenu";
import { AppDialog } from "../src/components/AppDialog";
import { ToastHost } from "../src/components/ToastHost";
import { toast } from "sonner";

const long = "A long fictional label with several words and a verylongunbrokenvaluethatmustwrapwithoutoverlappingadjacentcontrols";
const navigation=["dashboard","book","appointments","queue","patients","clinic","users","availability","qrs","reports","communication","templates","settings","profile"];
/** Fictional, controlled primitives under real workspace, form and dialog ancestry.
 * No production auth, delivery, writes, or permissions bypass is installed. */
export function CompactUiFixture(){
  const [checked,setChecked]=useState(false),[phone,setPhone]=useState("+919876543210");
  const [address,setAddress]=useState<AddressValue>({country:"IN",state:"Maharashtra",city:"Mumbai",address:"12 Fictional Road",pincode:"400080"});
  const [date,setDate]=useState("2026-10-23"),[time,setTime]=useState("09:30");
  const [selection,setSelection]=useState("long"),[errors,setErrors]=useState(false),[dialog,setDialog]=useState(false);
  const [multiple,setMultiple]=useState<string[]>([]);
  const [drawer,setDrawer]=useState(false),[collapsed,setCollapsed]=useState(false),[disabled,setDisabled]=useState(false);
  const [readOnly,setReadOnly]=useState(false),[load,setLoad]=useState<"ready"|"loading"|"error">("ready");
  const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false);
  const fields=<div className="cf-form editor-container"><div className="form-grid field-grid">
    <FormField className="field-cell fw-md" label={long} error={errors?"Required.":undefined} helper="Keep this explanation visible."><input data-testid="text-field" placeholder="Full name" disabled={disabled} readOnly={readOnly}/></FormField>
    <FormField className="field-cell fw-md" label="Email" error={errors?long:undefined}><input type="email" data-testid="email-field" defaultValue="fictional@example.invalid" disabled={disabled} readOnly={readOnly}/></FormField>
    <FormField className="field-cell fw-md" label="Password">{props=><div className="password-input"><input {...props} type={visible?"text":"password"} defaultValue="Fictional only" disabled={disabled} readOnly={readOnly}/><button type="button" className="password-toggle" aria-label="Reveal password" aria-pressed={visible} onClick={()=>setVisible(!visible)}>Show</button></div>}</FormField>
    <FormField className="field-cell fw-xs" label="Count"><input type="number" defaultValue={20} disabled={disabled} readOnly={readOnly}/></FormField>
    <FormField className="field-cell fw-sm" label="Native select"><select disabled={disabled}><option>Short</option><option>{long}</option></select></FormField>
    <FormField className="field-cell fw-lg" label="Searchable selection"><SearchableSelect options={[{value:"long",label:long},{value:"short",label:"Short"}]} value={selection} onChange={setSelection} disabled={disabled} loading={load==="loading"} error={load==="error"?"Options could not be loaded. Retry safely.":undefined} onRetry={()=>setLoad("ready")}/></FormField>
    <FormField id="compact-multiple" className="field-cell fw-lg" label="Searchable multiple"><SearchableMultiSelect options={[{value:"long",label:long},{value:"short",label:"Short"}]} value={multiple} onChange={setMultiple} disabled={disabled} loading={load==="loading"} error={load==="error"?"Options could not be loaded. Retry safely.":undefined} onRetry={()=>setLoad("ready")}/></FormField>
    <FormField className="field-cell fw-lg" label="Phone"><PhoneInput value={phone} onChange={setPhone} disabled={disabled} readOnly={readOnly}/></FormField>
    <FormField className="field-cell fw-sm" label="Date"><DateFormatInput value={date} onChange={setDate} disabled={disabled} readOnly={readOnly}/></FormField>
    <FormField className="field-cell fw-sm" label="Time"><TimeFormatInput value={time} onChange={setTime} disabled={disabled} readOnly={readOnly}/></FormField>
    <FormField className="field-cell fw-sm" label="OTP"><input inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" disabled={disabled} readOnly={readOnly}/></FormField>
    <FormField className="field-cell fw-full" label="Notes"><textarea defaultValue={long} disabled={disabled} readOnly={readOnly}/></FormField>
    <FormField className="field-cell fw-lg" label="Multiple values"><select multiple defaultValue={["long"]} disabled={disabled}><option value="long">{long}</option><option value="short">Short</option></select></FormField>
    <FormField className="field-cell fw-lg" label="File"><input type="file" disabled={disabled}/></FormField>
    <div className="field-cell fw-full"><AddressFields value={address} onChange={patch=>setAddress({...address,...patch})} directory="public"/></div>
    <div className="field-cell fw-full" style={{display:"flex",flexWrap:"wrap",alignItems:"center",gap:24}}>
      <label className="checkbox-row"><input type="checkbox" disabled={disabled}/> Checkbox</label>
      <label className="checkbox-row"><input type="radio" name="choice" disabled={disabled}/> Radio</label>
      <label className="checkbox-row"><Switch data-testid="compact-switch" checked={checked} onCheckedChange={setChecked} disabled={disabled}/> Notifications enabled</label>
    </div>
  </div></div>;
  return <div className={`workspace${collapsed?" sidebar-collapsed":""}`}>
    <aside className="sidebar"><WorkspaceNav role="admin" page="dashboard" navigation={navigation} onNavigate={()=>{}} collapsed={collapsed}/></aside>
    <div className="workspace-main">
      <header className="topbar"><div className="breadcrumb">DigiQ · Compact UI</div><ProfileMenu name={long} roleLabel="Fictional Clinic Admin" role="admin" actualRole="superAdmin" navigation={navigation} page="dashboard" userId="fictional-compact" onSignOut={()=>{}}/></header>
      <main className="content">
        <div className="page-heading"><h1>Compact UI fixture</h1></div>
        <div className="form-actions" style={{marginBottom:12}}>
          <button onClick={()=>setErrors(!errors)}>Toggle errors</button>
          <button onClick={()=>setDisabled(!disabled)}>Toggle disabled</button>
          <button onClick={()=>setReadOnly(!readOnly)}>Toggle readonly</button>
          <button onClick={()=>setLoad(load==="ready"?"loading":load==="loading"?"error":"ready")}>Cycle options state</button>
          <button onClick={()=>setCollapsed(!collapsed)}>Collapse navigation</button>
          <button onClick={()=>{setDialog(true);setDrawer(false);}}>Open dialog</button>
          <button onClick={()=>{setDialog(true);setDrawer(true);}}>Open drawer</button>
          <button onClick={()=>toast.error("Error: "+long)}>Show feedback</button>
        </div>
        <FormErrorSummary message={errors?"Error: Correct the highlighted fields. "+long:undefined}/>
        {["info","warning","success","error"].map(kind=><p key={kind} data-feedback={kind}><strong>{kind[0].toUpperCase()+kind.slice(1)}: </strong>{long}</p>)}
        <div style={{display:"flex",flexWrap:"wrap",gap:16,alignItems:"center",marginBlock:12,minWidth:0}}>
          <HelpTip label="Explanation" text={"Explanation: "+long}/>
          <div style={{width:120}}><OverflowText testId="compact-clipped" value={long}/></div>
          <OverflowText testId="compact-short" value="Short"/>
          <TooltipProvider><Tooltip><TooltipTrigger asChild><button>Library help</button></TooltipTrigger><TooltipContent>Library explanation</TooltipContent></Tooltip></TooltipProvider>
          <RowMenu label="Fictional row actions" items={[{key:"edit",label:long,onSelect:()=>setDialog(true)},{key:"disabled",label:"Unavailable",disabled:true},{key:"link",label:"Local destination",href:"#destination"}]}/>
        </div>
        {fields}
        <button data-testid="compact-outside" type="button">Outside target</button>
        <div id="destination">Linked destination</div>
        <AppDialog open={dialog} onClose={()=>setDialog(false)} title={drawer?"Compact drawer":"Compact dialog"} variant={drawer?"drawer":"modal"} size="wide" busy={busy}>
          {fields}
          <div className="form-footer form-actions"><button onClick={()=>setBusy(!busy)} disabled={busy}>{busy?"Saving…":"Simulate submitting"}</button><button onClick={()=>setDialog(false)} disabled={busy}>Close fixture</button></div>
        </AppDialog>
      </main>
    </div><ToastHost/>
  </div>;
}
