import test from "node:test";
import assert from "node:assert/strict";
import { createAudioEngine, buildNotes, soundDuration, TIMER_CUES, TIMER_VOLUME } from "./gameAudio.js";

function makeFake({ blocked = false } = {}) {
  const log = { contexts: 0, oscillators: [], gains: 0 };
  class FakeAudioContext {
    constructor() {
      log.contexts += 1;
      this.state = "suspended";
      this.currentTime = 0;
      this.destination = {};
      log.ctx = this;
    }
    async resume() {
      if (!blocked) this.state = "running";
    }
    createGain() {
      log.gains += 1;
      const param = () => ({
        value: 1,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        cancelScheduledValues() {},
      });
      return { gain: param(), connect() {}, disconnect() {} };
    }
    createDynamicsCompressor() {
      return { connect() {} };
    }
    createOscillator() {
      const o = {
        type: "sine",
        stops: [],
        started: false,
        frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        start() {
          o.started = true;
        },
        stop(t) {
          o.stops.push(t);
        },
        onended: null,
      };
      log.oscillators.push(o);
      return o;
    }
  }
  return { Ctor: FakeAudioContext, log };
}

function engineWith(opts) {
  const fake = makeFake(opts);
  const clock = { t: 1000 };
  const engine = createAudioEngine({ getContextCtor: () => fake.Ctor, now: () => clock.t });
  return { engine, clock, ...fake };
}

test("no AudioContext exists until unlock() is called (no autoplay)", () => {
  const { engine, log } = engineWith();
  assert.equal(log.contexts, 0);
  assert.equal(engine.getStatus(), "locked");
  assert.equal(engine.play("match"), false);
  assert.equal(log.contexts, 0);
  assert.equal(log.oscillators.length, 0);
});

test("unlock() from a gesture makes sound possible", async () => {
  const { engine, log } = engineWith();
  assert.equal(await engine.unlock(), "ready");
  assert.equal(log.contexts, 1);
  assert.equal(engine.play("match", { streak: 1, volume: 0.5 }), true);
  assert.ok(log.oscillators.length >= 2);
  assert.ok(log.oscillators.every((o) => o.started));
});

test("a browser that keeps audio blocked stays silent and does not throw", async () => {
  const { engine, log } = engineWith({ blocked: true });
  assert.equal(await engine.unlock(), "locked");
  assert.equal(engine.play("match"), false);
  assert.equal(log.oscillators.length, 0);
});

test("unsupported browsers report it and stay silent", async () => {
  const engine = createAudioEngine({ getContextCtor: () => null });
  assert.equal(engine.getStatus(), "unsupported");
  assert.equal(await engine.unlock(), "unsupported");
  assert.equal(engine.play("match"), false);
});

test("volume 0 plays nothing", async () => {
  const { engine, log } = engineWith();
  await engine.unlock();
  assert.equal(engine.play("match", { volume: 0 }), false);
  assert.equal(log.oscillators.length, 0);
});

test("rapid repeats of the same sound are rate limited", async () => {
  const { engine, clock } = engineWith();
  await engine.unlock();
  assert.equal(engine.play("select"), true);
  clock.t += 20;
  assert.equal(engine.play("select"), false);
  clock.t += 100;
  assert.equal(engine.play("select"), true);
  // different sounds do not block each other
  assert.equal(engine.play("miss"), true);
});

test("overlapping game voices are capped", async () => {
  const { engine, clock } = engineWith();
  await engine.unlock();
  let played = 0;
  for (let i = 0; i < 40; i += 1) {
    clock.t += 1000; // clear every rate limit
    if (engine.play("round")) played += 1; // 6 voices each, never ended in the fake
  }
  assert.ok(played >= 1 && played < 40);
  assert.ok(engine.activeVoices("game") <= 10);
});

test("stopAll('game') silences game sounds but never the timer alert", async () => {
  const { engine, log } = engineWith();
  await engine.unlock();
  engine.play("match", { channel: "game" });
  const gameCount = log.oscillators.length;
  engine.play("timer_done", { channel: "timer", volume: TIMER_VOLUME });
  const timerOscs = log.oscillators.slice(gameCount);
  assert.ok(engine.activeVoices("game") > 0);
  assert.ok(engine.activeVoices("timer") > 0);

  engine.stopAll("game");
  assert.equal(engine.activeVoices("game"), 0);
  assert.ok(engine.activeVoices("timer") > 0);
  log.oscillators.slice(0, gameCount).forEach((o) => assert.ok(o.stops.length >= 2, "game oscillators stopped now"));
  timerOscs.forEach((o) => assert.equal(o.stops.length, 1, "timer oscillators left alone"));

  engine.stopAll();
  assert.equal(engine.activeVoices(), 0);
});

