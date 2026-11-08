// Run with: node --test src/lib/careContent.test.js
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
} from "./careContent.js";

const names = (view) => getCareSymbols(view).map((s) => s.id);

test("symbol and tip ids are unique (one source, no duplicates)", () => {
  assert.equal(new Set(CARE_SYMBOLS.map((s) => s.id)).size, CARE_SYMBOLS.length);
  assert.equal(new Set(CARE_TIPS.map((t) => t.id)).size, CARE_TIPS.length);
});

test("the full view contains every symbol and every tip", () => {
  assert.deepEqual(names("all"), CARE_SYMBOLS.map((s) => s.id));
  assert.equal(getCareTips("all").length, CARE_TIPS.length);
  assert.deepEqual(names(undefined), names("all")); // default
  assert.deepEqual(names("nonsense"), names("all")); // unknown view falls back to everything
});

test("wash view: washing, temperature, bleaching, prep tips; no drying symbols", () => {
  const ids = names("wash");
  assert.ok(ids.includes("washing") && ids.includes("bleaching") && ids.includes("crossed"));
  assert.ok(!ids.includes("tumble") && !ids.includes("line_dry") && !ids.includes("ironing"));
  const washing = CARE_SYMBOLS.find((s) => s.id === "washing");
  assert.match(washing.meaning, /temperature/i);
  const tips = getCareTips("wash").map((t) => t.id);
  assert.ok(tips.includes("tag") && tips.includes("pockets") && tips.includes("sort"));
  assert.ok(!tips.includes("lint"));
});

test("dry view: tumble restrictions, heat indicators, and air-drying; no washing symbols", () => {
  const ids = names("dry");
  assert.ok(ids.includes("tumble") && ids.includes("crossed"));
  for (const air of ["line_dry", "drip_dry", "dry_flat", "shade_dry"]) assert.ok(ids.includes(air), air);
  assert.ok(!ids.includes("washing") && !ids.includes("bleaching"));
  const tumble = CARE_SYMBOLS.find((s) => s.id === "tumble");
  assert.match(tumble.meaning, /dots show the heat/i);
  assert.match(tumble.meaning, /no heat/i);
  const crossed = CARE_SYMBOLS.find((s) => s.id === "crossed");
  assert.match(crossed.meaning, /do not tumble dry/i); // the restriction rule
  const tips = getCareTips("dry").map((t) => t.id);
  assert.ok(tips.includes("lint") && tips.includes("move_soon") && tips.includes("air_dry"));
  assert.ok(!tips.includes("pockets"));
});

test("existing symbols and tips from the first version are preserved", () => {
  const original = [
    "Washing (tub)",
    "Bleaching (triangle)",
    "Tumble drying (square with a circle)",
    "Ironing (iron)",
    "Dry cleaning (circle)",
    "Crossed out (any symbol with an X)",
  ];
  const have = CARE_SYMBOLS.map((s) => s.name);
  for (const n of original) assert.ok(have.includes(n), n);
  const tips = CARE_TIPS.map((t) => t.text);
  for (const t of [
    "Check the care tag first. It beats any general rule.",
    "Empty pockets and close zips before washing.",
    "Don't overfill the washer or the dryer. Clothes need room to move.",
    "Wash similar fabrics and colors together. Dark and new clothes can bleed.",
    "Move clothes to the dryer soon after the wash ends to avoid a damp smell.",
    "Clean the dryer's lint filter before each load.",
    "Take clothes out when the dryer stops. It cuts down on wrinkles.",
  ]) {
    assert.ok(tips.includes(t), t);
  }
});

test("stage guidance: Start/Wash -> washing; Move/Dry -> drying; Put Away -> nothing", () => {
  assert.deepEqual(careViewForPhase("none"), { view: "wash", label: "Check laundry care symbols" });
  assert.equal(careViewForPhase("ready").view, "wash");
  assert.equal(careViewForPhase("wash_running").view, "wash");
  assert.deepEqual(careViewForPhase("wash_elapsed"), { view: "dry", label: "Check drying symbols" });
  assert.equal(careViewForPhase("dryer_setup").view, "dry");
  assert.equal(careViewForPhase("dry_running").view, "dry");
  // Stage 5 prioritizes completion: no guidance at all.
  for (const p of ["dry_elapsed", "put_away", "done"]) assert.equal(careViewForPhase(p), null, p);
});

test("every guidance view referenced by a phase exists", () => {
  for (const p of ["none", "ready", "wash_running", "wash_elapsed", "dryer_setup", "dry_running"]) {
    assert.ok(CARE_VIEWS[careViewForPhase(p).view], p);
  }
});

test("guidance code is isolated from the session, timer, and persistence layers", () => {
  const forbidden = /laundrySession|useLaundrySession|useNow|reminderStore|base44|react-query|sessionPrefs/;
  for (const file of ["./careContent.js", "../components/session/CarePanel.jsx", "../components/session/CareGuide.jsx"]) {
    const src = readFileSync(new URL(file, import.meta.url), "utf8");
    const imports = src.split("\n").filter((l) => /^\s*import\s/.test(l));
    for (const line of imports) assert.ok(!forbidden.test(line), `${file} must not import: ${line}`);
  }
});

test("screens wire the guide in the right places (static check)", () => {
  const read = (f) => readFileSync(new URL(f, import.meta.url), "utf8");
  const home = read("../pages/Home.jsx");
  assert.match(home, /<CarePanel[^>]*label="Laundry Care Guide"/);
  const session = read("../pages/Session.jsx");
  assert.match(session, /careViewForPhase\(phase\)/);
  assert.match(session, /<CarePanel key=\{care\.view\}/);
  const settings = read("../pages/SettingsCare.jsx");
  assert.match(settings, /<CarePanel[^>]*view="all"/);
  assert.ok(!/import CareGuide/.test(settings)); // Settings reuses the shared panel, not a private copy
});
