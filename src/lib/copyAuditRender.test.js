// Renders the REAL session timer in its two modes (a dryer, and an air-dry check-in) and checks the words a screen reader
// and a sighted person get. The air-dry timer is a reminder to look at the clothes, never an estimate of when they will be
// dry; the dryer timer keeps its existing "estimate" wording. Bundled in memory with esbuild + react-dom/server.
//
// If esbuild or react-dom cannot load, the first test FAILS with the reason (never silently skipped); the others are then
// skipped so the run cannot look healthy. What this cannot check: how a screen reader speaks it, colours and contrast, and
// how it looks at 200% text or on a phone (see the P8 report).
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AIR_DRY_COPY } from "./airDry.js";

const root = fileURLToPath(new URL("../..", import.meta.url));

async function load() {
  try {
    const esbuild = await import("esbuild");
    const src = join(root, "src");
    const entry = `
      import React from "react";
      import { renderToStaticMarkup } from "react-dom/server";
      import SessionTimer from "@/components/session/SessionTimer";
      export const timer = (props) => renderToStaticMarkup(<SessionTimer {...props} />);
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
    const dir = mkdtempSync(join(tmpdir(), "copy-audit-render-"));
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

const unesc = (s) => s.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const text = (html) => unesc(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
const RUNNING = { remainingMs: 25 * 60_000, overdueMs: 0, elapsed: false, progress: 0.4, endMs: Date.UTC(2026, 10, 22, 21, 0) };
const ELAPSED = { remainingMs: 0, overdueMs: 7 * 60_000, elapsed: true, progress: 1, endMs: Date.UTC(2026, 10, 22, 21, 0) };

t("an air-dry check-in timer is called a reminder everywhere: its name, its title, its time, its spoken text and its note", () => {
  const html = mod.timer({ phase: "dry_running", timer: RUNNING, airDry: true });
  assert.match(html, /<section aria-label="Check-in timer, a reminder to look at your clothes"/);
  assert.match(text(html), /Check-in timer \(reminder\)/);
  assert.match(text(html), /Check-in at /);
  assert.match(html, /About 25 minutes until your check-in\./);
  assert.ok(text(html).includes(AIR_DRY_COPY.reminderNote));
  assert.doesNotMatch(text(html), /estimat|Est\. finish|remaining|dryer|machine|Time's up/i);
  assert.match(html, /role="progressbar"[^>]*aria-label="Check-in timer progress"/);
});

t("when the check-in is ready it says so gently, with what to do next, and still no estimate or machine wording", () => {
  const html = mod.timer({ phase: "dry_elapsed", timer: ELAPSED, airDry: true });
  assert.match(text(html), /Check-in is ready/);
  assert.match(text(html), /Check-in time/);
  assert.ok(text(html).includes(AIR_DRY_COPY.timerElapsedNote));
  assert.ok(text(html).includes(AIR_DRY_COPY.reminderNote));
  assert.match(html, /Your check-in time came 7 minutes ago\. Please look at your clothes\./);
  assert.doesNotMatch(text(html), /estimat|Est\. finish|dryer|machine|Time's up|late|overdue/i);
});

t("a dryer timer keeps the wording it always had", () => {
  const running = mod.timer({ phase: "dry_running", timer: RUNNING });
  assert.match(running, /<section aria-label="Dry timer, estimated"/);
  assert.match(text(running), /Dry timer \(estimate\)/);
  assert.match(text(running), /Est\. finish /);
  assert.match(running, /remaining, estimated\./);
  const elapsed = mod.timer({ phase: "dry_elapsed", timer: ELAPSED });
  assert.match(text(elapsed), /Estimated time is up/);
  assert.match(text(elapsed), /This is only an estimate\. Check that your machine has actually stopped before you move on\./);
});

t("the visible countdown is hidden from a screen reader, which gets one calm sentence instead of a changing clock", () => {
  for (const airDry of [true, false]) {
    const html = mod.timer({ phase: "dry_running", timer: RUNNING, airDry });
    assert.match(html, /aria-hidden="true">25:00</);
    assert.match(html, /<p class="sr-only">/);
    assert.doesNotMatch(html, /aria-live|role="alert"|role="timer"/);
  }
});

t("the timer uses theme colours and relative sizes only, so high contrast and large text apply", () => {
  const html = mod.timer({ phase: "dry_running", timer: RUNNING, airDry: true });
  assert.doesNotMatch(html, /animate-|transition|duration-/);
  assert.doesNotMatch(html, /(bg|text|border)-(red|green|blue|amber|yellow|orange|emerald)-\d+/);
  assert.doesNotMatch(html, /(?<![\w-])text-\[\d+px\]/);
  // the only inline style is the progress bar's width
  const styles = [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);
  assert.deepEqual(styles, ["width:40%"]);
});
