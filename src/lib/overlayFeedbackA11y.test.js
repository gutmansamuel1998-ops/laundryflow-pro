// P8.9 regression tests: invisible toast layer, feedback dialog, extreme-viewport navigation.
//
// These pin the SOURCE (classes, structure, semantics, key handling) so a later edit cannot quietly undo the fixes.
// They cannot check layout or real focus movement; those were measured in headless Chromium (see the P8.9 report).
// A real phone and a screen reader are still needed for the spoken experience and the real look.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const toast = strip(read("../components/ui/toast.jsx"));
const feedback = strip(read("../components/FeedbackModal.jsx"));
const layout = strip(read("../Layout.jsx"));
const css = strip(read("../index.css"));

const classAfter = (src, marker) => {
  const i = src.indexOf(marker);
  assert.ok(i >= 0, `missing: ${marker}`);
  const m = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(src.slice(i, i + 900));
  assert.ok(m, `no className after ${marker}`);
  return (m[1] ?? m[2]).split(/\s+/);
};

// ─── 1. Empty toast layer ────────────────────────────────────────────────────────────────────

test("toast: the fixed provider and viewport layers do not capture pointer events when empty", () => {
  for (const [name, marker] of [["provider", "const ToastProvider"], ["viewport", "const ToastViewport"]]) {
    const layer = classAfter(toast, marker);
    assert.ok(layer.includes("pointer-events-none"), `${name} must not intercept taps`);
    assert.ok(layer.includes("fixed"), `${name} is still the fixed top/bottom layer`);
    assert.ok(layer.includes("z-[100]"), `${name}: toasts still stack above everything`);
  }
});

test("toast: each toast turns pointer events back on, so it stays tappable and its close button works", () => {
  const variants = toast.slice(toast.indexOf("toastVariants"), toast.indexOf("toastVariants") + 700);
  assert.match(variants, /pointer-events-auto/);
});

test("toast: no role or live region was removed or added by the fix", () => {
  assert.doesNotMatch(toast, /pointer-events-none[^"]*aria-hidden|aria-hidden[^"]*pointer-events-none/);
});

// ─── 2. Feedback dialog ──────────────────────────────────────────────────────────────────────

test("feedback dialog: keeps its dialog semantics and accessible name", () => {
  assert.match(feedback, /role="dialog"/);
  assert.match(feedback, /aria-modal="true"/);
  assert.match(feedback, /aria-labelledby="feedback-modal-title"/);
  assert.match(feedback, /id="feedback-modal-title"/);
  assert.match(feedback, /aria-label="Close feedback"/);
});

test("feedback dialog: sits above the bottom navigation (z-60 over the nav's z-50)", () => {
  const sheet = classAfter(feedback, "role=\"dialog\"");
  assert.ok(sheet.includes("z-[60]"));
  const backdrop = classAfter(feedback, "fixed inset-0");
  assert.ok(backdrop.includes("z-[60]"));
  assert.match(layout, /z-50/, "nav layer is unchanged");
});

test("feedback dialog: scrolls inside itself and is never taller than the screen", () => {
  assert.match(feedback, /feedback-sheet/);
  const block = css.slice(css.indexOf(".feedback-sheet"));
  const rule = block.slice(0, block.indexOf("}"));
  assert.match(rule, /max-height:\s*calc\(100vh/);
  assert.match(rule, /max-height:\s*calc\(100dvh/);
  assert.match(rule, /overflow-y:\s*auto/);
});

test("feedback dialog: Close is reachable while scrolled (sticky header) and is at least 44 x 44", () => {
  assert.match(feedback, /sticky top-0/);
  const close = classAfter(feedback, "aria-label=\"Close feedback\"");
  assert.ok(close.includes("min-h-[44px]") && close.includes("min-w-[44px]"));
});

test("feedback dialog: each option is at least 44 px tall and keeps its visible text as its name", () => {
  const option = classAfter(feedback, "onClick={() => handleSend");
  assert.ok(option.includes("min-h-[44px]"));
  assert.match(feedback, /\{label\}/);
});

test("feedback dialog: Escape closes it and Tab / Shift+Tab stay inside it", () => {
  assert.match(feedback, /event\.key === "Escape"/);
  assert.match(feedback, /event\.key !== "Tab"/);
  assert.match(feedback, /event\.shiftKey/);
  assert.match(feedback, /addEventListener\("keydown"/);
  assert.match(feedback, /removeEventListener\("keydown"/);
});

test("feedback dialog: focus moves in when it opens and returns to the launcher when it closes", () => {
  assert.match(feedback, /dialog\?\.focus\(\)/);
  assert.match(feedback, /tabIndex=\{-1\}/);
  assert.match(feedback, /launcherRef\.current\?\.focus\(\)/);
  assert.match(feedback, /ref=\{launcherRef\}/);
  assert.match(feedback, /aria-haspopup="dialog"/);
});

test("feedback dialog: motion respects the reduce-motion setting", () => {
  assert.match(feedback, /useReducedMotion/);
  assert.match(feedback, /duration:\s*0/);
});

test("feedback launcher: P8.7 position and size are unchanged", () => {
  const cls = classAfter(feedback, "ref={launcherRef}");
  assert.ok(cls.includes("bottom-[calc(var(--bottom-nav-h,5rem)+0.75rem)]"));
  assert.ok(cls.includes("z-40") && cls.includes("w-12") && cls.includes("h-12"));
  assert.match(feedback, /aria-label="Send feedback"/);
});

test("feedback dialog: the email hand-off is unchanged", () => {
  assert.match(feedback, /mailto:gutman\.samuel1998@gmail\.com\?subject=/);
  assert.match(feedback, /\["bug", "feedback", "suggestion"\]|value: "bug"[\s\S]*value: "feedback"[\s\S]*value: "suggestion"/);
});

// ─── 3. Extreme viewport: nav stops being pinned when it would take over the screen ─────────

test("layout: the bar is pinned normally and inline when it plus the feedback button would fill the screen", () => {
  assert.match(layout, /const \[compact, setCompact\] = useState\(false\)/);
  assert.match(layout, /height \+ 4\.75 \* rem > 0\.5 \* window\.innerHeight/);
  assert.match(layout, /compact \? "relative" : "fixed bottom-0 left-0 right-0 z-50"/);
  assert.match(layout, /tooTall \? "0px" : `\$\{height\}px`/);
  assert.match(layout, /addEventListener\("resize", publish\)/);
  assert.match(layout, /removeEventListener\("resize", publish\)/);
});

test("layout: when inline, the page keeps room below the bar so the feedback button never covers a destination", () => {
  assert.match(layout, /compact \? " pb-\[4\.75rem\]" : ""/);
});

test("layout: all three destinations and their full labels are still rendered in compact mode", () => {
  const items = [...layout.matchAll(/\{ page: "(\w+)", label: "([^"]+)"/g)].map((m) => m[2]);
  assert.deepEqual(items, ["Home", "Laundry Session", "Settings & Care"]);
  assert.doesNotMatch(layout, /compact\s*&&\s*<|compact\s*\?\s*null/, "compact mode must not hide the navigation");
  assert.doesNotMatch(layout, /sr-only[^"]*\{item\.label\}/);
});

test("layout: the existing measured-height publishing is intact", () => {
  assert.match(layout, /setProperty\("--bottom-nav-h"/);
  assert.match(layout, /new ResizeObserver\(publish\)/);
  assert.match(layout, /removeProperty\("--bottom-nav-h"\)/);
});
