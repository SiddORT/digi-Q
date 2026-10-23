/**
 * Paired rendered evidence for behavior-preserving CSS retirements.
 * Start workspace-regression/vite.config.ts, then run with record / compare.
 * Uses fictional controls only; no authenticated identity or live writes.
 * Baselines deliberately live outside Git: record BEFORE editing the CSS.
 */
import { chromium } from "@playwright/test";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";

const phase = process.argv[2];
assert(["record", "compare"].includes(phase), "Use record or compare");
const dir = "generated-artifacts/control-cascade";
await mkdir(dir, { recursive: true });
const browser = await chromium.launch({
  executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"],
});
const properties = [
  "display", "position", "box-sizing", "width", "height", "min-width", "max-width",
  "min-height", "max-height", "padding", "margin", "gap", "flex", "line-height",
  "font-size", "font-weight", "color", "background-color", "border", "border-radius",
  "outline", "outline-offset", "box-shadow", "opacity", "transform", "overflow",
  "vertical-align", "accent-color", "pointer-events", "cursor",
];
const contexts = ["", "workspace", "app-dialog", "auth-card", "registration-card",
  "workspace filter-bar", "workspace list-header", "workspace form-grid",
  "workspace editor-container"];
const controls = `
  <input placeholder="No type"><input type="text" value="Fictional text">
  <input type="email" value="fictional@example.invalid"><input type="password" value="Fictional">
  <input type="number" value="20"><input type="tel" value="1234567890">
  <input type="url" value="https://example.invalid"><input type="search" value="Fictional search">
  <input type="date" value="2026-10-23"><input type="time" value="09:30">
  <input type="datetime-local" value="2026-10-23T09:30">
  <input type="checkbox"><input type="radio"><input type="file">
  <input type="range"><input type="color"><input type="hidden">
  <select><option>Fictional long selection</option></select>
  <select multiple><option selected>Fictional multiline selection</option><option>Second</option></select>
  <textarea>Fictional multiline notes</textarea>
  <button>Ordinary</button><button class="button">Primary</button>
  <button class="button small">Compact</button>
  <button class="searchable-select-control">Searchable selection</button>
  <button class="dq-select-trigger">Select</button>
  <button class="dq-switch" data-state="unchecked" role="switch" aria-checked="false"><span></span></button>
  <button class="dq-checkbox" role="checkbox" aria-checked="false"></button>
  <button class="dq-radio" role="radio" aria-checked="false"></button>
  <button class="icon-action">Icon</button>
  <label class="status-switch"><input type="checkbox"><span class="status-switch-track"></span></label>
  <label class="day-open-switch"><input type="checkbox"></label>
  <div class="check-row"><input type="checkbox"></div>
  <div class="workspace-search"><input type="search"></div>
  <div class="workspace-command"><div class="ws-input"><input placeholder="Command"></div></div>
  <div class="password-input"><input type="password"><button class="password-toggle">Show</button></div>
  <p class="form-field-help">Fictional help</p><p class="form-field-error">Fictional error</p>`;
