import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read = path => readFileSync(new URL(path, import.meta.url), "utf8");

test("sensitive entries share visibility controls without retrieving saved secrets", () => {
  const secret = read("./PasswordInput.tsx");
  assert.match(secret, /type=\{visible \? "text" : "password"\}/);
  assert.match(secret, /aria-controls=\{inputId\}/);
  assert.match(secret, /aria-pressed=\{visible\}/);
  assert.match(secret, /onMouseDown=\{event => event.preventDefault\(\)\}/);
  assert.match(secret, /if \(value === ""\) setVisible\(false\)/);
  const integration = read("./IntegrationEditor.tsx");
  assert.match(integration, /Stored values are never displayed/);
  assert.match(integration, /type === "password" \? <PasswordInput/);
  assert.match(integration, /visibilityLabel=\{label\}/);
  assert.doesNotMatch(integration, /type="password"/);
  assert.match(read("../auth/DemoLogin.tsx"), /<PasswordInput/);
});

test("workspace search respects navigation scope and cancels stale requests", () => {
  const search = read("./WorkspaceSearch.tsx");
  assert.match(search, /if \(!navigation.includes\(target\)\) return/);
  assert.match(search, /role !== "patient"/);
  assert.match(search, /new AbortController/);
  assert.match(search, /controller.abort\(\)/);
  assert.match(search, /if \(!controller.signal.aborted\)/);
  assert.match(search, /event.metaKey \|\| event.ctrlKey/);
  assert.match(search, /setGroups\(\[\]\)/);
});

test("navigation preferences are user-role scoped and contain page IDs, not patient search history", () => {
  const search = read("./WorkspaceSearch.tsx");
  assert.match(search, /digiq-navigation:\$\{userId\}:\$\{role\}/);
  assert.match(search, /type Preferences = \{ favorites: string\[\]; recent: string\[\] \}/);
  assert.match(search, /items.filter\(p => navigation.includes\(p\)\)/);
  assert.match(search, /patient results and search terms are not saved/);
  assert.match(search, /Browser storage is unavailable/);
});

test("staff search deep links apply tab and search to existing list state", () => {
  const users = read("../Users.tsx");
  assert.match(users, /const routeSearch = useSearch\(\)/);
  assert.match(users, /if \(!query.has\("search"\)\) return/);
  assert.match(users, /tabs.find\(t => t.id === query.get\("tab"\)\)/);
  assert.match(users, /setContexts\(previous => \(\{ \.\.\.previous, \[requested\]: next \}\)\)/);
});
