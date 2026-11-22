// How "My laundry days" is connected (P6): where it appears, what it may and may not touch, and the promises that it
// stays local, uses the P5 helpers for every date, sends nothing, and never gets in the way of a laundry session.
// These read the source files; laundryDaysRender.test.js renders the screens, and laundryRoutineStore.test.js runs the
// real storage and controller.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_PREFS } from "./sessionPrefs.js";

const srcRoot = fileURLToPath(new URL("..", import.meta.url));
const appRoot = fileURLToPath(new URL("../..", import.meta.url));
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\s\/\/ .*$/gm, "");

const NEW_FILES = [
  "../lib/deviceZone.js",
  "../lib/laundryRoutineStore.js",
  "../lib/laundryRoutineView.js",
  "../lib/laundryRoutineController.js",
  "../hooks/useLaundryRoutine.js",
  "../components/laundryDays/LaundryDayCard.jsx",
  "../components/laundryDays/LaundryDayActions.jsx",
  "../components/laundryDays/LaundryDaysSettings.jsx",
];
const code = Object.fromEntries(NEW_FILES.map((f) => [f, strip(read(f))]));
const COMPONENTS = NEW_FILES.filter((f) => f.includes("components/"));
const LIBS = NEW_FILES.filter((f) => f.includes("/lib/"));

// ─── Placement ──────────────────────────────────────────────────────────────────────────────────

test("Home shows the card between the session area and the ironing card, and hides it while a session is active or loading", () => {
  const home = strip(read("../pages/Home.jsx"));
  assert.equal((home.match(/<LaundryDayCard\b/g) || []).length, 1);
  assert.match(home, /import LaundryDayCard from "@\/components\/laundryDays\/LaundryDayCard";/);
  assert.match(home, /<LaundryDayCard sessionActive=\{isLoading \|\| running\} \/>/);
  assert.ok(home.indexOf("<LaundryDayCard") < home.indexOf("<IronQueueCard />"));
  assert.ok(home.indexOf("<LaundryDayCard") > home.indexOf("<StartPanel"));
  assert.ok(home.indexOf("<LaundryDayCard") < home.indexOf("<CarePanel"));
  // "running" is Home's own meaning of an active session, unchanged by this patch
  assert.match(home, /const running = !!load && phase !== "ready" && phase !== "none";/);
});

test("Home still does everything it did: start, resume, timer, ironing card, care guide, loads finished", () => {
  const home = strip(read("../pages/Home.jsx"));
  for (const piece of ["<StartPanel onStarted={goToSession} />", "<SessionTimer phase={phase} timer={timer} sticky={false} />", "Resume laundry session", "<IronQueueCard />", '<CarePanel view="all" label="Laundry Care Guide" />', "Loads finished so far:"]) {
    assert.ok(home.includes(piece), piece);
  }
});

test("Settings & Care has one 'My laundry days' section, after the reminders and timers and before ironing, and every earlier setting is still there", () => {
  const src = strip(read("../pages/SettingsCare.jsx"));
  assert.equal((src.match(/<LaundryDaysSettings \/>/g) || []).length, 1);
  assert.match(src, /import LaundryDaysSettings from "@\/components\/laundryDays\/LaundryDaysSettings";/);
  const at = src.indexOf("<LaundryDaysSettings />");
  assert.ok(src.indexOf('id="timers-heading"') < at);
  assert.ok(at < src.indexOf('id="ironing-heading"'));
  for (const id of ['id="reminders-heading"', 'id="iron-suggestions"', 'id="a11y-heading"', 'id="sound-heading"', 'id="system-notifications"', 'id="care-heading"', 'id="high-contrast"']) assert.ok(src.includes(id), id);
  assert.match(src, /checked=\{prefs\.ironSuggestions === true\}/);
});

