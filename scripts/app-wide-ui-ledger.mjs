// Converts fresh Playwright evidence into a conservative, repeatable ledger.
// It never upgrades source presence or an initial screenshot to interaction acceptance.
import {readFileSync,writeFileSync,existsSync,mkdirSync} from "node:fs";
const reportPaths=process.argv.slice(2);
if(!reportPaths.length)throw Error("Usage: node scripts/app-wide-ui-ledger.mjs <playwright-json> [narrower-retest-json]");
const reports=reportPaths.map(p=>JSON.parse(readFileSync(p,"utf8")));
const report=reports[0];
const inventory=JSON.parse(readFileSync("docs/ui/surface-inventory.json","utf8"));
const tests=[];
function visit(suites){
  for(const suite of suites){
    for(const spec of suite.specs||[])for(const test of spec.tests)for(const run of test.results){
      const attachment=run.attachments?.find(a=>a.name==="route-result");
      let route;
      if(attachment){
        if(attachment.path&&existsSync(attachment.path))route=JSON.parse(readFileSync(attachment.path,"utf8"));
        else if(attachment.body)route=JSON.parse(Buffer.from(attachment.body,"base64"));
      }
      tests.push({name:spec.title,status:run.status,errors:(run.errors||[]).map(e=>e.message.replace(/\u001b\[[0-9;]*m/g,"")),route,evidence:(run.attachments||[]).filter(a=>a.path).map(a=>a.path.replace(`${process.cwd()}/`,""))});
    }
    visit(suite.suites||[]);
  }
}
for(const report of reports)visit(report.suites);
const latest=[...new Map(tests.map(t=>[t.name,t])).values()];
const routes=latest.filter(t=>t.name.startsWith("app-wide ")).map(t=>({
  role:t.route?.role||t.name.split(" ")[1],path:t.route?.path||t.name.split(" ").slice(2).join(" "),
  disposition:t.status==="passed"?"rendered-initial-state":t.route?.missingContracts.length?"blocked-fixture":"not-accepted",
  limitation:"Initial render/geometry only. Unexercised states and nested actions are not accepted by this result; fictional identity does not prove authorization.",
  ...t,
}));
for(const route of routes){
  const actual=route.route?.results.at(-1)?.url;
  if(route.status==="passed"&&actual&&new URL(actual,"https://fixture.invalid").pathname!==new URL(route.path,"https://fixture.invalid").pathname){
    route.disposition="rendered-permitted-redirect";
    route.limitation=`Requested path redirected to ${actual}. This accepts the permitted redirect's initial render, not the restricted or aliased requested body.`;
  }
}
const routePatterns=inventory.routes.map(pattern=>{
  const expression=new RegExp(`^${pattern.path.split("/").map(segment=>segment.startsWith(":")?"[^/]+":segment.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join("/")}$`);
  const samples=routes.filter(route=>expression.test(new URL(route.path,"https://fixture.invalid").pathname)).map(route=>({role:route.role,path:route.path,disposition:route.disposition}));
  return {...pattern,samples,disposition:samples.length?"sampled; see individual results":"unverified-route",reason:samples.length?"Samples do not cover every identity or conditional state.":"No current exact-path sample exercised this registered destination. Parameter/verification/account-specific prerequisites were not provided by the initial route fixture."};
});
const surfaceStates=inventory.surfaces.flatMap(module=>module.entries.map(entry=>({
  source:`${module.file}:${entry.line}`,owner:entry.definition,tag:entry.tag,family:entry.family,
  destination:entry.href||entry.to||null,stateProfile:entry.stateProfile,
  disposition:"unverified-per-instance",
  reasonCode:"conditional-owner",
})));
const checklist=readFileSync("reports/digiq-master-checklist-137.md","utf8");
const requirements=[...checklist.matchAll(/^(\d+)\. \[([^\]]+)\] (.+)$/gm)].map(([,number,classification,text])=>({number:+number,classification,text}));
const group=(numbers,routes,criterion)=>numbers.forEach(n=>mapping.set(n,{routes,criterion}));
const mapping=new Map();
group([1,7,8,9,10,64,65,92,93,108,109,110,111,112,113,114,115,116,117,118,119,120,121,122,123,124,125,126,127,128,129,130,131,132,133,134,135,136,137],["/sign-in","/patient-login","/forgot-password","/set-password","/demo-login","/onboarding"],"Readable auth fields, reveal, recovery, inline feedback and navigation. No authentication-policy migration or live delivery authorized.");
group([3,4,11,12,13,14,15,16,18,19,21,30,31,43,49,62,63,76,82,83,84,87,97,99],["/register-clinic","/onboarding","/admin/clinics/:id/locations","/{role}/availability","/{role}/patients","/{role}/profile"],"Coherent field groups; labels/errors contained; dependent saved labels retained; required validation visible; complete draft preserved across navigation.");
group([23,24,29,32,33,34,36,37,38,39,40,41,42,44,45,46,48,50,67,77,79,81,88,89,91,98,100,101,102,103,104,105,106],["/admin/staff","/admin/clinics/:id/staff","/doctor/clinics?area=staff","/admin/users","/{role}/patients","/{role}/availability"],"Identifiable rows; reserved selection/action space; bounded dialogs; focus/Escape/discard; visible role restrictions and truthful feedback. Creation, deletion and policy unchanged; Schedule destinations retain their existing scope.");
group([17,27,28,47,53,54,55,57,58,60,61,66,68,69,70,71,72,73,74,75,78,80,90,94,95,96,107],["/{role}/book","/book/:reference","/guest-booking","/{role}/appointments","/{role}/queue","/{role}/availability"],"Separate static context from visit fields; source clear; pending/loading/error/no-session/capacity distinct; readable actions, staged progression, inline details and inherited display formats.");
group([5,25,26,35,51,52,56,59,85,86],["/{role}/dashboard","/admin/reports","/admin/templates","/admin/communication","/admin/settings","/{role}/patients"],"Compact hierarchy, accessible adjacent optional help, consequential warnings visible, truthful state feedback and readable contained controls.");
group([2,6,20,22],["all existing destinations"],"No developer banners; names/errors remain readable; close targets and form fields use the existing shared accessible controls.");
const unlocalized=new Set([3,12,16,26,27,51,55,78,82,101,102,105]);
const numbered=requirements.map(r=>({...r,...mapping.get(r.number),
  disposition:r.number>=108?"policy/backend excluded; presentation and local auth evidence only":/[QP]/.test(r.classification)?"preserved question/proposal; no new business behavior":"UI mapped; acceptance limited to named executed checks",
  reason:unlocalized.has(r.number)?"Original finding's screenshot is unavailable: these are candidate screen families, not a claim to have localized the historical incident. Apply current observable criteria; do not infer the missing screenshot's owner.":"Historical item completion labels are not current evidence. Backend/delivery/performance causes are not reasserted from this UI pass.",
}));
if(numbered.length!==137||numbered.some(r=>!r.routes))throw Error("Every numbered requirement needs a mapping");
const functional=readFileSync("docs/functional-completion-acceptance.md","utf8");
const functionalRequirements=[...functional.matchAll(/^\| (\d+) \| ([^|]+) \|/gm)].map(([,id,title])=>{
  const destinations=/report|trend/i.test(title)?["/admin/reports"]:
    /patient|document|timeline|activity/i.test(title)?["/{role}/patients","/patient/profile → View My Records"]:
    /queue|ticket|QR/i.test(title)?["/{role}/queue","/{role}/appointments","/book/:reference"]:
    /staff|doctor|admin|permission|onboard/i.test(title)?["/admin/clinics/:id/staff","/doctor/clinics?area=staff","/admin/users","/onboarding"]:
    /notification/i.test(title)?["workspace notification drawer","/admin/templates"]:
    /tab|profile|navigation|sidebar|search|workspace|view|listing/i.test(title)?["all role workspace shells and applicable lists"]:
    ["all current routes / shared form and presentation consumers"];
  return {number:+id,title:title.trim(),destinations,disposition:"local UI evidence only; no historical completion imported",limitation:"See named tests and route records. Backend correctness, private files, policy, live delivery and unexercised conditional states are not certified by this pass."};
});
mkdirSync("docs/ui",{recursive:true});
const output={generatedAt:new Date().toISOString(),notice:"Local fictional-fixture evidence, not hosted UAT, authorization, real delivery, full cross-browser or exhaustive nested-state acceptance.",runs:reports.map((r,i)=>({input:reportPaths[i],stats:r.stats})),routePatterns,routes,tests:latest.filter(t=>!t.name.startsWith("app-wide ")),numberedRequirements:numbered,functionalRequirements,stateProfiles:inventory.stateProfiles,reasonCodes:{"conditional-owner":"Source enumeration identifies this conditional consumer; route screenshots and shared-family tests do not prove every state at this particular owner. State criteria reference stateProfiles. See executed named tests for narrower evidence."},surfaces:surfaceStates};
writeFileSync("docs/ui/app-wide-ui-ledger.json",`${JSON.stringify(output,null,2)}\n`);
const safe=s=>String(s).replaceAll("|","\\|").replaceAll("\n"," ");
const rows=routes.map(r=>`| ${safe(r.role)} | \`${safe(r.path)}\` | ${r.disposition} | ${r.route?.results.map(v=>`${v.viewport.width}×${v.viewport.height}`).join(", ")||"No completed geometry record"} | ${r.route?.missingContracts.join(", ")||r.errors[0]?.split("\n")[0]||"Initial-state evidence only"} |`);
const table=["# Current app-wide route evidence","","Generated from the named current run; older completion labels are not used.","","Every passing row below means **initial rendered geometry only**, not all actions/states accepted. Exact errors, screenshots, identity fixtures and per-viewport measurements are in `app-wide-ui-ledger.json`. Conditional source consumers are individually marked unverified there.","","| Role fixture | Destination requested | Disposition | Completed viewports | Limit / blocker |","|---|---|---|---|---|",...rows,"","## Executed named interactions","","| Check | Result |","|---|---|",...output.tests.map(t=>`| ${safe(t.name)} | ${t.status} |`),"","## Numbered requirements","","Each original item is mapped, including Q/P and authentication-policy exclusions. These are not copied historical acceptance statuses.","","| # | Screen families | Observable criterion / boundary | Disposition |","|---|---|---|---|",...numbered.map(r=>`| ${r.number} | ${r.routes.map(p=>`\`${p}\``).join(", ")} | ${safe(r.criterion)} | ${r.disposition} |`),""].join("\n");
writeFileSync("docs/ui/app-wide-route-evidence.md",table);
console.log(JSON.stringify({routeRecords:routes.length,numberedRequirements:numbered.length,conditionalConsumers:surfaceStates.length,stats:report.stats}));
