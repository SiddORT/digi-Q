import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { templateTestRequestError } from "./template-test-request-error.ts";

test("local throttling shows safe wait time, not a provider rejection", () => {
  const result = templateTestRequestError({status:429,data:{code:"RATE_LIMITED",error:"Too many attempts. Try again in 121 seconds."}});
  assert.match(result.title,/couldn’t complete the test/);
  assert.doesNotMatch(result.title,/HTTP/);
  assert.match(result.detail,/three attempts per 15 minutes/);
  assert.match(result.detail,/Wait about 3 minutes/);
  assert.match(result.detail,/Nothing was sent by this attempt/);
  assert.match(result.detail,/retry the same request/);
  assert.doesNotMatch(result.detail,/provider rejected/i);
});
test("untrusted response bodies never reach the display", () => {
  for (const status of [undefined,400,401,403,409,422,429,500,502]) {
    const result = templateTestRequestError({status,data:{code:"RATE_LIMITED",error:"Bearer secret contact message"},message:"Bearer secret"});
    assert.doesNotMatch(JSON.stringify(result),/Bearer|secret|contact message/);
  }
});
test("preview failures never imply a send or offer same-request dispatch", () => {
  for (const status of [undefined,429,500]) {
    const result = templateTestRequestError({status},"preview");
    assert.match(result.title,/couldn’t load the preview/);
    assert.match(result.detail,/Nothing was sent/);
    assert.doesNotMatch(result.detail,/three attempts|retry the same request/i);
  }
});
test("uncertain errors keep original-request duplicate protection", () => {
  assert.match(templateTestRequestError({status:500}).detail,/Do not start a new test/);
  const source=readFileSync(new URL("../components/EventTemplateTest.tsx",import.meta.url),"utf8");
  const retry=source.slice(source.indexOf("const retry ="),source.indexOf("const startNewTest ="));
  assert.match(retry,/submitted\.current/);
  assert.doesNotMatch(retry,/newRequestId|setInterval|setTimeout/);
  assert.match(source,/test\.isSuccess \|\| test\.isError/);
  assert.match(source,/className="error-box et-test-request-error"/);
  const css=readFileSync(new URL("../components/email-templates.css",import.meta.url),"utf8");
  assert.match(css,/\.et-test \.et-test-request-error\{display:block/);
  assert.match(css,/\.et-test-request-error>button\{[^}]*max-width:100%/);
});
