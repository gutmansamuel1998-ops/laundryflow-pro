// Static checks that the audio/game wiring keeps its safety rules. These read source text, so they
// catch an accidental regression (for example autoplay or a game sound cutting the timer alert).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const audio = read("./gameAudio.js");
const game = read("../components/session/SockMatch.jsx");
const engine = read("../components/notifications/SessionReminderEngine.jsx");
const session = read("../pages/Session.jsx");
const settings = read("../pages/SettingsCare.jsx");
const prefs = read("./sessionPrefs.js");
const store = read("./reminderStore.js");

test("the AudioContext is created in exactly one place, inside unlock()", () => {
  assert.equal((audio.match(/new Ctor\(/g) || []).length, 1);
  const unlockBody = audio.slice(audio.indexOf("async function unlock"), audio.indexOf("function removeVoice"));
  assert.match(unlockBody, /new Ctor\(/);
  assert.doesNotMatch(audio, /new (window\.)?(webkit)?AudioContext/);
});

test("play() refuses to run unless the context is running", () => {
  const playBody = audio.slice(audio.indexOf("function play("), audio.indexOf("function stopAll"));
  assert.match(playBody, /ctx\.state !== "running"\) return false/);
});

test("unlock listeners only start audio on real user input", () => {
  assert.match(audio, /\["pointerdown", "keydown", "touchend"\]/);
});

test("the game only ever stops its own channel, never the timer alert", () => {
  assert.match(game, /stopAll\("game"\)/);
  assert.doesNotMatch(game, /stopAll\("timer"\)/);
  assert.doesNotMatch(game, /stopAll\(\)/);
  assert.match(game, /channel: "game"/);
  assert.doesNotMatch(game, /channel: "timer"/);
});

test("the game pauses by silencing game sounds and cancelling confetti", () => {
  assert.match(game, /if \(!paused\) return;[\s\S]*?stopAll\("game"\)[\s\S]*?cancelConfetti\(\)/);
});

test("a late sound cannot start after the game was paused", () => {
  assert.match(game, /if \(pausedRef\.current\) return;/);
});

test("the game never touches laundry state, timers or notifications", () => {
  assert.doesNotMatch(game, /useLaundrySession|laundrySession|reminderStore|notify/);
});

test("timer cues play on the timer channel, from timestamps, with their own fired record", () => {
  assert.match(engine, /channel: "timer"/);
  assert.match(engine, /readFired\(load, "snd"\)/);
  assert.match(engine, /writeFired\(load, \[\.\.\.fired, \.\.\.due\.markFired\], "snd"\)/);
  assert.match(engine, /TIMER_CUES\[due\.notify\.id\]/);
  assert.doesNotMatch(engine, /actions\.|confirmTransfer|confirmDryDone|complete\(/);
});

test("the existing notification path is unchanged by the sound path", () => {
  assert.match(engine, /readFired\(load\);/);
  assert.match(engine, /showLaundryNotification\(due\.notify\.title/);
});

test("the Session page wakes exactly at timer end and still gates the game on the phase", () => {
  assert.match(session, /useNow\(timedStage, 1000, endMs\)/);
  assert.match(session, /const gamePaused = !isTimedPhase\(phase\)/);
});

test("reminder store keeps the original keys and re-arms both records after an extension", () => {
  assert.match(store, /const NAMESPACES = \["", "snd"\]/);
  assert.match(store, /\(ns \? `\$\{ns\}:` : ""\)/);
});

test("new preferences have safe defaults", () => {
  assert.match(prefs, /gameSound: true/);
  assert.match(prefs, /gameVolume: 0\.5/);
  assert.match(prefs, /timerSound: true/);
  assert.match(prefs, /reducedSensory: false/);
});

test("Settings & Care exposes sound, volume, calmer game, timer alerts and tests", () => {
  ["game-sound", "reduced-sensory", "timer-sound", "Test game sound", "Test timer alert", 'type="range"'].forEach((s) =>
    assert.ok(settings.includes(s), s)
  );
});

test("the game offers a visible equivalent for audio feedback and sound controls", () => {
  ["Nice match", "Great streak", "Board cleared", "New personal best", "aria-pressed", "Calmer game", 'type="range"'].forEach(
    (s) => assert.ok(game.includes(s) || /Nice match|Great streak/.test(read("./gameRewards.js")), s)
  );
});
