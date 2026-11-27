// V1 preferences. Stored on this device (localStorage) so they apply instantly, before any
// network call. Accessibility prefs are applied to <html> and mirrored to the existing User
// fields by the Settings & Care page so the archived Settings page stays consistent.
import { useSyncExternalStore } from "react";

const KEY = "lf_prefs_v1";

export const DEFAULT_PREFS = {
  reminderLevel: "standard", // off | minimal | standard | persistent
  notificationsEnabled: false, // browser notifications (also needs OS/browser permission)
  animations: "auto", // auto (follow device) | full | reduced | off
  showGame: true,
  defaultWashMinutes: 35,
  defaultDryMinutes: 45,
  textSize: "normal", // small | normal | large | xlarge
  highContrast: false,
  dyslexiaFont: false,
  gameSound: true, // Sock Match sound effects (only ever play after a tap/key press)
  gameVolume: 0.5, // 0 to 1, applies to game sounds
  timerSound: true, // short tones for the 5-minute, 1-minute and timer-finished alerts
  reducedSensory: false, // "Calmer game": quieter, fewer sounds, no confetti or card pop
};

const TEXT_SIZES = { small: "87.5%", normal: "100%", large: "125%", xlarge: "200%" };

const listeners = new Set();
let cache = null;

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_PREFS };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function hasSavedPrefs() {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function getPrefs() {
  if (!cache) cache = read();
  return cache;
}

export function applyPrefsToDocument(p = getPrefs()) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.fontSize = TEXT_SIZES[p.textSize] || "100%";
  root.classList.toggle("high-contrast", p.highContrast === true);
  root.classList.toggle("dyslexia-font", p.dyslexiaFont === true);
  root.classList.toggle("motion-reduced", p.animations === "reduced");
  root.classList.toggle("motion-off", p.animations === "off");
}

export function setPrefs(patch) {
  cache = { ...getPrefs(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // storage unavailable (private mode): prefs still apply for this visit
  }
  applyPrefsToDocument(cache);
  listeners.forEach((l) => l());
  return cache;
}

// First run on this device: adopt the accessibility values already saved on the user's account.
export function seedPrefsFromUser(user) {
  if (hasSavedPrefs() || !user) return;
  setPrefs({
    textSize: user.text_size || "normal",
    highContrast: user.high_contrast === true,
    dyslexiaFont: user.dyslexia_font === true,
    animations: user.reduced_motion === true ? "reduced" : "auto",
  });
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePrefs() {
  return useSyncExternalStore(subscribe, getPrefs, getPrefs);
}

// True when decorative animation (e.g. the completion confetti) is allowed.
export function animationsEnabled(p = getPrefs()) {
  if (p.animations === "off" || p.animations === "reduced") return false;
  if (p.animations === "auto" && typeof window !== "undefined" && window.matchMedia) {
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  return true;
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) {
      cache = read();
      applyPrefsToDocument(cache);
      listeners.forEach((l) => l());
    }
  });
  applyPrefsToDocument(getPrefs());
}
