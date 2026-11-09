// Test double for the AiUsage / BubblesMessage entity handlers (service-role side). It behaves like a database that
// is consistent per operation (a row is visible to every read that starts after its create finished) but lets
// concurrent requests interleave at every await, which is what real simultaneous requests do.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeStore({ seed = 1, chaos = false, prefix = "r" } = {}) {
  const rng = mulberry32(seed);
  const rows = [];
  let n = 0;
  const flags = { failCreate: false, failFilter: false, failDelete: false, hide: null };
  const pause = async () => {
    if (!chaos) { await Promise.resolve(); return; }
    const k = Math.floor(rng() * 4);
    for (let i = 0; i < k; i++) await new Promise((r) => setImmediate(r));
  };
  const matches = (row, q) =>
    Object.entries(q || {}).every(([k, v]) =>
      v && typeof v === "object" && "$lt" in v ? row[k] < v.$lt : row[k] === v);
  const api = {
    create: async (data) => {
      await pause();
      if (flags.failCreate) throw new Error("store down (create)");
      const rec = { id: `${prefix}${++n}`, ...data };
      rows.push(rec);
      await pause();
      return { ...rec };
    },
    filter: async (q, sort, limit) => {
      await pause();
      if (flags.failFilter) throw new Error("store down (filter)");
      let out = rows.filter((r) => matches(r, q) && !(flags.hide && flags.hide(r))).map((r) => ({ ...r }));
      if (sort === "-ts") out = out.map((r, i) => [r, i]).sort((a, b) => (b[0].ts - a[0].ts) || (a[1] - b[1])).map((x) => x[0]);
      return out.slice(0, limit ?? 1000);
    },
    delete: async (id) => {
      await pause();
      if (flags.failDelete) throw new Error("store down (delete)");
      const i = rows.findIndex((r) => r.id === id);
      if (i >= 0) rows.splice(i, 1);
      return { success: true };
    },
  };
  return { rows, flags, api };
}
