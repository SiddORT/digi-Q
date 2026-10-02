// Component rendering only: no browser, API requests, catalog writes or SMTP.
import {test,after} from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdtemp,rm} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";

// Reuse Vite's existing esbuild dependency; no test-only installation.
const require=createRequire(import.meta.url);
const {build}=await import(require.resolve("esbuild",{paths:[require.resolve("vite")]}));
const dir=await mkdtemp(join(tmpdir(),"digiq-suggestions-"));
await build({
  stdin:{contents:'export {SuggestionInput} from "./SuggestionInput"; export {renderToStaticMarkup} from "react-dom/server"; export {createElement} from "react";',resolveDir:import.meta.dirname},
  outfile:join(dir,"component.cjs"),bundle:true,platform:"node",format:"cjs",jsx:"automatic",
  plugins:[{name:"static-control-shell",setup(b){
    b.onResolve({filter:/^@\/lib\/utils$/},()=>({path:"utils",namespace:"fixture"}));
    b.onResolve({filter:/^@\/components\/ui\/popover$/},()=>({path:"popover",namespace:"fixture"}));
    b.onLoad({filter:/.*/,namespace:"fixture"},a=>({contents:a.path==="utils"
      ? 'export const cn=(...values)=>values.filter(Boolean).join(" ");'
      : 'export const Popover=({children})=>children; export const PopoverAnchor=({children})=>children; export const PopoverContent=({children})=>children;'}));
  }}],
});
const {default:{SuggestionInput,renderToStaticMarkup,createElement}}=await import(join(dir,"component.cjs"));
after(()=>rm(dir,{recursive:true,force:true}));
const render=props=>renderToStaticMarkup(createElement(SuggestionInput,{value:"Typed address",onChange(){},placeholder:"City",options:[],...props}));

test("local-master empty, search-empty and failure states keep manual text and expose retry",()=>{
  const empty=render({emptyMessage:"No active city values in the local catalog. Enter your own text."});
  assert.match(empty,/No active city values/);
  assert.match(empty,/value="Typed address"/);
  const unmatched=render({emptyMessage:"No matching active city values in the local catalog. Enter your own text."});
  assert.match(unmatched,/No matching active city values/);
  const failed=render({error:"Unable to load city suggestions. You can still enter city manually.",onRetry(){}});
  assert.match(failed,/role="alert"/);
  assert.match(failed,/Retry/);
  assert.match(failed,/Suggestions are unavailable/);
  assert.doesNotMatch(failed,/No matching suggestions/);
  assert.match(failed,/value="Typed address"/);
});
test("loading and populated suggestion responses render distinct accessible states",()=>{
  assert.match(render({loading:true}),/Loading suggestions/);
  const populated=render({options:["Catalog city"]});
  assert.match(populated,/role="option"/);
  assert.match(populated,/Catalog city/);
  assert.doesNotMatch(populated,/No matching suggestions/);
});