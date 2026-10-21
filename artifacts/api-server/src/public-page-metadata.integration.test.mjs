// Disposable public HTML server + real public projection SQL. Only fictional
// records; no live DB, auth session, delivery, screenshots, traces or QR payloads.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { chromium } from "@playwright/test";

const root = resolve(import.meta.dirname, "../../..");
const origin = "https://clinic.example.invalid";
const secret = "PRIVATE-PATIENT-TICKET-QR-OWNER-SENTINEL";
const template = await readFile(resolve(root, "artifacts/clinicflow/index.html"), "utf8");
const frontend = resolve(root, "artifacts/clinicflow/dist/public");
let pg, api, server, base;
const queries = [];
before(async () => {
  pg = new PGlite();
  // Match the production projection's exact table/JSON contract. Authorization
  // tests own the broader relational constraints; these tests own public reads.
  await pg.exec(`create table clinics(id text primary key,status text,data jsonb);
    create table branches(id text primary key,clinic_id text,status text,data jsonb);`);
  for (const [id, status, name, slug] of [
    ["c1", "active", "Fictional Cedar Care", "fictional-cedar"],
    ["c2", "active", "Fictional Maple Care", "fictional-maple"],
    ["ci", "inactive", "PRIVATE inactive clinic", "inactive-clinic"],
  ]) await pg.query("insert into clinics values($1,$2,$3)", [id, status, { name, slug, address: "Fictional Clinic Road", email: secret, ownerNotes: secret, qrReference: secret }]);
  for (const [id, clinic, status, name, slug] of [
    ["b1", "c1", "active", "Fictional East", "east-location"],
    ["b2", "c1", "active", "Fictional West", "west-location"],
    ["bi", "c1", "inactive", "PRIVATE inactive branch", "inactive-location"],
    ["bc", "ci", "active", "PRIVATE inactive parent", "parent-location"],
    ["bm", "c2", "active", "Fictional Maple", "maple-location"],
  ]) await pg.query("insert into branches values($1,$2,$3,$4)", [id, clinic, status, { name, slug, address: "Fictional Location Road", city: "Fictional City", qrReference: secret, patient: secret }]);
  globalThis.__publicPageDb = drizzle(pg, { logger: { logQuery(query) { queries.push(query); } } });
  globalThis.__publicPageOrigin = origin;
  const compiled = await build({
    stdin: { resolveDir: root, contents: `
      export * from "./lib/public-pages/src/index";
      export * from "./lib/public-pages/src/server";
      export * from "./lib/api-zod/src/public-page";
    ` },
    write: false, bundle: true, platform: "node", format: "cjs", external: ["express"],
    define: { "process.env.CLINICFLOW_PUBLIC_ORIGIN": "globalThis.__publicPageOrigin" },
    plugins: [{ name: "disposable-public-db", setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const db = globalThis.__publicPageDb;" }));
    } }],
  });
  const mod = { exports: {} };
  new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), mod, mod.exports);
  api = mod.exports;
  // Actual production server implementation, with a disposable SQL dependency.
  server = api.createPublicApp(frontend).listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await pg?.close();
  delete globalThis.__publicPageDb;
  delete globalThis.__publicPageOrigin;
});

