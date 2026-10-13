import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { canStartNewTemplateTest } from "./template-test-recovery.ts";

test("a fresh test is offered only after a definite pre-dispatch failure",()=>{
  assert.equal(canStartNewTemplateTest("pre_dispatch_failed"),true);
  for(const status of [undefined,"preview","provider_accepted","provider_rejected","delivery_unknown","sending"])
    assert.equal(canStartNewTemplateTest(status),false);
});
test("starting a fresh test does not send, retains typed input and requires renewed confirmation",()=>{
  const source=readFileSync(new URL("../components/EventTemplateTest.tsx",import.meta.url),"utf8");
  const action=source.slice(source.indexOf("const startNewTest ="),source.indexOf("return <section"));
  assert.match(action,/!canStartNewTemplateTest\(test\.data\?\.status\)/);
  assert.match(action,/requestId\.current = newRequestId\(\)/);
  assert.match(action,/submitted\.current = null/);
  assert.match(action,/test\.reset\(\); preview\.reset\(\); setConfirmed\(false\)/);
  assert.doesNotMatch(action,/\.mutate|setValues|setTo/);
  assert.match(source,/canStartNewTemplateTest\(test\.data\?\.status\) && <p/);
});
