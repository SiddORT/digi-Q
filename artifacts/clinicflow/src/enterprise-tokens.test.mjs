import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";

// Contract for the approved DigiQ v3 enterprise standard (HIGH_DENSITY_OPERATIONAL).
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const index = read("./index.css");
const cssFiles = [
  "./index.css", "./compact-workspace.css",
  ...readdirSync(new URL("./components/", import.meta.url)).filter((f) => f.endsWith(".css")).map((f) => `./components/${f}`),
];
// Ticket/QR geometry and the public queue display variant are governed separately.
const governed = cssFiles.filter((f) => !/visit-ticket|clinic-display|workspace-search|integration-settings/.test(f));

test("Inter is the only loaded font; legacy families are gone", () => {
  assert.match(index.split("\n")[0], /family=Inter:/);
  for (const f of cssFiles) assert.doesNotMatch(read(f), /Manrope|DM Sans|Space Mono/, f);
  assert.match(index, /--font-sans: 'Inter', system-ui, sans-serif;/);
});

test("approved scale tokens exist", () => {
  for (const t of ["--type-page: 24px", "--type-section: 20px", "--type-card: 18px", "--type-body: 14px",
    "--type-label: 13px", "--type-caption: 12px", "--weight-heading: 600", "--radius-badge: 6px",
    "--radius-control: 8px", "--radius-card: 12px", "--radius-dialog: 16px", "--radius-pill: 999px",
    "--control-sm: 32px", "--control-md: 40px", "--control-lg: 44px", "--control-xl: 48px"]) assert.ok(index.includes(t), t);
  assert.match(index, /--type-display-lg:/, "documented distance-readable display variant");
});

test("governed CSS has no literal px/rem/clamp font sizes outside ticket/brand/display readouts", () => {
  const allowed = /ticket|\.vt|receipt|\.brand|otp-slot/;
  for (const f of governed) {
    for (const [, sel, body] of read(f).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (allowed.test(sel)) continue;
      assert.doesNotMatch(body, /font-size:\s*(\d|\.\d|clamp)/, `${f}: ${sel.trim()}`);
    }
  }
});

test("no negative heading letter-spacing or off-scale 34-38px control heights", () => {
  for (const f of governed) {
    const s = read(f);
    assert.doesNotMatch(s, /letter-spacing:\s*-\d/, f);
    assert.doesNotMatch(s, /(?:^|[;{\s])(?:min-)?height:\s*3[4-8]px/, f);
  }
});

test("primary list header and page actions are 40px; heading weight is tokenized", () => {
  const u = read("./components/uniformity.css");
  assert.match(u, /\.list-header\{--lh-h:var\(--control-md\)/);
  assert.match(u, /\.page-heading \.button\{min-height:var\(--control-md\)/);
  assert.match(index, /\.workspace h4 \{ font-family: var\(--font-heading\); font-weight: var\(--weight-heading\)/);
});

test("empty states are left-aligned and compact; long form fields span full width", () => {
  assert.match(read("./components/shared-feedback.css"), /\.empty-state\{[^}]*align-items:flex-start;text-align:left/);
  assert.match(index, /\.form-grid > :has\(textarea, \.password-input, \.password-checklist\) \{ grid-column: 1 \/ -1; \}/);
  assert.match(index, /\.form-grid:not\(\.single\):has\(> :nth-child\(5\)\)/);
});

test("spacing and radius use the approved scales (ticket/QR/scanner geometry excluded)", () => {
  const skip = /ticket|\.vt|receipt|qr|scan|otp-slot|@keyframes|password-toggle|\.cl-/;
  const space = new Set([0, 4, 8, 12, 16, 24, 32, 40, 48]);
  const radius = new Set([6, 8, 12, 16]);
  for (const f of governed) {
    for (const [, sel, body] of read(f).matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (skip.test(sel)) continue;
      for (const [, prop, val] of body.matchAll(/(?<![-\w])((?:margin|padding)(?:-[a-z-]+)?|gap|row-gap|column-gap|border(?:-[a-z]+-[a-z]+)?-radius)\s*:\s*([^;}]+)/g)) {
        if (/calc\(|clamp\(|env\(|%/.test(val)) continue;
        for (const [, n] of val.replace(/var\([^)]*\)/g, "").matchAll(/-?(\d*\.?\d+)px/g)) {
          const v = Number(n);
          if (prop.endsWith("radius")) assert.ok(radius.has(v) || v >= 99, `${f} ${sel.trim()} ${prop}:${val}`);
          else assert.ok(space.has(v), `${f} ${sel.trim()} ${prop}:${val}`);
        }
      }
    }
  }
});

test("landing removes decorative art but keeps the content", () => {
  assert.match(index, /\.landing \.hero-art :is\(\.art-grid, \.care-orbit, \.care-center\) \{ display: none; \}/);
  const app = read("./App.tsx");
  for (const t of ["From Booking to Better", "Your Visit, Simplified", "Stay in the Know", "Thoughtfully Designed Around You"]) assert.ok(app.includes(t), t);
});
