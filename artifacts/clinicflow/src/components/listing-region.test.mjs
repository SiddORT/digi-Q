import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderPagination, renderFilterBar } from "./listing-controls-render.mjs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");

test("zero and unavailable results retain a truthful disabled footer",()=>{
  for(const state of ["ready","loading","error"]){
    const html=renderPagination({state});
    assert.match(html,/aria-label="Pagination"/);
    assert.match(html,state==="ready"?/0–0/:state==="loading"?/Loading results/:/Results unavailable/);
    assert.doesNotMatch(html,/1–0/);
    for(const match of html.matchAll(/<button([^>]+)>/g))assert.match(match[1],/disabled=""/);
  }
  assert.match(renderPagination({total:22,page:2}),/21–22/);
});
test("header flags cannot select a different layout",()=>{
  const props={title:"Patients",children:"Search",actions:"Add"};
  assert.equal(renderFilterBar({...props,compactToolbar:true}),renderFilterBar({...props,compactToolbar:false}));
});
test("all numbered and cursor consumer families use panel-local geometry",()=>{
  for(const path of ["../resources.tsx","../Users.tsx","../clinic.tsx","./SystemUsers.tsx","./queue/SessionQueue.tsx","./queue/GuestRequests.tsx","./reports/ReportsDashboard.tsx","./NotificationLogs.tsx","./CommunicationUsage.tsx","./PublicClinicPage.tsx"]){
    assert.match(read(path),/<ListingRegion/,path);
  }
  const css=read("./listing-region.css");
  assert.match(css,/margin-block-start:auto/);
  assert.doesNotMatch(css,/position:(fixed|sticky)|max-height/);
  assert.doesNotMatch(read("../index.css"),/\.table-panel \.table-scroll \{ max-height: min/);
});
