import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { decideCloseRequest } from "./app-dialog-close.ts";

test("busy blocks every close request", () => {
  assert.equal(decideCloseRequest({ busy: true, dirty: true, confirming: false }), "block");
  assert.equal(decideCloseRequest({ busy: true, dirty: false, confirming: true }), "block");
});

test("dirty asks once; repeat requests while confirming are ignored", () => {
  assert.equal(decideCloseRequest({ busy: false, dirty: true, confirming: false }), "confirm");
  assert.equal(decideCloseRequest({ busy: false, dirty: true, confirming: true }), "ignore");
});

test("clean closes immediately", () => {
  assert.equal(decideCloseRequest({ busy: false, dirty: false, confirming: false }), "close");
});

test("controlled drawers restore the connected opener without a Radix trigger", () => {
  const src = readFileSync(new URL("./AppDialog.tsx", import.meta.url), "utf8");
  assert.ok(src.includes("onOpenAutoFocus"));
  assert.ok(src.includes("onCloseAutoFocus"));
  assert.ok(src.includes("opener?.isConnected"));
  assert.ok(src.includes("opener.focus({ preventScroll: true })"));
});

test("AppDialog no longer uses window.confirm and exposes accessible discard dialog", () => {
  const src = readFileSync(new URL("./AppDialog.tsx", import.meta.url), "utf8");
  assert.ok(!src.includes("window.confirm"));
  assert.ok(src.includes('role="alertdialog"'));
  assert.ok(src.includes("Keep editing"));
  assert.ok(src.includes("Saving in progress"));
});
