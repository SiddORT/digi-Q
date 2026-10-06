import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
const bundle = new URL(`../../.date-format-input-test-${process.pid}.mjs`, import.meta.url);
let controls;
before(async () => {
  await build({
    entryPoints: [fileURLToPath(new URL("./DateFormatInput.tsx", import.meta.url))],
    outfile: fileURLToPath(bundle), bundle: true, platform: "node", format: "esm",
    packages: "external", jsx: "automatic",
  });
  controls = await import(bundle.href);
});
after(async () => { await unlink(bundle).catch(() => {}); await unlink(new URL(bundle.href.replace(/\.mjs$/, ".css"))).catch(() => {}); });

test("date and time inputs preserve external invalid state and error descriptions", () => {
  for (const [name, value] of [["DateFormatInput", "2026-09-30"], ["TimeFormatInput", "09:00"]]) {
    for (const invalid of [true, "true", "grammar"]) {
      const html = renderToStaticMarkup(createElement(controls[name], {
        value, onChange() {}, "aria-invalid": invalid, "aria-describedby": "external-error hint",
      }));
      assert.ok(html.includes(`aria-invalid="${invalid}"`));
      assert.ok(html.includes('aria-describedby="external-error hint"'));
    }
  }
});
test("internal parser errors override external false and append their linked description", () => {
  for (const name of ["DateFormatInput", "TimeFormatInput"]) {
    const html = renderToStaticMarkup(createElement(controls[name], {
      value: "invalid", onChange() {}, "aria-invalid": false, "aria-describedby": "external-error",
    }));
    assert.ok(html.includes('aria-invalid="true"'));
    const descriptions = /aria-describedby="([^"]+)"/.exec(html)[1].split(" ");
    assert.equal(descriptions[0], "external-error");
    assert.equal(descriptions.length, 2);
    assert.ok(html.includes(`id="${descriptions[1]}"`));
  }
});test("date and time inputs render a picker trigger beside validated typing", () => {
  for (const [name, label] of [["DateFormatInput", "Open calendar"], ["TimeFormatInput", "Open time list"]]) {
    const html = renderToStaticMarkup(createElement(controls[name], { value: "", onChange() {}, "data-testid": "input-x" }));
    assert.ok(html.includes(`aria-label="${label}"`), name);
    assert.ok(html.includes('data-testid="input-x-picker"'), name);
    assert.ok(html.includes('type="text"'), name);
  }
});
test("required, malformed, impossible and out-of-range values set an inline error and invalid state", () => {
  const render = (name, props) => renderToStaticMarkup(createElement(controls[name], { onChange() {}, ...props }));
  assert.match(render("DateFormatInput", { value: "", required: true }), /role="alert"[^>]*>This field is required\./);
  // A min bound beyond the value is shown with an on-or-after message in the configured format.
  assert.match(render("DateFormatInput", { value: "2026-09-01", min: "2026-09-10", preferences: { dateFormat: "YYYY-MM-DD" } }), /on or after 2026-09-10/);
  assert.match(render("DateFormatInput", { value: "2026-09-30", max: "2026-09-10", preferences: { dateFormat: "YYYY-MM-DD" } }), /on or before 2026-09-10/);
  assert.match(render("TimeFormatInput", { value: "08:59", min: "09:00", preferences: { timeFormat: "24h" } }), /on or after 09:00/);
  assert.doesNotMatch(render("TimeFormatInput", { value: "09:07", min: "09:00", preferences: { timeFormat: "24h" } }), /role="alert"/, "exact minute inside bounds is valid");
  assert.doesNotMatch(render("DateFormatInput", { value: "2028-02-29", preferences: { dateFormat: "YYYY-MM-DD" } }), /role="alert"/, "leap day is valid");
});
test("Escape on any focus within the field (input, trigger, portaled panel) closes only the picker", async () => {
  const src = (await import("node:fs")).readFileSync(new URL("./DateFormatInput.tsx", import.meta.url), "utf8");
  assert.match(src, /data-dtp-open=\{open \|\| undefined\}[^>]*onKeyDown=\{e => \{ if \(e\.key === "Escape" && open\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); close\(\); \} \}\}/);
});
