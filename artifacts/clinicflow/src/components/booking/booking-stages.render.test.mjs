import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { rm } from "node:fs/promises";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const require=createRequire(import.meta.url);
const {build}=createRequire(import.meta.resolve("vite"))("esbuild");
const file=resolve(import.meta.dirname,`.stages-test-${process.pid}.cjs`);
await build({entryPoints:[resolve(import.meta.dirname,"StagedBooking.tsx")],outfile:file,bundle:true,platform:"node",format:"cjs",jsx:"automatic",external:["react","react-dom"]});
const {StagedBooking}=require(file);
after(()=>rm(file,{force:true}));
function render(step){
  return renderToStaticMarkup(React.createElement(StagedBooking,{
    step,visit:React.createElement("h2",null,"Choose a visit"),patient:React.createElement("input",{name:"contact",defaultValue:"fictional"}),
    finalAction:React.createElement("button",{type:"submit"},"Book Appointment"),
  }));
}
test("shared progression has two input stages and ticket, with no confirmation section",()=>{
  const html=render(1);
  assert.match(html,/Visit details.*Patient details.*Ticket/);
  assert.doesNotMatch(html,/Confirmation|stage-confirmation|Book Appointment/);
  assert.match(html,/hidden="" aria-label="Patient details"/);
});
test("only final input stage exposes the explicit booking action",()=>{
  const html=render(2);
  assert.match(html,/<section aria-label="Patient details"[^>]*>.*Book Appointment<\/button><\/section>/);
  assert.match(html,/hidden="" aria-label="Visit details"/);
  assert.doesNotMatch(html,/stage-confirmation/);
});
