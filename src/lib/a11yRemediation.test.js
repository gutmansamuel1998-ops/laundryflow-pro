// P8.6 regression tests for the accessibility fixes found in the P8.5 browser audit:
//   1. keyboard focus is never left under the fixed bottom navigation,
//   2. nothing pushes the page sideways at large text (step tracker, minute stepper, reminder options, day picker),
//   3. a disabled switch row keeps AA-contrast text (no opacity fade) and still looks disabled,
//   4. the Care Guide's headings follow the page's heading level,
//   5. "My laundry days" does not write its summary twice, and ironing rows are less cluttered.
//
// Part A renders the REAL components (esbuild + react-dom/server). Part B checks the source and stylesheet. If esbuild or
// react-dom cannot load, the first render test FAILS with the reason (never silently skipped).
// What this cannot check: layout, colour contrast, focus position or text scaling in a real browser. Those were
// re-checked in headless Chromium for P8.6 (see the report) and still need a real phone and screen reader.
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
      import CareGuide from "@/components/session/CareGuide";
      import BubblesCard from "@/components/session/BubblesCard";
      import { OptionGroup, ToggleRow, MinutesStepper } from "@/components/session/ui";
      import { IronList } from "@/components/iron/IronParts";
      import { STATUS } from "@/lib/ironQueue";
      const noop = () => ({ ok: true });
      export const care = (props) => renderToStaticMarkup(<CareGuide {...props} />);
      export const bubbles = (props) => renderToStaticMarkup(<BubblesCard {...props} />);
      export const group = () => renderToStaticMarkup(<OptionGroup legend="How often?" name="x" value="a" onChange={noop} options={[{ value: "a", label: "Standard", hint: "A hint" }, { value: "b", label: "Off" }]} />);
      export const toggle = (props) => renderToStaticMarkup(<ToggleRow id="t" label="Show notifications" hint="Notifications are blocked. Allow them in your browser's site settings." checked={false} onChange={noop} {...props} />);
      export const stepper = () => renderToStaticMarkup(<MinutesStepper id="m" label="Wash cycle length" value={35} onChange={noop} />);
      export const iron = (items) => renderToStaticMarkup(<IronList items={items} onDone={noop} onReopen={noop} onRemove={noop} onChooseHeat={noop} onClearDone={noop} />);
      export const WAITING = STATUS.WAITING;
      export const DONE = STATUS.DONE;
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
    const dir = mkdtempSync(join(tmpdir(), "a11y-remediation-"));
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

// ─── 4. Care Guide heading levels ────────────────────────────────────────────────────────────

t("Care Guide headings are h3 by default (inside a section that has its own h2)", () => {
  const html = mod.care({ view: "all" });
  assert.match(html, /<h3 [^>]*>Simple care basics<\/h3>/);
  assert.doesNotMatch(html, /<h2 /);
});

t("Care Guide headings become h2 when the guide sits directly under the page's h1", () => {
  const html = mod.care({ view: "all", headingLevel: 2 });
  assert.match(html, /<h2 [^>]*>Simple care basics<\/h2>/);
  assert.doesNotMatch(html, /<h3 /);
});

test("pages directly under an h1 ask for level-2 care guide headings; sections with an h2 keep level 3", () => {
  assert.match(strip(read("../pages/Home.jsx")), /<CarePanel view="all" label="Laundry Care Guide" headingLevel=\{2\} \/>/);
  assert.match(strip(read("../pages/Session.jsx")), /<CarePanel key=\{care\.view\} view=\{care\.view\} label=\{care\.label\} headingLevel=\{2\} \/>/);
  assert.match(strip(read("../pages/SettingsCare.jsx")), /<CarePanel view="all" label="Laundry Care Guide" \/>/, "Settings has an h2 'Care' above it");
  assert.match(strip(read("../components/iron/IronOffer.jsx")), /<IronGuidePanel headingLevel=\{2\} \/>/, "the Session offer has no heading of its own");
  assert.match(strip(read("../components/iron/IronQueueCard.jsx")), /<IronGuidePanel \/>/, "the Home card has its own h2");
});

// ─── 3. Disabled switch row keeps readable text ──────────────────────────────────────────────

t("a disabled switch row does not fade its text with opacity, and still reads as disabled", () => {
  const html = mod.toggle({ disabled: true });
  assert.doesNotMatch(html, /opacity-/);
  assert.match(html, /border-dashed/);
  assert.match(html, /cursor-not-allowed/);
  assert.match(html, /bg-muted/);
  assert.match(html, /<input [^>]*disabled/);
  assert.match(html, /Notifications are blocked\./);
});

