// Renders the REAL care components (CareGuide and CarePanel) with the ironing view and checks the HTML they
// produce. The components are bundled in memory with esbuild (already installed with Vite) and rendered with
// react-dom/server, so this needs no browser. If esbuild or react-dom cannot be loaded the tests are skipped
// with a message instead of failing. It checks structure and text; it does not replace looking at the screen.
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
      import CareGuide from "@/components/session/CareGuide";
      import CarePanel from "@/components/session/CarePanel";
      export const guide = (view) => renderToStaticMarkup(<CareGuide view={view} />);
      export const panel = (view, label) => renderToStaticMarkup(<CarePanel view={view} label={label} />);
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
    const dir = mkdtempSync(join(tmpdir(), "iron-render-"));
    const file = join(dir, "bundle.cjs");
    writeFileSync(file, out.outputFiles[0].text);
    // src/lib/utils.js reads `window` when it is imported, so give it a stand-in just for the import.
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

// Plain text of some HTML, the way a screen reader would hear it (tags removed, entities decoded).
const plain = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

// Each symbol is one <li> of the first list; its picture and its words live in the same item.
const symbolItems = (html) => {
  const firstList = html.slice(html.indexOf("<ul"), html.indexOf("</ul>"));
  return firstList
    .split("<li ")
    .slice(1)
    .map((item) => `<li ${item}`);
};

const NAMES = [
  "Ironing (iron)",
  "Iron, one dot (low heat)",
  "Iron, two dots (medium heat)",
  "Iron, three dots (high heat)",
  "Do not iron (crossed-out iron)",
  "Do not steam (iron with crossed-out steam)",
];

t("the iron view renders with the existing care guide: title, plain-language intro, then the symbols", () => {
  const html = mod.guide("iron");
  const text = plain(html);
  assert.match(html, /<h3[^>]*>Ironing symbols<\/h3>/);
  assert.match(text, /The dots show the highest temperature of the iron's soleplate \(its flat metal base\)/);
  assert.match(text, /That is a limit, not a target, so you can always iron cooler\./);
  assert.match(text, /The tag on your garment is always the authority\./); // the shared reminder is still there
  assert.ok(text.indexOf("Ironing symbols") < text.indexOf("limit, not a target"));
  assert.ok(text.indexOf("limit, not a target") < text.indexOf("Ironing (iron)"));
  assert.match(html, /<h3[^>]*>Simple care basics<\/h3>/);
});

t("six symbols render, each with its name and meaning as real text", () => {
  const items = symbolItems(mod.guide("iron"));
  assert.equal(items.length, 6);
  NAMES.forEach((name, i) => assert.ok(plain(items[i]).startsWith(name), `${i}: ${plain(items[i]).slice(0, 60)}`));
  assert.match(plain(items[4]), /Do not iron or press this item/);
  assert.match(plain(items[5]), /Do not use steam/);
});

t("temperatures appear in °C and °F, labelled as the limit, with fabrics as a separate line", () => {
  const items = symbolItems(mod.guide("iron")).map(plain);
  const expect = [
    ["110 °C (about 230 °F)", "acetate, acrylic, modacrylic, nylon, polypropylene and spandex"],
    ["150 °C (about 300 °F)", "polyester, rayon, silk, triacetate and wool"],
    ["200 °C (about 390 °F)", "cotton and linen"],
  ];
  expect.forEach(([limit, fibres], i) => {
    const text = items[i + 1];
    assert.ok(text.includes(`Highest soleplate temperature (the limit): ${limit}`), text);
    assert.ok(text.includes(`Often recommended for: ${fibres}`), text);
    assert.ok(text.indexOf("the limit") < text.indexOf("Often recommended")); // limit first, guide second
  });
  // The prohibitions and the general iron carry no temperature.
  for (const i of [0, 4, 5]) assert.doesNotMatch(items[i], /°C|°F|Often recommended/);
});

t("the pictures match their names: the number of drawn dots equals the dots in the name", () => {
  const items = symbolItems(mod.guide("iron"));
  const dots = items.map((li) => (li.match(/<circle/g) || []).length);
  assert.deepEqual(dots, [0, 1, 2, 3, 0, 0]);
});

t("every picture is decorative to screen readers and uses the text color; the words carry the meaning", () => {
  const html = mod.guide("iron");
  const svgs = html.match(/<svg[^>]*>/g) || [];
  assert.equal(svgs.length, 6);
  for (const tag of svgs) {
    assert.match(tag, /aria-hidden="true"/);
    assert.match(tag, /focusable="false"/);
    assert.match(tag, /stroke="currentColor"/);
  }
  assert.ok((html.match(/fill="currentColor"/g) || []).length >= 6); // the dots: 1 + 2 + 3
  assert.doesNotMatch(html, /style=|#[0-9a-fA-F]{3,6}\b|rgb\(|hsl\(/); // no inline or hard-coded colors
  assert.doesNotMatch(html, /\b(text|bg|border)-(red|green|blue|yellow|orange|amber)-/);
  // No <title>/<desc> inside a drawing that could be read twice next to the visible name.
  assert.doesNotMatch(html, /<title|<desc/);
});

t("the ironing tips render in the same list style as the other views", () => {
  const html = mod.guide("iron");
  const tips = html.slice(html.indexOf("Simple care basics"));
  assert.equal((tips.match(/<li>/g) || []).length, 5);
  assert.match(plain(tips), /Check the care tag first/);
  assert.match(plain(tips), /Start on low heat and test a hidden spot first/);
  assert.match(plain(tips), /unplug it when you finish/);
});

t("inside the shared CarePanel it is a collapsed, keyboard-friendly disclosure", () => {
  const html = mod.panel("iron", "Ironing symbols and tips");
  assert.match(html, /^<details/);
  assert.doesNotMatch(html.slice(0, html.indexOf(">")), /\sopen/); // collapsed by default
  assert.match(html, /<summary/);
  assert.match(plain(html), /Ironing symbols and tips Show ▾ Hide ▴/);
  assert.match(plain(html), /Highest soleplate temperature \(the limit\): 200 °C \(about 390 °F\)/);
});

t("the shared full guide (Home, Settings & Care) lists the ironing symbols too, once each", () => {
  const text = plain(mod.guide("all"));
  for (const name of NAMES) assert.equal(text.split(name).length - 1, 1, name);
  assert.match(text, /Dry cleaning \(circle\)/); // the rest of the guide is still there
});

t("the other views render exactly as before: no ironing facts, no intro", () => {
  for (const view of ["wash", "dry", "airdry"]) {
    const text = plain(mod.guide(view));
    assert.doesNotMatch(text, /soleplate|Highest|Often recommended|Do not steam|Iron, /, view);
  }
  assert.match(plain(mod.guide("dry")), /Tumble drying \(square with a circle\)/);
  assert.match(plain(mod.guide("airdry")), /Dry flat \(one horizontal line\)/);
  assert.match(plain(mod.guide("wash")), /Washing \(tub\)/);
});

t("an unknown view still falls back to the full guide", () => {
  assert.match(plain(mod.guide("nonsense")), /Laundry symbol reference/);
});
