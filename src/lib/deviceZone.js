// The time zone this device is in right now, as a standard name such as "America/Chicago". This is the one place
// the app asks the device for its zone (the scheduling logic in laundryRoutine.js never does: it is always handed
// the zone). Returns "UTC" if the device cannot say, which is the same fallback the scheduling logic uses.
import { canonicalZone } from "./laundryRoutine.js";

/** @param {any} [intl] a stand-in for the built-in Intl object (tests only) */
export function deviceZone(intl) {
  try {
    const api = intl || Intl;
    return canonicalZone(new api.DateTimeFormat().resolvedOptions().timeZone) || "UTC";
  } catch {
    return "UTC";
  }
}