test("the section's own screen is optional and starts off", () => {
  const src = code["../components/laundryDays/LaundryDaysSettings.jsx"];
  assert.match(src, /id="laundry-days-on"/);
  assert.match(src, /checked=\{model\.enabled\}/);
  assert.match(src, /onChange=\{\(v\) => apply\(\{ enabled: v \}\)\}/);
  assert.match(src, /\{model\.enabled && \(/); // the day and time controls only appear once it is turned on
});

// ─── The one-day actions are wired to the P5 actions, and never to the weekly plan ───────────────

test("snooze, skip, move and put back each call their own action", () => {
  const card = code["../components/laundryDays/LaundryDayCard.jsx"];
  assert.match(card, /onSnooze=\{\(id, minutes\) => act\("snooze", \(\) => days\.snooze\(id, minutes\)\)\}/);
  assert.match(card, /onSkip=\{\(id\) => act\("skip", \(\) => days\.skip\(id\)\)\}/);
  assert.match(card, /onMove=\{\(id, date, time\) => act\("move", \(\) => days\.move\(id, date, time\)\)\}/);
  assert.match(card, /onRestore=\{\(id\) => act\("restore", \(\) => days\.restore\(id\)\)\}/);
  assert.match(card, /days\.restore\(model\.restoreId\)/);
  const actions = code["../components/laundryDays/LaundryDayActions.jsx"];
  assert.match(actions, /onClick=\{\(\) => onSnooze\(target\.id, Number\(minutes\)\)\}/);
  assert.match(actions, /onClick=\{\(\) => onSkip\(target\.id\)\}/);
  assert.match(actions, /onMove\(target\.id, date, time\)/);
  assert.match(actions, /onClick=\{\(\) => onRestore\(c\.id\)\}/);
  // the one-day screens never call the weekly-plan action
  assert.doesNotMatch(card + actions, /setSchedule|updateSchedule/);
  assert.equal((code["../components/laundryDays/LaundryDaysSettings.jsx"].match(/days\.setSchedule\(/g) || []).length, 1);
});

test("the controller maps each action to the matching P5 function, and nothing else", () => {
  const c = code["../lib/laundryRoutineController.js"];
  for (const [name, fn] of [["setSchedule", "updateSchedule"], ["skip", "skipOccurrence"], ["snooze", "snoozeOccurrence"], ["move", "rescheduleOccurrence"], ["restore", "restoreOccurrence"], ["acknowledgeZone", "noteZone"]]) {
    assert.match(c, new RegExp(`${name}: \\(owner[^)]*\\) => apply\\(owner, \\(r, c\\) => [^\\n]*${fn}\\(`), name);
  }
  assert.match(c, /import \{[^}]*\} from "\.\/laundryRoutine\.js";/);
  assert.match(c, /import \{ keyFor, readRoutine, writeRoutine \} from "\.\/laundryRoutineStore\.js";/);
});

test("the hook is thin: it uses the owner label, the controller and the device zone, and nothing else", () => {
  const hook = code["../hooks/useLaundryRoutine.js"];
  assert.match(hook, /useOwnerKey/);
  assert.match(hook, /createRoutineController/);
  assert.match(hook, /deviceZone/);
  assert.match(hook, /saved\.owner === owner/); // never shows one person's plan to another
  const imports = [...hook.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort();
  assert.deepEqual(imports, ["@/hooks/useOwnerKey", "@/lib/deviceZone", "@/lib/laundryRoutine", "@/lib/laundryRoutineController", "@/lib/laundryRoutineStore", "react"]);
});

test("the store keys every record by owner and checks every read", () => {
  const store = code["../lib/laundryRoutineStore.js"];
  assert.match(store, /lf_laundry_routine_v1:/);
  assert.match(store, /sanitizeRoutine\(parsed\.routine\)/);
  assert.match(store, /parsed\.owner === owner/);
  assert.doesNotMatch(store, /localStorage\.clear|storage\.clear|storage\.key\(|storage\.length|Object\.keys\(storage|for \(const \w+ in storage/); // never walks or wipes other keys
  assert.doesNotMatch(store, /Date\.now|new Date/); // the time is passed in
});

// ─── Local only, sends nothing, touches nothing else ─────────────────────────────────────────────

test("none of the new files reach the server, send a notification or email, or open a connection", () => {
  const forbidden = /base44Client|base44\.|@\/api|entities\b|integrations|agents\.|\bfunctions\b|\bfetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon|Notification\b|serviceWorker|PushManager|sendEmail|SendEmail|mailto:|@\/lib\/notify|@\/lib\/nativeNotifications|notificationPlan|notificationScheduler|reminderStore|useNotifications|Capacitor|LocalNotifications/;
  for (const f of NEW_FILES) assert.doesNotMatch(code[f], forbidden, f);
});

test("they import nothing from the session, payment, AI, auth or premium code either", () => {
  for (const f of NEW_FILES) {
    const imports = [...code[f].matchAll(/from "([^"]+)"/g)].map((m) => m[1]);
    for (const spec of imports) assert.doesNotMatch(spec, /laundrySession|useLaundrySession|sessionCache|usePremium|AuthContext|checkout|payment|bubbles|legacyAi|sessionPrefs|useNow/i, `${f}: ${spec}`);
  }
});

test("storage is used only by the store (and only through a passed-in object); the screens never touch it", () => {
  for (const f of NEW_FILES.filter((x) => x !== "../lib/laundryRoutineStore.js")) {
    assert.doesNotMatch(code[f], /localStorage|sessionStorage|indexedDB|document\.cookie/, f);
  }
  assert.match(code["../lib/laundryRoutineStore.js"], /typeof localStorage !== "undefined" \? localStorage : null/);
  assert.match(code["../lib/laundryRoutineStore.js"], /catch \{\s*return null;/);
});

test("the clock and the zone are read in exactly two small places; no date work is done in the screens or the view", () => {
  const clockUsers = NEW_FILES.filter((f) => /Date\.now\(|new Date\(|Intl\.|DateTimeFormat/.test(code[f]));
  assert.deepEqual(clockUsers.sort(), ["../hooks/useLaundryRoutine.js", "../lib/deviceZone.js"].sort());
  for (const f of [...COMPONENTS, "../lib/laundryRoutineView.js", "../lib/laundryRoutineStore.js", "../lib/laundryRoutineController.js"]) {
    assert.doesNotMatch(code[f], /new Date|Date\.(now|UTC|parse)|getUTC|getDay|getDate|getHours|getTimezoneOffset|toLocale|Intl\.|DateTimeFormat/, f);
  }
  // everything date-like in the screens is a P5 helper's answer
  assert.match(code["../lib/laundryRoutineView.js"], /from "\.\/laundryRoutine\.js"/);
});

test("no existing notification, reminder, session, offline-cache, payment or AI code was changed to know about laundry days", () => {
  const untouched = [
    "../lib/notify.js", "../lib/nativeNotifications.js", "../lib/notificationPlan.js", "../lib/notificationScheduler.js", "../lib/reminderStore.js",
    "../hooks/useNotifications.js", "../hooks/useNativePermission.js", "../lib/laundrySession.js", "../hooks/useLaundrySession.js", "../lib/sessionCache.js",
    "../lib/sessionPrefs.js", "../pages/Session.jsx", "../lib/ironQueue.js", "../lib/ironQueueStore.js", "../hooks/useIronQueue.js",
  ];
  for (const f of untouched) {
    if (!existsSync(new URL(f, import.meta.url))) continue;
    assert.doesNotMatch(read(f), /laundryRoutine|laundryDays|LaundryDay|useLaundryRoutine|deviceZone/, f);
  }
});

test("no production entity or function was created: there is no LaundryPrefs or IronItem anywhere in the app's data model", () => {
  const entityDir = join(appRoot, "base44", "entities");
  const names = readdirSync(entityDir).map((n) => n.replace(/\.jsonc?$/, ""));
  assert.ok(names.length > 5);
  assert.equal(names.includes("LaundryPrefs"), false);
  assert.equal(names.includes("IronItem"), false);
  const walk = (dir, out = []) => {
    for (const n of readdirSync(dir)) {
      const full = join(dir, n);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(js|jsx|ts|tsx)$/.test(n) && !/\.test\.js$/.test(n)) out.push(full);
    }
    return out;
  };
  for (const f of walk(srcRoot)) {
    assert.doesNotMatch(strip(readFileSync(f, "utf8")), /entities\.(LaundryPrefs|IronItem)\b/, f);
  }
});

test("the app preferences have no laundry-day setting: the plan lives in its own store", () => {
  assert.ok(Object.keys(DEFAULT_PREFS).every((k) => !/routine|laundryDay|weekday|schedule/i.test(k)));
  assert.doesNotMatch(strip(read("../pages/SettingsCare.jsx")), /setPrefs\(\{[^}]*(weekday|laundryDay|routine)/i);
});

// ─── Accessibility, from the source ─────────────────────────────────────────────────────────────

test("no screen uses alerts, dialogs, auto-focus, timers that move focus, or motion", () => {
  for (const f of COMPONENTS) {
    const src = code[f];
    assert.doesNotMatch(src, /\balert\(|\bconfirm\(|\bprompt\(|autoFocus|aria-live="assertive"|role="alert"|<dialog|aria-modal|window\.scrollTo|scrollIntoView|requestAnimationFrame|setTimeout|setInterval/, f);
    assert.doesNotMatch(src, /\b(animate-|transition(?!-colors)|duration-|motion\.|framer)/, f);
    assert.doesNotMatch(src, /tabIndex=\{[1-9]/, f);
  }
});

test("focus only moves after the person's own action, only if their button went away, and only to the card's heading", () => {
  const card = code["../components/laundryDays/LaundryDayCard.jsx"];
  assert.equal((card.match(/\.focus\(\)/g) || []).length, 1);
  assert.match(card, /if \(!refocus\.current\) return;/);
  assert.match(card, /!root\.contains\(document\.activeElement\)/);
  assert.match(card, /refocus\.current = true;/);
  assert.match(card, /tabIndex=\{-1\}/);
  for (const f of ["../components/laundryDays/LaundryDayActions.jsx", "../components/laundryDays/LaundryDaysSettings.jsx"]) assert.doesNotMatch(code[f], /\.focus\(/, f);
});

test("every control is a real, labeled element: native checkboxes, radios, date and time fields, selects and buttons", () => {
  const settings = code["../components/laundryDays/LaundryDaysSettings.jsx"];
  assert.match(settings, /<fieldset/);
  assert.match(settings, /<legend/);
  assert.match(settings, /type="checkbox"/);
  assert.match(settings, /htmlFor=\{`laundry-day-\$\{d\.value\}`\}/);
  assert.match(settings, /type="time"/);
  assert.match(settings, /htmlFor="laundry-day-custom-time"/);
  const actions = code["../components/laundryDays/LaundryDayActions.jsx"];
  assert.match(actions, /type="date"/);
  assert.match(actions, /type="time"/);
  assert.match(actions, /<select id="ld-snooze-minutes"/);
  assert.match(actions, /htmlFor="ld-move-date"/);
  assert.match(actions, /htmlFor="ld-move-time"/);
  for (const f of COMPONENTS) assert.doesNotMatch(code[f], /onClick=\{[^}]*\}[^>]*>\s*<(div|span)\b|role="button"/, f); // no clickable divs
});

test("status messages are polite live regions that are always present, so a screen reader hears them without moving focus", () => {
  for (const f of ["../components/laundryDays/LaundryDayCard.jsx", "../components/laundryDays/LaundryDaysSettings.jsx"]) {
    assert.match(code[f], /<p role="status" className="min-h-\[1\.5rem\] text-base">/, f);
  }
});

// ─── Words ──────────────────────────────────────────────────────────────────────────────────────

test("the screens contain no counters, tallies or guilt-based words in their source", () => {
  const BAD = /\b(miss(ed|es|ing)?|streaks?|penalt\w*|overdue|behind|forgot\w*|forgotten|guilt\w*|shame\w*|lazy|neglect\w*|catch up|punish\w*|days? in a row)\b/i;
  for (const f of [...COMPONENTS, "../lib/laundryRoutineView.js"]) {
    const strings = [...code[f].matchAll(/"([^"\n]{12,})"|`([^`\n]{12,})`/g)].map((m) => m[1] || m[2]);
    for (const s of strings) assert.doesNotMatch(s, BAD, `${f}: ${s}`);
  }
});

test("the new files are small and separate: nothing was added to the session screens", () => {
  const session = read("../pages/Session.jsx");
  assert.doesNotMatch(session, /LaundryDay|laundryRoutine|useLaundryRoutine/);
});
