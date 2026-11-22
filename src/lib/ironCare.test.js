// Ironing care guidance (the "iron" care view). These check the symbols, their plain-language wording and the
// temperatures, and that the new content stays inside the shared care architecture: no new stage, no queue,
// no entity, no navigation. Facts and sources are documented at the top of careContent.js.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CARE_SYMBOLS,
  CARE_TIPS,
  CARE_VIEWS,
  careViewForPhase,
  getCareSymbols,
  getCareTips,
  ironFibresText,
  ironLimitText,
} from "./careContent.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const byId = (id) => CARE_SYMBOLS.find((s) => s.id === id);
const ids = (view) => getCareSymbols(view).map((s) => s.id);
const withoutComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const IRON_IDS = ["ironing", "iron_low", "iron_medium", "iron_high", "iron_none", "no_steam"];
const COLOR_WORDS = /\b(red|green|blue|yellow|orange|purple|pink|black|white|grey|gray|colou?r(ed)?)\b/i;

// ─── The view and its symbols ────────────────────────────────────────────────────────────────────

test("the iron view has the five required symbols plus the general iron, in a sensible order", () => {
  assert.equal(CARE_VIEWS.iron.title, "Ironing symbols");
  assert.deepEqual(ids("iron"), IRON_IDS);
  // Only ironing: no washing, drying, bleaching or crossed-out-tumble content.
  for (const other of ["washing", "bleaching", "tumble", "line_dry", "dry_cleaning", "crossed"]) {
    assert.ok(!ids("iron").includes(other), other);
  }
});

test("each symbol is named in words: dots counted, heat named, prohibitions stated", () => {
  assert.equal(byId("iron_low").name, "Iron, one dot (low heat)");
  assert.equal(byId("iron_medium").name, "Iron, two dots (medium heat)");
  assert.equal(byId("iron_high").name, "Iron, three dots (high heat)");
  assert.match(byId("iron_none").name, /^Do not iron/);
  assert.match(byId("iron_none").name, /crossed-out iron/);
  assert.match(byId("no_steam").name, /^Do not steam/);
  assert.match(byId("no_steam").name, /crossed-out steam/);
  assert.equal(byId("ironing").name, "Ironing (iron)"); // the original entry keeps its name
});

// ─── Temperatures ────────────────────────────────────────────────────────────────────────────────

test("dots map to the standard maximum soleplate temperatures: 110, 150 and 200 °C", () => {
  const rows = [
    ["iron_low", 1, 110],
    ["iron_medium", 2, 150],
    ["iron_high", 3, 200],
  ];
  for (const [id, dots, c] of rows) {
    assert.equal(byId(id).dots, dots, id);
    assert.equal(byId(id).maxC, c, id);
  }
  assert.ok(byId("iron_low").maxC < byId("iron_medium").maxC && byId("iron_medium").maxC < byId("iron_high").maxC);
});

test("Fahrenheit matches the printed US figures and stays within 3 °F of the exact conversion", () => {
  assert.deepEqual([230, 300, 390], ["iron_low", "iron_medium", "iron_high"].map((id) => byId(id).maxF));
  for (const id of ["iron_low", "iron_medium", "iron_high"]) {
    const s = byId(id);
    const exact = (s.maxC * 9) / 5 + 32;
    assert.ok(Math.abs(s.maxF - exact) <= 3, `${id}: ${s.maxF} vs ${exact}`);
  }
});

test("the temperature line shows both units and calls it the limit", () => {
  assert.equal(ironLimitText(byId("iron_low")), "Highest soleplate temperature (the limit): 110 °C (about 230 °F)");
  assert.equal(ironLimitText(byId("iron_medium")), "Highest soleplate temperature (the limit): 150 °C (about 300 °F)");
  assert.equal(ironLimitText(byId("iron_high")), "Highest soleplate temperature (the limit): 200 °C (about 390 °F)");
});

test("symbols with no temperature show none (do not iron, do not steam, the general iron, everything else)", () => {
  for (const s of CARE_SYMBOLS.filter((x) => !["iron_low", "iron_medium", "iron_high"].includes(x.id))) {
    assert.equal(ironLimitText(s), null, s.id);
    assert.equal(ironFibresText(s), null, s.id);
  }
  assert.equal(ironLimitText(null), null);
  assert.equal(ironLimitText({ maxC: 110 }), null); // both units or nothing
  assert.equal(ironLimitText({ maxC: "hot", maxF: "hotter" }), null);
});

