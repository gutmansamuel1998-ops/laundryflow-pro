// P8.11 regression tests: toast timing / Close / live region, route titles and focus, tight-screen padding, the Sock Match
// fieldset, and the page-bottom clearance for the feedback button.
//
// Pure functions are tested directly (routeA11y.js). Everything else pins the SOURCE, so a later edit cannot quietly undo
// a fix. They cannot measure layout or real focus movement or hear a screen reader; those were measured in headless
// Chromium (see the P8.11 report). A real phone and a real screen reader are still needed for the spoken experience.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { APP_NAME, pageTitleFor } from "./routeA11y.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const toast = strip(read("../components/ui/toast.jsx"));
const toaster = strip(read("../components/ui/toaster.jsx"));
const useToast = strip(read("../components/ui/use-toast.jsx"));
const layout = strip(read("../Layout.jsx"));
const app = strip(read("../App.jsx"));
const routeComp = strip(read("../components/RouteA11y.jsx"));
const routeLib = strip(read("./routeA11y.js"));
const cssRaw = read("../index.css");
const css = strip(cssRaw);

// ─── 1. Toasts ───────────────────────────────────────────────────────────────────────────────

test("toast: the provider is a polite, non-atomic live region that is always in the page", () => {
  const provider = toast.slice(toast.indexOf("const ToastProvider"), toast.indexOf("ToastProvider.displayName"));
  assert.match(provider, /role="status"/);
  assert.match(provider, /aria-live="polite"/);
  assert.match(provider, /aria-atomic="false"/);
  assert.match(provider, /aria-label="Notifications"/);
});

test("toast: Close is always visible (no opacity-0 / hover-only), a 44px button, and keeps its accessible name", () => {
  const close = toast.slice(toast.indexOf("const ToastClose"), toast.indexOf("ToastClose.displayName"));
  assert.doesNotMatch(close, /opacity-0/);
  assert.doesNotMatch(close, /group-hover:opacity/);
  assert.match(close, /h-11 w-11/);
  assert.match(close, /type="button"/);
  assert.match(close, /aria-label="Close notification"/);
  assert.match(close, /focus-visible:ring-2/);
  assert.match(close, /aria-hidden="true"/, "the X icon is decorative");
});

test("toast: the card leaves room for the Close button and does not animate under reduced motion", () => {
  assert.match(toast, /pr-14/);
  assert.match(toast, /motion-reduce:transition-none/);
});

test("toaster: each toast dismisses itself after its own duration (default 5000 ms), pausing while hovered or focused", () => {
  assert.match(toaster, /typeof duration === "number" \? duration : DEFAULT_TOAST_DURATION/);
  assert.match(toaster, /setTimeout\(\(\) => dismissToast\(id\), ms\)/);
  assert.match(toaster, /clearTimeout\(timer\)/, "the timer is cleaned up");
  assert.match(toaster, /onPointerEnter/);
  assert.match(toaster, /pointerType === "mouse"/, "hover pause is for a mouse only, so a touch toast cannot get stuck");
  assert.match(toaster, /onFocus/);
  assert.match(toaster, /onBlur/);
  assert.match(useToast, /export const DEFAULT_TOAST_DURATION = 5000/);
});

test("toaster: Close has a real handler, and focus goes back where it was instead of dropping to <body>", () => {
  assert.match(toaster, /<ToastClose ref=\{closeRef\} onClick=\{handleClose\} \/>/);
  assert.match(toaster, /dismissToast\(id\)/);
  assert.match(toaster, /target\.focus\(\)/);
});

test("toaster: closed toasts are not rendered, and library-only props do not leak onto the page's div", () => {
  assert.match(toaster, /filter\(\(t\) => t\.open !== false\)/);
  assert.match(toaster, /open: _open, onOpenChange: _onOpenChange/);
});

test("use-toast: a dismissed toast is removed after 1 s (it used to linger for ~17 minutes) and dismiss is stable", () => {
  assert.match(useToast, /const TOAST_REMOVE_DELAY = 1000;/);
  assert.match(useToast, /export function dismissToast\(toastId\)/);
  assert.match(useToast, /dismiss: dismissToast/);
});

test("toast: P8.9's click-through layers are untouched", () => {
  for (const marker of ["const ToastProvider", "const ToastViewport"]) {
    const i = toast.indexOf(marker);
    const cls = /className="([^"]*)"/.exec(toast.slice(i, i + 900))[1].split(/\s+/);
    assert.ok(cls.includes("pointer-events-none") && cls.includes("fixed") && cls.includes("z-[100]"), marker);
  }
  assert.match(toast.slice(toast.indexOf("toastVariants"), toast.indexOf("toastVariants") + 700), /pointer-events-auto/);
});

// ─── 2. Route titles and focus ───────────────────────────────────────────────────────────────

test("route titles: Home, Session, Settings & Care and the earlier home screen each get their own descriptive title", () => {
  const titles = ["/", "/Home", "/Session", "/SettingsCare", "/LegacyHome"].map(pageTitleFor);
  assert.deepEqual(titles, [
    `Home – ${APP_NAME}`,
    `Home – ${APP_NAME}`,
    `Laundry Session – ${APP_NAME}`,
    `Settings & Care – ${APP_NAME}`,
    `Earlier home screen – ${APP_NAME}`,
  ]);
  assert.equal(new Set(titles.slice(1)).size, 4, "every distinct screen has a distinct title");
});

