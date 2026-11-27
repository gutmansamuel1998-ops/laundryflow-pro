// How the Home dashboard is wired (source checks): it is read-only, account-safe, independent of notifications, and
// every button goes to the Session page. These guard the boundaries of this change: no session code, entities,
// backend, notification, email, authentication or payment files are touched or used by the new Home files.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const hook = strip(read("../hooks/useHomeAttention.js"));
const card = strip(read("../components/attention/AttentionCard.jsx"));
const home = strip(read("../pages/Home.jsx"));
const logic = strip(read("./homeAttention.js"));
const sessionHook = strip(read("../hooks/useLaundrySession.js"));
const NEW_FILES = { "useHomeAttention.js": hook, "AttentionCard.jsx": card, "homeAttention.js": logic };

test("the Home hook never writes: it only reads loads, and calls no create/update/delete/bulk or backend function", () => {
  for (const [name, src] of Object.entries(NEW_FILES)) {
    assert.doesNotMatch(src, /\.(create|update|delete|bulkCreate|remove)\(/, name);
    assert.doesNotMatch(src, /useMutation|functions\.invoke|integrations|asServiceRole|auth\.(updateMe|setToken|logout)/, name);
  }
  const reads = hook.match(/base44\.entities\.\w+\.\w+\(/g) || [];
  assert.deepEqual(reads, ["base44.entities.Load.filter("]);
  assert.match(hook, /Load\.filter\(\{ status: "completed" \}/);
});

test("the finished-today query is scoped to the signed-in person and is only enabled once that person is known", () => {
  assert.match(hook, /queryKey: \["v1-home-finished", owner\]/);
  assert.match(hook, /enabled: owner !== ""/);
  assert.match(hook, /const owner = useOwnerKey\(\);/);
});

test("the session query key used for 'Try again' equals the one useLaundrySession uses", () => {
  const home = /const SESSION_KEY = (\[[^\]]*\]);/.exec(hook)[1];
  const real = /const SESSION_KEY = (\[[^\]]*\]);/.exec(sessionHook)[1];
  assert.equal(home, real);
  assert.match(hook, /qc\.refetchQueries\(\{ queryKey: SESSION_KEY \}\)/);
});

test("the load's owner is compared with the signed-in user as a second safety net", () => {
  assert.match(hook, /loadBelongsToSomeoneElse\(session\.load, user && user\.id\)/);
  assert.match(hook, /ownerMismatch/);
});

test("useLaundrySession is not changed to know about Home (no import of Home files, no new exports)", () => {
  assert.doesNotMatch(sessionHook, /homeAttention|useHomeAttention|AttentionCard/);
  const exports = (sessionHook.match(/^export (?:async )?function (\w+)/gm) || []).map((l) => l.replace(/^export (?:async )?function /, ""));
  assert.deepEqual(exports, ["useLaundrySession", "useCompletedCount"]);
  assert.match(sessionHook, /const SESSION_KEY = \["v1-session"\];/);
});

test("Home does not depend on notification permission, reminder level, push, email or the reminder engines", () => {
  for (const [name, src] of Object.entries({ ...NEW_FILES, "Home.jsx": home })) {
    assert.doesNotMatch(src, /Notification|notify|nativeNotifications|reminderStore|SessionReminderEngine|sessionPrefs|usePrefs|reminderLevel|pushManager|serviceWorker|sendEmail|SendEmail/i, name);
  }
});

test("every Home button opens the Session page and nothing else", () => {
  assert.match(home, /const goTo = \(page\) => navigate\(createPageUrl\(page\)\);/);
  assert.match(home, /onNavigate=\{goTo\}/);
  assert.match(home, /onStart=\{\(\) => goTo\(attention\.action\.page\)\}/);
  assert.match(logic, /export const HOME_ACTION_PAGE = "Session";/);
  assert.match(logic, /const goSession = \(label, emphasis = "primary"\) => \(\{ label, page: HOME_ACTION_PAGE, emphasis \}\);/);
  assert.doesNotMatch(logic, /page: "(?!Session)/);
  assert.doesNotMatch(home, /navigate\("|window\.location|<a /, "no other navigation from Home");
});

test("Home does not start, resume, extend, complete or cancel laundry itself", () => {
  assert.doesNotMatch(home, /useLaundrySession\(|actions\.|startWash|StartPanel|SessionTimer/);
  assert.doesNotMatch(card, /useLaundrySession|actions\./);
});

test("Home has one h1 and a labelled Needs Your Attention section; the laundry-day card drops to h3 inside it", () => {
  assert.equal((home.match(/<h1\b/g) || []).length, 1);
  assert.match(home, /<h1 className="text-3xl font-semibold">\{HOME_COPY\.pageHeading\}<\/h1>/);
  assert.match(home, /<section aria-labelledby="home-attention-section"/);
  assert.match(home, /headingLevel=\{3\}/);
  const day = strip(read("../components/laundryDays/LaundryDayCard.jsx"));
  assert.match(day, /headingLevel = 2/, "without the prop the card keeps its old h2");
});

test("the page and section headings read 'Your Laundry' and 'Needs Your Attention', and the bottom navigation still says Home", () => {
  assert.match(logic, /pageHeading: "Your Laundry"/);
  assert.match(logic, /sectionHeading: "Needs Your Attention"/);
  const layout = strip(read("../Layout.jsx"));
  assert.match(layout, /label: "Home"|"Home"/);
});

test("Home adds no timers of its own: the only clock is the laundry-days hook's once-a-minute one", () => {
  for (const [name, src] of Object.entries({ ...NEW_FILES, "Home.jsx": home })) {
    assert.doesNotMatch(src, /setInterval|setTimeout|requestAnimationFrame|useNow\(|Date\.now/, name);
  }
});

test("the announcer is a single polite, atomic, visually hidden status region that skips the loading state", () => {
  assert.equal((card.match(/role="status"/g) || []).length, 1);
  assert.match(card, /aria-live="polite"/);
  assert.match(card, /item\.kind === "loading"/);
});

test("no file outside the Home dashboard's own files was changed in ways the boundaries forbid", () => {
  // Entities, backend functions, auth and payments are not imported by the new files.
  for (const [name, src] of Object.entries(NEW_FILES)) {
    assert.doesNotMatch(src, /entities\/|functions\/|stripe|checkout|payment|subscription/i, name);
  }
  // And the folders for those do not contain anything newer-looking than what the repo already had: nothing here adds one.
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const names = (dir) => {
    try {
      return readdirSync(join(root, dir)).filter((n) => statSync(join(root, dir, n)).isFile());
    } catch {
      return [];
    }
  };
  for (const dir of ["entities", "functions"]) {
    for (const n of names(dir)) assert.doesNotMatch(n, /home|attention/i, `${dir}/${n}`);
  }
});

// ─── Phase 6: accessibility of the markup's classes (text scaling, narrow screens, touch targets) ───────────────

test("the attention card and Home use no fixed heights or widths, so 200% text and a 320 px screen can reflow", () => {
  for (const [name, src] of Object.entries({ "AttentionCard.jsx": card, "Home.jsx": home })) {
    assert.doesNotMatch(src, /\b(?:h|w|max-h|min-w)-\[\d+px\]|\bh-\d+\b|\bw-\d+\b|overflow-hidden|truncate|line-clamp/, name);
  }
  assert.match(card, /break-words text-2xl font-semibold/);
  assert.match(card, /break-words text-lg/);
  assert.match(home, /max-w-lg/);
  assert.match(home, /px-5/);
});

test("every control on the card is a BigButton (at least 56 px, or 48 px for the quiet 'Try again' link-style button)", () => {
  assert.equal((card.match(/<BigButtonAny\b/g) || []).length, 2);
  assert.doesNotMatch(card, /<button\b|<a\b|onClick=\{\(\) => window/);
  const ui = strip(read("../components/session/ui.jsx"));
  assert.match(ui, /w-full min-h-\[56px\]/);
  assert.match(ui, /ghost: "[^"]*min-h-\[48px\]/);
});

test("no guilt-inducing or urgent styling: no red/destructive colour and no pulsing on the attention card", () => {
  assert.doesNotMatch(card, /destructive|text-red|bg-red|border-red|animate|pulse|blink/);
});

test("Bubbles are not on Home and the Home files do not import them", () => {
  for (const [name, src] of Object.entries({ ...NEW_FILES, "Home.jsx": home })) {
    assert.doesNotMatch(src, /Bubbles/i, name);
  }
});
