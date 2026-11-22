// How the Ironing Queue is connected: the opt-in setting, the post-drying offer, the Home card, and the promise
// that finishing laundry never depends on any of it. These read the source files and run the real pure logic;
// ironQueueRender.test.js renders the screens.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DEFAULT_PREFS, getPrefs, setPrefs } from "./sessionPrefs.js";
import { completeUpdate, confirmDryDoneUpdate, getPhase, startDryUpdate } from "./laundrySession.js";
import { shouldOfferIroning, STATUS } from "./ironQueue.js";
import { careViewForPhase } from "./careContent.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

// ─── Opt-in setting ─────────────────────────────────────────────────────────────────────────

test("ironing suggestions are off by default", () => {
  assert.equal(DEFAULT_PREFS.ironSuggestions, false);
  assert.equal(getPrefs().ironSuggestions, false);
});

test("turning suggestions on is saved on the device and turning them off again works", () => {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  };
  try {
    setPrefs({ ironSuggestions: true });
    assert.equal(getPrefs().ironSuggestions, true);
    assert.equal(JSON.parse(data.get("lf_prefs_v1")).ironSuggestions, true);
    assert.equal(shouldOfferIroning({ prefs: getPrefs(), phase: "put_away" }), true);
    setPrefs({ ironSuggestions: false });
    assert.equal(JSON.parse(data.get("lf_prefs_v1")).ironSuggestions, false);
    assert.equal(shouldOfferIroning({ prefs: getPrefs(), phase: "put_away" }), false);
  } finally {
    delete globalThis.localStorage;
  }
});