function count(html, pattern) { return [...html.matchAll(pattern)].length; }
function assertHead(html, { title, index = false, canonical } = {}) {
  assert.equal(count(html, /<title\b/gi), 1);
  if (title) assert(html.includes(`<title>${title}</title>`));
  for (const [attr, key] of [["name", "description"], ["name", "robots"],
    ["property", "og:title"], ["property", "og:description"], ["name", "twitter:title"], ["name", "twitter:description"]]) {
    assert.equal(count(html, new RegExp(`<meta ${attr}="${key}"`, "g")), 1, key);
  }
  assert(html.includes(`name="robots" content="${index ? "index, follow" : "noindex, nofollow"}"`));
  assert.equal(count(html, /<link rel="canonical"/g), canonical ? 1 : 0);
  assert.equal(count(html, /<meta property="og:url"/g), canonical ? 1 : 0);
  if (canonical) assert(html.includes(`rel="canonical" href="${canonical}"`));
  assert(!html.includes(secret));
}
test("raw clinic/location HTML has unique metadata, canonical authority and only public fallback content", async () => {
  for (const [path, title, address] of [
    ["/fictional-cedar", "Fictional Cedar Care | DigiQ Doctors", "Fictional Clinic Road"],
    ["/fictional-cedar/east-location", "Fictional East · Fictional Cedar Care | DigiQ Doctors", "Fictional Location Road, Fictional City"],
    ["/fictional-cedar/west-location", "Fictional West · Fictional Cedar Care | DigiQ Doctors", "Fictional Location Road, Fictional City"],
    ["/fictional-maple/maple-location", "Fictional Maple · Fictional Maple Care | DigiQ Doctors", "Fictional Location Road, Fictional City"],
  ]) {
    const response = await fetch(base + path, { headers: { host: "untrusted.example.invalid", cookie: `session=${secret}`, "user-agent": "NonJavaScriptPreview" } });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-robots-tag"), "index, follow");
    assert.equal(response.headers.get("set-cookie"), null);
    const html = await response.text();
    assertHead(html, { title, index: true, canonical: origin + path });
    assert(html.includes(address));
    assert(!html.includes("untrusted.example.invalid"));
    assert(html.includes('<div id="root"><main><h1>'));
    if (path === "/fictional-cedar") assert(!html.includes("Fictional East"));
  }
  assert(queries.every(query => !/\b(?:users|patients|appointments|qrs|sessions|doctors)\b/.test(query)));
});
test("missing, inactive, cross-clinic and malformed public routes have actual 404 status", async () => {
  for (const path of ["/unknown-clinic", "/fictional-cedar/unknown-location", "/inactive-clinic",
    "/inactive-clinic/parent-location", "/fictional-cedar/inactive-location", "/fictional-cedar/maple-location",
    "/fictional-cedar/east-location/extra", "/bad%2Fslug", "/bad//slug"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404, path);
    assert.equal(response.headers.get("x-robots-tag"), "noindex, nofollow");
    assertHead(await response.text());
  }
});
test("private route families and query modes never look up or reflect public identity or tokens", async () => {
  const initialQueries = queries.length;
  for (const path of ["/sign-in", "/sign-up", "/patient-login", "/demo-login", "/register-clinic",
    "/register-doctor", "/onboarding", "/auth/callback", "/admin/dashboard", "/doctor/dashboard",
    "/receptionist/dashboard", "/patient/dashboard", `/set-password?token=${secret}`, `/reset-password?token=${secret}`,
    `/book/${secret}`, `/display/${secret}`, `/check-in?token=${secret}`, "/scan-qr", "/guest-booking",
    "/fictional-cedar/east-location?book=1", "/fictional-cedar/east-location?display=1",
    `/fictional-cedar?token=${secret}`, "/fictional-cedar?book=0", "/index.html"]) {
    const response = await fetch(base + path);
    assert.equal(response.status, 200, path);
    const html = await response.text();
    assertHead(html, { title: "Secure workspace | DigiQ Doctors" });
    assert(!html.includes("Fictional Cedar"));
  }
  assert.equal(queries.length, initialQueries);
});
test("directory queries/trailing slash canonicalize to the base page; HEAD matches GET policy", async () => {
  for (const suffix of ["/", "?search=fictional&page=2&pageSize=10&sort=-name"]) {
    const response = await fetch(base + "/fictional-cedar/east-location" + suffix);
    assertHead(await response.text(), { index: true, canonical: origin + "/fictional-cedar/east-location" });
  }
  for (const [path, status, robots] of [
    ["/fictional-cedar", 200, "index, follow"], ["/unknown-clinic", 404, "noindex, nofollow"],
    ["/set-password?token=fictional", 200, "noindex, nofollow"],
  ]) {
    const response = await fetch(base + path, { method: "HEAD" });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("x-robots-tag"), robots);
    assert.equal(await response.text(), "");
  }
});
test("no origin fallback, no stale activation cache, and SQL failures are non-indexable 503s", async () => {
  globalThis.__publicPageOrigin = undefined;
  assertHead(await (await fetch(base + "/fictional-cedar")).text());
  globalThis.__publicPageOrigin = "https://bad.example.invalid/path";
  assertHead(await (await fetch(base + "/fictional-cedar")).text());
  globalThis.__publicPageOrigin = origin;
  await pg.query("update clinics set status='inactive' where id='c1'");
  assert.equal((await fetch(base + "/fictional-cedar")).status, 404);
  await pg.query("update clinics set status='active' where id='c1'");
  assert.equal((await fetch(base + "/fictional-cedar")).status, 200);
  const execute = globalThis.__publicPageDb.execute;
  globalThis.__publicPageDb.execute = () => { throw new Error(secret); };
  const response = await fetch(base + "/fictional-cedar");
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("retry-after"), "60");
  assertHead(await response.text());
  // Private/auth pages must remain available when the public DB fails.
  assert.equal((await fetch(base + "/sign-in")).status, 200);
  globalThis.__publicPageDb.execute = execute;
});
test("rendering escapes public fields and removes duplicate owned tags without damaging scripts/assets", async () => {
  const dirty = template.replace("</head>", '<title>Old title</title><meta name="description" content="old"><meta property="og:title" content="old"><meta name="robots" content="index"><link rel="canonical" href="https://old.invalid"></head>');
  const page = await api.renderPublicPage("/fictional-cedar", dirty, async () => ({
    clinic: { name: 'Care </title><script>alert("fictional")</script>', address: '" onload="fictional' },
  }), origin);
  assertHead(page.html, { index: true, canonical: origin + "/fictional-cedar" });
  assert(page.html.includes("&lt;script&gt;"));
  assert(!page.html.includes('<script>alert("fictional")'));
  assert(page.html.includes('src="/src/main.tsx"'));
  const image = await fetch(base + "/digiq-doctors-logo.png");
  assert.equal(image.status, 200);
  assert(image.headers.get("content-type").startsWith("image/png"));
});

