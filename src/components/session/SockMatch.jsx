import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { BigButton } from "@/components/session/ui";
import { usePrefs, setPrefs, animationsEnabled } from "@/lib/sessionPrefs";
import { gameAudio } from "@/lib/gameAudio";
import { applyMatch, applyMiss, finishRound, sensoryProfile, soundForEvent } from "@/lib/gameRewards";

// Sock Match: an original, calm memory game (6 sock pairs, no time pressure, no score loss).
// - Plain buttons: works with keyboard (Tab, Enter/Space), touch, mouse and screen readers.
// - Each card shows a symbol AND a text name, so nothing depends on color.
// - Rewards: small points, a gentle combo bonus, a best score on this device. No currency,
//   purchases or loot boxes.
// - Every sound has a visible equivalent (the feedback line, check marks, the board-cleared panel),
//   so the game is fully playable with sound off. Sound starts only after the first tap or key press.
// - `paused` freezes input, turns revealed cards face down, silences game sounds and cancels any
//   celebration right away. The board is saved on this device and resumes in the next waiting period.

const STORAGE_KEY = "lf_sockmatch_v1";

const SOCKS = [
  { id: "star", glyph: "⭐", label: "Star" },
  { id: "heart", glyph: "❤️", label: "Heart" },
  { id: "moon", glyph: "🌙", label: "Moon" },
  { id: "clover", glyph: "🍀", label: "Clover" },
  { id: "diamond", glyph: "🔷", label: "Diamond" },
  { id: "sun", glyph: "☀️", label: "Sun" },
];

const sockById = (id) => SOCKS.find((s) => s.id === id);

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newBoard() {
  return shuffle(SOCKS.flatMap((s) => [
    { key: `${s.id}-a`, sock: s.id, matched: false },
    { key: `${s.id}-b`, sock: s.id, matched: false },
  ]));
}

const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

// Older saved games (moves + cleared only) still load; new fields start at zero.
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.cards) && saved.cards.length === 12 && saved.cards.every((c) => sockById(c.sock))) {
      return {
        cards: saved.cards,
        moves: count(saved.moves),
        cleared: count(saved.cleared),
        score: count(saved.score),
        best: count(saved.best),
        round: Math.max(1, count(saved.round)),
        streak: 0,
        lastRound:
          saved.lastRound && Number.isFinite(saved.lastRound.total)
            ? { total: saved.lastRound.total, isPersonalBest: saved.lastRound.isPersonalBest === true }
            : null,
      };
    }
  } catch {
    // fall through to a fresh board
  }
  return { cards: newBoard(), moves: 0, cleared: 0, score: 0, best: 0, round: 1, streak: 0, lastRound: null };
}

function fireConfetti() {
  return import("canvas-confetti")
    .then((m) =>
      m.default({ particleCount: 40, spread: 60, startVelocity: 25, ticks: 120, origin: { y: 0.65 }, disableForReducedMotion: true })
    )
    .catch(() => {});
}

function cancelConfetti() {
  return import("canvas-confetti").then((m) => m.default.reset && m.default.reset()).catch(() => {});
}

