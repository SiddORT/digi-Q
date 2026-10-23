import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { rm } from "node:fs/promises";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const bundle = resolve(import.meta.dirname, `.assignment-render-${process.pid}.cjs`);
let ResourceLookup;
before(async () => {
  await build({
    entryPoints:[resolve(import.meta.dirname, "../components/ResourceLookup.tsx")],
    outfile:bundle, bundle:true, platform:"node", format:"cjs", packages:"external", jsx:"automatic",
    plugins:[{name:"read-only-render-fixtures",setup(builder) {
      builder.onResolve({filter:/(@workspace\/api-client-react|@tanstack\/react-query|use-directory|SearchableSelect|SearchableMultiSelect|ListingControls)$/},
        args => ({path:args.path,namespace:"fixture"}));
      builder.onLoad({filter:/.*/,namespace:"fixture"}, () => ({resolveDir:import.meta.dirname,contents:`
        import React from "react";
        export const useQueryClient=()=>({});
        export const useQuery=()=>({isPending:false,isFetching:false,isSuccess:true,data:[]});
        export const useInfiniteQuery=()=>({isPending:false,isFetching:false,isSuccess:true,data:{pages:[globalThis.assignmentScopeFixture?.data||{items:[],total:0}]}});
        export const useDirectoryActor=()=>["fixture","superAdmin",""];
        export const useDirectoryCardinality=()=>globalThis.assignmentScopeFixture;
        export const directoryLists={};
        export const hashKey=JSON.stringify;
        export const getClinic=()=>{};
        export const getBranch=()=>{};
        export const getDoctor=()=>{};
        export const getPatient=()=>{};
        export const getUser=()=>{};
        export const getMaster=()=>{};
        export const assignmentDirectory=()=>{};
        export const useDebouncedValue=v=>v;
        export const SearchableSelect=props=>React.createElement("button",{role:"combobox","aria-label":props.label,disabled:props.disabled,"data-option-count":props.options.length},props.options.map(option=>option.label).join("|"));
        export const SearchableMultiSelect=()=>null;
      `}));
      if(process.env.ASSIGNMENT_DISPLAY_BASELINE==="1") {
        builder.onLoad({filter:/ResourceLookup\.tsx$/}, () => ({
          contents:execFileSync("git",["show","HEAD:artifacts/clinicflow/src/components/ResourceLookup.tsx"],{encoding:"utf8"}),
          loader:"tsx",resolveDir:resolve(import.meta.dirname,"../components"),
        }));
      }
    }}],
  });
  ({ResourceLookup}=require(bundle));
});
after(async()=>{delete globalThis.assignmentScopeFixture;await rm(bundle,{force:true});});
const success={isPending:false,isFetching:false,isError:false,isSuccess:true,data:{total:0,items:[]}};
function render(scope, props={}) {
  globalThis.assignmentScopeFixture=scope;
  return renderToStaticMarkup(React.createElement(ResourceLookup,{
    resource:"doctors",label:"Doctor",value:"",onChange:()=>{},autoSole:true,...props,
  }));
}
test("rendered successful zero is distinct from cold/pending discovery",()=>{
  assert.match(render(success),/Not assigned/);
  const pending=render({...success,isPending:true,isSuccess:false,isFetching:true,data:undefined});
  assert.doesNotMatch(pending,/Not assigned|No active assigned doctors/);
  assert.match(pending,/Checking assigned options|Loading assigned options/);
});
test("rendered cached zero cannot assert absence while its refresh is pending",()=>{
  const html=render({...success,isFetching:true});
  assert.doesNotMatch(html,/Not assigned|No active assigned doctors/);
  assert.match(html,/Checking assigned options/);
});
test("rendered failed cold and cached-zero requests explain failure, not absence",()=>{
  for(const data of [undefined,success.data]) {
    const html=render({...success,isSuccess:false,isError:true,error:Error("offline"),data});
    assert.doesNotMatch(html,/Not assigned|No active assigned doctors/);
    assert.match(html,/Unable to verify assignments/);
    assert.match(html,/Retry/);
  }
});
test("booking dropdown survives zero, sole and multiple scoped options",()=>{
  for(const count of [0,1,2]) {
    const items=Array.from({length:count},(_,i)=>({id:`d${i}`,fullName:`Doctor ${i}`,status:"active"}));
    const html=render({...success,data:{items,total:count}},{keepDropdown:true,value:items[0]?.id||""});
    assert.match(html,/role="combobox"/);
    assert.match(html,new RegExp(`data-option-count="${count}"`));
    assert.doesNotMatch(html,/readonly|fixed-scope-doctors/i);
    for(const item of items)assert.ok(html.includes(item.fullName));
  }
});
test("lookup warnings occupy the same grid item as their doctor control",()=>{
  const html=render(success,{keepDropdown:true});
  assert.match(html,/^<div class="resource-lookup-field">/);
  assert.match(html,/<button[^>]*role="combobox".*<\/button><p role="status">No active assigned doctors at this location\.<\/p><\/div>$/);
  assert.doesNotMatch(render(success,{keepDropdown:true,disabled:true}),/No active assigned/);
});
test("booking loading, failed reads and disabled children do not turn dropdowns into text inputs",()=>{
  for(const state of [
    {...success,isPending:true,isSuccess:false,isFetching:true,data:undefined},
    {...success,isSuccess:false,isError:true,error:Error("offline")},
    {...success,isFetching:true},
  ]) {
    const html=render(state,{keepDropdown:true});
    assert.match(html,/role="combobox"/);
    assert.doesNotMatch(html,/readonly|No active assigned doctors/i);
  }
  assert.match(render(success,{keepDropdown:true,disabled:true}),/disabled/);
});
test("explicit doctor/QR restrictions remain read-only even in dropdown-preserving booking",()=>{
  const html=render(success,{keepDropdown:true,fixed:true});
  assert.match(html,/readonly/i);
  assert.doesNotMatch(html,/role="combobox"/);
});
