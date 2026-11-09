// A one-way label for "who is signed in", so the phone never stores a raw account id or email just to
// remember whose reminders and cached session it is holding.
// Returns "" when it cannot be computed; callers treat "" as "owner unknown" (the safe direction: nothing is
// scheduled or cached for an unknown owner, and reminders from a previous owner are cancelled).

export async function hashOwner(value, subtle = globalThis.crypto && globalThis.crypto.subtle) {
  if (typeof value !== "string" || value.length === 0 || !subtle) return "";
  try {
    const data = new TextEncoder().encode(`lf-owner-v1:${value}`);
    const digest = await subtle.digest("SHA-256", data);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32);
  } catch {
    return "";
  }
}
