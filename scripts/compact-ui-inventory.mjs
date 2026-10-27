/**
 * Source inventory, not browser evidence. AST traversal records hidden/conditional
 * JSX too. Dynamic destinations remain expressions, never guessed URLs.
 */
import ts from "typescript";
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { relative, join, dirname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { captureFingerprint } from "./ui-evidence-freshness.mjs";
process.chdir(fileURLToPath(new URL("..",import.meta.url)));
const root = "artifacts/clinicflow/src";
const output = "docs/ui/surface-inventory.json";
const walk = dir => readdirSync(dir, { withFileTypes:true }).flatMap(e => e.isDirectory() ? walk(join(dir,e.name)) : [join(dir,e.name)]);
const families = {
  fields:/^(input|textarea|select|Input|Textarea|SelectTrigger|SearchableSelect|SearchableMultiSelect|MultiSelect|PhoneInput|EmailInput|PasswordInput|SecretField|AddressFields|DateFormatInput|TimeFormatInput|Switch|Checkbox|RadioGroup|RadioGroupItem|InputOTP|InputOTPSlot|SuggestionInput|AsyncSearchableSelect)$/,
  overlays:/Dialog|Drawer|Popover|Tooltip|HelpTip|HoverCard|OverflowText|RowMenu|Sheet|Confirm/,
  navigation:/Nav|Menu|Tabs|Pagination|Breadcrumb|Header|Shell/,
  forms:/^form$|FormField|FormSection|FormTabs|FormActions|FormDisclosure|Editor|Form$/,
};
const presentationFor = (family, tag) => {
  if (/HelpTip|Tooltip|OverflowText/.test(tag)) return "compact-ui.css: accessible bounded help; not a form modal";
  if (/AppDialog|ConfirmDialog/.test(tag)) return "AppDialog/app-dialog.css: shared modal/drawer shell and confirmation actions";
  if (/Popover|Menu|HoverCard/.test(tag)) return "anchored panel: existing primitive plus compact-ui.css; preserve anchor and dismissal";
  if (family === "overlays") return "overlay definition/caller: shared compact typography and bounds; preserve modal versus anchored-panel geometry";
  if (family === "forms") return "form-standard.css: shared field/section/action layout; purpose-specific workflow retained";
  if (family === "fields") return "compact-ui.css: semantic control family; compound structure retained";
  return "existing action/navigation presentation; unrelated navigation and table layout excluded";
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
// Module reachability is weaker than a rendered workflow: conditions, permissions
// and dynamic expressions still require role-aware browser evidence.
const reachable=new Set();
function visitModule(file){
  if(reachable.has(file)||!existsSync(file))return;
  reachable.add(file);
  const source=ts.createSourceFile(file,readFileSync(file,"utf8"),ts.ScriptTarget.Latest,true);
  function imports(node){
    const spec=(ts.isImportDeclaration(node)||ts.isExportDeclaration(node))?node.moduleSpecifier:
      ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword?node.arguments[0]:null;
    if(spec&&ts.isStringLiteral(spec)){
      const target=spec.text.startsWith("@/")?join(root,spec.text.slice(2)):
        spec.text.startsWith(".")?join(dirname(file),spec.text):null;
      if(target){
        const resolved=[target,`${target}.tsx`,`${target}.ts`,join(target,"index.tsx"),join(target,"index.ts")].find(p=>/\.(tsx|ts)$/.test(p)&&existsSync(p));
        if(resolved)visitModule(normalize(resolved));
      }
    }
    ts.forEachChild(node,imports);
  }
  imports(source);
}
visitModule(join(root,"main.tsx"));
for (const file of walk(root).filter(p=>p.endsWith(".tsx")).sort()) {
  const text=readFileSync(file,"utf8"), source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const entries=[];
  function visit(node) {
    if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
      const tag=node.tagName.getText(source);
      const literalAttr=name=>{
        const attr=node.attributes.properties.find(attr=>ts.isJsxAttribute(attr)&&attr.name.getText(source)===name);
        return attr?.initializer&&ts.isStringLiteral(attr.initializer)?attr.initializer.text:"";
      };
      const semanticRole=literalAttr("role");
      const customPanel=/(^|\s)(profile-menu-panel|row-menu-list|notif-panel|vrp-pop|ws-results|location-menu-panel|filter-panel)(\s|$)/.test(literalAttr("className"));
      const family=/^(dialog|alertdialog|menu)$/.test(semanticRole)||customPanel?"overlays":
        semanticRole==="textbox"||tag==="output"?"fields":
        tag==="a"||tag==="Link"?"links":tag==="button"?"actions":Object.entries(families).find(([,pattern])=>pattern.test(tag))?.[0];
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
        const ancestors=[];
        for(let parent=node.parent;parent;parent=parent.parent){
          if(ts.isFunctionDeclaration(parent)&&parent.name)ancestors.push(parent.name.text);
          if(ts.isVariableDeclaration(parent)&&ts.isIdentifier(parent.name))ancestors.push(parent.name.text);
        }
        entries.push({line:source.getLineAndCharacterOfPosition(node.getStart()).line+1,tag,family,...(customPanel?{customPanel:true}:{}),definition:ancestors.reverse().join(" / ")||"module or anonymous definition",disposition:presentationFor(family,tag),runtimeReachability:"conditional source; not independently established by enumeration",stateProfile:profile,viewportProfile:"responsive",coverage:"source-accounted; browser evidence is family-level unless explicitly listed in compact-ui-coverage.md",...attrs});
      }
    }
    ts.forEachChild(node,visit);
  }
  visit(source);
  if(entries.length)surfaces.push({file:relative(".",file),moduleDisposition:reachable.has(file)?"statically reached from production entry; conditional consumers still need runtime evidence":"not statically reached from production entry; retained source/primitive, not claimed as a live screen",entries});
}
const app=readFileSync(join(root,"App.tsx"),"utf8");
const explicit=[...app.matchAll(/<Route path="([^"]+)"/g)].map(m=>({path:m[1],kind:"explicit"}));
const roleBlock=app.match(/const routes: Record<string,string\[\]> = \{([\s\S]*?)\n\};/)[1];
const roleRoutes=[...roleBlock.matchAll(/(\w+):\[([^\]]+)\]/g)].flatMap(([,role,list])=>[
  {path:`/${role}`,kind:"workspace-redirect",role},
  ...[...list.matchAll(/"([^"]+)"/g)].map(([,page])=>({path:`/${role}/${page}`,kind:"workspace",role,owner:pageSources[page],roleVariants:role==="admin"?["Superadmin","Clinic Admin","consulting owner"]:role==="receptionist"?["receptionist","scoped custom role"]:role==="doctor"?["doctor","consulting owner"]:["patient"],viewportProfile:"responsive",coverage:"source-accounted; see family evidence and explicit limitations"})),
]);
const totals = surfaces.flatMap(surface=>surface.entries).reduce((counts,entry)=>{
  counts[entry.family]=(counts[entry.family]||0)+1;
  if(/^(AppDialog|ConfirmDialog)$/.test(entry.tag))counts.dialogPlacements=(counts.dialogPlacements||0)+1;
  if(/^(Dialog|DialogContent|AlertDialog|AlertDialogContent|Sheet|SheetContent|Drawer|DrawerContent)$/.test(entry.tag))counts.primitiveDialogDefinitionsAndCalls=(counts.primitiveDialogDefinitionsAndCalls||0)+1;
  if(entry.customPanel)counts.customPanels=(counts.customPanels||0)+1;
  if(entry.tag==="form")counts.nativeForms=(counts.nativeForms||0)+1;
  return counts;
},{});
const inventory={schemaVersion:3,notice:"Source enumeration only. Includes definitions and callers, not deduplicated runtime instances. See compact-ui-coverage.md for observed browser evidence and limitations. Source presence never establishes role authorization or state coverage.",totals,stateProfiles:profiles,viewportProfiles:{responsive:["390x844","768px tablet","1024x640","1366x768","1920x1080","512x320 (200% reflow, not actual browser zoom)"]},routes:[...explicit,...roleRoutes],surfaces};
inventory.genuineTabInventory="tab-inventory.json";
inventory.sourceFingerprint=captureFingerprint();
const data=JSON.stringify(inventory,null,2)+"\n";
if(process.argv.includes("--check")){
  if(readFileSync(output,"utf8")!==data)throw Error("UI inventory is stale. Run node scripts/compact-ui-inventory.mjs and update the coverage matrix.");
}else{mkdirSync("docs/ui",{recursive:true});writeFileSync(output,data);}
console.log(`${inventory.routes.length} route patterns; ${surfaces.length} source surfaces; ${surfaces.reduce((n,s)=>n+s.entries.length,0)} controls, links and child surfaces inventoried.`);
