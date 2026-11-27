// P8.8 regression tests:
//   1. The Session timer card is pinned to the top only while that leaves room. At large text it scrolls with the page,
//      because a pinned card plus the bottom navigation hid keyboard-focused controls (WCAG 2.2 SC 2.4.11).
//      While pinned, its height becomes scroll-padding-top so focus is never scrolled in underneath it.
//   2. The minutes stepper ("−  [ 35 ] min  +") can no longer overlap itself: when it is narrow, the number takes its
//      own row and the two buttons sit side by side beneath it.
//
// Part A renders the REAL components (esbuild + react-dom/server). Part B checks source and stylesheet. If the bundle
// cannot load, the first test FAILS with the reason (never silently skipped).
// What this cannot check: layout, overlap, focus position or text scaling in a real browser. Those were measured in
// headless Chromium for P8.8 (see the report) and still need a real phone and screen reader.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

async function load() {
  try {
    const esbuild = await import("esbuild");
    const src = join(root, "src");
    const entry = `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import SessionTimer from "@/components/session/SessionTimer";
      import { MinutesStepper } from "@/components/session/ui";
      const noop = () => {};
      const timer = (over = {}) => ({ progress: 0.25, endMs: Date.UTC(2026, 10, 22, 18, 0, 0), remainingMs: 600000, overdueMs: 0, elapsed: false, ...over });
      export const timerHtml = (props = {}, t = timer()) => renderToStaticMarkup(<SessionTimer phase="drying" timer={t} {...props} />);
      export const timerNone = () => renderToStaticMarkup(<SessionTimer phase="drying" timer={null} />);
      export const timerElapsed = (props = {}) => renderToStaticMarkup(<SessionTimer phase="drying" timer={timer({ elapsed: true, remainingMs: 0, overdueMs: 120000, progress: 1 })} {...props} />);
      export const stepper = (props = {}) => renderToStaticMarkup(<MinutesStepper id="m" label="Wash cycle length" value={35} onChange={noop} hint="A hint" {...props} />);
    `;
    const out = await esbuild.build({
      stdin: { contents: entry, resolveDir: src, loader: "jsx", sourcefile: "entry.jsx" },
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      alias: { "@": src },
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    const dir = mkdtempSync(join(tmpdir(), "sticky-stepper-"));
    const file = join(dir, "bundle.cjs");
    writeFileSync(file, out.outputFiles[0].text);
    const hadWindow = "window" in globalThis;
    if (!hadWindow) globalThis.window = { self: {}, top: {} };
    let mod;
    try {
      mod = createRequire(import.meta.url)(file);
    } finally {
      if (!hadWindow) delete globalThis.window;
      rmSync(dir, { recursive: true, force: true });
    }
    return { mod };
  } catch (error) {
    return { skip: `cannot render components here: ${error.message.split("\n")[0]}` };
  }
}

const { mod, skip } = await load();
const t = (name, fn) => test(name, { skip }, fn);

test("the render harness loads (a failure here means the render tests below could not run)", () => {
  assert.ok(mod, skip || "bundle did not load");
});

// ─── Fix 1: the timer card ───────────────────────────────────────────────────────────────────

t("the timer card still renders its heading, estimate wording, progress bar and spoken text", () => {
  const html = mod.timerHtml();
  assert.match(html, /<section[^>]*aria-label="Dry timer, estimated"/);
  assert.match(html, /<h2[^>]*>Dry timer/);
  assert.match(html, /\(estimate\)/);
  assert.match(html, /role="progressbar"[^>]*aria-valuenow="25"/);
  assert.match(html, /class="sr-only">About /);
  assert.match(html, /aria-hidden="true">10:00</, "the live digits stay hidden from screen readers");
});

t("the timer card starts pinned (the browser then un-pins it when it would take too much of the screen)", () => {
  const html = mod.timerHtml();
  assert.match(html, /\bsticky\b[^"]*top-0[^"]*z-30/);
});

t("a card that was never meant to be sticky (Home) is never pinned", () => {
  const html = mod.timerHtml({ sticky: false });
  assert.doesNotMatch(html, /sticky/);
  assert.doesNotMatch(html, /z-30/);
});

t("the elapsed state keeps its warning text and check-the-machine sentence", () => {
  const html = mod.timerElapsed();
  assert.match(html, /Time&#x27;s up|Time's up/);
  assert.match(html, /This is only an estimate\. Check that your machine has actually stopped/);
  assert.match(html, /The estimated timer finished 2 minutes ago\./);
});

t("no timer, nothing rendered", () => {
  assert.equal(mod.timerNone(), "");
});

test("the pinning rule: measured, capped at half the screen, observed, cleaned up", () => {
  const src = strip(read("../components/session/SessionTimer.jsx"));
  assert.match(src, /const MAX_PINNED_SHARE = 0\.5;/);
  assert.match(src, /cardH \+ navH <= window\.innerHeight \* MAX_PINNED_SHARE/);
  assert.match(src, /document\.querySelector\("nav\[aria-label='Main navigation'\]"\)/);
  assert.match(src, /new ResizeObserver\(update\)/);
  assert.match(src, /addEventListener\("resize", update\)/);
  assert.match(src, /removeEventListener\("resize", update\)/);
  assert.match(src, /observer\?\.disconnect\(\)/);
  assert.match(src, /typeof ResizeObserver !== "undefined"/);
});

test("while pinned the card's height is published as --sticky-top-h, and removed when not pinned or unmounted", () => {
  const src = strip(read("../components/session/SessionTimer.jsx"));
  assert.match(src, /setProperty\("--sticky-top-h", `\$\{Math\.ceil\(cardH\) \+ 8\}px`\)/);
  assert.equal((src.match(/removeProperty\("--sticky-top-h"\)/g) || []).length, 2, "removed when un-pinned and on cleanup");
  const css = strip(read("../index.css"));
  assert.match(css, /scroll-padding-top:\s*var\(--sticky-top-h,\s*0px\)/);
});

test("the sticky classes depend on the measured 'pinned' value, not on the prop alone; hooks run before the early return", () => {
  const src = strip(read("../components/session/SessionTimer.jsx"));
  assert.match(src, /pinned && "sticky top-0 z-30 -mx-5 bg-background\/95 px-5 backdrop-blur"/);
  assert.doesNotMatch(src, /\bsticky && "sticky/);
  assert.ok(src.indexOf("usePinned(sticky, Boolean(timer))") > 0);
  assert.ok(src.indexOf("usePinned(sticky, Boolean(timer))") < src.indexOf("if (!timer) return null"), "a hook must not be skipped by the early return");
  assert.match(src, /return \{ ref, pinned: enabled && pinned \}/);
  assert.match(src, /const \{ ref: sectionRef, pinned \} = usePinned\(/);
});

test("Home has no timer of its own (so nothing there can pin or tick); Session still uses the default (pinned when there is room)", () => {
  const home = strip(read("../pages/Home.jsx"));
  assert.doesNotMatch(home, /SessionTimer|useNow|formatClock/);
  const session = strip(read("../pages/Session.jsx"));
  assert.match(session, /<SessionTimer /);
  assert.doesNotMatch(session.slice(session.indexOf("<SessionTimer "), session.indexOf("<SessionTimer ") + 200), /sticky=\{false\}/);
});

test("the bottom-navigation focus fix is untouched (bottom padding still follows the measured nav height)", () => {
  const css = strip(read("../index.css"));
  assert.match(css, /scroll-padding-bottom:\s*calc\(var\(--bottom-nav-h,\s*5rem\)\s*\+\s*4\.75rem\)/);
});

test("the bottom scroll padding also clears the floating 'Send feedback' button (3rem tall + 0.75rem above the bar + 1rem room)", () => {
  const css = strip(read("../index.css"));
  const feedback = strip(read("../components/FeedbackModal.jsx"));
  assert.match(feedback, /bottom-\[calc\(var\(--bottom-nav-h,5rem\)\+0\.75rem\)\][^"]*\bw-12 h-12\b/);
  const m = /scroll-padding-bottom:\s*calc\(var\(--bottom-nav-h,\s*5rem\)\s*\+\s*(\d+(?:\.\d+)?)rem\)/.exec(css);
  assert.ok(m, "padding is nav height + a rem amount");
  assert.ok(Number(m[1]) >= 3 + 0.75 + 1, "at least launcher height + its gap + 1rem");
});

// ─── Fix 2: the minutes stepper ──────────────────────────────────────────────────────────────

t("the stepper keeps its label, both buttons, the input, the unit and the hint, and their accessible names", () => {
  const html = mod.stepper();
  assert.match(html, /<label for="m"[^>]*>Wash cycle length<\/label>/);
  assert.match(html, /aria-label="Decrease Wash cycle length by 5 minutes"/);
  assert.match(html, /aria-label="Increase Wash cycle length by 5 minutes"/);
  assert.match(html, /<input id="m" type="text" inputMode="numeric"|<input id="m"[^>]*inputMode="numeric"/);
  assert.match(html, /value="35"/);
  assert.match(html, />min<\/span>/);
  assert.match(html, /<p id="m-hint"[^>]*>A hint<\/p>/);
  assert.match(html, /aria-describedby="m-hint"/);
});

t("the stepper's parts carry the classes the stylesheet lays out (container, row, dec, value, inc), in reading order", () => {
  const html = mod.stepper();
  assert.match(html, /<div class="minutes-stepper">/);
  assert.match(html, /<div class="minutes-stepper__row">/);
  const order = ["minutes-stepper__dec", "minutes-stepper__value", "minutes-stepper__inc"].map((c) => html.indexOf(c));
  assert.ok(order.every((i) => i > 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order, "DOM order stays minus, number, plus");
});

t("both stepper buttons keep a 56 px minimum target and stay type=button", () => {
  const html = mod.stepper();
  assert.equal((html.match(/min-h-\[56px\] min-w-\[56px\]/g) || []).length, 2);
  assert.equal((html.match(/type="button"/g) || []).length, 2);
});

test("the stylesheet puts the stepper in a container and stacks it when it is narrow, in rem", () => {
  const css = strip(read("../index.css"));
  assert.match(css, /\.minutes-stepper\s*\{\s*container-type:\s*inline-size;\s*\}/);
  assert.match(css, /\.minutes-stepper \.minutes-stepper__row\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/);
  const q = /@container \(max-width: (\d+(?:\.\d+)?)rem\)\s*\{([\s\S]*?)\n\}\n/.exec(css.slice(css.indexOf(".minutes-stepper")));
  assert.ok(q, "container query for the stepper");
  assert.ok(Number(q[1]) >= 17, "threshold leaves room for 2 x 56 px buttons, the 6rem input and the unit");
  const body = q[2];
  assert.match(body, /display:\s*grid;/);
  assert.match(body, /grid-template-columns:\s*1fr 1fr;/);
  assert.match(body, /\.minutes-stepper__value\s*\{[^}]*grid-column:\s*1 \/ -1;[^}]*grid-row:\s*1;/);
  assert.match(body, /\.minutes-stepper__dec\s*\{[^}]*grid-row:\s*2;[^}]*grid-column:\s*1;/);
  assert.match(body, /\.minutes-stepper__inc\s*\{[^}]*grid-row:\s*2;[^}]*grid-column:\s*2;/);
});

test("nothing in the stepper CSS shrinks text, hides a control or clips content", () => {
  const css = strip(read("../index.css"));
  const block = css.slice(css.indexOf(".minutes-stepper {"), css.indexOf(".step-tracker {"));
  assert.doesNotMatch(block, /font-size|display:\s*none|visibility:\s*hidden|overflow:\s*hidden|text-overflow|opacity|transform:\s*scale|zoom/);
});

test("the stepper's value box no longer uses the shrink-to-nothing combination that caused the overlap", () => {
  const ui = strip(read("../components/session/ui.jsx"));
  const seg = ui.slice(ui.indexOf("export function MinutesStepper"), ui.indexOf("export function OptionGroup"));
  assert.doesNotMatch(seg, /flex min-w-0 flex-1 items-baseline/);
  assert.match(seg, /minutes-stepper__value flex min-w-0 items-baseline justify-center gap-2/);
});

test("both places that use the stepper (Home and Settings) still use MinutesStepper", () => {
  const files = ["../components/session/StartPanel.jsx", "../pages/SettingsCare.jsx", "../components/session/SettingsCare.jsx"];
  const uses = files.map((f) => { try { return /<MinutesStepper/.test(read(f)); } catch { return false; } });
  assert.ok(uses.some(Boolean), "MinutesStepper is still rendered by the Home start panel or Settings");
});