// ─── Maximum soleplate temperature versus recommended fabrics ────────────────────────────────────

test("the limit and the fabric recommendation are separate things, labelled differently", () => {
  for (const id of ["iron_low", "iron_medium", "iron_high"]) {
    const s = byId(id);
    assert.match(ironLimitText(s), /limit/i);
    assert.match(ironFibresText(s), /^Often recommended for: /);
    assert.doesNotMatch(ironFibresText(s), /°|\d/); // the fabric line never carries a number
  }
  assert.match(CARE_VIEWS.iron.intro, /limit, not a target/);
  assert.match(CARE_VIEWS.iron.intro, /always iron cooler/);
});

test("typical fabrics follow the Government of Canada guide, with no fabric under two heat levels", () => {
  assert.equal(byId("iron_high").fibres, "cotton and linen");
  assert.equal(byId("iron_medium").fibres, "polyester, rayon, silk, triacetate and wool");
  assert.equal(byId("iron_low").fibres, "acetate, acrylic, modacrylic, nylon, polypropylene and spandex");
  const all = ["iron_low", "iron_medium", "iron_high"].flatMap((id) => byId(id).fibres.split(/,\s*|\s+and\s+/));
  assert.equal(new Set(all).size, all.length);
});

test("jargon is explained: soleplate is defined where it is first used", () => {
  const intro = CARE_VIEWS.iron.intro;
  assert.match(intro, /soleplate \(its flat metal base\)/);
  // Every ironing text that says "soleplate" sits under a view whose intro defines it.
  assert.ok(intro.indexOf("soleplate") < intro.indexOf("limit"));
  for (const s of IRON_IDS.map(byId)) assert.doesNotMatch(s.meaning, /\b(soleplate|thermostat|ISO|GINETEX|ASTM)\b/i, s.id);
});

// ─── The prohibitions ────────────────────────────────────────────────────────────────────────────

test("do not iron: says not to iron or press, and why", () => {
  const m = byId("iron_none").meaning;
  assert.match(m, /Do not iron or press/);
  assert.match(m, /damage/i);
  assert.equal(byId("iron_none").maxC, undefined);
});

test("do not steam: ironing is still allowed, dry, at the heat the dots show", () => {
  const m = byId("no_steam").meaning;
  assert.match(m, /^Do not use steam/);
  assert.match(m, /still iron/i);
  assert.match(m, /steam button off/i);
  assert.doesNotMatch(m, /do not iron/i);
});

test("the one-dot entry carries the steam caution; the others do not claim it", () => {
  assert.match(byId("iron_low").meaning, /steam can damage/i);
  assert.match(byId("iron_low").meaning, /iron it dry/i);
  assert.doesNotMatch(byId("iron_medium").meaning + byId("iron_high").meaning, /steam/i);
});

// ─── Plain language and no color-only meaning ────────────────────────────────────────────────────

test("plain language: short sentences everywhere in the ironing content", () => {
  const texts = [
    CARE_VIEWS.iron.intro,
    ...IRON_IDS.map((id) => byId(id).meaning),
    ...CARE_TIPS.filter((t) => t.views.includes("iron")).map((t) => t.text),
  ];
  for (const text of texts) {
    for (const sentence of text.split(/(?<=[.!?])\s+/)) {
      assert.ok(sentence.split(/\s+/).length <= 30, `too long: ${sentence}`);
    }
  }
});

test("nothing is explained through color: no color words in the ironing text", () => {
  const texts = [
    CARE_VIEWS.iron.title,
    CARE_VIEWS.iron.intro,
    ...IRON_IDS.flatMap((id) => [byId(id).name, byId(id).meaning, ironLimitText(byId(id)), ironFibresText(byId(id))]),
    ...getCareTips("iron").map((t) => t.text),
  ].filter(Boolean);
  for (const text of texts) assert.doesNotMatch(text, COLOR_WORDS, text);
});

