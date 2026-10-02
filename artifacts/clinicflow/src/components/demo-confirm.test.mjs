import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("./DemoClinicManagement.tsx", import.meta.url), "utf8");

test("demo create/rotate use the in-app ConfirmDialog, never window.confirm", () => {
  assert.ok(!/window\.confirm|\bconfirm\(/.test(src.replace(/confirmDialog|useConfirm|ConfirmDialog/g, "")));
  assert.match(src, /import \{ useConfirm \} from "\.\/ConfirmDialog"/);
  assert.match(src, /\{confirmDialog\.dialog\}/);
});
test("cancel aborts before any request; destructive rotate warning preserved", () => {
  const change = src.slice(src.indexOf("async function change("));
  const askCreate = change.indexOf('action === "create" && !(await confirmDialog.ask(');
  const askRotate = change.indexOf('action === "rotate-password" && !(await confirmDialog.ask(');
  const request = change.indexOf("jsonRequest(");
  assert.ok(askCreate > 0 && askRotate > askCreate && request > askRotate, "confirmations must precede the request");
  assert.ok(src.includes("The previous shared password will stop working."));
  assert.match(change.slice(askRotate, request), /tone: "danger"/);
  assert.ok(src.includes("Create a fictional demo clinic, location, doctor, schedule and staff identity on this environment?"));
});

test("demo action failures use the shared friendly error translator", () => {
  assert.match(src, /import \{ friendlyError \} from "\.\.\/lib\/friendly-error"/);
  assert.ok(src.includes('setError(friendlyError(caught, "generic", "Demo action failed. Try again."))'));
  const change = src.slice(src.indexOf("async function change("));
  assert.ok(!change.slice(0, change.indexOf("finally")).includes("caught.message"));
});
