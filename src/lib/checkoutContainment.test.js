import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CHECKOUT_AVAILABLE } from "../components/premium/checkoutAvailability.js";

// Static checks that the Phase 3A checkout containment stays in place. They read source text only.
const here = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(here, rel), "utf8");
const code = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

test("the UI flag reports purchases as unavailable", () => {
  assert.equal(CHECKOUT_AVAILABLE, false);
});

test("createCheckout refuses before it reads the body, the origin or any payment credential", () => {
  const src = code(read("../../base44/functions/createCheckout/entry.ts"));
  assert.match(src, /const CHECKOUT_TEMPORARILY_DISABLED = true;/);
  const guard = src.indexOf("if (CHECKOUT_TEMPORARILY_DISABLED)");
  assert.ok(guard > 0, "guard present");
  for (const later of ["req.json()", "Deno.env.get", "wixapis.com", "req.headers"]) {
    assert.ok(src.indexOf(later) > guard, `${later} must come after the guard`);
  }
  assert.match(src.slice(guard, guard + 400), /status: 503/);
});

test("both purchase entry points are hidden and their handlers are inert while disabled", () => {
  for (const file of ["../pages/Premium.jsx", "../components/premium/PremiumCheckout.jsx"]) {
    const src = code(read(file));
    assert.match(src, /if \(!CHECKOUT_AVAILABLE\) return;/, `${file} handler guard`);
    assert.match(src, /CHECKOUT_AVAILABLE &&/, `${file} buttons gated`);
  }
});

test("the webhook and the restore-access check are not modified by the containment", () => {
  const webhook = code(read("../../base44/functions/wixPaymentsWebhook/entry.ts"));
  assert.doesNotMatch(webhook, /CHECKOUT_TEMPORARILY_DISABLED/);
  const restore = code(read("../components/premium/RestorePremiumSection.jsx"));
  assert.doesNotMatch(restore, /CHECKOUT_AVAILABLE/);
});
