import { useEffect, useMemo, useState } from "react";
import { buildAppLink, isValidState } from "@/lib/nativeAuth";

// Opened in the phone's browser after sign-in, only as part of signing in to the native app
// (see src/lib/nativeAuth.js). Base44 has just returned here with the person's token, and the SDK
// has already saved it. This page hands it to the app through com.laundryfun.pro://auth and shows a
// button in case the phone does not open the app by itself.
//
// It never shows the token, only hands it over when the link carries the one-time `s` code the app
// created. Opened any other way (no code), it does nothing.
function readToken() {
  try {
    return localStorage.getItem("base44_access_token") || localStorage.getItem("token");
  } catch {
    return null;
  }
}

export default function NativeAuthReturn() {
  const state = useMemo(() => new URLSearchParams(window.location.search).get("s"), []);
  const [link, setLink] = useState(null);
  const valid = isValidState(state);

  useEffect(() => {
    if (!valid) return;
    const built = buildAppLink({ token: readToken(), state });
    if (!built) return;
    setLink(built);
    window.location.href = built;
  }, [valid, state]);

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="text-xl font-semibold text-slate-900">LaundryFun Pro</h1>
        {!valid && (
          <p className="text-slate-600">
            This page is used to finish signing in to the LaundryFun Pro app. Open the app and tap Sign in to start.
          </p>
        )}
        {valid && !link && <p className="text-slate-600">Finishing sign-in…</p>}
        {valid && link && (
          <>
            <p className="text-slate-600">You're signed in. Returning to the app…</p>
            <a
              href={link}
              className="inline-block rounded-lg bg-slate-900 text-white px-5 py-3 font-medium"
            >
              Open LaundryFun Pro
            </a>
          </>
        )}
      </div>
    </main>
  );
}