test("rendered real app matches raw metadata, deduplicates tags and clears identity on SPA navigation", async () => {
  const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", args: ["--no-sandbox"] });
  const context = await browser.newContext(); // No cookies, traces, videos or screenshots.
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) return route.abort(); // No remote fonts or providers.
    if (!["GET", "HEAD"].includes(request.method())) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    if (url.pathname === "/api/public/website-config") return route.fulfill({ json: { publicOrigin: origin } });
    if (url.pathname === "/api/auth/status") return route.fulfill({ json: { authenticated: false } });
    if (url.pathname.startsWith("/api/public/clinics-by-slug/fictional-cedar")) {
      return route.fulfill({ json: {
        clinic: { id: "c1", name: "Fictional Cedar Care", slug: "fictional-cedar", address: "Fictional Clinic Road" },
        // The real API can auto-select its sole branch on a clinic root. That
        // must not make the root metadata silently become location metadata.
        branch: { id: "b1", name: "Fictional East", slug: "east-location", address: "Fictional Location Road", city: "Fictional City", timezone: "Asia/Kolkata" },
        branchCount: 1, branches: [], doctors: [], qrReference: null,
      } });
    }
    return route.fulfill({ status: 404, json: { error: "Fictional route unavailable" } });
  });
  async function readHead() {
    return page.evaluate(() => ({
      title: document.title,
      descriptions: [...document.head.querySelectorAll('meta[name="description"]')].map(n => n.content),
      robots: [...document.head.querySelectorAll('meta[name="robots"]')].map(n => n.content),
      canonicals: [...document.head.querySelectorAll('link[rel="canonical"]')].map(n => n.href),
      ogTitles: [...document.head.querySelectorAll('meta[property="og:title"]')].map(n => n.content),
      ogDescriptions: [...document.head.querySelectorAll('meta[property="og:description"]')].map(n => n.content),
      ogUrls: [...document.head.querySelectorAll('meta[property="og:url"]')].map(n => n.content),
      twitterTitles: [...document.head.querySelectorAll('meta[name="twitter:title"]')].map(n => n.content),
      twitterDescriptions: [...document.head.querySelectorAll('meta[name="twitter:description"]')].map(n => n.content),
    }));
  }
  async function expectPublic(path, title) {
    await page.waitForFunction(({ title, canonical }) =>
      document.title === title && document.head.querySelector('link[rel="canonical"]')?.href === canonical,
    { title, canonical: origin + path });
    const head = await readHead();
    assert.deepEqual(head.robots, ["index, follow"]);
    assert.deepEqual(head.ogTitles, [title]);
    assert.deepEqual(head.twitterTitles, [title]);
    assert.equal(head.descriptions.length, 1);
    assert.deepEqual(head.ogDescriptions, head.descriptions);
    assert.deepEqual(head.twitterDescriptions, head.descriptions);
    assert.deepEqual(head.ogUrls, [origin + path]);
    assert.deepEqual(head.canonicals, [origin + path]);
    return head;
  }
  try {
    await page.goto(base + "/fictional-cedar/east-location");
    const branch = await expectPublic("/fictional-cedar/east-location", "Fictional East · Fictional Cedar Care | DigiQ Doctors");
    assert(branch.descriptions[0].includes("Fictional Location Road, Fictional City"));
    // Introduce legacy duplicates, then change the route using the real router.
    await page.evaluate(() => {
      for (const selector of ['title', 'meta[name="description"]', 'meta[name="robots"]', 'meta[property="og:title"]', 'link[rel="canonical"]', 'meta[property="og:url"]']) {
        const node = document.head.querySelector(selector); if (node) document.head.append(node.cloneNode(true));
      }
      history.pushState({}, "", "/fictional-cedar"); dispatchEvent(new PopStateEvent("popstate"));
    });
    const clinic = await expectPublic("/fictional-cedar", "Fictional Cedar Care | DigiQ Doctors");
    assert(!clinic.descriptions[0].includes("Fictional East"));
    for (const path of ["/fictional-cedar?book=1", "/fictional-cedar?display=1", "/unknown-clinic", `/set-password?token=${secret}`, "/sign-in"]) {
      await page.evaluate(path => { history.pushState({}, "", path); dispatchEvent(new PopStateEvent("popstate")); }, path);
      await page.waitForFunction(() => document.head.querySelector('meta[name="robots"]')?.content === "noindex, nofollow" &&
        !document.head.querySelector('link[rel="canonical"]') && !document.title.includes("Fictional Cedar"));
      const head = await readHead();
      assert.deepEqual(head.robots, ["noindex, nofollow"]);
      assert.deepEqual(head.canonicals, []);
      assert.deepEqual(head.ogUrls, []);
      assert(!JSON.stringify(head).includes(secret));
      assert(!JSON.stringify(head).includes("Fictional Cedar"));
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); await browser.close(); }
});
