import test from "node:test";
import assert from "node:assert/strict";
import {
  POINTS,
  comboBonus,
  applyMatch,
  applyMiss,
  finishRound,
  sensoryProfile,
  soundForEvent,
} from "./gameRewards.js";

test("combo bonus is small, predictable and capped", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 12].map(comboBonus), [0, 0, 5, 10, 15, 20, 20, 20]);
  assert.equal(comboBonus(undefined), 0);
  assert.equal(comboBonus(NaN), 0);
});

test("first match: 10 points, 'Nice match!'", () => {
  const r = applyMatch({ score: 0, streak: 0 });
  assert.equal(r.points, 10);
  assert.equal(r.streak, 1);
  assert.equal(r.score, 10);
  assert.equal(r.message, "Nice match!");
});

test("consecutive matches build a streak with 'Great streak!'", () => {
  let s = { score: 0, streak: 0 };
  const messages = [];
  for (let i = 0; i < 6; i += 1) {
    const r = applyMatch(s);
    messages.push(r.message);
    s = { score: r.score, streak: r.streak };
  }
  assert.deepEqual(messages, [
    "Nice match!",
    "Great streak! x2",
    "Great streak! x3",
    "Great streak! x4",
    "Great streak! x5",
    "Great streak! x6",
  ]);
  // 10 + 15 + 20 + 25 + 30 + 30
  assert.equal(s.score, 130);
});

test("a perfect board is worth 155 with the round bonus", () => {
  let s = { score: 0, streak: 0 };
  for (let i = 0; i < 6; i += 1) {
    const r = applyMatch(s);
    s = { score: r.score, streak: r.streak };
  }
  assert.equal(finishRound({ score: s.score, best: 0 }).total, 130 + POINTS.roundBonus);
});

test("a miss is gentle: no point loss, streak resets", () => {
  const r = applyMiss({ score: 40, streak: 3 });
  assert.equal(r.score, 40);
  assert.equal(r.streak, 0);
  assert.equal(r.points, 0);
  assert.match(r.message, /try again/i);
});

test("applyMatch tolerates missing or bad input", () => {
  assert.equal(applyMatch().score, 10);
  assert.equal(applyMatch({ score: NaN, streak: NaN }).score, 10);
});

test("finishRound: first board is never a 'personal best'", () => {
  const r = finishRound({ score: 100, best: 0 });
  assert.equal(r.isFirstBoard, true);
  assert.equal(r.isPersonalBest, false);
  assert.equal(r.best, 125);
  assert.equal(r.message, "Board cleared!");
});

test("finishRound: beating the best is a personal best, tying is not", () => {
  assert.equal(finishRound({ score: 100, best: 100 }).isPersonalBest, true);
  assert.equal(finishRound({ score: 100, best: 125 }).isPersonalBest, false);
  const lower = finishRound({ score: 50, best: 125 });
  assert.equal(lower.isPersonalBest, false);
  assert.equal(lower.best, 125);
  assert.equal(finishRound({ score: 100, best: 100 }).message, "New personal best!");
});

test("sensoryProfile defaults", () => {
  const p = sensoryProfile({}, true);
  assert.deepEqual(p, { calm: false, soundOn: true, volume: 0.5, confetti: true, pop: true });
});

test("sensoryProfile: reduced motion removes confetti and pop but not sound", () => {
  const p = sensoryProfile({ gameSound: true, gameVolume: 0.8 }, false);
  assert.equal(p.confetti, false);
  assert.equal(p.pop, false);
  assert.equal(p.soundOn, true);
  assert.equal(p.volume, 0.8);
});

test("sensoryProfile: calmer game halves volume and removes effects", () => {
  const p = sensoryProfile({ reducedSensory: true, gameVolume: 0.8 }, true);
  assert.equal(p.calm, true);
  assert.equal(p.volume, 0.4);
  assert.equal(p.confetti, false);
  assert.equal(p.pop, false);
});

test("sensoryProfile clamps volume", () => {
  assert.equal(sensoryProfile({ gameVolume: 5 }).volume, 1);
  assert.equal(sensoryProfile({ gameVolume: -1 }).volume, 0);
});

test("sound mapping: normal mode", () => {
  const p = sensoryProfile({}, true);
  assert.deepEqual(soundForEvent("select", p), { name: "select", streak: 1 });
  assert.deepEqual(soundForEvent("match", p, { streak: 3 }), { name: "match", streak: 3 });
  assert.deepEqual(soundForEvent("miss", p), { name: "miss", streak: 1 });
  assert.equal(soundForEvent("round", p).name, "round");
  assert.equal(soundForEvent("best", p).name, "best");
  assert.equal(soundForEvent("nonsense", p), null);
});

test("sound mapping: off, zero volume and calm", () => {
  assert.equal(soundForEvent("match", sensoryProfile({ gameSound: false })), null);
  assert.equal(soundForEvent("match", sensoryProfile({ gameVolume: 0 })), null);
  const calm = sensoryProfile({ reducedSensory: true });
  assert.equal(soundForEvent("select", calm), null);
  assert.equal(soundForEvent("miss", calm), null);
  assert.equal(soundForEvent("match", calm).name, "soft_chime");
  assert.equal(soundForEvent("round", calm).name, "soft_chime");
  assert.equal(soundForEvent("best", calm).name, "soft_chime");
});
