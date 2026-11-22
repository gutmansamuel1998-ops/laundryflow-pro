// Renders the REAL Ironing Queue screens (the Home card, the post-drying offer, the add form and the list) together
// with the shared care components, and checks the HTML they produce. Like ironCareRender.test.js, the components
// are bundled in memory with esbuild and rendered with react-dom/server, so no browser is needed. Only the storage
// hook is swapped for a stand-in that serves a list the test chooses. If esbuild or react-dom cannot load, the tests
// are SKIPPED with a message (never silently passed), and the run summary shows the skipped count.
//
// What this does not cover: taps, keyboard use, focus movement and screen-reader speech. Those need a real browser
// or phone (see the manual check list in the P4 report). It checks structure, text and attributes.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function load() {
  try {
    const esbuild = await import("esbuild");
    const src = join(root, "src");
    const entry = `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import IronQueueCard from "@/components/iron/IronQueueCard";
      import IronOffer from "@/components/iron/IronOffer";
      import { IronAddForm, IronList } from "@/components/iron/IronParts";
      import CarePanel from "@/components/session/CarePanel";
      import Disclosure from "@/components/session/Disclosure";
      const noop = () => ({ ok: true, items: [], message: "" });
      export const card = () => renderToStaticMarkup(<IronQueueCard />);
      export const offer = () => renderToStaticMarkup(<IronOffer />);
      export const form = (props = {}) => renderToStaticMarkup(<IronAddForm idPrefix="t" onAdd={noop} {...props} />);
      export const list = (items, props = {}) =>
        renderToStaticMarkup(<IronList items={items} onDone={noop} onReopen={noop} onRemove={noop} onChooseHeat={noop} onClearDone={noop} {...props} />);
      export const panel = (view, label) => renderToStaticMarkup(<CarePanel view={view} label={label} />);
      export const disclosure = (label) => renderToStaticMarkup(<Disclosure label={label}><p>Custom content</p></Disclosure>);
    `;
    // The storage hook is replaced with a stand-in that returns whatever list the test sets on globalThis.
    const stubHook = {
      name: "stub-iron-queue-hook",
      setup(build) {
        build.onResolve({ filter: /^@\/hooks\/useIronQueue$/ }, () => ({ path: "useIronQueue", namespace: "stub" }));
        build.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
          contents: "export function useIronQueue() { return globalThis.__ironQueue; }",
          loader: "js",
        }));
      },
    };
    const out = await esbuild.build({
      stdin: { contents: entry, resolveDir: src, loader: "jsx", sourcefile: "entry.jsx" },
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      alias: { "@": src },
      plugins: [stubHook],
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    const dir = mkdtempSync(join(tmpdir(), "iron-queue-render-"));
    const file = join(dir, "bundle.cjs");
    writeFileSync(file, out.outputFiles[0].text);
    const hadWindow = "window" in globalThis;
    if (!hadWindow) globalThis.window = { self: {}, top: {} }; // src/lib/utils.js reads `window` at import
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

const T = 1_700_000_000_000;
const item = (n, extra = {}) => ({ id: `i${n}`, name: `Shirt ${n}`, heat: null, status: "waiting", addedAt: T, doneAt: null, ...extra });
const queue = (items, extra = {}) => {
  globalThis.__ironQueue = { items, ready: true, saveFailed: false, add: () => ({ ok: true, items }), done() {}, reopen() {}, remove() {}, chooseHeat() {}, clearDone() {}, ...extra };
};

// Plain text the way a screen reader would hear it.
const plain = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

const buttons = (html) =>
  [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map((m) => ({ attrs: m[1], text: plain(m[2]), label: (m[1].match(/aria-label="([^"]*)"/) || [])[1] }));

// ─── Home card ──────────────────────────────────────────────────────────────────────────────

t("Home card: renders nothing at all when the list is empty, and nothing while the person is still being identified", () => {
  queue([]);
  assert.equal(mod.card(), "");
  queue([item(1)], { ready: false });
  assert.equal(mod.card(), "");
});

t("Home card: with items it shows a labeled region, a count in words, and a calm no-pressure line", () => {
  queue([item(1), item(2, { status: "done", doneAt: T })]);
  const html = mod.card();
  assert.match(html, /<section[^>]*aria-labelledby="iron-queue-heading"/);
  assert.match(html, /<h2 id="iron-queue-heading"[^>]*>Ironing queue<\/h2>/);
  const text = plain(html);
  assert.match(text, /No rush\. Items wait here until you're ready\./);
  assert.match(text, /1 waiting, 1 finished/);
  assert.match(text, /Shirt 1 Waiting/);
  assert.match(text, /Shirt 2 ✓ Finished/);
  assert.match(text, /Your list is saved on this device only\./);
});

t("Home card: Done, Remove, Not done yet and Clear finished are real buttons that name the item", () => {
  queue([item(1), item(2, { status: "done", doneAt: T })]);
  const all = buttons(mod.card());
  const byLabel = (label) => all.find((b) => b.label === label);
  assert.equal(byLabel("Done: Shirt 1").text, "Done");
  assert.equal(byLabel("Remove Shirt 1").text, "Remove");
  assert.equal(byLabel("Not done yet: Shirt 2").text, "Not done yet");
  assert.equal(byLabel("Remove Shirt 2").text, "Remove");
  assert.ok(all.some((b) => b.text === "Clear finished (1)"));
  assert.equal(all.some((b) => b.label === "Done: Shirt 2"), false); // a finished item has no Done button
});

t("every button's accessible name contains its visible text (WCAG 2.5.3 label in name) and is 48px or taller", () => {
  queue([item(1, { heat: "high" }), item(2, { status: "done", doneAt: T })]);
  for (const html of [mod.card(), mod.list([item(1), item(2, { status: "done" })]), mod.form()]) {
    for (const b of buttons(html)) {
      if (b.label) assert.ok(b.label.toLowerCase().includes(b.text.toLowerCase()), `${b.label} / ${b.text}`);
      assert.match(b.attrs, /min-h-\[(48|56)px\]/, b.text);
      assert.match(b.attrs, /type="(button|submit)"/, b.text);
    }
  }
});

t("Home card: no Clear finished button when nothing is finished", () => {
  queue([item(1), item(2)]);
  assert.equal(buttons(mod.card()).some((b) => /Clear finished/.test(b.text)), false);
});

t("Home card: the P3 ironing guidance is right there, collapsed, with the real symbols and temperatures", () => {
  queue([item(1)]);
  const html = mod.card();
  assert.match(html, /<summary[^>]*>[\s\S]*?Ironing symbols and tips/);
  const text = plain(html);
  assert.match(text, /Iron, one dot \(low heat\)/);
  assert.match(text, /110 °C \(about 230 °F\)/);
  assert.match(text, /150 °C \(about 300 °F\)/);
  assert.match(text, /200 °C \(about 390 °F\)/);
  assert.match(text, /Do not iron \(crossed-out iron\)/);
  assert.match(text, /Do not steam \(iron with crossed-out steam\)/);
  assert.match(text, /limit, not a target/);
  assert.doesNotMatch(html, /<details[^>]*\sopen/); // every disclosure starts closed
});

t("Home card: an item with a heat setting shows its words and the P3 limit; the heat chooser lists all four choices", () => {
  queue([item(1, { heat: "medium" })]);
  const html = mod.card();
  const text = plain(html);
  assert.match(text, /Medium heat \(two dots\)\. Highest soleplate temperature \(the limit\): 150 °C \(about 300 °F\)/);
  assert.match(html, /<label for="heat-i1"[^>]*>Heat setting for Shirt 1<\/label>/);
  const select = html.match(/<select id="heat-i1"[\s\S]*?<\/select>/)[0];
  assert.deepEqual([...select.matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]), ["Not sure yet", "Low heat (one dot)", "Medium heat (two dots)", "High heat (three dots)"]);
  assert.match(select, /<option value="medium" selected/);
});

t("Home card: an item name is shown as text, never as markup", () => {
  queue([item(1, { name: '<img src=x onerror=alert(1)> & "quotes"' })]);
  const html = mod.card();
  assert.doesNotMatch(html, /<img/);
  assert.match(plain(html), /<img src=x onerror=alert\(1\)> & "quotes"/);
});

t("Home card: a list that could not be saved says so kindly", () => {
  queue([item(1)], { saveFailed: true });
  assert.match(plain(mod.card()), /We couldn't save your list on this device\. It still works until you close the app\./);
});

// ─── Full list ──────────────────────────────────────────────────────────────────────────────

t("a full list explains itself supportively, in the card and in the add form", () => {
  const fifty = Array.from({ length: 50 }, (_, n) => item(n + 1));
  queue(fifty);
  const text = plain(mod.card());
  assert.match(text, /Your ironing list is full at 50 items\./);
  assert.match(text, /mark items done or remove ones you no longer need to make room/);
  const done = fifty.map((i, n) => (n < 3 ? { ...i, status: "done", doneAt: T } : i));
  queue(done);
  assert.match(plain(mod.card()), /There's room again once you clear finished items\./);
});

t("a list close to full gives a gentle heads-up about the room left", () => {
  queue(Array.from({ length: 45 }, (_, n) => item(n + 1)));
  assert.match(plain(mod.card()), /45 waiting \(room for 5 more\)/);
});

// ─── Post-drying offer ──────────────────────────────────────────────────────────────────────

t("the offer is a closed disclosure: optional wording, nothing open, nothing focused", () => {
  queue([]);
  const html = mod.offer();
  assert.match(html, /<details/);
  assert.doesNotMatch(html, /<details[^>]*\sopen/);
  assert.doesNotMatch(html, /autofocus/i);
  const text = plain(html);
  assert.match(text, /Anything to iron\? \(optional\)/);
  assert.match(text, /This is optional, and your laundry is complete either way\./);
  assert.match(text, /Nothing to add\? Just leave this closed\./);
  assert.match(text, /Your list is saved on this device only\./);
});

t("the offer holds the add form with a visible label, an 80-character limit, a heat choice and the P3 guidance", () => {
  queue([]);
  const html = mod.offer();
  assert.match(html, /<label for="iron-offer-name"[^>]*>What would you like to iron\?<\/label>/);
  assert.match(html, /<input[^>]*id="iron-offer-name"[^>]*maxLength="80"/);
  assert.match(html, /aria-describedby="iron-offer-name-hint"/);
  assert.match(html, /<label for="iron-offer-heat"[^>]*>Heat setting \(optional\)<\/label>/);
  assert.match(plain(html), /Not sure\? Check the care label, or start on low heat and test a hidden spot first\./);
  assert.match(plain(html), /Ironing symbols and tips/);
  assert.match(plain(html), /Iron, three dots \(high heat\)/);
  assert.equal(buttons(html).find((b) => /Add to my ironing list/.test(b.text)).attrs.includes('type="submit"'), true);
});

t("the offer shows items already on the list, so it can be used to finish them too", () => {
  queue([item(1)]);
  const text = plain(mod.offer());
  assert.match(text, /1 waiting/);
  assert.match(text, /Shirt 1/);
});

t("while the person cannot be identified yet, the offer says so calmly and shows no form", () => {
  queue([], { ready: false });
  const html = mod.offer();
  assert.match(plain(html), /Your ironing list isn't ready yet\. Please try again in a moment\./);
  assert.doesNotMatch(html, /<form/);
});

// ─── Add form ───────────────────────────────────────────────────────────────────────────────

t("add form: label, hint, live status message and a submit button, all connected by ids", () => {
  const html = mod.form();
  assert.match(html, /<form[^>]*novalidate/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  for (const ref of [...html.matchAll(/aria-describedby="([^"]+)"/g)].flatMap((m) => m[1].split(" "))) assert.ok(ids.includes(ref), `missing id ${ref}`);
  for (const target of [...html.matchAll(/for="([^"]+)"/g)].map((m) => m[1])) assert.ok(ids.includes(target), `label points at ${target}`);
  assert.match(html, /<p id="t-message" role="status"/);
  assert.match(plain(html), /A short name is enough, like “blue shirt”\. Up to 80 characters\./);
});

t("add form: when the list is full it says so before anyone tries", () => {
  const html = mod.form({ full: true, fullText: "Your ironing list is full at 50 items." });
  assert.match(plain(html), /Your ironing list is full at 50 items\./);
});

// ─── Colors, motion, sensory ─────────────────────────────────────────────────────────────────

t("nothing relies on color or motion: no color utility classes, no animation classes, no images or audio", () => {
  queue([item(1, { heat: "low" }), item(2, { status: "done", doneAt: T })]);
  for (const html of [mod.card(), mod.offer(), mod.form(), mod.list([item(1)])]) {
    assert.doesNotMatch(html, /\b(text|bg|border)-(red|green|blue|yellow|orange|amber|emerald|rose|pink|purple)-\d/);
    // (The shared buttons' hover color fade, "transition-colors", is not motion and is allowed.)
    assert.doesNotMatch(html, /\banimate-|\btransition(?!-colors)|\bduration-|<audio|<video|<img|<canvas/);
  }
});

t("status is always words: 'Waiting' and '✓ Finished' appear as text on every item", () => {
  const html = mod.list([item(1), item(2, { status: "done" })]);
  const items = html.split("<li ").slice(1);
  assert.equal(items.length, 2);
  assert.match(plain(items[0]), /Waiting/);
  assert.match(plain(items[1]), /✓ Finished/);
});

// ─── Existing care components still work the same ───────────────────────────────────────────

t("the shared care panel is unchanged for the existing views and still renders the care guide inside", () => {
  for (const [view, label, marker] of [
    ["wash", "Washing symbols and tips", /Washing symbols/],
    ["dry", "Drying symbols and tips", /Drying symbols/],
    ["airdry", "Air-drying symbols and tips", /Air-drying/],
    ["iron", "Ironing symbols and tips", /Ironing symbols/],
    ["all", "Laundry Care Guide", /Laundry Care Guide/],
  ]) {
    const html = mod.panel(view, label);
    assert.match(html, /<details class="group rounded-3xl border-2 border-border bg-card"/);
    assert.match(plain(html), marker);
    assert.match(plain(html), /Show ▾ Hide ▴/);
    assert.match(html, /<h3/); // the guide's own heading is inside
  }
});

t("the shared disclosure (used by the care panel and the ironing queue) is a closed details with a text Show/Hide cue", () => {
  const html = mod.disclosure("Add another item");
  assert.match(html, /^<details class="group rounded-3xl border-2 border-border bg-card"><summary[^>]*>/);
  assert.doesNotMatch(html, /\sopen/);
  assert.match(plain(html), /Add another item Show ▾ Hide ▴ Custom content/);
  assert.doesNotMatch(plain(html), /Simple care basics/);
  // The care panel is that same disclosure around the care guide, so both open and close identically.
  const care = mod.panel("wash", "Washing symbols and tips");
  assert.equal(care.slice(0, care.indexOf("</summary>")).replace("Washing symbols and tips", "Add another item"), html.slice(0, html.indexOf("</summary>")));
});
