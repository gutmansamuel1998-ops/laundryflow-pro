// Synthesized sound for Sock Match and the laundry timer cues. Web Audio only: no audio files,
// no dependencies.
//
// Rules this module enforces:
// - The AudioContext is created only inside unlock(), which callers run from a user gesture.
//   Nothing can play before that, and play() does nothing unless the context is "running".
// - Game sounds and timer cues use separate channels. stopAll("game") never cuts a timer cue.
// - Rapid repeats are limited per sound, and the number of overlapping game voices is capped.
// - Game sounds are short and rising/bright. Timer cues are longer, lower and descending,
//   so the laundry alert never sounds like a game reward.
// - Audio is only ever extra: nothing in the app depends on it.

export const TIMER_CUES = { five_min: "timer_soon", one_min: "timer_minute", done: "timer_done" };
export const TIMER_VOLUME = 0.6;

const MIN_GAP_MS = {
  select: 70,
  miss: 180,
  match: 90,
  soft_chime: 120,
  round: 400,
  best: 400,
  timer_soon: 1000,
  timer_minute: 1000,
  timer_done: 1000,
};
const MAX_GAME_VOICES = 10;
const MASTER_GAIN = 0.7;
const MAX_NOTE_GAIN = 0.35;

const F = {
  G4: 392.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
  B5: 987.77,
  C6: 1046.5,
  D6: 1174.66,
  G6: 1567.98,
};
const PENTATONIC = [F.C5, F.D5, F.E5, F.G5, F.A5];

// Pure description of a sound: [{ t, dur, freq, endFreq?, type, gain }]. Easy to test.
export function buildNotes(name, { streak = 1 } = {}) {
  switch (name) {
    case "select":
      return [{ t: 0, dur: 0.07, freq: 600, endFreq: 420, type: "sine", gain: 0.18 }];
    case "match": {
      const step = Math.min(Math.max(1, Math.floor(streak)) - 1, PENTATONIC.length - 1);
      const root = PENTATONIC[step];
      const notes = [
        { t: 0, dur: 0.18, freq: root, type: "sine", gain: 0.26 },
        { t: 0.07, dur: 0.22, freq: root * 1.5, type: "sine", gain: 0.22 },
      ];
      if (streak >= 3) notes.push({ t: 0.14, dur: 0.25, freq: root * 2, type: "triangle", gain: 0.12 });
      return notes;
    }
    case "soft_chime":
      return [{ t: 0, dur: 0.3, freq: F.E5, type: "sine", gain: 0.2 }];
    case "miss":
      return [{ t: 0, dur: 0.22, freq: 330, endFreq: 294, type: "sine", gain: 0.14 }];
    case "round":
      return [
        { t: 0, dur: 0.25, freq: F.C5, type: "sine", gain: 0.26 },
        { t: 0.12, dur: 0.25, freq: F.E5, type: "sine", gain: 0.26 },
        { t: 0.24, dur: 0.25, freq: F.G5, type: "sine", gain: 0.26 },
        { t: 0.36, dur: 0.25, freq: F.C6, type: "sine", gain: 0.26 },
        { t: 0.36, dur: 0.6, freq: F.E5, type: "triangle", gain: 0.12 },
        { t: 0.36, dur: 0.6, freq: F.G5, type: "triangle", gain: 0.12 },
      ];
    case "best":
      return [
        { t: 0, dur: 0.22, freq: F.G5, type: "triangle", gain: 0.24 },
        { t: 0.1, dur: 0.22, freq: F.B5, type: "triangle", gain: 0.24 },
        { t: 0.2, dur: 0.22, freq: F.D6, type: "triangle", gain: 0.24 },
        { t: 0.3, dur: 0.3, freq: F.G6, type: "triangle", gain: 0.24 },
        { t: 0.3, dur: 0.7, freq: F.G6 * 1.5, type: "sine", gain: 0.1 },
      ];
    case "timer_soon":
      return [
        { t: 0, dur: 0.45, freq: F.E5, type: "sine", gain: 0.3 },
        { t: 0.4, dur: 0.5, freq: F.C5, type: "sine", gain: 0.3 },
      ];
    case "timer_minute":
      return [
        { t: 0, dur: 0.4, freq: F.G5, type: "sine", gain: 0.3 },
        { t: 0.35, dur: 0.4, freq: F.E5, type: "sine", gain: 0.3 },
        { t: 0.7, dur: 0.4, freq: F.C5, type: "sine", gain: 0.3 },
      ];
    case "timer_done": {
      const once = [
        { dt: 0, freq: F.E5 },
        { dt: 0.35, freq: F.C5 },
        { dt: 0.7, freq: F.G4 },
      ];
      return [0, 1.1].flatMap((offset) =>
        once.map(({ dt, freq }) => ({ t: offset + dt, dur: 0.4, freq, type: "sine", gain: 0.32 }))
      );
    }
    default:
      return [];
  }
}

