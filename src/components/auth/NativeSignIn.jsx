import { useState } from "react";
import { startNativeLogin } from "@/lib/nativeAuth";
import { appParams } from "@/lib/app-params";
import { currentRuntime } from "@/lib/runtimeConfig";

// Shown only inside the native app when the person is not signed in. Sign-in happens in the phone's
// browser (Google does not allow it inside an app's embedded view) and returns here by itself.
// Nothing is opened until the person taps the button, so the app never loops into the browser.
export default function NativeSignIn() {
  const [error, setError] = useState(null);
  const [opening, setOpening] = useState(false);

  const signIn = async () => {
    setError(null);
    setOpening(true);
    const { appBaseUrl } = currentRuntime(appParams.appBaseUrl);
    const result = await startNativeLogin({ appBaseUrl });
    setOpening(false);
    if (!result.ok) setError("We couldn't open the sign-in page. Please try again.");
  };

  return (
    <main className="fixed inset-0 flex items-center justify-center p-6 bg-slate-50">
      <div className="max-w-sm w-full text-center space-y-5">
        <h1 className="text-2xl font-semibold text-slate-900">LaundryFun Pro</h1>
        <p className="text-slate-600">Sign in to see your laundry and reminders.</p>
        <button
          type="button"
          onClick={signIn}
          disabled={opening}
          className="w-full rounded-lg bg-slate-900 text-white px-5 py-3 font-medium disabled:opacity-60"
        >
          {opening ? "Opening…" : "Sign in"}
        </button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </div>
    </main>
  );
}
