import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("searchable controls link generated labels, validation and selected-value descriptions", () => {
  for (const file of ["./SearchableSelect.tsx", "./SearchableMultiSelect.tsx"]) {
    const source = read(file);
    assert.match(source, /React\.useId\(\)/);
    assert.match(source, /htmlFor=\{controlId\}/);
    assert.match(source, /aria-labelledby=\{labelledBy\}/);
    assert.match(source, /aria-invalid=\{invalid \?\? !!error\}/);
    assert.match(source, /id=\{errorId\} role="alert"/);
    assert.ok(source.includes('`${controlId}-value`'));
    assert.match(source, /aria-haspopup="dialog"/);
    assert.match(source, /aria-controls=\{open \? popupId : undefined\}/);
    assert.ok(source.includes('label={label ? `Search ${label}` : "Search options"}'));
  }
});

test("remote option pagination is available without scrolling or a pointer", () => {
  for (const file of ["./SearchableSelect.tsx", "./SearchableMultiSelect.tsx"]) {
    assert.ok(read(file).includes('onClick={onLoadMore}>Load More Options</button>'));
    assert.ok(read(file).includes('if (event.key === "Enter" || event.key === " ") event.stopPropagation()'), "button activation must not also select cmdk's active option");
  }
});

test("long selected labels and multiselect options wrap instead of losing content", () => {
  const single = read("./SearchableSelect.tsx");
  const multi = read("./SearchableMultiSelect.tsx");
  assert.ok(!single.includes("truncate"));
  assert.ok(!multi.includes("truncate"));
  assert.match(multi, /flex min-w-0 flex-wrap/);
  assert.match(multi, /searchable-select-remove/);
  const css = read("../index.css");
  assert.match(css, /\.searchable-select-popup\{max-width:calc\(100vw - 24px\)/);
  assert.match(css, /\.searchable-select-remove\{min-width:44px!important;min-height:44px!important\}/);
});

test("form wrapper forwards the visible label identity to custom controls", () => {
  assert.ok(read("./FormField.tsx").includes('"aria-labelledby": `${controlId}-label`'));
  assert.match(read("./ResourceLookup.tsx"), /Pick<AriaAttributes, "aria-describedby" \| "aria-invalid" \| "aria-required" \| "aria-labelledby">/);
});

test("suggestions stop referencing unmounted options and permit Tab to leave", () => {
  const source = read("./SuggestionInput.tsx");
  assert.match(source, /aria-activedescendant=\{open && activeIndex >= 0/);
  assert.match(source, /event\.key === "Tab"/);
  assert.match(source, /aria-label=\{accessibleLabel \|\| \(labelledBy \? undefined : placeholder\)\}/);
});

test("discard confirmation makes both underlying header and body inert", () => {
  const source = read("./AppDialog.tsx");
  assert.match(source, /<DialogHeader[^>]*inert=\{confirming \? true : undefined\}/);
  assert.match(source, /className="app-dialog-body[^>]*inert=\{confirming \? true : undefined\}/);
  assert.match(read("./app-dialog.css"), /\.app-discard-panel\{min-width:0;max-height:100%;overflow:auto/);
});

test("resetting advanced filters restores keyboard focus", () => {
  const source = read("./ListingControls.tsx");
  assert.match(source, /onReset\(\); setInvalidMessage\(""\); closeFilters\(\)/);
  assert.match(source, /requestAnimationFrame\(\(\) => toggleRef\.current\?\.focus\(\)\)/);
  assert.match(source, /<AppDialog open=\{open\} onClose=\{closeFilters\} title=\{label\} variant="drawer"/);
});

test("public account copy does not imply mandatory login and rescheduling explanation does not change eligibility", () => {
  const clinic = read("../clinic.tsx");
  assert.ok(clinic.includes("Sign In to Your Account"));
  assert.ok(clinic.includes("<GuestBooking key={reference}"));
  const rows = read("./appointments/AppointmentRows.tsx");
  assert.ok(rows.includes('const canReschedule=["booked","waiting","called"].includes(a.status)&&!a.checkedInAt&&a.allowedActions.includes("cancel")'));
  assert.ok(rows.includes('!canReschedule&&["called","inConsultation"].includes(a.status)'));
  assert.ok(rows.includes("Rescheduling is unavailable"));
});