import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

test("pagination offers 10/25/50/100 and retains current 20 default", () => {
  const s = read("./ListingControls.tsx");
  assert.ok(s.includes("PAGE_SIZE_OPTIONS = [10, 20, 25, 50, 100]"));
  assert.ok(s.includes("DEFAULT_PAGE_SIZE = 20"));
  assert.ok(s.includes("pageSizeOptions(pageSize)"));
});
test("single toast host is mounted once", () => {
  const app = read("../App.tsx");
  assert.equal(app.match(/<ToastHost\/>/g)?.length, 1);
});
test("admin bulk status uses friendly errors and one consolidated toast", () => {
  const s = read("./AdminListing.tsx");
  assert.ok(!s.includes("error instanceof Error?error.message"));
  assert.ok(s.includes("notifyBulk(summary"));
});
test("approved prompt §4 tokens are central", () => {
  const css = read("../index.css");
  for (const t of ["--text-disabled: #7A889E", "--surface-hover: #EEF4FB", "--shadow-dropdown: 0 4px 12px rgba(23,42,74,0.12)", "--shadow-dialog: 0 12px 32px rgba(23,42,74,0.18)"]) assert.ok(css.includes(t), t);
});
test("password toggle has accessible name", () => {
  const s = read("./PasswordInput.tsx");
  assert.ok(s.includes('visibilityLabel = "password"'));
  assert.ok(s.includes('${visible ? "Hide" : "Show"} ${visibilityLabel}'));
});

test("auth screens use PasswordInput and the shared 8-char rule; no raw account error", () => {
  const login = read("../auth/StaffLogin.tsx"), flows = read("../auth/PasswordFlows.tsx"), app = read("../App.tsx");
  assert.ok(login.includes("<PasswordInput") && flows.includes("<PasswordInput"));
  assert.ok(flows.includes("validatePassword(") && flows.includes("showChecklist"));
  assert.ok(!login.includes("validatePassword("), "login must not enforce the new policy on existing passwords");
  assert.ok(!flows.includes("minLength={12}") && !app.includes("{me.error.message}"));
});
test("dropdowns and suggestions expose Retry", () => {
  for (const f of ["./SearchableSelect.tsx", "./SearchableMultiSelect.tsx", "./SuggestionInput.tsx"]) assert.ok(read(f).includes("onRetry"), f);
});
