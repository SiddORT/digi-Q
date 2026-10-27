import test, { before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
const src = readFileSync(new URL("./CommunicationUsage.tsx", import.meta.url), "utf8");
test("usage view is read-only, scoped and uncached", () => {
  assert.match(src, /gcTime: 0/);
  assert.match(src, /sa && f\.clinicId/);
  assert.match(src, /sa && f\.source/);
  assert.doesNotMatch(src, /localStorage|sessionStorage|resend/i);
  assert.match(src, /not proof that nothing was sent/);
});
test("staff reporting picker uses the scoped report identities, including linked doctors", () => {
  const source=readFileSync(new URL("./CommunicationUsage.tsx",import.meta.url),"utf8");
  assert.match(source,/SearchableSelect label="Staff User"/);
  assert.match(source,/q\.data\?\.userOptions/);
  assert.doesNotMatch(source,/ResourceLookup resource="users"/);
  assert.match(source,/labelScope=\{`communication-report-users:/);
});
test("Reports tabs are not hidden by the location gate; clinical reports retain that gate",()=>{
  const clinic=readFileSync(new URL("../clinic.tsx",import.meta.url),"utf8");
  assert.match(clinic,/return page==="reports"\?<>\{children\}<\/>:/);
  assert.match(clinic,/<ReportsWorkspace.*legacy=\{<LegacyReports\/>\}/);
  const workspace=readFileSync(new URL("./reports/ReportsWorkspace.tsx",import.meta.url),"utf8");
  assert.match(workspace,/tab === "live" \? <WorkspaceBranchScopeGate page="reports"><ReportsDashboard/);
  assert.match(workspace,/tab === "operational" \? <WorkspaceBranchScopeGate page="reports">/);
  assert.match(workspace,/: <CommunicationUsage/);
});
const require=createRequire(import.meta.url);
const {build}=createRequire(import.meta.resolve("vite"))("esbuild");
let component;
const state={};
before(async()=>{
  globalThis.__usageState=state;
  const bundle=await build({entryPoints:[new URL("./CommunicationUsage.tsx",import.meta.url).pathname],
    bundle:true,platform:"node",format:"cjs",write:false,jsx:"automatic",loader:{".css":"empty"},
    external:["react","react-dom","react-dom/server","react/jsx-runtime"],
    plugins:[{name:"usage-fixtures",setup(b){
      b.onResolve({filter:/^@workspace\/api-client-react$/},()=>({path:"api",namespace:"fixture"}));
      b.onResolve({filter:/\/(AppDialog|ResourceLookup)$/},()=>({path:"ui",namespace:"fixture"}));
      b.onResolve({filter:/\/ListingControls$/},()=>({path:"filters",namespace:"fixture"}));
      b.onLoad({filter:/^filters$/,namespace:"fixture"},()=>({contents:`import {createElement as h} from "react"; export const FilterBar=p=>h("section",null,p.title,p.children,p.secondary,p.actions,p.advanced); export const ListingRegion=p=>h("section",{className:"listing-region"},p.children);`}));
      b.onLoad({filter:/api/,namespace:"fixture"},()=>({contents:`
        export const getGetCommunicationUsageQueryKey=p=>["usage",p];
        export const getGetCommunicationUsageDetailQueryKey=id=>["detail",id];
        export const useGetCommunicationUsage=()=>({refetch(){},...globalThis.__usageState});
        export const useGetCommunicationUsageDetail=()=>({});`}));
      b.onLoad({filter:/ui/,namespace:"fixture"},()=>({contents:`
        export const AppDialog=p=>p.children;
        export const ResourceLookup=()=>null;`}));
    }}]});
  const m={exports:{}};
  new Function("require","module","exports",bundle.outputFiles[0].text)(require,m,m.exports);
  component=m.exports;
});
test("IST presets, open-ended custom dates and all-time have no date floor",()=>{
  const {usageRange,EMPTY_USAGE,buildUsageParams}=component;
  const now=Date.parse("2026-09-30T19:00:00Z"); // October 1 in IST.
  assert.deepEqual(usageRange(EMPTY_USAGE,now),{});
  assert.deepEqual(usageRange({...EMPTY_USAGE,preset:"today"},now),{
    from:"2026-10-01T00:00:00.000+05:30",to:"2026-10-01T23:59:59.999+05:30"});
  assert.equal(usageRange({...EMPTY_USAGE,preset:"last7"},now).from,"2026-09-25T00:00:00.000+05:30");
  assert.equal(usageRange({...EMPTY_USAGE,preset:"last30"},now).from,"2026-09-02T00:00:00.000+05:30");
  assert.equal(usageRange({...EMPTY_USAGE,preset:"currentMonth"},now).from,"2026-10-01T00:00:00.000+05:30");
  assert.deepEqual(usageRange({...EMPTY_USAGE,preset:"custom",from:"1900-01-01T01:23"}),{from:"1900-01-01T01:23:00+05:30",to:undefined});
  assert.deepEqual(buildUsageParams({...EMPTY_USAGE,clinicId:"other",source:"test"},"clinicAdmin"),{pageSize:25});
});
test("rendered cards count accepted messages, not all messages; states and role controls are honest",()=>{
  const html=role=>renderToStaticMarkup(createElement(component.CommunicationUsage,{userId:"fixture",role}));
  state.data={items:[],counts:[
    {channel:"sms",bucket:"accepted",count:2,clinicId:"c1",clinicName:"One"},
    {channel:"sms",bucket:"failed",count:9,clinicId:"c1",clinicName:"One"},
    {channel:"email",bucket:"accepted",count:4,clinicId:null,clinicName:null},
  ],total:15,nextCursor:"next",timezone:"Asia/Kolkata",earliestAvailableAt:0,legacyCount:1,unattributedCount:4};
  let h=html("superAdmin");
  assert.match(h,/card-usage-channel-sms[^]*?SMS · Provider accepted<\/small><strong>2<\/strong>/);
  assert.match(h,/card-usage-channel-email[^]*?Email · Provider accepted<\/small><strong>4<\/strong>/);
  assert.match(h,/Unattributed \/ platform/);
  assert.match(h,/select-usage-source/);
  assert.match(h,/empty-usage/);
  assert.match(h,/1970/);
  h=html("clinicAdmin");
  assert.doesNotMatch(h,/select-usage-source|table-usage-clinics|check-usage-unattributed/);
  state.isError=true;
  h=html("superAdmin");
  assert.match(h,/not a count of zero/);
  assert.doesNotMatch(h,/cards-usage-channels/);
  state.isError=false;state.isLoading=true;
  assert.match(html("superAdmin"),/Loading communication usage/);
});
