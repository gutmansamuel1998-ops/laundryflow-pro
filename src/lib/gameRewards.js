// Sock Match rewards: pure, deterministic helpers (no audio, no DOM, no storage).
// Points are a small, friendly score. There are no currencies, purchases or loot boxes,
// and a miss never takes points away.

export const POINTS = { match: 10, comboStep: 5, comboCap: 20, roundBonus: 25 };

const num = (v, fallback = 0) => (Number.isFinite(v) ? v : fallback);

// Streak 1 -> 0, 2 -> 5, 3 -> 10, 4 -> 15, 5 or more -> 20.
export function comboBonus(streak) {
  const s = Math.floor(num(streak));
  if (s < 2) return 0;
  return Math.min((s - 1) * POINTS.comboStep, POINTS.comboCap);
}

export function applyMatch({ score = 0, streak = 0 } = {}) {
  const nextStreak = Math.max(0, Math.floor(num(streak))) + 1;
  const bonus = comboBonus(nextStreak);
  const points = POINTS.match + bonus;
  return {
    streak: nextStreak,
    bonus,
    points,
    score: Math.max(0, num(score)) + points,
    message: nextStreak >= 2 ? `Great streak! x${nextStreak}` : "Nice match!",
  };
}

export function applyMiss({ score = 0 } = {}) {
  return {
    streak: 0,
    bonus: 0,
    points: 0,
    score: Math.max(0, num(score)),
    message: "Not a match. Try again.",
  };
}

// Called when the last pair is found. `score` already includes that final match.
export function finishRound({ score = 0, best = 0 } = {}) {
  const total = Math.max(0, num(score)) + POINTS.roundBonus;
  const previousBest = Math.max(0, num(best));
  const isFirstBoard = previousBest <= 0;
  const isPersonalBest = !isFirstBoard && total > previousBest;
  return {
    total,
    bonus: POINTS.roundBonus,
    best: Math.max(previousBest, total),
    isPersonalBest,
    isFirstBoard,
    message: isPersonalBest ? "New personal best!" : "Board cleared!",
  };
}

// One place that turns the user's settings into what the game may do.
// "Calmer game" (reduced sensory): quieter, no select/miss sounds, one soft chime for
// every reward, and no confetti or card pop. Sound off silences everything in the game.
export function sensoryProfile(prefs = {}, animationsAllowed = true) {
  const calm = !!prefs.reducedSensory;
  const raw = Number.isFinite(prefs.gameVolume) ? prefs.gameVolume : 0.5;
  const clamped = Math.min(1, Math.max(0, raw));
  return {
    calm,
    soundOn: prefs.gameSound !== false,
    volume: calm ? clamped * 0.5 : clamped,
    confetti: !calm && !!animationsAllowed,
    pop: !calm && !!animationsAllowed,
  };
}

// event: "select" | "match" | "miss" | "round" | "best"
export function soundForEvent(event, profile, { streak = 1 } = {}) {
  if (!profile || !profile.soundOn || !(profile.volume > 0)) return null;
  if (profile.calm) {
    if (event === "match" || event === "round" || event === "best") return { name: "soft_chime", streak: 1 };
    return null;
  }
  switch (event) {
    case "select":
      return { name: "select", streak: 1 };
    case "match":
      return { name: "match", streak: Math.max(1, Math.floor(num(streak, 1))) };
    case "miss":
      return { name: "miss", streak: 1 };
    case "round":
      return { name: "round", streak: 1 };
    case "best":
      return { name: "best", streak: 1 };
    default:
      return null;
  }
}
