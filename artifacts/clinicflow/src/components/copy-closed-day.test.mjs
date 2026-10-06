import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { readFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const read = p => readFileSync(new URL(p, import.meta.url), "utf8");
const out = name => new URL(`../../.${name}-test-${process.pid}.mjs`, import.meta.url);
let H, W;
before(async () => {
  for (const [entry, name] of [["./ClinicRegistrationHours.tsx", "crh"], ["./schedule/week-plan.ts", "wp"]])
    await build({ entryPoints: [fileURLToPath(new URL(entry, import.meta.url))], outfile: fileURLToPath(out(name)), bundle: true, platform: "node", format: "esm", packages: "external", jsx: "automatic", loader: { ".css": "empty" } });
  H = await import(out("crh").href); W = await import(out("wp").href);
});
after(async () => { for (const n of ["crh", "wp"]) await unlink(out(n)).catch(() => {}); });

test("registration hours: closed rows keep an enabled expand control and no session editor", () => {
  const week = H.newWeek().map(d => d.dayOfWeek === 1 ? { ...d, isOpen: true, sessions: [{ startTime: "09:00", endTime: "17:00" }] } : d);
  const html = renderToStaticMarkup(createElement(H.ClinicRegistrationHours, { value: week, onChange() {} }));
  const sunday = html.match(/<button[^>]*data-testid="button-hours-expand-0"[^>]*>/)[0];
  assert.doesNotMatch(sunday, /disabled/, "closed day can be expanded to reach Copy");
  const src = read("./ClinicRegistrationHours.tsx");
  assert.match(src, /const isExpanded = expanded\.includes\(day\.dayOfWeek\) \|\| !!error;/);
  assert.match(src, /\{day\.isOpen && <div className="registration-sessions">/, "sessions stay hidden for closed days");
  assert.match(src, /Copy \{days\[day\.dayOfWeek\]\} hours/);
  assert.match(src, /day\.isOpen \? "opening hours" : "closed status"/, "closed-status copy message retained");
});

test("weekly schedule: closed rows expand to Copy without enabling sessions", () => {
  const src = read("./schedule/WeeklyScheduleEditor.tsx");
  assert.match(src, /const isExpanded = expandedDays\.includes\(dayIndex\) \|\| errs\.length > 0;/);
  assert.match(src, /disabled=\{errs\.length > 0\} onClick/);
  assert.doesNotMatch(src, /disabled=\{!day\.isOpen \|\| errs\.length > 0\}/);
  assert.match(src, /\{day\.isOpen && <div className="registration-sessions">/);
  assert.match(src, /<summary>Copy \{DAYS\[dayIndex\]\}<\/summary>/);
});

test("copying a closed day closes targets and keeps clinic-linked sessions", () => {
  const week = W.buildWeek([]).map(d => d.dayOfWeek === 2 ? { ...d, isOpen: true, sessions: [{ key: "a", startTime: "09:00", endTime: "12:00" }] }
    : d.dayOfWeek === 3 ? { ...d, isOpen: true, sessions: [{ key: "l", startTime: "08:00", endTime: "10:00", locked: true }, { key: "b", startTime: "11:00", endTime: "12:00" }] } : d);
  const next = W.copyDay(week, 0, [2, 3]);
  assert.deepEqual([next[2].isOpen, next[2].sessions], [false, []]);
  assert.equal(next[3].isOpen, true); assert.deepEqual(next[3].sessions.map(s => s.key), ["l"]);
});
