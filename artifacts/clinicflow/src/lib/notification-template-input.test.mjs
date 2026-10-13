import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { templateContentForSave } from "./notification-template-input.ts";

const form={enabled:false,subject:"",body:"Dear {{patient_name}}, {{appointment_date}} {{session_start}}. Token {{token_number}}.",
  prefix:"Old prefix",footer:"Old footer",logoUrl:"https://example.invalid/logo.png",
  senderId:"OLD_SENDER",dltEntityId:"OLD_ENTITY",dltTemplateId:" 1700000000000000000 "};
test("SMS save sends the event template ID but uses configured Sender/Entity IDs",()=>{
  assert.deepEqual(templateContentForSave(form,"sms","Booking confirmation"),{
    enabled:false,subject:"Booking confirmation",body:form.body,prefix:"",footer:"",logoUrl:"",dltTemplateId:"1700000000000000000",
  });
  assert.equal(form.senderId,"OLD_SENDER");
});
test("email save never submits retained SMS metadata",()=>{
  const payload=templateContentForSave({...form,subject:"Hello"},"email","Booking");
  assert.deepEqual(payload,{enabled:false,subject:"Hello",body:form.body,prefix:form.prefix,footer:form.footer,logoUrl:form.logoUrl});
});
test("both editors omit the per-template Sender and Entity controls and share the save builder",()=>{
  const editor=readFileSync(new URL("../components/EmailTemplates.tsx",import.meta.url),"utf8");
  assert.match(editor,/templateContentForSave\(form, channel, item\.title\)/);
  assert.equal((editor.match(/content=\{templateContentForSave\(form, channel, item\.title\)\}/g)||[]).length,2,"both draft preview/test panels use the same configured sender as publish");
  const fields=editor.slice(editor.indexOf("const SMS_FIELDS"),editor.indexOf("const MODE_COPY"));
  assert.doesNotMatch(fields,/"senderId"|"dltEntityId"/);
  assert.match(fields,/"dltTemplateId"/);
});
