import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require=createRequire(import.meta.url);
const {build}=createRequire(import.meta.resolve("vite"))("esbuild");
const files=["BookingDiscovery","BookingScheduleSetup"];
const bundles=files.map(name=>resolve(import.meta.dirname,`.${name}-${process.pid}.cjs`));
let Discovery,Setup;
before(async()=>{
  for(const [index,name] of files.entries()){
    await build({
      entryPoints:[resolve(import.meta.dirname,`../components/booking/${name}.tsx`)],
      outfile:bundles[index],bundle:true,platform:"node",format:"cjs",packages:"external",jsx:"automatic",
      plugins:[{name:"booking-display-fixtures",setup(builder){
        builder.onResolve({filter:/(@workspace\/api-client-react|useFreshWorkspace|SessionSelector|HoursWarning|resources|DateTimePreferences|HelpTip|AppDialog|DoctorScheduleContext)$/},args=>({path:args.path,namespace:"fixture"}));
        builder.onLoad({filter:/.*/,namespace:"fixture"},()=>({resolveDir:import.meta.dirname,contents:`
          import React from "react";
          export const useGetBookingScheduleAccess=()=>globalThis.scheduleAccessFixture;
          export const getGetBookingScheduleAccessQueryKey=()=>["schedule-access"];
          export const useGetPublicBookingContext=()=>{throw Error("Display tests must not start discovery reads");};
          export const getGetPublicBookingContextQueryKey=()=>["context"];
          export const getPublicAvailabilitySessions=()=>{throw Error("Display tests must not request availability");};
          export const useFreshWorkspace=()=>({stale:false});
          export const useDateTimePreferences=()=>({dateFormat:"YYYY-MM-DD",timeFormat:"24h"});
          export const SessionSelector=()=>React.createElement("div",{"data-testid":"session-selector"});
          export const formatSessionHours=()=>"09:00–12:00";
          export const HoursWarning=()=>null;
          export const ErrorNotice=()=>null;
          export const HelpTip=props=>React.createElement("button",{"aria-label":props.label},React.createElement("span",null,props.text));
          export const AppDialog=()=>null;
          export const DoctorScheduleContext=()=>null;
        `}));
      }}],
    });
  }
  Discovery=require(bundles[0]).BookingDiscovery;
  Setup=require(bundles[1]).BookingScheduleSetup;
});
after(async()=>{delete globalThis.scheduleAccessFixture;await Promise.all(bundles.map(path=>rm(path,{force:true})));});
function discovery({hasContext=true,pending=false,error=false,eligible=false}={}){
  const session=eligible?{available:true,remainingTokens:4,timezone:"UTC",startTime:"09:00",endTime:"12:00",queueMode:"mixed"}:undefined;
  return renderToStaticMarkup(React.createElement(Discovery,{
    date:"2026-11-05",
    selection:{hasContext,sessions:session?[session]:[],availability:{data:session,isFetching:pending,error:error?Error("offline"):null,dataUpdatedAt:Date.now()}},
    discovery:{ready:true,context:{data:{timezone:"UTC",today:"2026-11-04",lastBookableDate:"2026-12-01"},isFetching:false},from:"2026-11-05",end:"2026-11-19"},
  }));
}
test("preselection is one compact status line, not a padded availability card",()=>{
  const html=discovery({hasContext:false});
  assert.match(html,/Choose a location, doctor and date/);
  assert.doesNotMatch(html,/availability-box|session-selector|contact the clinic/i);
});
test("current session loading and retry failures stay explicit",()=>{
  assert.match(discovery({pending:true}),/Checking current sessions/);
  const html=discovery({error:true});
  assert.match(html,/role="alert"/);assert.match(html,/retry before booking/);
});
test("missing sessions remain distinct from a missing doctor and available capacity",()=>{
  const empty=discovery();
  assert.match(empty,/No doctor session is listed/);
  assert.doesNotMatch(empty,/session-selector/);
  assert.doesNotMatch(empty,/availability-box/);
  const html=discovery({eligible:true});
  assert.match(html,/4 places remaining/);
  assert.match(html,/not an exact consultation time/);
  assert.doesNotMatch(html,/No doctor session is listed/);
});
test("schedule access hides irrelevant advice and distinguishes checking, failure, denial and permission",()=>{
  function render(access,doctorId="doctor"){
    globalThis.scheduleAccessFixture=access;
    return renderToStaticMarkup(React.createElement(Setup,{identity:{user:{id:"owner",role:"clinicAdmin"}},doctorId,branchId:"location",clinicId:"clinic"}));
  }
  assert.equal(render({},""),"");
  assert.match(render({isFetching:true}),/Checking schedule access/);
  assert.match(render({error:Error("offline")}),/Unable to verify schedule access.*Retry schedule access/);
  assert.match(render({data:{allowed:false}}),/cannot manage this schedule/);
  assert.match(render({data:{allowed:true}}),/Manage this doctor/);
  assert.doesNotMatch(render({isFetching:true}),/contact the clinic/i);
});
