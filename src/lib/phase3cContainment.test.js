import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { stripTypeScriptTypes } from "node:module";

// Phase 3C containment tests. They run the real function source with mocked platform dependencies
// (no network, no payments, no real records, no paid AI).
const here = dirname(fileURLToPath(import.meta.url));
const fnPath = (name) => join(here, "../../base44/functions", name, "entry.ts");
const read = (name) => readFileSync(fnPath(name), "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// Load a function's source and capture the handler it registers with Deno.serve.
function load(name, { jwt, env = {}, createClientFromRequest } = {}) {
  let src = stripTypeScriptTypes(read(name));
  src = src.replace(/^import .*$/gm, "");
  let handler;
  const Deno = { serve: (h) => { handler = h; }, env: { get: (k) => env[k] } };
  new Function("createClientFromRequest", "jwt", "Deno", src)(createClientFromRequest, jwt, Deno);
  assert.equal(typeof handler, "function", `${name} registers a handler`);
  return handler;
}

// Capture console output during a call so tests can check what is logged.
async function withLogs(fn) {
  const lines = [];
  const orig = { log: console.log, warn: console.warn, error: console.error };
  const cap = (...a) => lines.push(a.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
  console.log = cap; console.warn = cap; console.error = cap;
  try { return { result: await fn(), logs: lines.join("\n") }; }
  finally { Object.assign(console, orig); }
}

// ---- Webhook ------------------------------------------------------------------------------------
const b64 = (o) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
const keys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const otherKeys = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
const publicPem = keys.publicKey.export({ type: "spki", format: "pem" });

function sign(payload, privateKey = keys.privateKey, alg = "RS256") {
  const head = b64({ alg, typ: "JWT" });
  const body = b64(payload);
  const sig = crypto.createSign("RSA-SHA256").update(`${head}.${body}`).sign(privateKey).toString("base64url");
  return `${head}.${body}.${sig}`;
}
// Minimal stand-in for jsonwebtoken.verify (RS256 only).
const jwt = {
  verify(token, key, opts) {
    const parts = String(token).split(".");
    if (parts.length !== 3) throw new Error("jwt malformed");
    const header = JSON.parse(Buffer.from(parts[0], "base64url").toString());
    if (!opts.algorithms.includes(header.alg)) throw new Error("invalid algorithm");
    const ok = crypto.createVerify("RSA-SHA256").update(`${parts[0]}.${parts[1]}`).verify(key, Buffer.from(parts[2], "base64url"));
    if (!ok) throw new Error("invalid signature");
    return JSON.parse(Buffer.from(parts[1], "base64url").toString());
  },
};

const BUYER = "secret.buyer@example.com";
const orderEvent = (extra = {}) => ({
  data: JSON.stringify({
    eventType: "wix.ecom.v1.order_approved",
    data: JSON.stringify({
      actionEvent: { body: { order: {
        id: "order-1", number: "1001", status: "APPROVED", paymentStatus: "PAID", currency: "USD",
        priceSummary: { total: { amount: "0.01" } },
        buyerInfo: { email: BUYER, contactId: "c-1" }, billingInfo: { contactDetails: { firstName: "Secret", lastName: "Buyer" } },
        ...extra,
      } } },
    }),
  }),
});

function webhook({ withKey = true } = {}) {
  const sdk = { calls: 0 };
  const createClientFromRequest = () => { sdk.calls++; throw new Error("SDK must not be used by the grant-disabled webhook"); };
  const handler = load("wixPaymentsWebhook", { jwt, env: withKey ? { WIX_PAYMENTS_WEBHOOK_PUBLIC_KEY: publicPem } : {}, createClientFromRequest });
  return { handler, sdk };
}
const post = (body) => new Request("https://example.test/wixPaymentsWebhook", { method: "POST", body });

test("webhook source has no path to users, entitlements or the SDK", () => {
  const src = code(read("wixPaymentsWebhook"));
  for (const banned of ["createClientFromRequest", "@base44/sdk", "asServiceRole", "entities", "has_premium", ".update(", ".filter(", "buyerInfo", "buyerEmail"]) {
    assert.ok(!src.includes(banned), `must not contain ${banned}`);
  }
  assert.match(src, /algorithms: \["RS256"\]/);
});

test("valid signed order is acknowledged, changes nothing and logs no personal data", async () => {
  const { handler, sdk } = webhook();
  const { result, logs } = await withLogs(() => handler(post(sign(orderEvent()))));
  assert.equal(result.status, 200);
  assert.equal(await result.text(), "OK");
  assert.equal(sdk.calls, 0, "no SDK client may be created");
  assert.ok(logs.includes("order-1"), "operational order id is logged");
  for (const secret of [BUYER, "Secret", "Buyer", "c-1"]) assert.ok(!logs.includes(secret), `log must not contain ${secret}`);
});

test("duplicate deliveries behave identically and never change entitlements", async () => {
  const { handler, sdk } = webhook();
  const token = sign(orderEvent());
  const a = await withLogs(() => handler(post(token)));
  const b = await withLogs(() => handler(post(token)));
  assert.equal(a.result.status, 200);
  assert.equal(b.result.status, 200);
  assert.equal(sdk.calls, 0);
});

test("unrelated event types are acknowledged without side effects", async () => {
  const { handler, sdk } = webhook();
  const token = sign({ data: JSON.stringify({ eventType: "wix.ecom.v1.order_updated", data: "{}" }) });
  const { result } = await withLogs(() => handler(post(token)));
  assert.equal(result.status, 200);
  assert.equal(sdk.calls, 0);
});

test("invalid, forged, tampered, unsigned or empty requests are rejected", async () => {
  const { handler, sdk } = webhook();
  const good = sign(orderEvent());
  const [h, p, s] = good.split(".");
  const tampered = `${h}.${b64(orderEvent({ id: "order-evil" }))}.${s}`;
  const cases = {
    wrongKey: sign(orderEvent(), otherKeys.privateKey),
    tampered,
    alg_none: `${b64({ alg: "none", typ: "JWT" })}.${p}.`,
    garbage: "not-a-token",
    json_body: JSON.stringify(orderEvent()),
    empty: "",
  };
  for (const [name, body] of Object.entries(cases)) {
    const { result, logs } = await withLogs(() => handler(post(body)));
    assert.equal(result.status, 401, `${name} must be rejected with 401`);
    assert.ok(!logs.includes(BUYER), `${name} must not log personal data`);
  }
  assert.equal(sdk.calls, 0);
});

test("signed but malformed payload returns 500 without echoing payload fragments", async () => {
  const { handler, sdk } = webhook();
  const { result, logs } = await withLogs(() => handler(post(sign({ data: "SECRETFRAGMENT is not json" }))));
  assert.equal(result.status, 500);
  assert.ok(!logs.includes("SECRETFRAGMENT"));
  assert.equal(sdk.calls, 0);
});

test("missing public key fails closed", async () => {
  const { handler } = webhook({ withKey: false });
  const { result } = await withLogs(() => handler(post(sign(orderEvent()))));
  assert.equal(result.status, 500);
});

// ---- Legacy AI containment ---------------------------------------------------------------------
function legacy(name, ctx) {
  const entities = new Proxy({}, { get: () => new Proxy({}, { get: () => async () => [] }) });
  const Core = {
    InvokeLLM: async () => { ctx.llm++; return { product_name: null, suggested_unit: "loads", predictions: [], tasks: [], suggestions: [] }; },
    SendEmail: async () => { ctx.email++; },
  };
  const client = {
    auth: { me: async () => ctx.user },
    integrations: { Core },
    entities,
    agents: { getConversation: async () => ({ created_by_id: "u1", agent_name: "bubbles" }) },
    asServiceRole: { integrations: { Core }, entities },
  };
  return load(name, { createClientFromRequest: () => client });
}

const FREE = { id: "u1", email: "free@example.com", role: "user", has_premium: false };
const PREMIUM = { id: "u1", email: "premium@example.com", role: "user", has_premium: true };
const ADMIN = { id: "admin-1", email: "automation@example.com", role: "admin", has_premium: false };

const CASES = {
  smartPlanner: { body: { mode: "dashboard" } },
  smartSchedule: { body: { action: "notify" } },
  analyzeStain: { body: { imageUrl: "https://example.com/stain.jpg" } },
  predictSupplyDepletion: { body: {} },
  bubblesCheckIn: { body: { event: { conversation_id: "c1" } } },
  advancedDepletionPrediction: { body: {} },
};

async function call(name, user, body) {
  const ctx = { user, llm: 0, email: 0 };
  const handler = legacy(name, ctx);
  const origFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ status: 0 }) });
  try {
    const { result } = await withLogs(() => handler(new Request("https://example.test/fn", { method: "POST", body: JSON.stringify(body) })));
    return { status: result.status, json: await result.json().catch(() => ({})), ctx };
  } finally { globalThis.fetch = origFetch; }
}

