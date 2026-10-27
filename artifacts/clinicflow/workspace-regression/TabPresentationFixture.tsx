import { useState } from "react";
import inventory from "../../../docs/ui/tab-inventory.json";
import { WorkspaceTabs, type WorkspaceTab } from "../src/components/WorkspaceTabs";
import { FormTabs } from "../src/components/FormTabs";
import { Tabs, TabsList, TabsTrigger } from "../src/components/ui/tabs";
import { TabIcon, type TabIconName } from "../src/components/TabIcon";
import { AppDialog } from "../src/components/AppDialog";
import { OwnerWeeklySessions } from "../src/components/schedule/OwnerWeeklySessions";
import { buildWeek } from "../src/components/schedule/week-plan";
import { PatientDetailsDrawer } from "../src/components/PatientDetailsDrawer";
import { NotificationsPanel } from "../src/components/NotificationsPanel";
import { WorkspaceSearch } from "../src/components/WorkspaceSearch";
import { useTabIds } from "../src/lib/tabs-a11y";

function Sample({ group }: { group: typeof inventory.groups[number] }) {
  const [active, select] = useState(0);
  const names = group.labels;
  const icons = group.icons as TabIconName[];
  const ids = names.map((_, i) => String(i));
  const tabs = useTabIds(ids, String(active), id => select(Number(id)));
  const metadata: WorkspaceTab[] = names.map((label, i) => ({ id: String(i), label, icon: icons[i] }));
  const strip = group.primitive === "form"
    ? <FormTabs tabs={names} icons={icons} active={active} onChange={select} invalid={names.map((_,i)=>i===0)} attention={names.map((_,i)=>i===1)}/>
    : group.primitive === "workspace"
    ? <WorkspaceTabs tabs={metadata} area={String(active)} onSelect={id=>select(Number(id))} label={group.id}/>
    : group.primitive === "radix"
    ? <Tabs value={String(active)} onValueChange={id=>select(Number(id))}><TabsList aria-label={group.id}>{names.map((label,i)=><TabsTrigger key={label} value={String(i)}><TabIcon name={icons[i]}/>{label}</TabsTrigger>)}</TabsList></Tabs>
    : <div className={`dq-tabs ${group.id==="search"?"ws-tabs":group.id==="notifications"?"notif-tabs":group.id==="patient-drawer"?"pd-tabs":"workspace-tabs"}`} aria-label={group.id} {...tabs.list}>{names.map((label,i)=><button className="dq-tab" key={label} type="button" {...tabs.tab(String(i))}><TabIcon name={icons[i]}/>{label}{group.id==="search"&&<span className="ws-tab-count">{i===0?12345:i}</span>}</button>)}</div>;
  return <section data-tab-sample={group.id} style={{ minWidth:0, marginBottom:16 }}><h2>{group.id} · presentation sample</h2>{strip}</section>;
}
export function TabPresentationFixture() {
  const [overlay, setOverlay] = useState<"dialog"|"drawer"|null>(null);
  const [patient, setPatient] = useState(false);
  const [weeks, setWeeks] = useState([buildWeek([]), buildWeek([])]);
  const [active, setActive] = useState("last");
  const longTabs: WorkspaceTab[] = [{id:"first",label:"First",icon:"details"},{id:"long",label:"A deliberately long section label with a descriptive name",icon:"details"},{id:"last",label:"Last section",icon:"history"}];
  const samples = <>{inventory.groups.filter(g=>g.id!=="owner-locations").map(group=><Sample key={group.id} group={group}/>)}<div data-tab-sample="long"><WorkspaceTabs tabs={longTabs} area={active} onSelect={setActive} label="Long labels"/></div>
    <WorkspaceTabs tabs={longTabs} area="first" onSelect={()=>{}} label="Rejected selection"/>
    <Tabs defaultValue="enabled"><TabsList aria-label="Disabled state"><TabsTrigger value="enabled"><TabIcon name="details"/>Enabled</TabsTrigger><TabsTrigger value="disabled" disabled><TabIcon name="history"/>Disabled</TabsTrigger></TabsList></Tabs></>;
  return <div className="workspace" style={{display:"block",minWidth:0}}><main className="content" style={{width:"100%",minWidth:0,padding:16}}>
    <h1>Tab presentation fixtures · fictional, no authenticated identity</h1>
    <button type="button" onClick={()=>setOverlay("dialog")}>Open tab dialog</button>
    <button type="button" onClick={()=>setOverlay("drawer")}>Open tab drawer</button>
    <button type="button" onClick={()=>setPatient(true)}>Open real patient drawer</button>
    <NotificationsPanel/><WorkspaceSearch navigation={["patients","appointments","staff","clinics","branches","availability","reports","audit"]} role="admin" page="patients" userId="tab-fixture"/>
    {samples}
    <section data-tab-sample="owner-locations" className="clinic-registration"><h2>Real owner location tabs; weekday accordions stay unchanged</h2><OwnerWeeklySessions branches={[{name:"Central clinic location",hours:[]},{name:"Long location name supplied by an owner — never interpreted as an icon",hours:[]}]} weeks={weeks} onChange={setWeeks} preferences={{timezone:"Asia/Kolkata",timeFormat:"24h"}}/></section>
    <AppDialog open={!!overlay} onClose={()=>setOverlay(null)} variant={overlay==="drawer"?"drawer":undefined} title="Tab presentation overlay">{samples}</AppDialog>
    {patient&&<PatientDetailsDrawer patient={{id:"fictional-patient",fullName:"Fictional Patient"}} onClose={()=>setPatient(false)}/>}
  </main></div>;
}
