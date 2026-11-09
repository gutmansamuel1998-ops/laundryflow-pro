// SECURITY CONTAINMENT (Phase 3A): new Premium purchases are temporarily disabled while the checkout is rebuilt.
// The server-side createCheckout function enforces this independently (it returns 503); this flag only controls
// what the UI shows. Existing Premium access is unaffected. Do not re-enable until the secure checkout is approved.
export const CHECKOUT_AVAILABLE = false;

export const CHECKOUT_UNAVAILABLE_MESSAGE =
  "New Premium purchases are temporarily unavailable. If you already have Premium, your access is not affected.";
