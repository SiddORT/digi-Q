import assert from "node:assert/strict";
import test from "node:test";
import { emptyFieldValue, scheduleBreakFields, selectInputValue } from "./editor-input.ts";

test("stored numeric weekdays match string options, including Sunday zero", () => {
  for (let day = 0; day < 7; day++) assert.equal(selectInputValue(day), String(day));
  assert.equal(selectInputValue("active"), "active");
  assert.equal(selectInputValue(null), "");
  assert.equal(selectInputValue(undefined), "");
});

test("clearing schedule breaks sends explicit nulls instead of retaining old breaks", () => {
  const body = Object.assign({}, ...scheduleBreakFields.map(field => emptyFieldValue(field, "")));
  assert.deepEqual(body, { breakStart: null, breakEnd: null });
  assert.deepEqual(emptyFieldValue({ key: "timezone" }, ""), {});
  assert.deepEqual(emptyFieldValue(scheduleBreakFields[0], "12:00"), {});
});

test("clearing nullable exception overrides restores inherited times and capacity", () => {
  for (const key of ["startTime", "endTime", "maxTokens"]) {
    assert.deepEqual(emptyFieldValue({ key, nullable: true }, ""), { [key]: null });
  }
});