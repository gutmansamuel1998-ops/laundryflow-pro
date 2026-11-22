// P7 navigation tests: the "Earlier features" list in Settings & Care is regrouped and explained, and nothing is lost.
// These check the data, the wording, and how the pieces are wired. earlierFeaturesRender.test.js renders the real
// section and checks the HTML.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { EARLIER_COPY, OLDER_TOOLS, OTHER_EARLIER } from "./earlierFeatures.js";
import { AIR_DRY_COPY } from "./airDry.js";

const appRoot = fileURLToPath(new URL("../..", import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// The twelve links "Earlier features" had before P7 (the old ARCHIVED_LINKS), in their old order.
const BEFORE_P7 = [
  ["Previous home screen", "LegacyHome"],
  ["Previous settings", "Settings"],
  ["Load history", "Loads"],
  ["Digital closet", "DigitalCloset"],
  ["Supplies", "Supplies"],
  ["Shopping list", "ShoppingList"],
  ["Laundry calendar", "LaundryCalendar"],
  ["Ironing queue", "IroningQueue"],
  ["Air-dry tracker", "AirDryTracker"],
  ["Household", "HouseholdManagement"],
  ["Laundry funds", "LaundryFunds"],
  ["Bubbles chat (earlier version)", "Bubbles"],
];
const now = [...OLDER_TOOLS, ...OTHER_EARLIER];
const sentence = (label) => label.toLowerCase();

// ─── Nothing is lost ────────────────────────────────────────────────────────────────────────────

test("every earlier feature that was listed before is still listed, once, under the same name and address", () => {
  assert.equal(now.length, BEFORE_P7.length);
  for (const [label, page] of BEFORE_P7) {
    const hits = now.filter((x) => x.page === page);
    assert.equal(hits.length, 1, page);
    assert.equal(sentence(hits[0].label), sentence(label), page);
  }
  assert.equal(new Set(now.map((x) => x.page)).size, now.length);
});

test("the three older tools are grouped together in the requested order, and the other nine keep their old relative order", () => {
  assert.deepEqual(OLDER_TOOLS.map((t) => t.page), ["AirDryTracker", "IroningQueue", "LaundryCalendar"]);
  assert.deepEqual(OLDER_TOOLS.map((t) => t.label), ["Air-dry tracker", "Ironing queue", "Laundry calendar"]);
  const rest = BEFORE_P7.filter(([, p]) => !OLDER_TOOLS.some((t) => t.page === p)).map(([, p]) => p);
  assert.deepEqual(OTHER_EARLIER.map((t) => t.page), rest);
});

test("every one of them still has a route, so no link leads to a missing page", () => {
  const app = read("../App.jsx");
  const config = read("../pages.config.js");
  for (const { page } of now) {
    const routed = app.includes(`path="/${page}"`) || new RegExp(`["']${page}["']\\s*:`).test(config);
    assert.ok(routed, page);
  }
});

test("the older tools' pages and the data they use are still there", () => {
  for (const page of ["AirDryTracker", "IroningQueue", "LaundryCalendar"]) assert.ok(existsSync(join(appRoot, "src", "pages", `${page}.jsx`)), page);
  const entities = readdirSync(join(appRoot, "base44", "entities")).map((n) => n.replace(/\.jsonc?$/, ""));
  for (const e of ["AirDrySession", "IroningSession", "Load"]) assert.ok(entities.includes(e), e);
  assert.equal(entities.includes("LaundryPrefs"), false);
  assert.equal(entities.includes("IronItem"), false);
});

test("the old pages were not edited to point at the new section, and no new navigation was added", () => {
  for (const f of ["../pages/AirDryTracker.jsx", "../pages/IroningQueue.jsx", "../pages/LaundryCalendar.jsx", "../Layout.jsx", "../App.jsx"]) {
    assert.doesNotMatch(read(f), /EarlierFeatures|earlierFeatures/, f);
  }
  const layout = strip(read("../Layout.jsx"));
  const items = layout.match(/const navItems = \[([\s\S]*?)\];/)[1];
  assert.equal((items.match(/page:/g) || []).length, 3); // Home, Session, Settings & Care: unchanged
  assert.match(items, /SettingsCare/);
});

// ─── Words ──────────────────────────────────────────────────────────────────────────────────────

test("the section says air-drying and optional ironing now work inside the main laundry experience", () => {
  assert.match(EARLIER_COPY.olderIntro, /air-drying and optional ironing now work inside your main laundry experience/i);
  assert.equal(EARLIER_COPY.olderHeading, "Older tools"); // not "built into your laundry": that is only true of two of the three
});

test("it points to the current versions by the same names the real controls use", () => {
  const joined = EARLIER_COPY.currentItems.join(" | ");
  assert.ok(joined.includes(AIR_DRY_COPY.setupToggleLabel.replace("'", "'")) || joined.includes(AIR_DRY_COPY.setupToggleLabel.replace("'", "’")), "air-dry label");
  const settings = read("../pages/SettingsCare.jsx");
  assert.match(settings, /label="Offer an ironing list after drying"/);
  assert.ok(joined.includes("Offer an ironing list after drying"));
  assert.match(joined, /My laundry days/);
  assert.ok(read("../components/laundryDays/LaundryDaysSettings.jsx").includes("sectionHeading") || read("../lib/laundryRoutineView.js").includes('sectionHeading: "My laundry days"'));
  assert.match(settings, /<h2 id="ironing-heading"/); // "the Ironing section above" really exists, above
  assert.ok(settings.indexOf('id="ironing-heading"') < settings.indexOf("<EarlierFeatures />"));
  assert.ok(settings.indexOf("<LaundryDaysSettings />") < settings.indexOf("<EarlierFeatures />"));
});

test("each older tool says how it relates to the newer feature; none is described as gone", () => {
  const [airDry, ironing, calendar] = OLDER_TOOLS;
  for (const t of [airDry, ironing]) {
    assert.match(t.note, /older/i, t.label);
    assert.match(t.note, /current version|inside your laundry session/i, t.label);
  }
  // P8: the calendar was NOT recreated, and its note must not suggest it was
  assert.match(calendar.note, /still the full Laundry calendar/i);
  assert.match(calendar.note, /simpler plan/i);
  assert.match(calendar.note, /doesn't replace it/i);
  const all = JSON.stringify([EARLIER_COPY, OLDER_TOOLS, OTHER_EARLIER]);
  assert.doesNotMatch(all, /\b(deleted|removed|retired|discontinued|deprecated|no longer (available|works?)|going away|will be (removed|deleted)|replaced and)\b/i);
  assert.match(EARLIER_COPY.keptNote, /still work/i);
  assert.match(EARLIER_COPY.keptNote, /still keep what you saved/i);
  assert.match(EARLIER_COPY.keptNote, /not moved into the newer features automatically|nothing in them is moved into the newer features automatically/i);
  assert.match(EARLIER_COPY.intro, /everything you saved in them is still there/i);
});

test("it does not claim the two sets of data are combined, or that anything syncs or sends reminders", () => {
  assert.match(EARLIER_COPY.keptNote, /moved into the newer features automatically/i);
  assert.doesNotMatch(JSON.stringify(EARLIER_COPY), /\b(sync(ed|s|ing)?|merged?|imported?|migrat\w+|reminders? (are|will be) sent)\b/i);
});

test("the wording is calm: no counters, no guilt, no pressure", () => {
  const all = JSON.stringify([EARLIER_COPY, OLDER_TOOLS, OTHER_EARLIER]);
  assert.doesNotMatch(all, /\b(miss(ed|es|ing)?|streaks?|penalt\w*|overdue|behind|forgot\w*|guilt\w*|shame\w*|lazy|you must|urgent|hurry|act now|don't (lose|miss))\b/i);
  assert.doesNotMatch(all, /[!]{1}/);
});

// ─── Wiring ─────────────────────────────────────────────────────────────────────────────────────

test("Settings & Care renders the section once, after the Care guide, and no longer carries its own copy of the list", () => {
  const src = strip(read("../pages/SettingsCare.jsx"));
  assert.equal((src.match(/<EarlierFeatures \/>/g) || []).length, 1);
  assert.match(src, /import EarlierFeatures from "@\/components\/settings\/EarlierFeatures";/);
  assert.ok(src.indexOf('id="care-heading"') < src.indexOf("<EarlierFeatures />"));
  assert.doesNotMatch(src, /ARCHIVED_LINKS|<details|createPageUrl|react-router-dom/);
  assert.match(src, /<h1 className="text-3xl font-semibold">Settings &amp; Care<\/h1>/);
});

test("every other Settings & Care section is still there, in the same order", () => {
  const src = strip(read("../pages/SettingsCare.jsx"));
  const order = ["reminders-heading", "timers-heading", "<LaundryDaysSettings />", "ironing-heading", "a11y-heading", "sound-heading", "care-heading", "<EarlierFeatures />"];
  let last = -1;
  for (const marker of order) {
    const at = src.indexOf(marker);
    assert.ok(at > last, marker);
    last = at;
  }
});

test("the section is plain display: it reads no data, saves nothing, sends nothing, and has no motion, alerts or focus changes", () => {
  const code = strip(read("../components/settings/EarlierFeatures.jsx")) + strip(read("./earlierFeatures.js"));
  assert.doesNotMatch(code, /base44|entities|fetch\(|XMLHttpRequest|WebSocket|Notification\b|serviceWorker|localStorage|sessionStorage|indexedDB|useQuery|useEffect|useState|Date\b|Intl\./);
  assert.doesNotMatch(code, /\balert\(|\bconfirm\(|autoFocus|\.focus\(|tabIndex|aria-live|role="alert"|animate-|transition|duration-|framer|setTimeout|setInterval/);
  const imports = [...code.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ["@/components/session/Disclosure", "@/lib/earlierFeatures", "@/utils", "react", "react-router-dom"]);
});

test("none of the areas this patch must not touch mention the new section", () => {
  for (const f of [
    "./notify.js", "./nativeNotifications.js", "./notificationPlan.js", "./notificationScheduler.js", "./reminderStore.js",
    "../hooks/useNotifications.js", "../context/AuthContext.jsx", "../lib/AuthContext.jsx", "../components/session/Disclosure.jsx", "../pages/Session.jsx", "../pages/Home.jsx",
  ]) {
    if (!existsSync(new URL(f, import.meta.url))) continue;
    assert.doesNotMatch(read(f), /EarlierFeatures|earlierFeatures/, f);
  }
});
