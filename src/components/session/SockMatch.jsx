import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { BigButton } from "@/components/session/ui";

// Sock Match: an original, calm memory game (6 sock pairs, no time pressure, no score loss).
// - Plain buttons: works with keyboard (Tab, Enter/Space), touch, mouse and screen readers.
// - Each card shows a symbol AND a text name, so nothing depends on color.
// - `paused` freezes input and turns revealed cards face down. The board is saved on this
//   device, so the same game resumes during the next waiting period.

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

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && Array.isArray(saved.cards) && saved.cards.length === 12 && saved.cards.every((c) => sockById(c.sock))) {
      return { cards: saved.cards, moves: saved.moves | 0, cleared: saved.cleared | 0 };
    }
  } catch {
    // fall through to a fresh board
  }
  return { cards: newBoard(), moves: 0, cleared: 0 };
}

export default function SockMatch({ paused = false, pausedReason = "" }) {
  const [state, setState] = useState(loadState);
  const [faceUp, setFaceUp] = useState([]);
  const [announce, setAnnounce] = useState("");
  const { cards, moves, cleared } = state;
  const boardDone = cards.every((c) => c.matched);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable: the game still works for this visit
    }
  }, [state]);

  // Freeze: any revealed pair is turned back over so the game resumes cleanly later.
  useEffect(() => {
    if (paused) setFaceUp([]);
  }, [paused]);

  // Resolve a revealed pair.
  useEffect(() => {
    if (faceUp.length !== 2) return undefined;
    const [a, b] = faceUp;
    if (cards[a].sock === cards[b].sock) {
      const finishes = cards.every((c, i) => c.matched || i === a || i === b);
      setState((s) => ({
        ...s,
        cleared: finishes ? s.cleared + 1 : s.cleared,
        cards: s.cards.map((c, i) => (i === a || i === b ? { ...c, matched: true } : c)),
      }));
      setFaceUp([]);
      setAnnounce(finishes ? "Match! Board cleared. Nicely done." : `Match! You found the ${sockById(cards[a].sock).label} pair.`);
      return undefined;
    }
    const t = setTimeout(() => {
      setFaceUp([]);
      setAnnounce("Not a match. The cards turned back over.");
    }, 1200);
    return () => clearTimeout(t);
  }, [faceUp, cards]);

  const flip = (i) => {
    if (paused || boardDone) return;
    if (cards[i].matched || faceUp.includes(i) || faceUp.length >= 2) return;
    if (faceUp.length === 1) setState((s) => ({ ...s, moves: s.moves + 1 }));
    setFaceUp((f) => [...f, i]);
    setAnnounce(`${sockById(cards[i].sock).label} sock.`);
  };

  const reset = () => {
    setState((s) => ({ cards: newBoard(), moves: 0, cleared: s.cleared }));
    setFaceUp([]);
    setAnnounce("New board ready. All cards face down.");
  };

  return (
    <div>
      <h3 className="text-lg font-semibold">Sock Match</h3>
      <p className="text-sm text-muted-foreground">
        Find the matching pairs. No timer, no pressure. Moves: {moves} · Boards cleared: {cleared}
      </p>

      {paused && (
        <p role="status" className="my-3 rounded-2xl border-2 border-foreground p-3 text-base font-medium">
          Game paused. {pausedReason}
        </p>
      )}

      <div role="group" aria-label="Sock Match board, 12 cards" className="mt-3 grid grid-cols-4 gap-2">
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
                "flex min-h-[72px] flex-col items-center justify-center rounded-2xl border-2 p-1 text-center disabled:opacity-60",
                revealed ? "border-primary bg-background" : "border-border bg-muted",
                c.matched && "border-4 bg-secondary"
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

      <div className="mt-3">
        <BigButton variant="secondary" onClick={reset} disabled={paused} className="min-h-[48px] text-base">
          {boardDone ? "Play a new board" : "Shuffle a new board"}
        </BigButton>
      </div>
    </div>
  );
}
