// Shared helpers for the notification tests (not a test file itself). Includes a tiny simulated
// operating system: a pending-notification list that behaves like a real scheduler would,
// plus a way to "lose" notifications the way a reboot or a clean install can.

export const T0 = Date.parse("2026-01-01T12:00:00.000Z");

export const washing = (over = {}) => ({
  id: "L1",
  status: "active",
  current_state: "washing",
  stage_start_time: new Date(T0).toISOString(),
  wash_timer_minutes: 35,
  ...over,
});

export const drying = (over = {}) => ({
  id: "L1",
  status: "active",
  current_state: "drying",
  stage_start_time: new Date(T0).toISOString(),
  dry_timer_minutes: 45,
  dry_guidance: "tumble_medium",
  ...over,
});

export function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  };
}

export function makeOS({ permission = "granted", native = true } = {}) {
  const os = {
    permission,
    native,
    pending: new Map(),
    log: [],
    duplicateSchedules: 0,
    failNext: null,
  };
  os.adapter = {
    isNative: () => os.native,
    getPermission: async () => os.permission,
    requestPermission: async () => os.permission,
    schedule: async (items) => {
      if (os.failNext === "schedule") {
        os.failNext = null;
        throw new Error("schedule failed");
      }
      os.log.push(["schedule", items.map((i) => i.id)]);
      items.forEach((i) => {
        if (os.pending.has(i.id)) os.duplicateSchedules += 1;
        os.pending.set(i.id, { ...i });
      });
    },
    cancel: async (ids) => {
      os.log.push(["cancel", [...ids]]);
      ids.forEach((id) => os.pending.delete(id));
    },
    getPending: async () => [...os.pending.values()].map((i) => ({ id: i.id, extra: i.extra })),
  };
  // Simulate time passing: delivered notifications leave the pending list.
  os.fireDue = (nowMs) => {
    const fired = [];
    for (const [id, item] of os.pending) {
      if (item.at <= nowMs) {
        fired.push(item);
        os.pending.delete(id);
      }
    }
    return fired;
  };
  os.pendingEvents = () => [...os.pending.values()].sort((a, b) => a.at - b.at).map((i) => i.event);
  return os;
}
