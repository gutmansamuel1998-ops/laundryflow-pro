// P8.7 regression tests for the bottom navigation at large text on narrow phones.
//
// P8.5/P8.6 found that at 200% text on a 320-390 px screen the third nav item ("Settings & Care") was clipped, and the
// floating "Send feedback" button overlapped the top of the bar. P8.7 lets labels wrap, keeps the whole label, sizes the
// columns so no label is narrower than its longest word, and positions the feedback button from the measured nav height.
//
// These tests pin the SOURCE (classes, structure, semantics) so a later edit cannot quietly undo the fix. They cannot
// check layout. Clipping, overlap, touch-target size, focus visibility and horizontal scrolling were measured in
// headless Chromium at 320/360/390 px, 100% and 200% text (see the P8.7 report). A real phone and a screen reader are
// still needed for the visual look and the spoken experience.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const layout = strip(read("../Layout.jsx"));
const feedback = strip(read("../components/FeedbackModal.jsx"));
const css = strip(read("../index.css"));

const classOf = (src, openTagStart) => {
  const i = src.indexOf(openTagStart);
  assert.ok(i >= 0, `missing: ${openTagStart}`);
  const m = /className=(?:"([^"]*)"|\{`([^`]*)`\})/.exec(src.slice(i, i + 600));
  assert.ok(m, `no className after ${openTagStart}`);
  return (m[1] ?? m[2]).split(/\s+/);
};

test("P8.7 nav: three destinations are unchanged, in order", () => {
  const items = [...layout.matchAll(/\{ page: "(\w+)", label: "([^"]+)", icon: (\w+) \}/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(items, [["Home", "Home"], ["Session", "Laundry Session"], ["SettingsCare", "Settings & Care"]]);
});

test("P8.7 nav: the full 'Settings & Care' label is kept, not shortened or truncated", () => {
  assert.match(layout, /label: "Settings & Care"/);
  const span = layout.slice(layout.indexOf("{item.label}") - 120, layout.indexOf("{item.label}"));
  assert.doesNotMatch(span, /truncate|text-ellipsis|line-clamp|overflow-hidden|whitespace-nowrap/);
});

test("P8.7 nav: label text may wrap and is neither shrunk nor clipped", () => {
  const cls = classOf(layout, "<span className=\"min-w-0");
  assert.ok(cls.includes("break-words"), "label must be allowed to break");
  assert.ok(cls.includes("text-xs"), "label keeps its existing text size (no smaller)");
  assert.ok(!cls.some((c) => /^(truncate|whitespace-nowrap|overflow-hidden|text-ellipsis|line-clamp-\d)$/.test(c)));
  assert.ok(!cls.some((c) => /^text-\[\d+px\]$/.test(c)), "no fixed pixel font size");
});

test("P8.7 nav: columns never narrower than their longest word, and wrap instead of overflowing", () => {
  assert.ok(classOf(layout, "<ul className=\"max-w-lg").includes("flex-wrap"));
  const li = classOf(layout, "<li key={item.page}");
  assert.ok(li.includes("min-w-min"), "li must not shrink below its longest word");
  assert.ok(li.includes("flex-1"), "columns stay equal width when there is room");
  assert.ok(!li.includes("min-w-0"), "min-w-0 let a long word overhang its neighbour at 320 px / 200%");
});

test("P8.7 nav: side padding is small and in rem, so three labels fit at 200% on 320 px", () => {
  const ul = classOf(layout, "<ul className=\"max-w-lg");
  assert.ok(ul.includes("px-0.5"));
  const link = classOf(layout, "<Link");
  assert.ok(link.includes("px-0.5"));
  assert.ok(![...ul, ...link].some((c) => /^p[xl]?-\[?\d+px\]?$/.test(c)), "padding must scale with text (rem), not px");
});

test("P8.7 nav: height is content-driven, so it grows when a label wraps", () => {
  const nav = classOf(layout, "<nav ref={navRef}");
  assert.ok(!nav.some((c) => /^(h-|max-h-|overflow-)/.test(c)), "nav must not have a fixed or capped height");
  const link = classOf(layout, "<Link");
  assert.ok(!link.some((c) => /^h-\d/.test(c)), "links must not have a fixed height");
});

test("P8.7 nav: touch targets keep at least 44 px (60 px minimum height, full-column width)", () => {
  const link = classOf(layout, "<Link");
  assert.ok(link.includes("min-h-[60px]"));
  assert.ok(classOf(layout, "<li key={item.page}").includes("flex-1"));
});

test("P8.7 nav: icon is decorative and active state, name and landmark are preserved", () => {
  assert.match(layout, /<nav ref=\{navRef\} aria-label="Main navigation"/);
  assert.match(layout, /aria-current=\{isActive \? "page" : undefined\}/);
  assert.match(layout, /<Icon [^>]*aria-hidden="true"/);
  assert.match(layout, /<ul className=/);
  assert.match(layout, /<li key=\{item\.page\}/);
  assert.match(layout, /\{item\.label\}<\/span>/, "visible label is the link's accessible name");
  const link = layout.slice(layout.indexOf("<Link"), layout.indexOf("</Link>"));
  assert.doesNotMatch(link, /aria-label=/);
});

test("P8.7 nav: skip link and main landmark are still there", () => {
  assert.match(layout, /href="#main-content"/);
  assert.match(layout, /Skip to main content/);
  assert.match(layout, /<main id="main-content">/);
});

test("P8.7 nav: P8.6 keyboard-focus fix still works with the new height (measured, published, used)", () => {
  assert.match(layout, /ResizeObserver/);
  assert.match(layout, /--bottom-nav-h/);
  assert.match(layout, /removeProperty\(["']--bottom-nav-h["']\)/);
  assert.match(css, /scroll-padding-bottom:\s*calc\(var\(--bottom-nav-h,\s*5rem\)\s*\+\s*1rem\)/);
});

test("P8.7 launcher: 'Send feedback' sits above the measured nav height instead of a fixed offset", () => {
  const cls = classOf(feedback, "className=\"fixed bottom-");
  assert.ok(cls.includes("bottom-[calc(var(--bottom-nav-h,5rem)+0.75rem)]"));
  assert.ok(!cls.includes("bottom-20"), "the old fixed offset overlapped the bar at large text");
  assert.ok(cls.includes("z-40"), "launcher stays below the nav's z-50 layer");
  assert.match(feedback, /aria-label="Send feedback"/);
  assert.ok(cls.includes("w-12") && cls.includes("h-12"), "launcher stays 48 x 48");
});