test("route titles: older pages get readable names, odd input never throws, and the app name is always last", () => {
  assert.equal(pageTitleFor("/LaundryBasket"), `Laundry Basket – ${APP_NAME}`);
  assert.equal(pageTitleFor("/AirDryTracker"), `Air Dry Tracker – ${APP_NAME}`);
  assert.equal(pageTitleFor("/some-thing_odd/deeper"), `some thing odd – ${APP_NAME}`);
  assert.equal(pageTitleFor("/Session/"), `Laundry Session – ${APP_NAME}`);
  assert.equal(pageTitleFor(""), `Home – ${APP_NAME}`);
  assert.equal(pageTitleFor(undefined), `Home – ${APP_NAME}`);
  assert.equal(pageTitleFor("/constructor"), `constructor – ${APP_NAME}`, "object prototype names are not treated as known pages");
});

test("route focus: heading is focused only when the page left focus on <body>, nav or nothing in <main>", () => {
  assert.match(routeLib, /main\.contains\(active\)\) return true/);
  assert.match(routeLib, /setAttribute\("tabindex", "-1"\)/);
  assert.match(routeLib, /removeAttribute\("tabindex"\)/);
  assert.match(routeLib, /new MutationObserver/);
  assert.match(routeLib, /timeoutMs = 3000/);
});

test("route focus: the component skips the first load and same-path changes, and does not scroll on Back/Forward", () => {
  assert.match(routeComp, /before === null \|\| before === pathname/);
  assert.match(routeComp, /preventScroll: navigationType === "POP"/);
  assert.match(routeComp, /document\.title = pageTitleFor\(pathname\)/);
});

test("route focus: the component is mounted once, inside the Router, and the skip link is untouched", () => {
  const router = app.slice(app.indexOf("<Router>"), app.indexOf("</Router>"));
  assert.match(router, /<RouteA11y \/>/);
  assert.match(layout, /href="#main-content"/);
  assert.match(layout, /Skip to main content/);
  assert.match(layout, /<main id="main-content">/);
});

test("route focus: the focused heading gets no ring (it is not interactive), but real controls keep theirs", () => {
  assert.match(css, /main h1\[tabindex="-1"\]:focus\s*\{\s*outline: none;\s*\}/);
});

// ─── 3. Tight screens, Sock Match, launcher clearance ────────────────────────────────────────

test("tight screens: Layout flags the page when it is fewer than 14 text-widths wide, and cleans up", () => {
  assert.match(layout, /root\.toggleAttribute\("data-tight", window\.innerWidth \/ rem < 14\)/);
  assert.match(layout, /root\.removeAttribute\("data-tight"\)/);
  assert.match(layout, /attributeFilter: \["style"\]/, "re-measures when the text-size setting changes the root font size");
  assert.match(layout, /getPropertyValue\("--bottom-nav-h"\) !== navH/, "writes only on change, so the observer cannot loop");
});

test("tight screens: the CSS caps ONLY sideways padding, in pixels; text size, heights and visibility are never touched", () => {
  const start = css.indexOf('html[data-tight] main .px-4');
  assert.ok(start > 0, "tight rules exist");
  const block = css.slice(start);
  const rules = block.split("\n").filter((l) => l.trim().startsWith("html[data-tight]"));
  assert.ok(rules.length >= 8, "container, card and button paddings are covered");
  for (const r of rules) {
    assert.doesNotMatch(r, /font-size|line-height|min-height|height:|display:|visibility|overflow|opacity|width:/, r);
  }
  for (const r of rules.filter((l) => !l.includes("Notifications"))) {
    assert.match(r, /padding-inline: min\([\d.]+rem, \d+px\);/, r);
  }
});

test("tight screens: the nav bar, the feedback button and the dialog are outside <main>, so they are not affected", () => {
  assert.ok(css.split("\n").filter((l) => l.startsWith("html[data-tight]")).every((l) => l.includes("main .") || l.includes("Notifications")));
});

test("Sock Match: fieldsets may shrink to their container (no 2px sideways scroll at 320px / 200%)", () => {
  assert.match(css, /fieldset\s*\{\s*min-width: 0;\s*\}/);
});

test("feedback launcher: pages end above both the bar and the floating button (adds only the shortfall beyond pb-32)", () => {
  assert.match(layout, /paddingBottom: "max\(0px, calc\(var\(--bottom-nav-h, 5rem\) \+ 4\.75rem - 8rem\)\)"/);
  assert.match(layout, /compact \? undefined :/, "the compact (unpinned bar) layout keeps its own pb-[4.75rem]");
  assert.match(layout, /aria-label="Send feedback"|FeedbackModal/);
  const feedback = strip(read("../components/FeedbackModal.jsx"));
  assert.match(feedback, /bottom-\[calc\(var\(--bottom-nav-h,5rem\)\+0\.75rem\)\]/, "launcher position is unchanged");
});
