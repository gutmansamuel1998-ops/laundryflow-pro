// Renders the REAL "Earlier features" section of Settings & Care (the shared Disclosure, the headings, the lists and the
// links) with esbuild + react-dom/server and checks the HTML it produces. No browser is needed.
//
// If esbuild or react-dom cannot load, the first test FAILS with the reason (it is never silently skipped), and the other
// tests are skipped so the run cannot look healthy.
//
// What this does not cover: opening the disclosure with a key or a tap, tab order, focus rings, screen-reader speech,
// 200% text scaling and phone layouts. Those need a real browser or phone (see the manual check list in the P7 report).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { OLDER_TOOLS, OTHER_EARLIER } from "./earlierFeatures.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function load() {
  try {
    const esbuild = await import("esbuild");
    const src = join(root, "src");
    const entry = `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { MemoryRouter } from "react-router-dom";
      import EarlierFeatures from "@/components/settings/EarlierFeatures";
      export const section = () => renderToStaticMarkup(<MemoryRouter><EarlierFeatures /></MemoryRouter>);
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
    const dir = mkdtempSync(join(tmpdir(), "earlier-features-render-"));
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

test("the render harness loaded, so none of the screen tests below were skipped", () => {
  assert.equal(skip, undefined, skip);
});

const unesc = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const text = (html) => unesc(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
const links = (html) => [...html.matchAll(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({ href: m[1], text: unesc(m[2].replace(/<[^>]+>/g, "").trim()), tag: m[0] }));

t("one h2 for the section, then the two groups as h3, with no skipped heading level", () => {
  const html = mod.section();
  const levels = [...html.matchAll(/<h([1-6])\b/g)].map((m) => Number(m[1]));
  assert.equal(levels[0], 2);
  assert.equal(levels.filter((l) => l === 2).length, 1);
  assert.equal(levels.filter((l) => l === 3).length, 2);
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] <= 1, `jump at heading ${i}`);
  assert.ok(!levels.includes(1));
  assert.match(html, /<section aria-labelledby="earlier-heading"/);
  assert.match(html, /<h2 id="earlier-heading"[^>]*>Earlier features<\/h2>/);
  assert.match(html, /<h3 id="older-tools-heading"[^>]*>Older tools now built into your laundry<\/h3>/);
  assert.match(html, /<h3 id="other-earlier-heading"[^>]*>Other earlier features<\/h3>/);
});

t("it starts closed, in the shared disclosure, with a text cue (not only an icon or colour)", () => {
  const html = mod.section();
  assert.match(html, /<details class="[^"]*"(?![^>]*\bopen\b)/);
  assert.match(html, /<summary[^>]*>[\s\S]*Open the earlier tools[\s\S]*Show ▾[\s\S]*Hide ▴/);
  assert.match(html, /min-h-\[56px\]/);
});

t("the three older tools come first, in a labelled list, each with its address and an 'Older tool' tag", () => {
  const html = mod.section();
  const olderPart = html.slice(html.indexOf('id="older-list-heading"'), html.indexOf('id="other-earlier-heading"'));
  const found = links(olderPart);
  assert.deepEqual(found.map((l) => l.href), ["/AirDryTracker", "/IroningQueue", "/LaundryCalendar"]);
  assert.deepEqual(found.map((l) => l.text), ["Air-dry tracker", "Ironing queue", "Laundry calendar"]);
  assert.equal((olderPart.match(/Older tool\./g) || []).length, 3);
  for (const tool of OLDER_TOOLS) assert.ok(text(olderPart).includes(tool.note), tool.label);
  assert.match(html, /<ul aria-labelledby="older-list-heading"/);
});

t("the explanation names the current air-drying and ironing, and says they work inside the main laundry experience", () => {
  const html = text(mod.section());
  assert.match(html, /Air-drying and optional ironing now work inside your main laundry experience/);
  assert.match(html, /choose “I'll air-dry instead” on the dryer step of a laundry session/);
  assert.match(html, /turn on “Offer an ironing list after drying” in the Ironing section above/);
  assert.match(html, /choose them under “My laundry days” above/);
  assert.match(html, /These still work and still keep what you saved in them/);
});

t("all twelve earlier destinations are links, each once, with the same addresses as before", () => {
  const found = links(mod.section());
  assert.equal(found.length, 12);
  const expected = [...OLDER_TOOLS, ...OTHER_EARLIER].map((x) => "/" + x.page).sort();
  assert.deepEqual(found.map((l) => l.href).sort(), expected);
  assert.equal(new Set(found.map((l) => l.href)).size, 12);
  for (const l of found) assert.ok(l.text.length > 2, l.href);
});

t("the other nine are listed under their own heading, in their old order", () => {
  const html = mod.section();
  const part = html.slice(html.indexOf('id="other-earlier-heading"'));
  assert.deepEqual(links(part).map((l) => l.href), OTHER_EARLIER.map((x) => "/" + x.page));
  assert.match(text(part), /These are unchanged and still available/);
});

t("every link is a real anchor with a large target and no click handler tricks", () => {
  const found = links(mod.section());
  for (const l of found) {
    assert.match(l.tag, /min-h-\[48px\]/);
    assert.doesNotMatch(l.tag, /role=|tabindex|onclick|aria-hidden/i);
  }
});

t("lists and headings are connected: every aria-labelledby points at a real heading, and ids are unique", () => {
  const html = mod.section();
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(ids).size, ids.length);
  for (const m of html.matchAll(/aria-labelledby="([^"]+)"/g)) assert.ok(ids.includes(m[1]), m[1]);
});

t("no unnecessary motion, alerts, auto-focus or fixed pixel text sizes", () => {
  const html = mod.section();
  assert.doesNotMatch(html, /animate-|transition|duration-|autofocus|tabindex|role="alert"|aria-live|<dialog|aria-modal/i);
  assert.doesNotMatch(html, /(?<![\w-])(text|h|max-h|w)-\[\d+px\]/);
  assert.doesNotMatch(html, /style="[^"]*(font-size|height)\s*:\s*\d+px/);
});

t("the wording is calm and does not suggest anything was lost", () => {
  const copy = text(mod.section());
  assert.doesNotMatch(copy, /\b(deleted|removed|retired|discontinued|no longer (available|works?)|going away|missed|streak|overdue|behind|guilt|shame)\b/i);
  assert.match(copy, /everything you saved in them is still there/);
});
