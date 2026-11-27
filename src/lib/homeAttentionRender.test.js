// What Home actually renders (V1 Home dashboard): the REAL Home page and AttentionCard, bundled with esbuild and
// rendered on the server with invented data (no network, no real account). The session answer is put straight into
// the query cache, which is how the page would look once the server had answered.
//
// Server rendering runs no effects, so the laundry-days plan is "not read yet" here; that is why the quiet states
// (all clear, finished today, laundry day) are checked on the AttentionCard with real buildAttention output instead.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRoutine, zonedToInstant } from "./laundryRoutine.js";
import { homeCardModel } from "./laundryRoutineView.js";
import { buildAttention } from "./homeAttention.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const MIN = 60 * 1000;
const CHI = "America/Chicago";

async function load() {
  try {
    const esbuild = await import("esbuild");
    const src = join(root, "src");
    const stubs = {
      "base44-stub": `export const base44 = { entities: { Load: { filter: async () => [], update: async () => ({}), create: async () => ({}) } }, auth: {} };`,
      "auth-stub": `export const useAuth = () => ({ user: { id: "synthetic-user-1" } });`,
    };
    const entry = `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import { MemoryRouter } from "react-router-dom";
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import Home from "@/pages/Home";
      import AttentionCard from "@/components/attention/AttentionCard";
      const client = (seed) => {
        const c = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity, retryOnMount: false } } });
        if (seed && seed.session !== undefined) c.setQueryData(["v1-session"], seed.session);
        if (seed && seed.sessionError) c.getQueryCache().build(c, { queryKey: ["v1-session"] }).setState({ status: "error", error: new Error("synthetic"), fetchStatus: "idle", data: undefined });
        return c;
      };
      export const renderHome = (seed) => renderToStaticMarkup(<MemoryRouter><QueryClientProvider client={client(seed)}><Home /></QueryClientProvider></MemoryRouter>);
      export const renderCard = (item) => renderToStaticMarkup(<AttentionCard item={item} onNavigate={() => {}} onRetry={() => {}} />);
    `;
    const out = await esbuild.build({
      stdin: { contents: entry, resolveDir: src, loader: "jsx", sourcefile: "entry.jsx" },
      bundle: true,
      write: false,
      platform: "node",
      format: "cjs",
      jsx: "automatic",
      alias: { "@": src },
      plugins: [
        {
          name: "synthetic-stubs",
          setup(build) {
            build.onResolve({ filter: /^@\/api\/base44Client$/ }, () => ({ path: "base44-stub", namespace: "stub" }));
            build.onResolve({ filter: /^@\/lib\/AuthContext$/ }, () => ({ path: "auth-stub", namespace: "stub" }));
            build.onLoad({ filter: /.*/, namespace: "stub" }, (args) => ({ contents: stubs[args.path], loader: "js" }));
          },
        },
      ],
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });
    const dir = mkdtempSync(join(tmpdir(), "home-attention-"));
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
    return { skip: `cannot render Home here: ${error.message.split("\n")[0]}` };
  }
}

const { mod, skip } = await load();
const t = (name, fn) => test(name, { skip }, fn);

test("the Home render harness loads (a failure here means the render tests below could not run)", () => {
  assert.ok(mod, skip || "bundle did not load");
});

const washing = (startedMinutesAgo, minutes = 30, extra = {}) => ({
  id: "synthetic-load-1",
  status: "active",
  current_state: "washing",
  stage_start_time: new Date(Date.now() - startedMinutesAgo * MIN).toISOString(),
  wash_timer_minutes: minutes,
  ...extra,
});
const text = (html) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
const count = (html, re) => (html.match(re) || []).length;

// ─── Home, as the session answer arrives ───────────────────────────────────────────────────────────

t("while the session is loading: heading, section, a 'checking' card, no Start button, never 'nothing needs attention'", () => {
  const html = mod.renderHome({});
  const words = text(html);
  assert.match(words, /Your Laundry/);
  assert.match(words, /Needs Your Attention/);
  assert.match(words, /Checking on your laundry/);
  assert.doesNotMatch(words, /Nothing needs your attention/);
  assert.doesNotMatch(words, /Start laundry/);
});

t("when reading the session fails: says so gently, offers 'Try again', never 'nothing needs attention'", () => {
  const html = mod.renderHome({ sessionError: true });
  const words = text(html);
  assert.match(words, /We couldn.t check your laundry just now/);
  assert.match(words, /Try again/);
  assert.match(words, /Open laundry session/);
  assert.doesNotMatch(words, /Nothing needs your attention/);
  assert.doesNotMatch(words, /Start laundry/);
});

t("a wash whose timer has ended: the 'Continue laundry' card, honest about the estimate, with no start form and no clock", () => {
  const html = mod.renderHome({ session: washing(40, 30) });
  const words = text(html);
  assert.match(words, /Your wash timer has ended\. Ready to move your clothes\?/);
  assert.match(words, /Check your washer first\. The timer is only an estimate\./);
  assert.match(words, /Continue laundry/);
  assert.doesNotMatch(words, /Put your clothes in the washer/, "the old start form is gone from Home");
  assert.doesNotMatch(words, /Resume laundry session/);
  assert.doesNotMatch(html, /\b\d{1,2}:\d{2}\b/, "no ticking clock on Home");
});

