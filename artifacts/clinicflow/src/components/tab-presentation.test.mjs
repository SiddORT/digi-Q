import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const root=path.resolve(import.meta.dirname,"..");
const inventory=JSON.parse(readFileSync(path.resolve(root,"../../../docs/ui/tab-inventory.json"),"utf8"));
const read=p=>readFileSync(path.join(root,p),"utf8");
test("every genuine tab owner and wrapper caller is source-inventoried",()=>{
  const known=new Set(inventory.groups.map(g=>g.owner.split(":")[0].split(" / ")[0]));
  const shared=new Set(["components/ui/tabs.tsx","components/FormTabs.tsx","components/WorkspaceTabs.tsx"]);
  const owners=[];
  function scan(dir) {
    for(const entry of readdirSync(dir,{withFileTypes:true})) {
      const file=path.join(dir,entry.name);if(entry.isDirectory()){scan(file);continue;}
      if(!file.endsWith(".tsx"))continue;
      const text=readFileSync(file,"utf8"), source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
      let hasTabs=false;
      function visit(node) {
        if(ts.isJsxOpeningElement(node)||ts.isJsxSelfClosingElement(node)){
          const tag=node.tagName.getText(source);
          const role=node.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.getText(source)==="role");
          const isTab=role?.initializer&&ts.isStringLiteral(role.initializer)&&["tab","tablist"].includes(role.initializer.text);
          if(isTab||["FormTabs","WorkspaceTabs","TabsList","TabsTrigger"].includes(tag)||tag==="TabsPrimitive.List"||tag==="TabsPrimitive.Trigger")hasTabs=true;
          if(tag==="FormTabs")assert.ok(node.attributes.properties.some(a=>ts.isJsxAttribute(a)&&a.name.getText(source)==="icons"),`${file}: explicit icons`);
        }
        ts.forEachChild(node,visit);
      }
      visit(source);if(!hasTabs&&!text.includes("useTabIds<"))continue;
      const relative=path.relative(root,file);owners.push(relative);assert.ok(known.has(relative)||shared.has(relative),`Uninventoried genuine tab owner ${relative}`);
    }
  }
  scan(root);
  assert.equal(inventory.groups.length,17);
  for(const group of inventory.groups) {
    assert.equal(group.labels.length,group.icons.length,group.id);
    assert.ok(group.entryPoints.length&&group.roles.length&&group.case,group.id);
  }
  assert.ok(owners.includes("components/schedule/OwnerWeeklySessions.tsx"));
});
test("one tab-only style owner, distinct error/attention and decorative icons",()=>{
  const css=read("components/tab-presentation.css");
  assert.match(css,/\.dq-tabs > \.dq-tab/);
  assert.match(css,/min-width:max-content/);
  assert.match(css,/overflow-x:auto/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/focus-visible/);
  assert.match(css,/data-attention=true/);
  assert.doesNotMatch(css,/\.(appt-tab-panel|form-grid|pd-panel|notif-body)|StatusTabs|sq-status/);
  const icon=read("components/TabIcon.tsx");
  assert.match(icon,/aria-hidden="true"/);assert.match(icon,/strokeWidth=\{1\.75\}/);
  assert.match(read("components/WorkspaceTabs.tsx"),/keyboardTarget\.current!==area/);
  assert.match(read("components/appointments/AppointmentDetails.tsx"),/<TabIcon name="booking"\/>Booking/);
  assert.doesNotMatch(read("components/queue/StatusTabs.tsx"),/dq-tab|TabIcon/);
  // A single :not list keeps the old .workspace button:not(.button) specificity.
  // Adding a second :not would also override unrelated switch/accordion sizing.
  assert.match(read("compact-workspace.css"),/\.workspace button:not\(\.button,\.dq-tab,\[role=tab\]\)\{/);
  assert.doesNotMatch(read("compact-workspace.css"),/button:not\(\.button\):not\(\[role=tab\]\)/);
});
test("appointment view buttons share tab presentation, not tab semantics or legacy pressed rules",()=>{
  const selector=read("components/appointments/AppointmentViewSelector.tsx");
  assert.match(selector,/dq-tabs dq-tabs-intrinsic/);
  assert.match(selector,/role="group" aria-label="Appointment layout"/);
  assert.equal((selector.match(/aria-pressed=/g)||[]).length,2);
  assert.equal((selector.match(/className="dq-tab"/g)||[]).length,2);
  assert.doesNotMatch(selector,/role="tab|aria-selected|tabIndex/);
  const css=read("components/tab-presentation.css");
  assert.match(css,/\.dq-tabs\.dq-tabs-intrinsic.*width:max-content/);
  assert.match(css,/\.dq-tabs-intrinsic > \.dq-tab \{ flex:0 0 auto/);
  assert.match(css,/:not\(:disabled,\[aria-selected=true\],\[data-state=active\],\[aria-pressed=true\]\):hover/);
  assert.match(css,/:is\(\[aria-selected=true\],\[data-state=active\],\[aria-pressed=true\]\)/);
  for(const file of ["components/uniformity.css","components/appointments/visit-range.css","clinic.tsx"])
    assert.doesNotMatch(read(file),/appt-mode/);
  assert.match(read("clinic.tsx"),/<AppointmentViewSelector mode=\{mode\}/);
  assert.match(read("clinic.tsx"),/if\(next==="calendar"\)setCalMonth\(monthStart\(from\|\|visitToday\)\);setMode\(next\)/);
  assert.equal(inventory.viewSelectors.length,1);
  assert.equal(inventory.viewSelectors[0].id,"appointment-layout");
});
