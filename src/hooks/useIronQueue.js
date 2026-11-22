import { useCallback, useEffect, useRef, useState } from "react";
import { useOwnerKey } from "@/hooks/useOwnerKey";
import { IRON_QUEUE_KEY, readQueue, writeQueue } from "@/lib/ironQueueStore";
import { IRON_COPY, addItem, clearFinished, markDone, removeItem, reopenItem, setHeat } from "@/lib/ironQueue";

// The Ironing Queue for the signed-in person, kept on this device only. Every change re-reads the saved list
// first, so two open tabs never overwrite each other. It reads no laundry session and writes nothing to the
// server, so it can never affect a timer, a step, or finishing a load.

const listeners = new Set();
const notifyOthers = () => listeners.forEach((l) => l());

const newId = () =>
  globalThis.crypto && typeof globalThis.crypto.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `iq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function useIronQueue() {
  const owner = useOwnerKey();
  const [items, setItems] = useState([]);
  const [saveFailed, setSaveFailed] = useState(false);
  const ownerRef = useRef(owner);
  ownerRef.current = owner;

  const refresh = useCallback(() => setItems(ownerRef.current ? readQueue({ owner: ownerRef.current }) : []), []);

  useEffect(() => {
    refresh();
    const onStorage = (e) => {
      if (e.key === IRON_QUEUE_KEY || e.key === null) refresh();
    };
    window.addEventListener("storage", onStorage);
    listeners.add(refresh);
    return () => {
      window.removeEventListener("storage", onStorage);
      listeners.delete(refresh);
    };
  }, [owner, refresh]);

  // fn gets the freshly saved list and returns a result from ironQueue.js ({ ok, items, message, ... }).
  const change = useCallback((fn) => {
    const who = ownerRef.current;
    if (!who) return { ok: false, reason: "not_ready", message: IRON_COPY.unavailable, items: [] };
    const result = fn(readQueue({ owner: who }));
    if (result.ok) {
      const saved = writeQueue({ owner: who, items: result.items });
      setSaveFailed(!saved);
      setItems(result.items);
      notifyOthers();
    }
    return result;
  }, []);

  return {
    items,
    ready: owner !== "",
    saveFailed,
    add: (input) => change((list) => addItem(list, input, { now: Date.now(), id: newId() })),
    done: (id) => change((list) => markDone(list, id, Date.now())),
    reopen: (id) => change((list) => reopenItem(list, id)),
    remove: (id) => change((list) => removeItem(list, id)),
    chooseHeat: (id, heat) => change((list) => setHeat(list, id, heat)),
    clearDone: () => change((list) => clearFinished(list)),
  };
}