test("every symbol has a drawing, drawn in the text color and hidden from screen readers (the name is the alternative)", () => {
  const guide = read("../components/session/CareGuide.jsx");
  for (const id of IRON_IDS) assert.ok(new RegExp(`\\b${id}:`).test(guide), `${id} has a drawing`);
  assert.match(guide, /aria-hidden="true" focusable="false"/);
  assert.match(guide, /stroke: "currentColor"/);
  assert.match(guide, /fill="currentColor"/); // the dots use the text color too
  assert.doesNotMatch(withoutComments(guide), /(text|bg|border|fill|stroke)-(red|green|blue|yellow|orange|amber|lime|emerald|rose|pink|purple)/);
  // The name, meaning, limit and fabrics are all real text next to the picture.
  assert.match(guide, /ironLimitText\(s\)/);
  assert.match(guide, /ironFibresText\(s\)/);
});

// ─── Tips and the other views ────────────────────────────────────────────────────────────────────

test("ironing tips: the tag first, then start low, mixed fabrics, inside out, safety", () => {
  assert.deepEqual(getCareTips("iron").map((t) => t.id), ["tag", "iron_start_low", "iron_mixed", "iron_inside_out", "iron_safety"]);
  assert.match(CARE_TIPS.find((t) => t.id === "iron_start_low").text, /test a hidden spot/);
  assert.match(CARE_TIPS.find((t) => t.id === "iron_safety").text, /unplug/);
});

test("the other care views are unchanged by ironing", () => {
  for (const view of ["wash", "dry", "airdry"]) {
    for (const id of IRON_IDS.filter((x) => x !== "ironing")) assert.ok(!ids(view).includes(id), `${view}/${id}`);
    for (const tip of getCareTips(view)) assert.ok(!tip.id.startsWith("iron_"), `${view}/${tip.id}`);
  }
  assert.deepEqual(getCareTips("wash").map((t) => t.id), ["tag", "pockets", "overfill", "sort"]);
  assert.deepEqual(getCareTips("dry").map((t) => t.id), ["tag", "overfill", "move_soon", "lint", "take_out", "air_dry"]);
  assert.deepEqual(getCareTips("airdry").map((t) => t.id), ["tag", "air_dry", "air_dry_time"]);
  assert.deepEqual(ids("airdry"), ["line_dry", "drip_dry", "dry_flat", "shade_dry"]);
  // The shared "all" view (Home, Settings & Care) lists the ironing symbols once each.
  for (const id of IRON_IDS) assert.equal(ids("all").filter((x) => x === id).length, 1, id);
  assert.equal(CARE_VIEWS.wash.intro, undefined);
  assert.equal(CARE_VIEWS.dry.intro, undefined);
});

// ─── Scope: this patch only prepares guidance ────────────────────────────────────────────────────

test("no laundry stage shows the ironing view yet, and the session state machine is untouched", () => {
  const phases = ["none", "ready", "wash_running", "wash_elapsed", "dryer_setup", "dry_running", "dry_elapsed", "put_away", "done"];
  for (const phase of phases) {
    for (const flag of [undefined, { airDry: false }, { airDry: true }]) {
      const v = careViewForPhase(phase, flag);
      assert.ok(v === null || v.view !== "iron", `${phase} ${JSON.stringify(flag)}`);
    }
  }
  const session = withoutComments(read("./laundrySession.js") + read("../pages/Session.jsx") + read("../hooks/useLaundrySession.js"));
  assert.doesNotMatch(session, /IronItem|IroningSession|LaundryPrefs|view="iron"|"iron"/);
  assert.doesNotMatch(read("./laundrySession.js"), /iron_|ironing/i);
});

test("no navigation, route or entity was added for ironing", () => {
  const app = read("../App.jsx");
  // Only the three pre-existing ironing pages are routed; this patch adds none and no IronItem exists.
  const routes = [...app.matchAll(/path="\/(Iron\w*)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(routes, ["IroningDashboard", "IroningGuide", "IroningQueue"]);
  assert.doesNotMatch(app, /IronItem|LaundryPrefs/);
  const nav = read("../components/home/QuickLinksSection.jsx");
  assert.equal((nav.match(/page: "Ironing\w*"/g) || []).length, 1); // the existing quick link, not a new one
  const careSrc = withoutComments(read("./careContent.js"));
  assert.doesNotMatch(careSrc, /^\s*import\s/m); // still free of session, storage and network code
  assert.doesNotMatch(careSrc, /base44|fetch\(|localStorage/);
});
