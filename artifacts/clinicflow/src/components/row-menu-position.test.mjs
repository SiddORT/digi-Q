import assert from "node:assert/strict";
import test from "node:test";
import { computeMenuPosition, menuBounds } from "./row-menu-position.ts";

const box = (left, top, width, height) => ({ left, top, right: left + width, bottom: top + height });
// Dialog at (200,100), 400x300 border box, 1px borders, transformed (fixed children use its padding box).
const dialog = (scrollTop = 0) => ({ rect: box(200, 100, 400, 300), clientTop: 1, clientLeft: 1, clientWidth: 398, clientHeight: 298, scrollTop, scrollLeft: 0 });
const toViewport = (p, h) => ({ top: p.top + h.rect.top + h.clientTop - h.scrollTop, left: p.left + h.rect.left + h.clientLeft - h.scrollLeft });

test("body-hosted menu stays inside the viewport and flips above near the bottom", () => {
  const p = computeMenuPosition(box(1200, 860, 32, 32), { width: 200, height: 160 }, 1280, 900, null);
  assert.equal(p.placement, "above");
  assert.ok(p.top >= 8 && p.top + 160 <= 892);
  assert.ok(p.left >= 8 && p.left + 200 <= 1272);
});

test("dialog-hosted menu is bounded by the dialog client box (incl. borders), not only the viewport", () => {
  const h = dialog();
  const b = menuBounds(1280, 900, h);
  assert.deepEqual(b, { top: 109, left: 209, right: 591, bottom: 391 });
  const p = computeMenuPosition(box(560, 360, 32, 24), { width: 200, height: 160 }, 1280, 900, h);
  const v = toViewport(p, h);
  const height = Math.min(160, p.maxHeight);
  assert.ok(v.top >= b.top && v.top + height <= b.bottom, JSON.stringify({ p, v }));
  assert.ok(v.left >= b.left && v.left + 200 <= b.right);
  assert.equal(p.placement, "above");
});

test("maxHeight never exceeds the available space (no fixed floor)", () => {
  const h = { ...dialog(), rect: box(200, 100, 400, 90), clientHeight: 88 };
  const p = computeMenuPosition(box(400, 140, 32, 24), { width: 180, height: 400 }, 1280, 900, h);
  const b = menuBounds(1280, 900, h);
  assert.ok(p.maxHeight <= b.bottom - b.top, String(p.maxHeight));
  assert.ok(p.maxHeight < 120);
});

test("width is limited to the host and the menu is clamped horizontally", () => {
  const h = { ...dialog(), rect: box(10, 100, 150, 300), clientWidth: 148 };
  const p = computeMenuPosition(box(100, 150, 32, 24), { width: 240, height: 80 }, 390, 844, h);
  assert.equal(p.maxWidth, 148 - 16);
  const v = toViewport(p, h);
  assert.ok(v.left >= 19 && v.left + p.maxWidth <= 151);
});

test("viewport cuts a dialog that extends past the screen; scrolled host offsets are compensated", () => {
  const h = { ...dialog(50), rect: box(200, 600, 400, 600), clientHeight: 598 };
  const b = menuBounds(1280, 900, h);
  assert.equal(b.bottom, 892);
  const p = computeMenuPosition(box(500, 860, 32, 24), { width: 200, height: 160 }, 1280, 900, h);
  const v = toViewport(p, h);
  assert.ok(v.top + Math.min(160, p.maxHeight) <= 892 && v.top >= b.top);
});

test("trigger outside the visible bounds closes the menu", () => {
  assert.equal(computeMenuPosition(box(500, 50, 32, 24), { width: 200, height: 100 }, 1280, 900, dialog()), null);
});