test("Settings & Care has one clearly labeled switch for it, wired to that setting, and it is off unless the setting is exactly true", () => {
  const src = read("../pages/SettingsCare.jsx");
  assert.equal((src.match(/id="iron-suggestions"/g) || []).length, 1);
  assert.match(src, /label="Offer an ironing list after drying"/);
  assert.match(src, /checked=\{prefs\.ironSuggestions === true\}/);
  assert.match(src, /onChange=\{\(v\) => setPrefs\(\{ ironSuggestions: v \}\)\}/);
  assert.match(src, /It's off until you turn it on/);
  assert.match(src, /saved on this device only/);
  assert.match(src, /<h2 id="ironing-heading"/);
});

test("the switch is a real labeled switch: the shared ToggleRow gives it a label, a visible On/Off word and a large target", () => {
  const ui = read("../components/session/ui.jsx");
  assert.match(ui, /role="switch"/);
  assert.match(ui, /htmlFor=\{id\}/);
  assert.match(ui, /checked \? "On" : "Off"/);
  assert.match(ui, /min-h-\[56px\]/);
});

// ─── The offer after drying ─────────────────────────────────────────────────────────────────

test("Session shows the offer only through shouldOfferIroning, after the next-step actions, as its own component", () => {
  const src = strip(read("../pages/Session.jsx"));
  assert.match(src, /import IronOffer from "@\/components\/iron\/IronOffer"/);
  assert.match(src, /const offerIroning = shouldOfferIroning\(\{ prefs, phase, airDry: copy\.airDry \}\)/);
  assert.equal((src.match(/<IronOffer \/>/g) || []).length, 1);
  assert.match(src, /\{offerIroning && <IronOffer \/>\}/);
  // It sits after the "Next step" section closes, so it is never inside the laundry steps themselves.
  const nextStepEnd = src.indexOf("</section>", src.indexOf('aria-label="Next step"'));
  assert.ok(nextStepEnd > 0 && src.indexOf("<IronOffer />") > nextStepEnd);
  // The page never reads or writes the queue itself.
  assert.doesNotMatch(src, /useIronQueue|ironQueueStore|readQueue|writeQueue/);
});

test("the offer is collapsed by default, optional, and has no timers, sounds, notifications or focus-stealing", () => {
  const offer = strip(read("../components/iron/IronOffer.jsx"));
  const parts = strip(read("../components/iron/IronParts.jsx"));
  const card = strip(read("../components/iron/IronQueueCard.jsx"));
  assert.match(offer, /<CarePanel label=\{IRON_COPY\.offerSummary\}>/); // CarePanel is a closed <details>
  assert.doesNotMatch(read("../components/session/CarePanel.jsx"), /\bopen\b=/);
  for (const src of [offer, parts, card]) {
    assert.doesNotMatch(src, /autoFocus|setInterval|setTimeout|Notification|gameAudio|confetti|framer-motion|animate-|\.play\(|useNow|useLaundrySession|laundrySession/);
  }
});

test("finishing laundry never depends on the ironing list: 'I put my clothes away' is gated only by the save in progress", () => {
  const src = strip(read("../pages/Session.jsx"));
  const button = src.slice(src.indexOf("I put my clothes away") - 400, src.indexOf("I put my clothes away"));
  assert.match(button, /disabled=\{pending\}/);
  assert.match(button, /await actions\.complete\(\);\s*setJustCompleted\(true\);/);
  assert.doesNotMatch(button, /iron/i);
});

test("the laundry steps are produced by the same pure functions with or without an ironing list", () => {
  const load = { id: "L1", status: "active", current_state: "drying", state_history: [] };
  const now = Date.parse("2026-11-22T10:00:00Z");
  // The builders take only the load and the time, so no ironing list (full, finished, or none) can reach them.
  assert.equal(completeUpdate.length, 2);
  assert.equal(confirmDryDoneUpdate.length, 2);
  assert.equal(startDryUpdate.length, 4);
  const done = confirmDryDoneUpdate(load, now);
  assert.equal(done.current_state, "dry_finished");
  assert.equal(getPhase({ ...load, ...done }, now), "put_away");
  const finished = completeUpdate({ ...load, ...done }, now);
  assert.equal(finished.current_state, "completed");
  assert.equal(finished.status, "completed");
  assert.equal(typeof finished.completed_at, "string");
});

test("the laundry session, timers, reminders and notifications do not know the ironing queue exists", () => {
  for (const file of ["./laundrySession.js", "./airDry.js", "./notificationPlan.js", "./notificationScheduler.js", "./reminderStore.js", "../hooks/useLaundrySession.js", "../hooks/useNotifications.js", "../components/session/SessionTimer.jsx", "../components/session/BubblesCard.jsx", "../components/session/SockMatch.jsx"]) {
    assert.doesNotMatch(strip(read(file)), /ironQueue|IronOffer|IronQueueCard|useIronQueue|IronParts|ironSuggestions|lf_iron_queue/, file);
  }
});

test("no laundry stage maps to the ironing guidance: it appears only inside the optional offer and the Home card", () => {
  for (const phase of ["none", "ready", "wash_running", "wash_elapsed", "dryer_setup", "dry_running", "dry_elapsed", "put_away", "done"]) {
    for (const flag of [{ airDry: false }, { airDry: true }]) {
      const v = careViewForPhase(phase, flag);
      assert.ok(v === null || v.view !== "iron", phase);
    }
  }
  assert.match(read("../components/iron/IronOffer.jsx"), /<CarePanel view="iron" label=\{IRON_COPY\.guideLabel\} \/>/);
  assert.match(read("../components/iron/IronQueueCard.jsx"), /<CarePanel view="iron" label=\{IRON_COPY\.guideLabel\} \/>/);
});

// ─── Home card ──────────────────────────────────────────────────────────────────────────────

test("Home renders the card once, and the card renders nothing until the list has an item", () => {
  const home = strip(read("../pages/Home.jsx"));
  assert.equal((home.match(/<IronQueueCard \/>/g) || []).length, 1);
  assert.match(home, /import IronQueueCard from "@\/components\/iron\/IronQueueCard"/);
  const card = strip(read("../components/iron/IronQueueCard.jsx"));
  assert.match(card, /if \(!queue\.ready \|\| queue\.items\.length === 0\) return null;/);
  // It does not depend on the opt-in setting, so items already on the list never disappear.
  assert.doesNotMatch(card, /ironSuggestions|usePrefs/);
});

// ─── Accessible actions ─────────────────────────────────────────────────────────────────────

test("Done, Remove and Clear finished are real buttons with the item named in their accessible name", () => {
  const parts = strip(read("../components/iron/IronParts.jsx"));
  assert.match(parts, /aria-label=\{`Done: \$\{item\.name\}`\}[\s\S]{0,200}Done\s*<\/button>/);
  assert.match(parts, /aria-label=\{`Remove \$\{item\.name\}`\}[\s\S]{0,200}Remove\s*<\/button>/);
  assert.match(parts, /aria-label=\{`Not done yet: \$\{item\.name\}`\}[\s\S]{0,200}Not done yet\s*<\/button>/);
  assert.match(parts, /\{IRON_COPY\.clearFinished\} \(\{done\}\)/);
  assert.equal((parts.match(/<button/g) || []).length, 3);
  assert.equal((parts.match(/type="button"/g) || []).length, 3);
  assert.doesNotMatch(parts, /onKeyDown|onMouseDown|tabIndex=\{?-?[1-9]/); // native buttons only: no key handling to get wrong
});

test("touch targets: every button is at least 48px tall", () => {
  const parts = read("../components/iron/IronParts.jsx");
  assert.match(parts, /SMALL_BUTTON =\s*"min-h-\[48px\] min-w-\[96px\]/);
  assert.match(parts, /FIELD =\s*"min-h-\[56px\]/);
  assert.match(read("../components/session/ui.jsx"), /"w-full min-h-\[56px\]/); // BigButton: Add, Clear finished
});

test("the ironing parts rely on no color to say anything, and add no animation of their own", () => {
  const parts = strip(read("../components/iron/IronParts.jsx") + read("../components/iron/IronOffer.jsx") + read("../components/iron/IronQueueCard.jsx"));
  assert.doesNotMatch(parts, /\b(text|bg|border)-(red|green|blue|yellow|orange|amber|emerald|rose|pink|purple)-\d/);
  assert.doesNotMatch(parts, /\btransition|\banimate|\bduration-|\bmotion\./);
  assert.match(parts, /"✓ Finished" : "Waiting"/);
});

// ─── Scope ──────────────────────────────────────────────────────────────────────────────────

test("no entity, route, navigation or server call was added for ironing", () => {
  const app = read("../App.jsx");
  const routes = [...app.matchAll(/path="\/(Iron\w*)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(routes, ["IroningDashboard", "IroningGuide", "IroningQueue"]); // the three that already existed
  for (const file of ["../App.jsx", "../Layout.jsx", "../pages.config.js", "./ironQueue.js", "./ironQueueStore.js", "../hooks/useIronQueue.js", "../components/iron/IronParts.jsx", "../components/iron/IronOffer.jsx", "../components/iron/IronQueueCard.jsx"]) {
    assert.doesNotMatch(strip(read(file)), /IronItem|LaundryPrefs/, file);
  }
  const nav = read("../components/home/QuickLinksSection.jsx");
  assert.equal((nav.match(/page: "Ironing\w*"/g) || []).length, 1);
});

test("the earlier ironing pages and Home components are untouched", () => {
  const legacyQueue = read("../components/home/IroningQueueSection.jsx");
  assert.match(legacyQueue, /base44\.entities\.ClothingItem/);
  assert.doesNotMatch(legacyQueue, /ironQueue|useIronQueue/);
  assert.doesNotMatch(read("../pages/IroningQueue.jsx"), /ironQueue|useIronQueue/);
  assert.equal(STATUS.DONE, "done");
});