export default function SockMatch({ paused = false, pausedReason = "" }) {
  const prefs = usePrefs();
  const profile = sensoryProfile(prefs, animationsEnabled(prefs));
  const [state, setState] = useState(loadState);
  const [faceUp, setFaceUp] = useState([]);
  const [announce, setAnnounce] = useState("");
  const [feedback, setFeedback] = useState("");
  const { cards, moves, cleared, score, best, streak, round, lastRound } = state;
  const boardDone = cards.every((c) => c.matched);

  // Latest values for effects and delayed callbacks that must not go stale.
  const stateRef = useRef(state);
  const profileRef = useRef(profile);
  const pausedRef = useRef(paused);
  const firedConfetti = useRef(false);
  stateRef.current = state;
  profileRef.current = profile;
  pausedRef.current = paused;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable: the game still works for this visit
    }
  }, [state]);

  // Silence game sounds if the game goes away (collapsed, page change, step change).
  useEffect(() => () => gameAudio.stopAll("game"), []);

  // Freeze: turn revealed cards back over, stop game sounds and any celebration immediately.
  // This never touches the "timer" audio channel, so the laundry alert is unaffected.
  useEffect(() => {
    if (!paused) return;
    setFaceUp([]);
    setFeedback("");
    setAnnounce("");
    setState((s) => (s.streak ? { ...s, streak: 0 } : s));
    gameAudio.stopAll("game");
    if (firedConfetti.current) {
      firedConfetti.current = false;
      cancelConfetti();
    }
  }, [paused]);

  // `gesture` is true only when called straight from a tap or key press: that is the one place
  // the browser lets us start audio.
  const playEvent = (event, opts, gesture = false) => {
    const p = profileRef.current;
    const snd = soundForEvent(event, p, opts);
    if (!snd) return;
    const go = () => {
      if (pausedRef.current) return;
      gameAudio.play(snd.name, { streak: snd.streak, volume: p.volume, channel: "game" });
    };
    if (gesture && gameAudio.getStatus() !== "ready") gameAudio.unlock().then(go);
    else go();
  };

  // Resolve a revealed pair.
  useEffect(() => {
    if (paused || faceUp.length !== 2) return undefined;
    const [a, b] = faceUp;
    const s = stateRef.current;
    if (s.cards[a].sock === s.cards[b].sock) {
      const label = sockById(s.cards[a].sock).label;
      const finishes = s.cards.every((c, i) => c.matched || i === a || i === b);
      const m = applyMatch({ score: s.score, streak: s.streak });
      const nextCards = s.cards.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c));
      if (finishes) {
        const r = finishRound({ score: m.score, best: s.best });
        setState({
          ...s,
          cards: nextCards,
          score: r.total,
          best: r.best,
          streak: m.streak,
          cleared: s.cleared + 1,
          lastRound: { total: r.total, isPersonalBest: r.isPersonalBest },
        });
        setFeedback(r.isPersonalBest ? `New personal best! ${r.total} points` : `Board cleared! Score ${r.total}.`);
        setAnnounce(
          r.isPersonalBest
            ? `Match! Board cleared. New personal best: ${r.total} points.`
            : `Match! Board cleared. You scored ${r.total} points.`
        );
        playEvent(r.isPersonalBest ? "best" : "round");
        if (profileRef.current.confetti) {
          firedConfetti.current = true;
          fireConfetti();
        }
      } else {
        setState({ ...s, cards: nextCards, score: m.score, streak: m.streak });
        setFeedback(`${m.message} +${m.points}`);
        setAnnounce(`${m.message} You found the ${label} pair. Plus ${m.points} points.`);
        playEvent("match", { streak: m.streak });
      }
      setFaceUp([]);
      return undefined;
    }
    const miss = applyMiss({ score: s.score });
    setState((cur) => (cur.streak ? { ...cur, streak: miss.streak } : cur));
    setFeedback(miss.message);
    playEvent("miss");
    const t = setTimeout(() => {
      setFaceUp([]);
      setAnnounce("Not a match. The cards turned back over.");
    }, 1200);
    return () => clearTimeout(t);
    // playEvent only reads refs, so it is safe to leave out of the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceUp, paused]);

  const flip = (i) => {
    if (paused || boardDone) return;
    if (cards[i].matched || faceUp.includes(i) || faceUp.length >= 2) return;
    const first = faceUp.length === 0;
    if (!first) setState((s) => ({ ...s, moves: s.moves + 1 }));
    setFaceUp((f) => [...f, i]);
    setAnnounce(`${sockById(cards[i].sock).label} sock.`);
    if (first) {
      setFeedback("");
      playEvent("select", undefined, true);
    } else if (profileRef.current.soundOn && gameAudio.getStatus() === "locked") {
      gameAudio.unlock(); // the pair's result sound follows right after
    }
  };

  const reset = () => {
    gameAudio.stopAll("game");
    setState((s) => ({ ...s, cards: newBoard(), moves: 0, score: 0, streak: 0, round: s.round + 1, lastRound: null }));
    setFaceUp([]);
    setFeedback("");
    setAnnounce("New board ready. All cards face down.");
  };

  const toggleSound = () => {
    const next = !(prefs.gameSound !== false);
    setPrefs({ gameSound: next });
    if (!next) gameAudio.stopAll("game");
    else gameAudio.unlock(); // a tap is a valid moment to prepare audio
  };

  const changeVolume = (percent) => {
    const v = Math.min(100, Math.max(0, percent)) / 100;
    setPrefs({ gameVolume: v });
    if (paused) return;
    const p = sensoryProfile({ ...prefs, gameVolume: v }, false);
    const snd = soundForEvent("match", p, { streak: 1 });
    if (!snd) return;
    const go = () => !pausedRef.current && gameAudio.play(snd.name, { streak: 1, volume: p.volume, channel: "game" });
    if (gameAudio.getStatus() !== "ready") gameAudio.unlock().then(go);
    else go();
  };

  const soundOn = prefs.gameSound !== false;
  const volumePercent = Math.round((Number.isFinite(prefs.gameVolume) ? prefs.gameVolume : 0.5) * 100);

  return (
    <div>
      <h3 className="text-lg font-semibold">Sock Match</h3>
      <p className="text-sm text-muted-foreground">
        Find the matching pairs. No timer, no pressure, and a miss never costs points.
      </p>
      <p className="mt-1 text-base font-medium tabular-nums">
        Points: {score}
        {best > 0 ? ` · Best: ${best}` : ""} · Streak: {streak} · Moves: {moves} · Boards cleared: {cleared}
      </p>

      {paused && (
        <p role="status" className="my-3 rounded-2xl border-2 border-foreground p-3 text-base font-medium">
          Game paused. {pausedReason}
        </p>
      )}

      {/* Visible feedback: the on-screen equivalent of every sound. Screen readers get the fuller
          version in the hidden live region below, so this line is hidden from them to avoid repeats. */}
      <p className="mt-3 min-h-[1.75rem] text-base font-semibold" aria-hidden="true">
        {feedback}
      </p>

      <div role="group" aria-label="Sock Match board, 12 cards" className="mt-1 grid grid-cols-4 gap-2">
        {cards.map((c, i) => {
          const sock = sockById(c.sock);
          const revealed = c.matched || faceUp.includes(i);
          return (
            <button
              key={c.key}
              type="button"
              disabled={paused}
              aria-disabled={c.matched || undefined}
              onClick={() => flip(i)}
              aria-label={
                revealed
                  ? `Card ${i + 1}: ${sock.label} sock${c.matched ? ", matched" : ""}`
                  : `Card ${i + 1}: face down`
              }
              className={cn(
                "flex min-h-[72px] flex-col items-center justify-center rounded-2xl border-2 p-1 text-center transition-transform duration-150 disabled:opacity-60",
                revealed ? "border-primary bg-background" : "border-border bg-muted",
                c.matched && "border-4 bg-secondary",
                c.matched && profile.pop && "scale-105"
              )}
            >
              {revealed ? (
                <>
                  <span className="text-2xl leading-none" aria-hidden="true">{sock.glyph}</span>
                  <span className="mt-1 text-xs font-medium" aria-hidden="true">
                    {c.matched ? "✓ " : ""}
                    {sock.label}
                  </span>
                </>
              ) : (
                <span className="text-2xl font-semibold text-muted-foreground" aria-hidden="true">?</span>
              )}
            </button>
          );
        })}
      </div>

      <p className="sr-only" role="status" aria-live="polite">{announce}</p>

      {boardDone && (
        <div className="mt-3 rounded-2xl border-4 border-primary p-4 text-center">
          <p className="text-xl font-semibold">
            <span aria-hidden="true">✓ </span>Board cleared!
          </p>
          <p className="mt-1 text-base tabular-nums">Score: {lastRound ? lastRound.total : score}</p>
          {lastRound?.isPersonalBest && (
            <p className="mt-2 inline-block rounded-full border-2 border-foreground px-3 py-1 text-base font-bold">
              <span aria-hidden="true">★ </span>New personal best!
            </p>
          )}
        </div>
      )}

      <div className="mt-3">
        <BigButton variant="secondary" onClick={reset} disabled={paused} className="min-h-[48px] text-base">
          {boardDone ? "Play a new board" : "Shuffle a new board"}
        </BigButton>
      </div>

      {/* Sound controls live here too, so they are right where the game is. All optional. */}
      <fieldset className="mt-5 space-y-3 rounded-2xl border-2 border-border p-3">
        <legend className="px-1 text-base font-semibold">Game sound</legend>
        <button
          type="button"
          aria-pressed={soundOn}
          onClick={toggleSound}
          className="min-h-[48px] w-full rounded-2xl border-2 border-primary px-4 text-base font-medium"
        >
          Sound: {soundOn ? "On" : "Off"}
        </button>
        <label className="block text-base">
          <span className="font-medium">Game volume: {volumePercent}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={volumePercent}
            disabled={!soundOn}
            aria-valuetext={`${volumePercent} percent`}
            onChange={(e) => changeVolume(Number(e.target.value))}
            className="mt-2 block h-11 w-full"
          />
        </label>
        <label className="flex min-h-[48px] items-center gap-3 text-base">
          <input
            type="checkbox"
            checked={prefs.reducedSensory === true}
            onChange={(e) => setPrefs({ reducedSensory: e.target.checked })}
            className="h-6 w-6"
          />
          <span>
            <span className="font-medium">Calmer game</span>
            <span className="block text-sm text-muted-foreground">Quieter, fewer sounds, no confetti.</span>
          </span>
        </label>
      </fieldset>
    </div>
  );
}