const results = {};
try {
  for (const [width, height, touch] of [
    [390, 844, false], [768, 900, false], [1024, 640, false],
    [1366, 768, false], [1920, 1080, false], [1024, 640, true],
  ]) {
    const context = await browser.newContext({
      viewport: { width, height }, hasTouch: touch, reducedMotion: "reduce",
    });
    const page = await context.newPage();
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      assert.equal(route.request().method(), "GET", `Unexpected fixture write: ${path}`);
      if (path === "/api/auth/status") return route.fulfill({ json: { authenticated: false } });
      if (path === "/api/workspaces") return route.fulfill({ json: { workspaces: [], switchable: false, activeClinicId: null } });
      if (path === "/api/me") return route.fulfill({ json: { user: { id: "fictional-compact", role: "superAdmin", fullName: "Fictional" }, needsOnboarding: false } });
      if (/geography|masters|pincode/.test(path)) return route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20, available: false } });
      throw Error(`Missing fixture contract: ${path}`);
    });
    await page.goto("http://127.0.0.1:43720/?mode=compact-ui");
    await page.getByRole("heading", { name: "Compact UI fixture" }).waitFor();
    await page.evaluate(() => document.fonts.ready);
    // No transition sampling noise; do not change final geometry or colours.
    await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
    const key = `${width}x${height}${touch ? "-touch" : ""}`;
    results[key] = {};
    async function capture(name, selector = ".workspace") {
      await page.mouse.move(0, 0);
      await page.evaluate(() => window.scrollTo(0, 0));
      results[key][name] = await page.locator(selector).evaluateAll((roots, properties) => {
        const nodes = [...new Set(roots.flatMap(root => [root, ...root.querySelectorAll("*")]))];
        return nodes.map(el => {
          const rect = el.getBoundingClientRect();
          const style = pseudo => {
            const css = getComputedStyle(el, pseudo);
            return Object.fromEntries(properties.map(p => [p, css.getPropertyValue(p)]));
          };
          return {
            tag: el.tagName, class: el.className,
            box: [rect.x, rect.y, rect.width, rect.height].map(n => Math.round(n * 1000) / 1000),
            style: style(null), before: style("::before"), after: style("::after"),
          };
        });
      }, properties);
    }
    await capture("initial");
    await page.screenshot({ path: `${dir}/${phase}-${key}.png` });
    await page.getByTestId("compact-switch").click();
    await page.getByRole("button", { name: "Toggle errors", exact: true }).click();
    await page.getByTestId("text-field").focus();
    await capture("checked-invalid-focus");
    await page.getByRole("button", { name: "Toggle disabled", exact: true }).click();
    await capture("disabled");
    await page.getByRole("button", { name: "Toggle disabled", exact: true }).click();
    await page.getByRole("button", { name: "Toggle readonly", exact: true }).click();
    await capture("readonly");
    for (const kind of ["dialog", "drawer"]) {
      await page.getByRole("button", { name: `Open ${kind}`, exact: true }).click();
      await page.getByRole("dialog").waitFor();
      await page.waitForTimeout(250);
      await capture(kind, '[role="dialog"]');
      await page.screenshot({ path: `${dir}/${phase}-${key}-${kind}.png` });
      await page.keyboard.press("Escape");
    }
    // Include native excluded families and legacy ancestry, not just React's
    // happy-path primitives. Append outside the live fixture's layout.
    await page.evaluate(({ contexts, controls }) => {
      const host = document.createElement("section");
      host.id = "cascade-probes";
      for (const className of contexts) {
        const root = document.createElement("section");
        root.className = className;
        root.style.cssText = "position:relative;width:100%;max-height:none;overflow:visible";
        root.innerHTML = controls;
        host.append(root);
      }
      document.body.append(host);
    }, { contexts, controls });
    await capture("native", "#cascade-probes");
    await page.evaluate(() => {
      document.querySelectorAll("#cascade-probes input,#cascade-probes select,#cascade-probes textarea,#cascade-probes button").forEach(el => {
        el.setAttribute("aria-invalid", "true");
        if (el.matches('input[type=checkbox],input[type=radio]')) el.checked = true;
        if (el.matches(".dq-switch")) { el.dataset.state = "checked"; el.setAttribute("aria-checked", "true"); }
      });
    });
    await capture("native-invalid-checked", "#cascade-probes");
    await page.evaluate(() => {
      document.querySelectorAll("#cascade-probes input,#cascade-probes select,#cascade-probes textarea,#cascade-probes button").forEach(el => { el.disabled = true; });
    });
    await capture("native-disabled", "#cascade-probes");
    await context.close();
    console.log(`${phase}: ${key} complete`);
  }
  await writeFile(`${dir}/${phase}.json`, JSON.stringify(results));
  if (phase === "compare") {
    const before = JSON.parse(await readFile(`${dir}/record.json`, "utf8"));
    const differences = [];
    function diff(a, b, path = "") {
      if (JSON.stringify(a) === JSON.stringify(b)) return;
      if (a && b && typeof a === "object" && typeof b === "object") {
        for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[key], b[key], `${path}/${key}`);
      } else differences.push({ path, before: a, after: b });
    }
    diff(before, results);
    await writeFile(`${dir}/differences.json`, JSON.stringify(differences, null, 2));
    assert.equal(differences.length, 0, `Rendered changes: ${JSON.stringify(differences.slice(0, 12))}`);
    console.log("Exact rendered parity: all contexts, states, pseudo-elements and six viewport/pointer profiles.");
  }
} finally {
  await browser.close();
}
