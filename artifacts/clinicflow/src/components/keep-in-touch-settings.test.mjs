import assert from "node:assert/strict";
import {before,test} from "node:test";
import {createRequire} from "node:module";
import {createElement} from "react";
import {renderToStaticMarkup} from "react-dom/server";
const require=createRequire(import.meta.url);
// Match the bundled component's CommonJS conditional export, otherwise the ESM
// provider and CJS hook use different React Query contexts.
const {QueryClient,QueryClientProvider}=require("@tanstack/react-query");
const {build}=createRequire(import.meta.resolve("vite"))("esbuild");
let Panel;
before(async()=>{
 const result=await build({
  entryPoints:[new URL("./SmsProviderPanel.tsx",import.meta.url).pathname],
  bundle:true,platform:"node",format:"cjs",write:false,jsx:"automatic",loader:{".css":"empty"},
  external:["react","react-dom","react-dom/server","react/jsx-runtime","@tanstack/react-query"],
  plugins:[{name:"settings-fixture",setup(b){
   b.onResolve({filter:/^@workspace\/api-client-react$/},()=>({path:"api",namespace:"fixture"}));
   b.onLoad({filter:/.*/,namespace:"fixture"},()=>({contents:`
    export const getGetIntegrationSettingsQueryKey=()=>["settings"];
    export const useSendNotificationSmsTestMessage=()=>({isPending:false,reset(){}});
    export const useUpdateIntegrationSettings=()=>({isPending:false,reset(){}});
   `}));
  }}],
 });
 const mod={exports:{}};
 new Function("require","module","exports",result.outputFiles[0].text)(require,mod,mod.exports);
 Panel=mod.exports.SmsProviderPanel;
});
const protectedNames=["NOTIFICATION_SMS_KEY","NOTIFICATION_SMS_BEARER_TOKEN","NOTIFICATION_SMS_CLIENT_ID","NOTIFICATION_SMS_SENDER_ID"];
const props={
 r:{ready:true,smsProvider:"keepInTouch",countryCodeFormat:"digits",notificationsEnabled:false,apiUrl:"https://api.keepintouch.life/kitversion01/api/DripMaster/SendSMS",keys:protectedNames.map(key=>({key,status:"configured"}))},
 editable:true,onDirtyChange(){},onBusyChange(){},onSaved(){},
};
const render=p=>renderToStaticMarkup(createElement(QueryClientProvider,{client:new QueryClient()},createElement(Panel,{...props,...p})));
test("saved Keep in Touch settings render provider, exact endpoint, independent masked credentials and format warning",()=>{
 const html=render();
 assert.match(html,/value="keepInTouch" selected/);
 assert.match(html,/api\.keepintouch\.life\/kitversion01\/api\/DripMaster\/SendSMS/);
 assert.match(html,/Body API Key \(apiKey\)/);assert.match(html,/Bearer token/);
 for(const id of ["sms-key","sms-bearer","sms-client","sms-sender"])assert.match(html,new RegExp(`data-testid="${id}-configured"`));
 assert.match(html,/value="digits" selected/);assert.match(html,/Plus-prefixed/);
 assert.match(html,/does not verify/);assert.match(html,/never tries both/);
 assert.match(html,/success:true/);assert.match(html,/Entity ID is neither required nor sent/);
 assert.doesNotMatch(html,/id="sms-entity"/);
 assert.doesNotMatch(html,/data-testid="select-sms-auth"/);
 assert.doesNotMatch(html,/data-testid="checkbox-sms-enabled" checked/);
});
test("incomplete Keep in Touch settings show protected missing keys, blank-preserve help and explicit format choice",()=>{
 const html=render({r:{...props.r,ready:false,countryCodeFormat:undefined,keys:protectedNames.map(key=>({key,status:"missing"}))}});
 assert.match(html,/NOTIFICATION_SMS_BEARER_TOKEN: missing/);
 assert.match(html,/blank fields preserve saved values/);
 assert.match(html,/Choose explicitly/);assert.match(html,/type="password"/);
 assert.match(html,/disabled=""[^>]*data-testid="button-save-sms-settings"/);
});
test("Custom API settings still render existing authentication mapping and entity controls without Bearer-body preset",()=>{
 const html=render({r:{...props.r,smsProvider:"generic",apiUrl:"https://provider.example.invalid/send",keys:[]}});
 assert.match(html,/data-testid="select-sms-auth"/);assert.match(html,/id="sms-entity"/);
 assert.doesNotMatch(html,/id="sms-bearer"/);
});
