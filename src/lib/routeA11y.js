// P8.11: what a person gets after moving to another screen inside the app.
//   1. A page title that says where they are (every screen used to be just "LaundryFun Pro").
//   2. Keyboard / screen-reader focus on the new page's main heading, instead of being dropped on <body>.
// Pure functions and plain DOM calls only, so they can be tested without a framework.

export const APP_NAME = "LaundryFun Pro";

// The three V1 destinations use the same words as the bottom navigation.
const KNOWN = {
  "": "Home",
  Home: "Home",
  Session: "Laundry Session",
  SettingsCare: "Settings & Care",
  LegacyHome: "Earlier home screen",
};

// "/LaundryBasket" -> "Laundry Basket". Used for the older pages, which keep working at their own addresses.
function words(segment) {
  return segment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .trim();
}

export function pageTitleFor(pathname) {
  const segment = String(pathname || "/").split("/").filter(Boolean)[0] || "";
  const name = Object.prototype.hasOwnProperty.call(KNOWN, segment) ? KNOWN[segment] : words(segment);
  return name ? `${name} – ${APP_NAME}` : APP_NAME;
}

// Moves focus to the page's <h1>. If the page has not drawn its heading yet (it is still loading), waits for it, for up to
// timeoutMs. Returns a function that cancels the wait. Rules:
//   - if the page already put focus on something inside <main> (for example an autofocus field), that is left alone;
//   - focus on the navigation bar, the feedback button or <body> is moved, because the screen it was on is gone;
//   - the heading gets tabindex="-1" only while it is focused, so it never becomes a tab stop.
export function focusPageHeading({ preventScroll = false, timeoutMs = 3000 } = {}) {
  if (typeof document === "undefined") return () => {};
  let done = false;
  let observer = null;
  let timer = null;
  const stop = () => {
    done = true;
    if (observer) observer.disconnect();
    if (timer) clearTimeout(timer);
  };
  const tryFocus = () => {
    const main = document.getElementById("main-content") || document.querySelector("main");
    const heading = main && main.querySelector("h1");
    if (!heading) return false;
    const active = document.activeElement;
    if (active && active !== document.body && active !== document.documentElement && main.contains(active)) return true;
    if (!heading.hasAttribute("tabindex")) {
      heading.setAttribute("tabindex", "-1");
      heading.addEventListener("blur", () => heading.removeAttribute("tabindex"), { once: true });
    }
    heading.focus({ preventScroll });
    return true;
  };
  if (tryFocus()) return stop;
  const root = document.getElementById("main-content") || document.body;
  observer = new MutationObserver(() => {
    if (!done && tryFocus()) stop();
  });
  observer.observe(root, { childList: true, subtree: true });
  timer = setTimeout(stop, timeoutMs);
  return stop;
}