t("a running wash: calm, approximate minutes, nothing to do, and no live countdown", () => {
  const html = mod.renderHome({ session: washing(10, 30) });
  const words = text(html);
  assert.match(words, /Your wash is running\./);
  assert.match(words, /About (19|20) minutes left, by your estimate\. Nothing to do right now\./);
  assert.doesNotMatch(html, /\b\d{1,2}:\d{2}\b/);
  assert.doesNotMatch(html, /role="timer"/);
});

t("an air-dry check-in is worded as a reminder to check", () => {
  const session = { id: "synthetic-load-2", status: "active", current_state: "drying", dry_guidance: "hang_dry", dry_timer_minutes: 60, stage_start_time: new Date(Date.now() - 90 * MIN).toISOString() };
  const words = text(mod.renderHome({ session }));
  assert.match(words, /Time for your check-in!/);
  assert.match(words, /reminder to check, not a prediction/);
});

t("a load that belongs to a different account is not shown (defence in depth)", () => {
  const words = text(mod.renderHome({ session: washing(40, 30, { created_by_id: "someone-else" }) }));
  assert.match(words, /We couldn.t check your laundry just now/);
  assert.doesNotMatch(words, /wash timer has ended/);
});

t("Home keeps the ironing area, the care guide and the page structure", () => {
  const html = mod.renderHome({ session: washing(10, 30) });
  assert.match(text(html), /Laundry Care Guide/);
  assert.equal(count(html, /<h1[\s>]/g), 1);
  assert.match(html, /<h1[^>]*>Your Laundry<\/h1>/);
  assert.match(html, /<section[^>]*aria-labelledby="home-attention-section"/);
  assert.match(html, /<h2[^>]*id="home-attention-section"[^>]*>Needs Your Attention<\/h2>/);
});

// ─── Accessibility of the markup ───────────────────────────────────────────────────────────────────────

t("exactly one polite status region for the attention section, visually hidden, and no assertive regions", () => {
  const html = mod.renderHome({ session: washing(40, 30) });
  assert.equal(count(html, /role="status"/g), 1);
  assert.match(html, /<p role="status" aria-live="polite" aria-atomic="true" class="sr-only">/);
  assert.doesNotMatch(html, /aria-live="assertive"|role="alert"/);
});

t("buttons are real <button>s at least 56px tall, the card is not a noisy landmark, and nothing animates", () => {
  const html = mod.renderHome({ session: washing(40, 30) });
  const buttons = html.match(/<button[^>]*>/g) || [];
  assert.ok(buttons.length >= 1);
  assert.match(html, /<button[^>]*type="button"[^>]*min-h-\[56px\]|<button[^>]*min-h-\[56px\][^>]*type="button"/);
  assert.doesNotMatch(html, /aria-labelledby="home-attention-headline"/);
  assert.match(html, /<section[^>]*data-attention-kind="needs_action"/);
  assert.doesNotMatch(html, /animate-|motion-|autoplay/);
});

// ─── The quiet states, on the card itself ──────────────────────────────────────────────────────────────

const SUNDAY_PLAN = createRoutine({ weekdays: [0], time: "09:00", nowMs: 1000, zone: CHI }).routine;
const atChi = (date, time = "10:00") => zonedToInstant(CHI, date, time).ms;
const quiet = (over = {}) => {
  const nowMs = over.nowMs ?? atChi("2026-11-23");
  return buildAttention({
    nowMs,
    zone: CHI,
    session: { isLoading: false, known: true, load: null },
    dayCard: homeCardModel(SUNDAY_PLAN, { nowMs, zone: CHI }),
    completedToday: false,
    ...over,
  });
};

t("all clear: the warm sentence, the next laundry day, and a secondary 'Start laundry' button to the Session page", () => {
  const item = quiet();
  assert.equal(item.kind, "all_clear");
  const html = mod.renderCard(item);
  assert.match(text(html), /Nothing needs your attention right now!/);
  assert.match(text(html), /Start laundry/);
  assert.match(html, /border-foreground/, "a secondary button is outlined, not filled");
});

t("finished today: a kind 'done' card, still with a way to start again", () => {
  const html = mod.renderCard(quiet({ completedToday: true }));
  assert.match(text(html), /Your laundry is done for today\./);
  assert.match(text(html), /Start laundry/);
});

t("the failure card offers 'Try again' as well as the Session page", () => {
  const html = mod.renderCard(quiet({ session: { isLoading: false, known: false, load: null } }));
  assert.match(text(html), /Try again/);
  assert.match(text(html), /Open laundry session/);
});

t("the loading card has no buttons at all", () => {
  const html = mod.renderCard(quiet({ session: { isLoading: true, known: false, load: null } }));
  assert.equal(count(html, /<button/g), 0);
});