test("voices are removed when they end", async () => {
  const { engine, log } = engineWith();
  await engine.unlock();
  engine.play("select");
  assert.equal(engine.activeVoices("game"), 1);
  log.oscillators[0].onended();
  assert.equal(engine.activeVoices("game"), 0);
});

test("match pitch rises with the streak and is predictable", () => {
  const f = (s) => buildNotes("match", { streak: s })[0].freq;
  assert.ok(f(1) < f(2) && f(2) < f(3) && f(3) < f(4) && f(4) < f(5));
  assert.equal(f(5), f(9));
  assert.equal(buildNotes("match", { streak: 2 }).length, 2);
  assert.equal(buildNotes("match", { streak: 3 }).length, 3);
});

test("every sound is built from sine/triangle and stays within the gain ceiling", () => {
  const names = ["select", "match", "soft_chime", "miss", "round", "best", "timer_soon", "timer_minute", "timer_done"];
  names.forEach((n) => {
    const notes = buildNotes(n, { streak: 5 });
    assert.ok(notes.length > 0, n);
    notes.forEach((x) => {
      assert.ok(["sine", "triangle"].includes(x.type), `${n} waveform`);
      assert.ok(x.gain > 0 && x.gain <= 0.35, `${n} gain`);
      assert.ok(x.dur > 0 && x.freq > 0);
    });
  });
  assert.deepEqual(buildNotes("unknown"), []);
});

test("miss is a single soft, falling tone (not harsh)", () => {
  const notes = buildNotes("miss");
  assert.equal(notes.length, 1);
  assert.ok(notes[0].endFreq < notes[0].freq);
  assert.ok(notes[0].gain <= 0.15);
  assert.ok(notes[0].freq <= 400);
});

test("round-complete and personal-best are distinct from each other and from a match", () => {
  const sig = (n) => JSON.stringify(buildNotes(n, { streak: 1 }));
  assert.notEqual(sig("round"), sig("best"));
  assert.notEqual(sig("round"), sig("match"));
  assert.ok(soundDuration("round") > soundDuration("match"));
  assert.ok(buildNotes("best")[0].freq > buildNotes("round")[0].freq);
});

test("timer cues are distinguishable from game rewards: longer, lower start, descending", () => {
  const rising = (notes) => notes.every((n, i) => i === 0 || n.freq >= notes[i - 1].freq);
  ["timer_soon", "timer_minute", "timer_done"].forEach((name) => {
    const notes = buildNotes(name);
    assert.ok(!rising(notes), `${name} must not rise like a reward`);
  });
  assert.ok(soundDuration("timer_done") >= 2, "done cue is clearly longer");
  assert.ok(soundDuration("timer_done") > soundDuration("best"));
  assert.ok(soundDuration("timer_minute") > soundDuration("match"));
  // the "done" cue repeats twice so it is hard to miss
  assert.equal(buildNotes("timer_done").length, 6);
  // game rewards are never the descending timer shape
  assert.ok(rising(buildNotes("round").filter((n) => n.type === "sine")));
});

test("timer cue mapping covers the 5-minute, 1-minute and done events", () => {
  assert.deepEqual(TIMER_CUES, { five_min: "timer_soon", one_min: "timer_minute", done: "timer_done" });
  assert.ok(TIMER_VOLUME > 0 && TIMER_VOLUME <= 1);
});

test("a timer cue still plays after the game channel was stopped (timer expiry)", async () => {
  const { engine, log, clock } = engineWith();
  await engine.unlock();
  engine.play("round", { channel: "game" });
  engine.stopAll("game");
  clock.t += 5000;
  const before = log.oscillators.length;
  assert.equal(engine.play("timer_done", { channel: "timer", volume: TIMER_VOLUME }), true);
  assert.equal(log.oscillators.length - before, 6);
});
