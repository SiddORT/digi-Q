import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { kolkataToIso, formatLogTime, buildLogParams, show, EMPTY_FILTERS, smsProviderErrorHelp } from "../lib/notification-log-format.ts";
import { communicationTab } from "../lib/communication-routes.ts";
const rd = f => readFileSync(new URL(f, import.meta.url), "utf8");
test("kolkata conversion and formatting", () => {
  assert.equal(kolkataToIso("2025-01-01T05:30"), "2025-01-01T00:00:00.000Z");
  assert.match(formatLogTime(0), /Asia\/Kolkata/);
  assert.equal(formatLogTime(null), "Unavailable");
  assert.equal(show(null), "Unavailable");
});
test("params omit empties and carry cursor", () => {
  const p = buildLogParams({ ...EMPTY_FILTERS, status: "delivery_unknown", reference: " r1 " }, "c1");
  assert.deepEqual(p, { pageSize: 25, status: "delivery_unknown", reference: "r1", cursor: "c1" });
});
test("logs tab deep link and no persistence", () => {
  assert.equal(communicationTab("logs"), "logs");
  const s = rd("./NotificationLogs.tsx");
  assert.ok(s.includes("gcTime: 0") && !/localStorage|sessionStorage/.test(s));
});
test("SMS authentication rejection has actionable, credential-free guidance", () => {
  const help = smsProviderErrorHelp({ channel: "sms", httpStatus: 401 });
  assert.match(help, /HTTP 401/);
  assert.match(help, /select Keep in Touch/);
  assert.match(help, /Postman token/);
  assert.match(help, /not retried automatically/);
  assert.equal(smsProviderErrorHelp({ channel: "email", httpStatus: 401 }), null);
  assert.equal(smsProviderErrorHelp({ channel: "sms", httpStatus: 200 }), null);
  assert.equal(smsProviderErrorHelp({ channel: "sms", httpStatus: null }), null);
});
test("kit url separate from custom url", () => {
  const p = rd("./SmsProviderPanel.tsx");
  assert.ok(p.includes("NOTIFICATION_SMS_KEEP_IN_TOUCH_URL") && p.includes("setKitUrl") && !/readOnly=\{kit\}/.test(p));
});
test("Keep in Touch endpoint in Custom API mode offers a draft-only explicit correction",()=>{
  const p=rd("./SmsProviderPanel.tsx");
  assert.match(p,/!kit && url\.trim\(\) === KEEP_IN_TOUCH_URL/);
  assert.match(p,/warning-sms-kit-provider/);
  assert.match(p,/setProvider\("keepInTouch"\); setCountryFormat\("digits"\)/);
  assert.match(p,/draft only/);
  assert.match(p,/Saved credentials are preserved/);
});
import {createRequire} from "node:module";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {before} from "node:test";
const require=createRequire(import.meta.url);
const {QueryClient,QueryClientProvider}=require("@tanstack/react-query");
const {build}=createRequire(import.meta.resolve("vite"))("esbuild");
let Logs, state={};
before(async()=>{
 globalThis.__logState=state;
 const r=await build({entryPoints:[new URL("./NotificationLogs.tsx",import.meta.url).pathname],bundle:true,platform:"node",format:"cjs",write:false,jsx:"automatic",loader:{".css":"empty"},
  external:["react","react-dom","react-dom/server","react/jsx-runtime","@tanstack/react-query"],
  plugins:[{name:"fx",setup(b){
   b.onResolve({filter:/^@workspace\/api-client-react$/},()=>({path:"api",namespace:"fixture"}));
   b.onResolve({filter:/\/AppDialog$/},()=>({path:"dlg",namespace:"fixture"}));
   b.onResolve({filter:/\/ListingControls$/},()=>({path:"filters",namespace:"fixture"}));
   b.onResolve({filter:/\/ResourceLookup$/},()=>({path:"lookup",namespace:"fixture"}));
   b.onLoad({filter:/^filters$/,namespace:"fixture"},()=>({contents:`import {createElement as h} from "react"; export const FilterBar=p=>h("section",null,p.title,p.children,p.secondary,p.actions,h("div",{"data-testid":"fixture-filter-drawer"},p.advanced)); export const ListingRegion=p=>h("section",{className:"listing-region"},p.children);`}));
   b.onLoad({filter:/^lookup$/,namespace:"fixture"},()=>({contents:`export const ResourceLookup=()=>null;`}));
   b.onLoad({filter:/^api$/,namespace:"fixture"},()=>({contents:`
    export const getListNotificationLogsQueryKey=p=>["l",p]; export const getGetNotificationLogQueryKey=i=>["g",i];
    export const useListNotificationLogs=()=>({refetch(){},...globalThis.__logState.list});
    export const useGetNotificationLog=()=>({refetch(){},...globalThis.__logState.one});`}));
   b.onLoad({filter:/^dlg$/,namespace:"fixture"},()=>({contents:`export const AppDialog=p=>p.children;`}));
  }}]});
 const m={exports:{}}; new Function("require","module","exports",r.outputFiles[0].text)(require,m,m.exports); Logs=m.exports.NotificationLogs;
});
const html=()=>renderToStaticMarkup(createElement(QueryClientProvider,{client:new QueryClient()},createElement(Logs)));
test("production caller uses the shared draft drawer and keeps refresh outside it",()=>{
  state.list={data:{items:[],timezone:"Asia/Kolkata"}};
  const h=html();
  assert.match(h,/fixture-filter-drawer/);
  assert.match(h,/input-log-from-picker/);
  assert.match(h,/input-log-from-time-picker/);
  assert(h.indexOf('data-testid="button-refresh-logs"')<h.indexOf('fixture-filter-drawer'));
  const source=rd("./NotificationLogs.tsx");
  assert.match(source,/Object\.values\(applied\)\.filter\(Boolean\)\.length/);
  assert.match(source, /onOpen=\{\(\) => setDraft\(applied\)\}/);
  assert.match(source, /onCancel=\{\(\) => setDraft\(applied\)\}/);
  assert.match(source, /onResetDraft=\{\(\) => setDraft\(EMPTY_FILTERS\)\}/);
});
test("rendered states",()=>{
 state.list={isLoading:true}; assert.match(html(),/loading-logs/);
 state.list={isError:true}; assert.match(html(),/error-logs/);
 state.list={data:{items:[],nextCursor:null,timezone:"Asia/Kolkata"}}; assert.match(html(),/empty-logs/);
 assert.match(html(),/select-log-event/); assert.match(html(),/exact matches/);
 state.list={data:{items:[{id:"a1",channel:"sms",event:"booking",status:"delivery_unknown",source:"automatic",legacy:true,createdAt:0,recipient:null,reference:null,timeline:[]}],nextCursor:"n",timezone:"Asia/Kolkata"}};
 const h=html(); assert.match(h,/row-log-a1/); assert.match(h,/Unavailable/);
});
