import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=path=>readFileSync(new URL(path,import.meta.url),"utf8");
test("new patient editor receives verified workspace IDs; existing registration is immutable for ordinary staff",()=>{
  const ui=source("../resources.tsx");
  assert.match(ui,/pinDefaults:Record<string,string>=branchPin\?\{branchId:branchPin\.branchId,clinicId:branchPin\.clinicId\}/);
  assert.match(ui,/defaults=\{\.\.\.defaults,\.\.\.pinDefaults,/,"not only list filtering: Add Patient receives context");
  assert.match(ui,/immutablePatient=resourceName==="patients"&&!!initial\?\.id&&me\.data\?\.user\?\.role!=="superAdmin"/);
  assert.match(ui,/resourceName==="patients"&&initial\.id&&identity\.data\?\.user\?\.role!=="superAdmin"&&\["clinicId","branchId"\]\.includes\(field\.key\)\)return/);
});
test("operational sole cardinality is independent of search and fixed information is readable/nonclearable",()=>{
  const ui=source("./ResourceLookup.tsx");
  const shared=source("../lib/use-directory.ts");
  assert.match(ui,/useDirectoryCardinality\(resource, params,/);
  assert.match(shared,/scope = directoryScope\(params\)/);
  assert.match(shared,/\.\.\.scope, page: 1, pageSize: 20/);
  assert.match(ui,/if \(!value && sole && !scope\.isFetching\) onChange/);
  assert.match(ui,/<input id=\{props\.id\} aria-label=\{props\.label\} readOnly/);
  assert.match(ui,/Your selection has been retained/);
  assert.match(ui,/Selected assignments were only partially loaded/);
});
test("optional QR scope remains optional; schedule creation does not depend on availability sessions",()=>{
  const ui=source("../resources.tsx");
  assert.match(ui,/autoSole:operational&&!immutablePatient&&\(field\.required\|\|resourceName==="patients"\)/);
  const relation=ui.slice(ui.indexOf("function RelationInput"),ui.indexOf("const EDITOR_GROUPS"));
  assert.doesNotMatch(relation,/useDailySession|availability\.data/);
});
test("persisted context has a 60-second active refresh path without resetting mounted forms",()=>{
  const ui=source("../auth/AuthAccess.tsx");
  assert.match(ui,/setInterval\(\(\)=>void refreshSignedInContext\(client,true\),DIRECTORY_FRESH_MS\)/);
  assert.match(source("../lib/directory-cache.ts"),/DIRECTORY_FRESH_MS = 60_000/);
  assert.match(ui,/addEventListener\("focus",update\)/);
  assert.match(ui,/\[isSignedIn,location,client\]/);
  assert.doesNotMatch(ui,/form\.reset/);
});
test("reused directory labels do not treat ordinary missing saved records as proof of inaccessibility",()=>{
  const ui=source("./ResourceLookup.tsx");
  assert.match(ui,/if \(params\.doctorId && \["clinics", "branches"\]\.includes\(resource\)\) return found/);
  assert.match(ui,/unfound\.map\(id => directoryDetail/);
});
test("live profile refresh keeps unsaved fields; a successful response makes submitted fields clean",()=>{
  const editor=source("../resources.tsx"),profile=source("../clinic.tsx");
  assert.match(editor,/const dirtyFields=form\.formState\.dirtyFields/);
  assert.match(editor,/keepDirtyValues:keepDraft,keepErrors:keepDraft,keepTouched:keepDraft/);
  assert.match(editor,/const keepDraft=synchronized\.current\.revision===savedRevision/);
  assert.match(profile,/const liveEditorProps=\{refreshInitial:true,savedRevision\}/);
  assert.match(profile,/<Editor \{\.\.\.liveEditorProps\}/);
  assert.match(profile,/client\.setQueryData\(api\.getGetDoctorQueryKey\(identity\.doctorId\),saved\)/);
});
