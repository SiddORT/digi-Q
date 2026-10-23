/**
 * Source inventory, not browser evidence. AST traversal records hidden/conditional
 * JSX too. Dynamic destinations remain expressions, never guessed URLs.
 */
import ts from "typescript";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { relative, join } from "node:path";
import { fileURLToPath } from "node:url";
process.chdir(fileURLToPath(new URL("..",import.meta.url)));
const root = "artifacts/clinicflow/src";
const output = "docs/ui/surface-inventory.json";
const walk = dir => readdirSync(dir, { withFileTypes:true }).flatMap(e => e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name)]);
const families = {
  fields:/^(input|textarea|select|Input|Textarea|SelectTrigger|SearchableSelect|MultiSelect|PhoneInput|AddressFields|DateFormatInput|TimeFormatInput|Switch|Checkbox|RadioGroup|InputOTP|SuggestionInput|AsyncSearchableSelect)$/,
  overlays:/Dialog|Drawer|Popover|Tooltip|HelpTip|HoverCard|OverflowText|RowMenu|Sheet|Confirm/,
  navigation:/Nav|Menu|Tabs|Pagination|Breadcrumb|Header|Shell/,
  forms:/FormField|FormSection|FormTabs|FormActions|Editor|Form$/,
};
const profiles={
  field:["empty","populated","placeholder","hover","focus-visible","invalid","invalid+focused","disabled","read-only","loading"],
  selection:["empty","selected","long-value","clipped","unclipped","open","keyboard","clear","loading","no-results","failed-load","retry","disabled-saved-label"],
  binary:["unchecked","checked","indeterminate-if-supported","disabled","focus-visible","keyboard","touch"],
  upload:["empty","selected-long-filename","progress-if-supported","failure-if-supported","retry-if-supported","remove-if-supported"],
  overlay:["closed","open","edge-clamp","internal-scroll","keyboard-focus","focus-return","Escape","outside-touch","settled-dismissal"],
  help:["unclipped-no-reveal","measured-clipping","hover","focus","Escape","pointer-travel","touch-toggle","outside-touch","settled-no-reopen","reduced-motion"],
  navigation:["default","hover","pressed","focus-visible","current","selected","disabled","expanded","collapsed","long-label","touch"],
  form:["pristine","dirty","short-error","long-error","simultaneous-errors","hidden-tab-error","discard","submitting","failure","success"],
  action:["default","hover","pressed","focus-visible","disabled","busy-if-supported","keyboard","touch"],
  link:["default","hover","focus-visible","current-if-applicable","visited-if-applicable","history","external-if-applicable","touch"],
};
const pageSources={
  dashboard:"clinic.tsx:Dashboard",profile:"clinic.tsx:Profile",book:"clinic.tsx:Booking",appointments:"clinic.tsx:Appointments",
  queue:"clinic.tsx:Queue / components/queue/SessionQueue.tsx",settings:"clinic.tsx:WorkspaceSettings",clinic:"components/ClinicSettings.tsx",
  clinics:"resources.tsx / clinic.tsx:DoctorClinicWorkspace",branches:"resources.tsx",patients:"resources.tsx",
  users:"Users.tsx / clinic.tsx:UsersWorkspace",staff:"Users.tsx",masters:"resources.tsx",audit:"resources.tsx",
  qrs:"resources.tsx",reports:"clinic.tsx:ReportsTabs / components/reports/ReportsWorkspace.tsx",availability:"components/SchedulingWorkspace.tsx",
  exceptions:"components/SchedulingWorkspace.tsx",demo:"components/DemoClinicManagement.tsx",
  templates:"components/NotificationTemplatesPage.tsx",communication:"components/CommunicationSettings.tsx",
  permissions:"components/AccessRules.tsx / components/CustomRoles.tsx",integrations:"components/IntegrationSettings.tsx",
  "system-users":"components/SystemUsers.tsx",
};
const surfaces = [];
for (const file of walk(root).filter(p=>p.endsWith(".tsx")).sort()) {
  const text=readFileSync(file,"utf8"), source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const entries=[];
  function visit(node) {
    if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
      const tag=node.tagName.getText(source);
      const family=tag==="a"||tag==="Link"?"links":tag==="button"?"actions":Object.entries(families).find(([,pattern])=>pattern.test(tag))?.[0];
      if(family){
        const attrs={};
        for(const attr of node.attributes.properties) if(ts.isJsxAttribute(attr)&&/^(href|to|type|role|id|className|data-testid|disabled|readOnly|aria-.*|hidden)$/.test(attr.name.getText(source))) {
          attrs[attr.name.getText(source)]=attr.initializer?.getText(source)??"true";
        }
        const profile=family==="links"?"link":family==="fields"?
          /checkbox|radio|Switch|Checkbox|RadioGroup/.test(`${tag} ${attrs.type}`)?"binary":
          attrs.type==='"file"'?"upload":/select|Select/.test(tag)?"selection":"field":
          family==="overlays"?/HelpTip|Tooltip|OverflowText/.test(tag)?"help":"overlay":
          family==="navigation"?"navigation":family==="forms"?"form":"action";
        entries.push({line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,tag,family,stateProfile:profile,viewportProfile:"responsive",coverage:"source-accounted; browser evidence is family-level unless explicitly listed in compact-ui-coverage.md",...attrs});
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
  if(entries.length)surfaces.push({file:relative(".",file),entries});
}
const app=readFileSync(join(root,"App.tsx"),"utf8");
const explicit=[...app.matchAll(/<Route path="([^"]+)"/g)].map(m=>({path:m[1],kind:"explicit"}));
const roleBlock=app.match(/const routes: Record<string,string\[\]> = \{([\s\S]*?)\n\};/)[1];
const roleRoutes=[...roleBlock.matchAll(/(\w+):\[([^\]]+)\]/g)].flatMap(([,role,list])=>[
  {path:`/${role}`,kind:"workspace-redirect",role},
  ...[...list.matchAll(/"([^"]+)"/g)].map(([,page])=>({path:`/${role}/${page}`,kind:"workspace",role,owner:pageSources[page],roleVariants:role==="admin"?["Superadmin","Clinic Admin","consulting owner"]:role==="receptionist"?["receptionist","scoped custom role"]:role==="doctor"?["doctor","consulting owner"]:["patient"],viewportProfile:"responsive",coverage:"source-accounted; see family evidence and explicit limitations"})),
]);
const inventory={schemaVersion:2,notice:"Source enumeration only. See compact-ui-coverage.md for observed browser evidence and limitations. Source presence never establishes role authorization or state coverage.",stateProfiles:profiles,viewportProfiles:{responsive:["390x844","768px tablet","1024x640","1366x768","1920x1080","200% zoom"]},routes:[...explicit,...roleRoutes],surfaces};
const data=JSON.stringify(inventory,null,2)+"\n";
if(process.argv.includes("--check")){
  if(readFileSync(output,"utf8")!==data)throw Error("UI inventory is stale. Run node scripts/compact-ui-inventory.mjs and update the coverage matrix.");
}else{mkdirSync("docs/ui",{recursive:true});writeFileSync(output,data);}
console.log(`${inventory.routes.length} route patterns; ${surfaces.length} source surfaces; ${surfaces.reduce((n,s)=>n+s.entries.length,0)} controls, links and child surfaces inventoried.`);
