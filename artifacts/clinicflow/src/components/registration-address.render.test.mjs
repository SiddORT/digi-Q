// Actual shared wizard rendered in Chromium with fictional input and no external services.
import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";

const { build } = createRequire(import.meta.resolve("vite"))("esbuild");
let server, browser, origin, script;
before(async () => {
  const result = await build({
    stdin: { resolveDir: import.meta.dirname, loader: "tsx", contents: `
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import { ClinicRegistrationWizard } from "./ClinicRegistrationWizard";
      import { ClinicRegistrationComplete } from "./ClinicRegistrationComplete";
      const adminMode = new URLSearchParams(location.search).get("mode") === "admin";
      const initial = { fullName: "Fictional Owner", email: "owner@test.invalid", name: "Fictional Care",
        clinicEmail: "front@test.invalid", phone: "+919876543210",
         branches: [0,1,2].map(index => ({ name: "Fictional Location", slug: index === 2 ? "fictional-location" : "", address: "Fictional Way", city: "",
          timezone: "Asia/Kolkata", email: "", phone: "", inheritEmail: true, inheritPhone: true,
           hours: Array.from({ length: 7 }, (_, dayOfWeek) => ({ dayOfWeek, isOpen: dayOfWeek === 1, sessions: dayOfWeek === 1 ? [{startTime:"09:00",endTime:"12:00"}] : [] })) })) };
      window.checks = []; window.submissions = []; window.lookupFailure = false; window.conflict = false;
      function Harness() {
        const [saved, setSaved] = React.useState(null);
        return saved ? <ClinicRegistrationComplete result={saved}/> : <ClinicRegistrationWizard
          adminMode={adminMode} initial={initial} draftKey={"render-" + (adminMode ? "admin" : "self")}
          categories={[]} specialities={[]} qualifications={[]} busy={false}
          checkSlug={async slug => { window.checks.push(slug); if(window.lookupFailure) throw new Error("Address lookup failed. Try again."); return slug !== "fictional-care"; }}
          onSubmit={async (values, requestId) => {
            window.submissions.push({values, requestId});
            if(window.conflict) throw {status:409,data:{error:"This public URL is already in use"}};
            setSaved({clinic:{id:"fictional-id",name:values.name,slug:values.slug},branches:[]});
          }}/>;
      }
      createRoot(document.getElementById("root")).render(<QueryClientProvider client={new QueryClient()}><Harness/></QueryClientProvider>);
    ` },
    bundle: true, platform: "browser", format: "iife", write: false, jsx: "automatic",
    loader: { ".css": "empty" }, logLevel: "error",
    plugins: [{ name: "standalone-logo", setup(b) {
      b.onResolve({ filter: /^(?:\.\.\/)+App$/ }, () => ({ path: "logo", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: 'export const Logo=()=>"ClinicFlow";' }));
    } }],
  });
  script = result.outputFiles[0].text;
  server = createServer((req, res) => {
    res.setHeader("content-type", req.url === "/bundle.js" ? "text/javascript" : "text/html");
    res.end(req.url === "/bundle.js" ? script : '<div id="root"></div><script src="/bundle.js"></script>');
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
});
after(async () => { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); });

for (const mode of ["admin", "self"]) test(`${mode}: blank native-valid entry advances, persists, reviews and creates with the selected address`, async () => {
  const context = await browser.newContext(), page = await context.newPage();
  try {
    await page.goto(`${origin}/?mode=${mode}`);
    const slug = page.getByTestId("registration-slug");
    await slug.waitFor();
    assert.deepEqual(await slug.evaluate(el => ({ required: el.required, ariaRequired: el.getAttribute("aria-required"), valid: el.checkValidity(), value: el.value })),
      { required: false, ariaRequired: null, valid: true, value: "" });
    assert.match(await page.locator("body").innerText(), /Clinic URL name \(optional\)/);
    assert.equal(await page.getByTestId("registration-name").getAttribute("aria-required"), "true");
    assert.equal(await page.getByRole("button", { name: /Suggest/ }).count(), 0);
    await page.getByTestId("registration-next").click();
    await page.getByRole("heading", { name: "Locations", exact: true }).waitFor();
    assert.deepEqual(await page.evaluate(() => window.checks), ["fictional-care", "fictional-care-2"]);
    await page.reload();
    await page.getByRole("heading", { name: "Locations", exact: true }).waitFor();
    const locationSlug = page.getByTestId("registration-branch-0-slug");
    assert.deepEqual(await locationSlug.evaluate(el => ({ required: el.required, ariaRequired: el.getAttribute("aria-required"), valid: el.checkValidity(), value: el.value })),
      { required: false, ariaRequired: null, valid: true, value: "" });
    assert.equal(await page.getByTestId("registration-branch-0-name").getAttribute("required"), "");
    assert.match(await page.locator("body").innerText(), /Location URL name \(optional\)/);
    await page.getByTestId("registration-next").click();
    await page.getByRole("heading", { name: "Opening hours", exact: true }).waitFor();
    await page.getByTestId("registration-back").click();
    assert.equal(await locationSlug.inputValue(), "fictional-location-2");
    assert.equal(await page.getByTestId("registration-branch-1-slug").inputValue(), "fictional-location-3");
    assert.equal(await page.getByTestId("registration-branch-2-slug").inputValue(), "fictional-location");
    await page.getByTestId("registration-branch-0-name").fill("Renamed Location");
    await page.reload();
    assert.equal(await locationSlug.inputValue(), "fictional-location-2");
    for (let i = 0; i < 4; i++) await page.getByTestId("registration-next").click();
    await page.getByRole("heading", { name: "Review", exact: true }).waitFor();
    const review = await page.locator(".registration-review").innerText();
    for (const slug of ["fictional-location-2", "fictional-location-3", "fictional-location"]) {
      assert.ok(review.includes("https://clinic-flow-new-platform.replit.app/fictional-care-2/" + slug));
    }
    await page.evaluate(() => { window.conflict = true; });
    await page.getByTestId("registration-next").click();
    await page.getByTestId("registration-error").waitFor();
    assert.match(await page.getByTestId("registration-error").innerText(), /Check Clinic identity and Locations/);
    await page.getByRole("heading", { name: "Clinic identity", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.submissions.length), 1);
    await page.evaluate(() => { window.conflict = false; });
    // A definite conflict requires an explicit pass through correction and Review.
    await page.getByTestId("registration-slug").fill("corrected-clinic");
    for (let i = 0; i < 5; i++) await page.getByTestId("registration-next").click();
    await page.getByRole("heading", { name: "Review", exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.submissions.length), 1);
    await page.getByTestId("registration-next").click();
    await page.getByRole("heading", { name: "Fictional Care is registered." }).waitFor();
    assert.equal(await page.getByRole("link", { name: "Check Public Booking Page" }).getAttribute("href"), "/corrected-clinic");
    const submitted = await page.evaluate(() => window.submissions);
    assert.equal(submitted[0].values.slug, "fictional-care-2");
    assert.deepEqual(submitted[0].values.branches.map(b => b.slug), ["fictional-location-2", "fictional-location-3", "fictional-location"]);
    assert.equal(submitted[0].requestId, submitted[1].requestId);
    assert.equal(await page.evaluate(mode => sessionStorage.getItem("render-" + mode), mode), null);
  } finally { await context.close(); }
});

test("rendered lookup failure stays on identity and leaves input blank; custom input is not replaced", async () => {
  const context = await browser.newContext(), page = await context.newPage();
  try {
    await page.goto(`${origin}/?mode=admin`);
    await page.getByTestId("registration-slug").waitFor();
    await page.evaluate(() => { window.lookupFailure = true; });
    await page.getByTestId("registration-next").click();
    await page.getByTestId("registration-error").waitFor();
    assert.equal(await page.getByTestId("registration-slug").inputValue(), "");
    assert.match(await page.getByTestId("registration-error").innerText(), /Address lookup failed/);
    await page.evaluate(() => { window.lookupFailure = false; });
    await page.getByTestId("registration-slug").fill("fictional-care");
    await page.getByTestId("registration-next").click();
    await page.getByTestId("registration-error").filter({ hasText: "This Clinic URL name is unavailable." }).waitFor();
    assert.equal(await page.getByTestId("registration-slug").inputValue(), "fictional-care");
    await page.getByTestId("registration-slug").fill("admin");
    await page.getByTestId("registration-next").click();
    await page.getByTestId("registration-error").filter({ hasText: "reserved" }).waitFor();
  } finally { await context.close(); }
});

for (const mode of ["admin", "self"]) test(`${mode}: whitespace resolves, invalid custom location names do not, and an unresolved restored review cannot create`, async () => {
  const context = await browser.newContext(), page = await context.newPage();
  try {
    await page.goto(`${origin}/?mode=${mode}`);
    await page.getByTestId("registration-slug").fill("  ");
    assert.equal(await page.getByTestId("registration-slug").evaluate(el => el.checkValidity()), true);
    await page.getByTestId("registration-next").click();
    const slug = page.getByTestId("registration-branch-0-slug");
    await slug.waitFor();
    for (const [value, message] of [["ab", "3–63"], ["admin", "reserved"], ["fictional-location", "different Location URL name"]]) {
      await slug.fill(value);
      await page.getByTestId("registration-next").click();
      await page.getByTestId("registration-error").filter({ hasText: message }).waitFor();
      assert.equal(await slug.inputValue(), value);
      assert.equal(await page.evaluate(() => window.submissions.length), 0);
    }
    await slug.fill("  ");
    assert.equal(await slug.evaluate(el => el.checkValidity()), true);
    // Old/incomplete drafts must be corrected at Locations, not submitted from Review.
    await page.evaluate(mode => {
      const key = "render-" + mode, draft = JSON.parse(sessionStorage.getItem(key));
      draft.data.step = 5; sessionStorage.setItem(key, JSON.stringify(draft));
    }, mode);
    await page.reload();
    await page.getByRole("heading", { name: "Review", exact: true }).waitFor();
    await page.getByTestId("registration-next").click();
    await page.getByRole("heading", { name: "Locations", exact: true }).waitFor();
    assert.match(await page.getByTestId("registration-error").innerText(), /generate each Location URL name/);
    assert.equal(await page.evaluate(() => window.submissions.length), 0);
    await page.getByTestId("registration-next").click();
    await page.getByRole("heading", { name: "Opening hours", exact: true }).waitFor();
    await page.getByTestId("registration-back").click();
    assert.equal(await slug.inputValue(), "fictional-location-2");
  } finally { await context.close(); }
});