t("an enabled switch row is unchanged: pointer cursor, solid border, native switch", () => {
  const html = mod.toggle({ disabled: false });
  assert.match(html, /cursor-pointer/);
  assert.doesNotMatch(html, /border-dashed|cursor-not-allowed/);
  assert.match(html, /role="switch"/);
});

// ─── 2. Large text: nothing is allowed to force the page wider ───────────────────────────────

t("option groups: the fieldset can shrink, and each option wraps instead of squeezing its words", () => {
  const html = mod.group();
  assert.match(html, /<fieldset class="min-w-0 /);
  assert.match(html, /flex-wrap/);
  assert.match(html, /basis-\[6rem\]/);
});

t("the minute stepper's minus, number and plus can move to another row instead of overflowing (rules live in index.css since P8.8)", () => {
  const html = mod.stepper();
  assert.match(html, /<div class="minutes-stepper">/);
  assert.match(html, /class="minutes-stepper__row"/);
  const css = strip(read("../index.css"));
  assert.match(css, /\.minutes-stepper \.minutes-stepper__row\s*\{[^}]*flex-wrap:\s*wrap/);
  assert.match(html, /aria-label="Decrease Wash cycle length by 5 minutes"/);
  assert.match(html, /aria-label="Increase Wash cycle length by 5 minutes"/);
});

t("the Bubbles card can wrap its emoji above its text, and keeps its live region", () => {
  const html = mod.bubbles({ headline: "Time to put your clothes away!", detail: "Check the dryer.", urgent: false });
  assert.match(html, /flex-wrap/);
  assert.match(html, /role="status"/);
  assert.match(html, /basis-\[9rem\]/);
});

test("switch rows wrap their On/Off + switch under the text at very large text", () => {
  const ui = strip(read("../components/session/ui.jsx"));
  assert.match(ui, /flex min-h-\[56px\] flex-wrap items-center justify-between/);
  assert.match(ui, /min-w-0 flex-1 basis-\[6rem\] break-words/);
});

test("the day picker's fieldset can shrink, and each day label wraps instead of forcing a 10rem minimum", () => {
  const src = strip(read("../components/laundryDays/LaundryDaysSettings.jsx"));
  assert.match(src, /<fieldset className="min-w-0 space-y-2">/);
  assert.match(src, /min-w-\[min\(10rem,100%\)\]/);
  assert.doesNotMatch(src, /min-w-\[10rem\]/);
  assert.match(src, /flex-wrap items-center gap-x-3 gap-y-1/);
});

test("disclosure summaries and the timer header wrap, and the stylesheet breaks only over-long words", () => {
  assert.match(strip(read("../components/session/Disclosure.jsx")), /list-none flex-wrap items-center justify-between/);
  assert.match(strip(read("../components/session/SessionTimer.jsx")), /flex flex-wrap items-baseline justify-between/);
  const css = strip(read("../index.css"));
  assert.match(css, /body\s*\{\s*overflow-wrap:\s*break-word;\s*\}/);
  assert.doesNotMatch(css, /overflow-wrap:\s*anywhere/, "'anywhere' lets flex items collapse to one letter per line");
  assert.doesNotMatch(strip(read("../components/session/Disclosure.jsx")), /overflow-wrap:anywhere/);
});

test("the step tracker switches to a vertical list by container width (in rem, so it follows text size), and stays an ordered list", () => {
  const css = strip(read("../index.css"));
  assert.match(css, /\.step-tracker\s*\{\s*container-type:\s*inline-size;\s*\}/);
  assert.match(css, /@container \(max-width: 14rem\)/);
  assert.match(css, /\.step-tracker__list\s*\{\s*flex-direction:\s*column/);
  const page = strip(read("../pages/Session.jsx"));
  assert.match(page, /<div className="step-tracker">/);
  assert.match(page, /<ol aria-label="Laundry steps" className="step-tracker__list /);
  assert.match(page, /step-tracker__item/);
  assert.match(page, /step-tracker__label/);
  // Nothing is hidden or shrunk to make room: the container query changes layout only.
  const start = css.indexOf("@container");
  const end = css.indexOf("/* WCAG focus-visible", start);
  const block = css.slice(start, end > 0 ? end : undefined);
  assert.doesNotMatch(block, /font-size|display:\s*none|visibility|clip/);
});

// ─── 1. Focus never hides behind the fixed navigation ────────────────────────────────────────

test("the layout measures the bottom navigation and publishes its height; the stylesheet uses it as scroll padding", () => {
  const layout = strip(read("../Layout.jsx"));
  assert.match(layout, /<nav ref=\{navRef\} aria-label="Main navigation"/);
  assert.match(layout, /setProperty\("--bottom-nav-h"/);
  assert.match(layout, /new ResizeObserver\(publish\)/);
  assert.match(layout, /observer\.disconnect\(\)/);
  assert.match(layout, /removeProperty\("--bottom-nav-h"\)/);
  assert.match(layout, /typeof ResizeObserver === "undefined"/, "older browsers still get the measured height once");
  const css = strip(read("../index.css"));
  assert.match(css, /html\s*\{\s*scroll-padding-bottom:\s*calc\(var\(--bottom-nav-h,\s*5rem\)\s*\+\s*1rem\);\s*scroll-padding-top:\s*var\(--sticky-top-h,\s*0px\);\s*\}/);
});

test("the navigation itself is unchanged: three destinations, skip link first, no new tabs", () => {
  const layout = strip(read("../Layout.jsx"));
  assert.equal((layout.match(/\{ page: "/g) || []).length, 3);
  assert.match(layout, /Skip to main content/);
  assert.match(layout, /aria-current=\{isActive \? "page" : undefined\}/);
});

// ─── 5. Polish: duplicate wording and ironing clutter ────────────────────────────────────────

test("'My laundry days' shows 'Saved.' and keeps the repeated summary for screen readers only", () => {
  const src = strip(read("../components/laundryDays/LaundryDaysSettings.jsx"));
  assert.match(src, /note === `\$\{COPY\.saved\} \$\{model\.summary\}`/);
  assert.match(src, /<span className="sr-only"> \{model\.summary\}<\/span>/);
  assert.match(src, /<p role="status"/, "the status region is kept, so the change is still announced");
});

const ITEMS = (mod && [
  { id: "a", name: "Blue work shirt", status: mod.WAITING, heat: null },
  { id: "b", name: "Linen trousers", status: mod.WAITING, heat: "medium" },
  { id: "c", name: "Pillowcase", status: mod.DONE, heat: "low" },
]) || [];

t("each waiting ironing row keeps its name, status, Done and Remove, with the heat select in a closed disclosure", () => {
  const html = mod.iron(ITEMS);
  const rows = html.split("<li ").slice(1);
  assert.equal(rows.length, 3);
  const [first, second, third] = rows;
  for (const row of [first, second]) {
    assert.match(row, /<details class="group mt-2">/);
    assert.doesNotMatch(row, /<details[^>]* open/);
    assert.match(row, /<select id="heat-/);
    assert.match(row, /Waiting/);
  }
  assert.match(first, /aria-label="Done: Blue work shirt"/);
  assert.match(first, /aria-label="Remove Blue work shirt"/);
  assert.match(first, /Choose a heat setting<span class="sr-only"> for Blue work shirt<\/span>/);
  assert.match(second, /Change heat setting<span class="sr-only"> for Linen trousers<\/span>/);
  // A finished row has no heat disclosure, and can still be reopened or removed.
  assert.doesNotMatch(third, /<details/);
  assert.match(third, /aria-label="Not done yet: Pillowcase"/);
  assert.match(third, /aria-label="Remove Pillowcase"/);
});

t("the heat select keeps its visible label and the same options inside the disclosure", () => {
  const html = mod.iron(ITEMS);
  assert.match(html, /<label for="heat-a"[^>]*>Heat setting for Blue work shirt<\/label>/);
  for (const label of ["Not sure yet", "Low heat (one dot)", "Medium heat (two dots)", "High heat (three dots)"]) assert.ok(html.includes(label), label);
  assert.doesNotMatch(html, /aria-label="(Change|Choose)[^"]*heat/, "the summary's name is its text, so it matches what is shown");
});

test("the ironing disclosure uses the same keyboard-operable native details element as the rest of the app", () => {
  const src = strip(read("../components/iron/IronParts.jsx"));
  assert.match(src, /<summary\s+className="flex min-h-\[48px\] cursor-pointer list-none flex-wrap/);
  assert.match(src, /aria-hidden="true"/);
  assert.doesNotMatch(src, /onToggle|onClick=\{\(\) => setOpen/, "no custom open state to get out of step with the element");
});