for (const [name, { body }] of Object.entries(CASES)) {
  test(`${name}: anonymous callers are refused`, async () => {
    const r = await call(name, null, body);
    assert.ok([401, 403].includes(r.status), `status ${r.status}`);
    assert.equal(r.ctx.llm + r.ctx.email, 0);
  });
  test(`${name}: Free users are denied on the server and nothing paid runs`, async () => {
    const r = await call(name, FREE, body);
    assert.equal(r.status, 403);
    assert.equal(r.ctx.llm, 0);
    assert.equal(r.ctx.email, 0);
  });
  test(`${name}: existing Premium users are not blocked by the gate`, async () => {
    const r = await call(name, PREMIUM, body);
    assert.ok(![401, 403].includes(r.status), `status ${r.status}`);
  });
}

test("scheduled automation (app admin) cannot trigger paid AI in contained functions", async () => {
  for (const name of ["predictSupplyDepletion", "bubblesCheckIn"]) {
    const r = await call(name, ADMIN, CASES[name].body);
    assert.equal(r.status, 200);
    assert.equal(r.json.skipped, true);
    assert.equal(r.ctx.llm, 0);
    assert.equal(r.ctx.email, 0);
  }
});

test("smartSchedule notify email is sent only for Premium users", async () => {
  assert.equal((await call("smartSchedule", FREE, { action: "notify" })).ctx.email, 0);
  assert.equal((await call("smartSchedule", PREMIUM, { action: "notify" })).ctx.email, 1);
});

test("lookupBarcode: AI fallback is Premium-only, free lookup unchanged", async () => {
  const body = { barcode: "0123456789012" };
  const free = await call("lookupBarcode", FREE, body);
  assert.equal(free.status, 200);
  assert.equal(free.json.found, false);
  assert.equal(free.ctx.llm, 0);
  const prem = await call("lookupBarcode", PREMIUM, body);
  assert.equal(prem.status, 200);
  assert.equal(prem.ctx.llm, 1);
});

test("V1-critical and non-AI functions are not touched by the containment", () => {
  for (const name of ["notifyLoadEvents", "sendLaundryReminder", "resetWearingToday", "sendIroningReminder", "checkSupplyLevels", "checkDepletionAlerts", "suggestOptimalTime", "suggestSupplies", "updateShoppingList", "detectFriction"]) {
    assert.ok(!read(name).includes("Phase 3C"), `${name} must be unchanged`);
  }
});
