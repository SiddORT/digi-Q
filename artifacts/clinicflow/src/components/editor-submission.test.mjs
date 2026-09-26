import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { beginEditorSubmission } from "./editor-submission.ts";

test("conflicting review followed by an unused-day edit can be reviewed repeatedly without busy toggling", () => {
  const latch = { current: false };
  const staged = [];
  const review = hours => {
    if (beginEditorSubmission(latch, false, true)) staged.push(hours);
  };
  review(["Monday changed (booked)"]);
  // Preview conflict does not start a mutation; editing then clears pending review.
  review(["Monday unchanged", "Wednesday 09:00–17:00"]);
  review(["Monday unchanged", "Wednesday 10:00–17:00"]);
  assert.equal(staged.length, 3);
  assert.equal(latch.current, false);
});

test("actual save still prevents duplicate submissions until busy cycle resets it", () => {
  const latch = { current: false };
  assert.equal(beginEditorSubmission(latch, false, false), true);
  assert.equal(beginEditorSubmission(latch, false, false), false);
  latch.current = false;
  assert.equal(beginEditorSubmission(latch, true, true), false);
  assert.equal(beginEditorSubmission(latch, true, false), false);
  assert.equal(beginEditorSubmission(latch, false, false), true);
});

test("branch hours and linked controls are children of the one validating Editor form", () => {
  const settings = readFileSync(new URL("./ClinicSettings.tsx", import.meta.url), "utf8");
  const branch = settings.slice(settings.indexOf("function BranchSettings"), settings.indexOf("export function OpeningHoursEditor"));
  assert.match(branch, /<Editor[^\n]*submitLabel="Review changes" reviewOnly/);
  assert.ok(branch.indexOf("<Editor") < branch.indexOf("<OpeningHoursEditor"));
  assert.ok(branch.indexOf("<LinkedScheduleControls") < branch.indexOf("</Editor>"));
  assert.match(branch, /onInvalidCapture/);
  assert.match(branch, /HTMLDetailsElement/);
  const editor = readFileSync(new URL("../resources.tsx", import.meta.url), "utf8");
  assert.match(editor, /beginEditorSubmission\(submitting,busy,reviewOnly\)/);
  assert.match(editor, /<form[\s\S]*?\{children\}[\s\S]*?<\/form>/);
});