import { createServer } from "vite";
import assert from "node:assert/strict";

// Minimal browser stubs (src/lib/utils.js touches window at import).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};
globalThis.window = { addEventListener() {}, matchMedia: () => ({ matches: false }), localStorage: globalThis.localStorage };
globalThis.document = { documentElement: { style: {}, classList: { toggle() {} } } };

const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const results = [];
const check = (name, fn) => {
  try {
    fn();
    results.push(["PASS", name]);
  } catch (e) {
    results.push(["FAIL", name + " :: " + e.message]);
  }
};

try {
  const React = (await server.ssrLoadModule("react")).default;
  const { renderToStaticMarkup } = await server.ssrLoadModule("react-dom/server");
  const rs = await server.ssrLoadModule("/src/lib/reminderStore.js");
  const prefsMod = await server.ssrLoadModule("/src/lib/sessionPrefs.js");

  // --- reminderStore namespaces ---
  const load = { id: "L1", current_state: "washing", stage_start_time: "2026-01-01T00:00:00.000Z" };
  check("reminderStore: default namespace key unchanged", () => {
    rs.writeFired(load, ["five_min"]);
    const keys = [...store.keys()].filter((k) => k.startsWith("lf_fired:"));
    assert.equal(keys.length, 1);
    assert.ok(!keys[0].startsWith("lf_fired:snd:"));
    assert.deepEqual(rs.readFired(load), ["five_min"]);
  });
  check("reminderStore: 'snd' namespace is independent", () => {
    assert.deepEqual(rs.readFired(load, "snd"), []);
    rs.writeFired(load, ["five_min", "one_min"], "snd");
    assert.deepEqual(rs.readFired(load, "snd"), ["five_min", "one_min"]);
    assert.deepEqual(rs.readFired(load), ["five_min"]);
  });
  check("reminderStore: extension re-arms both records", () => {
    rs.writeFired(load, ["five_min", "one_min", "done"]);
    rs.writeFired(load, ["five_min", "one_min", "done"], "snd");
    rs.rearmAfterExtension(load, 10 * 60 * 1000);
    assert.ok(!rs.readFired(load).includes("done"));
    assert.ok(!rs.readFired(load, "snd").includes("done"));
    assert.ok(!rs.readFired(load, "snd").includes("one_min"));
  });

  // --- SockMatch SSR renders ---
  const SockMatch = (await server.ssrLoadModule("/src/components/session/SockMatch.jsx")).default;
  const html = (props) => renderToStaticMarkup(React.createElement(SockMatch, props));

  check("SockMatch: renders 12 cards face down, controls and score", () => {
    const h = html({});
    assert.equal((h.match(/face down/g) || []).length, 12);
    assert.match(h, /Points: 0/);
    assert.match(h, /Sound: On/);
    assert.match(h, /Game volume: 50%/);
    assert.match(h, /Calmer game/);
    assert.match(h, /type="range"/);
    assert.match(h, /aria-pressed="true"/);
    assert.doesNotMatch(h, /Game paused/);
  });
  check("SockMatch: paused state shows the reason and disables every card", () => {
    const h = html({ paused: true, pausedReason: "Your timer is up. Time to move your clothes." });
    assert.match(h, /Game paused\. Your timer is up/);
    assert.equal((h.match(/disabled=""/g) || []).length >= 13, true);
  });
  check("SockMatch: old saved state (moves/cleared only) still loads", () => {
    const cards = ["star", "heart", "moon", "clover", "diamond", "sun"].flatMap((s) => [
      { key: s + "-a", sock: s, matched: false },
      { key: s + "-b", sock: s, matched: false },
    ]);
    store.set("lf_sockmatch_v1", JSON.stringify({ cards, moves: 7, cleared: 2 }));
    const h = html({});
    assert.match(h, /Moves: 7/);
    assert.match(h, /Boards cleared: 2/);
    assert.match(h, /Points: 0/);
  });
  check("SockMatch: finished board shows the cleared panel and personal best badge", () => {
    const cards = ["star", "heart", "moon", "clover", "diamond", "sun"].flatMap((s) => [
      { key: s + "-a", sock: s, matched: true },
      { key: s + "-b", sock: s, matched: true },
    ]);
    store.set(
      "lf_sockmatch_v1",
      JSON.stringify({ cards, moves: 9, cleared: 3, score: 140, best: 140, round: 3, lastRound: { total: 140, isPersonalBest: true } })
    );
    const h = html({});
    assert.match(h, /Board cleared!/);
    assert.match(h, /New personal best!/);
    assert.match(h, /Best: 140/);
    assert.match(h, /Play a new board/);
  });
  check("SockMatch: sound off and calmer game are reflected in the controls", () => {
    store.delete("lf_sockmatch_v1");
    prefsMod.setPrefs({ gameSound: false, reducedSensory: true });
    const h = html({});
    assert.match(h, /Sound: Off/);
    assert.match(h, /aria-pressed="false"/);
    assert.match(h, /checked=""/);
    prefsMod.setPrefs({ gameSound: true, reducedSensory: false });
  });
  check("SSR render created no AudioContext (no autoplay)", () => {
    assert.equal(typeof globalThis.AudioContext, "undefined");
  });
} catch (e) {
  results.push(["FAIL", "harness: " + (e.stack || e)]);
} finally {
  await server.close();
}

results.forEach(([s, n]) => console.log(s, n));
process.exit(results.some(([s]) => s === "FAIL") ? 1 : 0);