export function soundDuration(name, opts) {
  return buildNotes(name, opts).reduce((m, n) => Math.max(m, n.t + n.dur), 0);
}

function defaultContextCtor() {
  if (typeof window === "undefined") return null;
  return window.AudioContext || window.webkitAudioContext || null;
}

export function createAudioEngine({ getContextCtor = defaultContextCtor, now = () => Date.now() } = {}) {
  let ctx = null;
  let master = null;
  let voices = [];
  const lastPlayed = {};

  const supported = () => !!getContextCtor();

  function getStatus() {
    if (!supported()) return "unsupported";
    return ctx && ctx.state === "running" ? "ready" : "locked";
  }

  // Must be called from a user gesture (click, key press, touch).
  async function unlock() {
    const Ctor = getContextCtor();
    if (!Ctor) return "unsupported";
    try {
      if (!ctx) {
        ctx = new Ctor();
        master = ctx.createGain();
        master.gain.value = MASTER_GAIN;
        const comp = ctx.createDynamicsCompressor();
        master.connect(comp);
        comp.connect(ctx.destination);
      }
      if (ctx.state !== "running" && typeof ctx.resume === "function") await ctx.resume();
    } catch {
      // blocked or failed: stay locked, the game works silently
    }
    return getStatus();
  }

  function removeVoice(v) {
    voices = voices.filter((x) => x !== v);
  }

  function play(name, { streak = 1, volume = 0.5, channel = "game" } = {}) {
    if (!ctx || ctx.state !== "running") return false;
    if (!(volume > 0)) return false;
    const notes = buildNotes(name, { streak });
    if (!notes.length) return false;
    const t = now();
    const gap = MIN_GAP_MS[name] ?? 100;
    if (lastPlayed[name] != null && t - lastPlayed[name] < gap) return false;
    if (channel === "game" && voices.filter((v) => v.channel === "game").length + notes.length > MAX_GAME_VOICES) {
      return false;
    }
    lastPlayed[name] = t;

    const amp = Math.min(1, Math.max(0, volume)) ** 2;
    const base = ctx.currentTime;
    try {
      notes.forEach((n) => {
        const start = base + n.t;
        const end = start + n.dur;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = n.type;
        osc.frequency.setValueAtTime(n.freq, start);
        if (n.endFreq) osc.frequency.exponentialRampToValueAtTime(n.endFreq, end);
        const peak = Math.max(0.0002, Math.min(n.gain, MAX_NOTE_GAIN) * amp);
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(peak, start + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(g);
        g.connect(master);
        const voice = { channel, osc, gain: g };
        osc.onended = () => removeVoice(voice);
        voices.push(voice);
        osc.start(start);
        osc.stop(end + 0.05);
      });
    } catch {
      return false;
    }
    return true;
  }

  // Immediately silence one channel ("game" or "timer"), or everything when omitted.
  function stopAll(channel) {
    const stopping = voices.filter((v) => !channel || v.channel === channel);
    voices = voices.filter((v) => !stopping.includes(v));
    const t = ctx ? ctx.currentTime : 0;
    stopping.forEach((v) => {
      try {
        v.gain.gain.cancelScheduledValues(t);
        v.gain.gain.setValueAtTime(0.0001, t);
      } catch {
        // ignore
      }
      try {
        v.osc.stop(t);
      } catch {
        // already stopped
      }
      try {
        v.gain.disconnect();
      } catch {
        // ignore
      }
    });
  }

  const activeVoices = (channel) => voices.filter((v) => !channel || v.channel === channel).length;

  return { unlock, play, stopAll, getStatus, activeVoices };
}

export const gameAudio = createAudioEngine();

// Unlock audio on the first real interaction (tap, click or key press) when sound is wanted.
// Creating the context makes no sound. Returns a function that removes the listeners.
export function attachGestureUnlock(shouldUnlock, engine = gameAudio) {
  if (typeof document === "undefined") return () => {};
  const events = ["pointerdown", "keydown", "touchend"];
  const detach = () => events.forEach((e) => document.removeEventListener(e, handler, true));
  function handler() {
    if (!shouldUnlock()) return;
    engine.unlock().then((status) => {
      if (status === "ready" || status === "unsupported") detach();
    });
  }
  events.forEach((e) => document.addEventListener(e, handler, true));
  return detach;
}
