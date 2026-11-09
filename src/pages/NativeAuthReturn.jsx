import { useEffect, useMemo, useState } from "react";
import { buildAppLink, isValidState, tokenFromNavigationUrl, TOKEN_KEYS } from "@/lib/nativeAuth";

// Opened in the phone's browser after sign-in, only as part of signing in to the native app
// (see src/lib/nativeAuth.js). Base44 has just returned here with the person's token in the address.
// This page hands it to the app through com.laundryfun.pro://auth and shows a button in case the
// phone does not open the app by itself.
//
// Safety rules:
// - The token is read from the address the browser was first sent to (the navigation entry), because
//   the app strips it from the visible address at startup. It is never read from storage, so nothing
//   else on this site can feed this page a token.
// - It never shows or logs the token, and only hands it over when the link carries the one-time `s`
//   code the app created. Opened any other way (no code), it does nothing.
// - After the hand-over, the copy the browser's storage kept is removed.
// - `?out=1` is the landing page after signing out in the browser; it just says so.
function firstNavigationUrl() {
  try {
    const entry = performance.getEntriesByType("navigation")[0];
    return entry && entry.name ? entry.name : null;
  } catch {
    return null;
  }
}

function forgetStoredToken() {
  try {
    for (const key of TOKEN_KEYS) localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

export default function NativeAuthReturn() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const state = params.get("s");
  const signedOut = params.get("out") === "1";
  const [link, setLink] = useState(null);
  const valid = isValidState(state) && !signedOut;

  useEffect(() => {
    if (!valid) return;
    const built = buildAppLink({ token: tokenFromNavigationUrl(firstNavigationUrl()), state });
    forgetStoredToken();
    if (!built) return;
    setLink(built);
    window.location.href = built;
  }, [valid, state]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">LaundryFun Pro</h1>
        {signedOut && <p className="text-slate-600">You're signed out. You can close this window and return to the app.</p>}
        {!valid && !signedOut && (
          <p className="text-slate-600">
            This page is used to finish signing in to the LaundryFun Pro app. Open the app and tap Sign in to start.
          </p>
        )}
        {valid && !link && <p className="text-slate-600">Finishing sign-in…</p>}
        {valid && link && (
          <>
            <p className="text-slate-600">You're signed in. Returning to the app…</p>
            <a href={link} className="inline-block rounded-lg bg-slate-900 text-white px-5 py-3 font-medium">
              Open LaundryFun Pro
            </a>
          </>
        )}
      </div>
    </main>
  );
}
