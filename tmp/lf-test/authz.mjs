// Direct-API authorization matrix for one entity, using only synthetic accounts A and B (and no token).
// usage: node authz.mjs <EntityName> [--load]   (--load uses real Load field shape; markers are synthetic)
// Output: one line per check: PASS (access denied as required / own access works) or FAIL, never prints tokens.
import fs from "node:fs";
const APP = "69ae2620151e62b00d74f1d0", SERVER = "https://easy-laundry-flow.base44.app";
const ENT = process.argv[2];
const isLoad = process.argv.includes("--load");
const EA = "lf-sectest-a@example.com", EB = "lf-sectest-b@example.com";
const tok = (n) => fs.readFileSync(`/tmp/lf-test/${n}.token`, "utf8").trim();
const url = (p = "") => `${SERVER}/api/apps/${APP}/entities/${ENT}${p}`;
async function call(token, method, path = "", body) {
  const headers = { "X-App-Id": APP, "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const r = await fetch(url(path), { method, headers, body: body ? JSON.stringify(body) : undefined });
  let data = null; try { data = await r.json(); } catch {}
  return { status: r.status, data };
}
const TA = tok("A"), TB = tok("B");
const tag = "LF-AUTHZ-" + Math.random().toString(36).slice(2, 8);
const shape = (marker) => isLoad
  ? { load_type: "everyday_clothes", current_state: "washing", status: "active", stage_start_time: new Date().toISOString(), wash_timer_minutes: 35, notes: marker }
  : { note: marker };
const field = isLoad ? "notes" : "note";
const results = [];
const rec = (n, ok, d = "") => { results.push({ n, ok }); console.log(`${ok ? "PASS" : "FAIL"}  ${n}${d ? "  -> " + d : ""}`); };
const arr = (d) => Array.isArray(d) ? d : (d && Array.isArray(d.items) ? d.items : (d && Array.isArray(d.data) ? d.data : []));
const own = (rows, email) => rows.every((x) => x.created_by === email);

// 1-2 create + own access
const a = await call(TA, "POST", "", shape(tag + "-A")); const b = await call(TB, "POST", "", shape(tag + "-B"));
rec("1. A can create own record", a.status < 300 && a.data?.id, `status ${a.status}`);
rec("2. B can create own record", b.status < 300 && b.data?.id, `status ${b.status}`);
const aid = a.data?.id, bid = b.data?.id;
const ga = await call(TA, "GET", `/${aid}`); rec("1b. A can read own record by id", ga.status === 200 && ga.data?.[field] === tag + "-A", `status ${ga.status}`);
const gb = await call(TB, "GET", `/${bid}`); rec("2b. B can read own record by id", gb.status === 200 && gb.data?.[field] === tag + "-B", `status ${gb.status}`);
const ua = await call(TA, "PUT", `/${aid}`, { [field]: tag + "-A2" }); rec("1c. A can update own record", ua.status === 200 && ua.data?.[field] === tag + "-A2", `status ${ua.status}`);

// 3-4 cross read
const xa = await call(TA, "GET", `/${bid}`); rec("3. A cannot GET B's record by id", xa.status >= 400 && !xa.data?.[field], `status ${xa.status}`);
const xb = await call(TB, "GET", `/${aid}`); rec("4. B cannot GET A's record by id", xb.status >= 400 && !xb.data?.[field], `status ${xb.status}`);

// 8 list & filter
for (const [who, t, email, other] of [["A", TA, EA, tag + "-B"], ["B", TB, EB, tag + "-A"]]) {
  const l = await call(t, "GET", "?limit=500"); const rows = arr(l.data);
  rec(`8. ${who} list returns only ${who}'s records`, l.status === 200 && rows.length > 0 && own(rows, email), `status ${l.status}, rows ${rows.length}`);
  const q = encodeURIComponent(JSON.stringify({ [field]: { $regex: "LF-AUTHZ" } }));
  const f = await call(t, "GET", `?q=${q}&limit=500`); const fr = arr(f.data);
  rec(`8. ${who} filter by marker sees no other-account marker`, f.status === 200 && !fr.some((x) => String(x[field] || "").includes(other.slice(0, -2))) && own(fr, email), `status ${f.status}, rows ${fr.length}`);
  const q2 = encodeURIComponent(JSON.stringify({ created_by: email === EA ? EB : EA }));
  const f2 = await call(t, "GET", `?q=${q2}&limit=500`); rec(`8. ${who} filter created_by=other returns nothing`, f2.status === 200 && arr(f2.data).length === 0, `rows ${arr(f2.data).length}`);
}

// 5-6 cross update / delete
const bu = await call(TB, "PUT", `/${aid}`, { [field]: tag + "-TAMPER" }); const chkA = await call(TA, "GET", `/${aid}`);
rec("6. B cannot UPDATE A's record", bu.status >= 400 && chkA.data?.[field] === tag + "-A2", `status ${bu.status}`);
const au = await call(TA, "PUT", `/${bid}`, { [field]: tag + "-TAMPER" }); const chkB = await call(TB, "GET", `/${bid}`);
rec("5. A cannot UPDATE B's record", au.status >= 400 && chkB.data?.[field] === tag + "-B", `status ${au.status}`);
const bd = await call(TB, "DELETE", `/${aid}`); const stillA = await call(TA, "GET", `/${aid}`);
rec("6. B cannot DELETE A's record", stillA.status === 200 && stillA.data?.id === aid, `delete status ${bd.status}`);
const ad = await call(TA, "DELETE", `/${bid}`); const stillB = await call(TB, "GET", `/${bid}`);
rec("5. A cannot DELETE B's record", stillB.status === 200 && stillB.data?.id === bid, `delete status ${ad.status}`);

// ownership forging / taking
const fg = await call(TB, "POST", "", { ...shape(tag + "-FORGE"), created_by: EA, created_by_id: "forged" });
rec("9a. B cannot create a record owned by A (created_by forged)", fg.status >= 400 || fg.data?.created_by === EB, `status ${fg.status}, stored owner is B=${fg.data?.created_by === EB}`);
const fgid = fg.data?.id;
const seenByA = fgid ? (await call(TA, "GET", `/${fgid}`)).status : 0;
rec("9b. A cannot see the forged record", seenByA >= 400 || seenByA === 0, `A status ${seenByA}`);
const re = await call(TB, "PUT", `/${bid}`, { created_by: EA }); const after = await call(TB, "GET", `/${bid}`); const afterA = await call(TA, "GET", `/${bid}`);
rec("9c. B cannot reassign own record to A (update created_by)", !(afterA.status === 200), `update status ${re.status}; B still reads=${after.status === 200}; A reads=${afterA.status === 200}`);
const re2 = await call(TB, "PUT", `/${bid}`, { created_by_id: "69ae2620151e62b00d74f1d1" }); const afterA2 = await call(TA, "GET", `/${bid}`);
rec("9d. B cannot reassign own record by created_by_id", afterA2.status !== 200, `update status ${re2.status}`);
const take = await call(TB, "PUT", `/${aid}`, { created_by: EB, created_by_id: "x" }); const takeChk = await call(TA, "GET", `/${aid}`);
rec("9e. B cannot take ownership of A's record", take.status >= 400 && takeChk.status === 200, `status ${take.status}; A still reads=${takeChk.status === 200}`);

// 7 unauthenticated and bad tokens
const u1 = await call(null, "GET", "?limit=5"); rec("7. unauthenticated list denied", u1.status >= 400 && arr(u1.data).length === 0, `status ${u1.status}`);
const u2 = await call(null, "GET", `/${aid}`); rec("7. unauthenticated get-by-id denied", u2.status >= 400 && !u2.data?.[field], `status ${u2.status}`);
const u3 = await call(null, "POST", "", shape("anon")); rec("7. unauthenticated create denied", u3.status >= 400, `status ${u3.status}`);
const u4 = await call(null, "PUT", `/${aid}`, { [field]: "anon" }); rec("7. unauthenticated update denied", u4.status >= 400, `status ${u4.status}`);
const u5 = await call(null, "DELETE", `/${aid}`); const still = await call(TA, "GET", `/${aid}`); rec("7. unauthenticated delete denied", u5.status >= 400 && still.status === 200, `status ${u5.status}`);
const bad = await call("not-a-real-token", "GET", "?limit=5"); rec("7. garbage token denied", bad.status >= 400 && arr(bad.data).length === 0, `status ${bad.status}`);

// cleanup of everything created here
for (const [t, id] of [[TA, aid], [TB, bid], [TB, fgid]]) if (id) await call(t, "DELETE", `/${id}`);
const left = [];
for (const [t, id] of [[TA, aid], [TB, bid], [TB, fgid]]) if (id && (await call(t, "GET", `/${id}`)).status === 200) left.push(id);
rec("cleanup: all test records removed", left.length === 0, `remaining ${left.length}`);
const fails = results.filter((r) => !r.ok).length;
console.log(`\n${ENT}: ${results.length - fails}/${results.length} passed${fails ? `, ${fails} FAILED` : ""}`);
fs.writeFileSync(`/tmp/lf-test/result-${ENT}.json`, JSON.stringify(results, null, 2));
