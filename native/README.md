# LaundryFun Pro native shell (Capacitor) — feasibility foundation

Status: **feasibility only. Never built, never run on a device or emulator, not for release.**
Everything native lives in this folder. To remove all native code, delete `native/` (the web app keeps
working; the small additive web changes are listed at the bottom). Nothing here is published or distributed.

## What this is
- Capacitor 8 shell that **bundles** the web build (`../dist`) and serves it on the device
  (`https://localhost` on Android, `capacitor://localhost` on iOS). No `server.url` (no hosted-site mode).
- Plugins: `@capacitor/local-notifications` (reminders), `@capacitor/app` (sign-in return link), `@capacitor/browser` (system-browser sign-in).
- The web app detects the shell at run time (`src/lib/runtimeConfig.js`), so the same `dist` serves browsers and the shell.

## Why bundled (and what would change that)
See `claude/laundryfun-native-capacitor-feasibility.md` in the project. Short version: the Base44 API allows
cross-origin calls from `capacitor://localhost` and `https://localhost` with Bearer tokens, so bundled assets
can reach it; hosted mode cannot sign in either, because Google refuses embedded web views and Capacitor
opens off-origin redirects in the system browser. **Gate:** the sign-in round trip (below) must pass on a
real device before this choice is final.

## Build on a developer machine (needs Android Studio / Xcode, which the sandbox does not have)
```
npm install                  # at the repo root
npm run build                # root: produces ../dist
cd native && npm install
npx cap sync                 # copies dist and plugin config into android/ and ios/
npm run check                # static configuration checks (no build tools needed)
npx cap open android         # then run on an emulator or a real phone
npx cap open ios             # macOS only
```
Optional: `VITE_NATIVE_API_ORIGIN=https://<published-site> npm run build` points the shell at another
https origin (staging). Default is the published site.

## Rules for this folder
- **No exact-alarm permissions.** The notification plugin declares `SCHEDULE_EXACT_ALARM`; the app manifest
  removes it (`tools:node="remove"`) and also removes `USE_EXACT_ALARM`. Reminders are inexact on purpose.
  `npm run check` fails if either comes back. Adding one needs approval.
- `android:allowBackup="false"` because local storage holds the sign-in token.
- Merged permissions expected: INTERNET, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED (re-arm after restart), WAKE_LOCK.
- Sign-in return link scheme `com.laundryfun.pro://auth` is declared in `AndroidManifest.xml` and `Info.plist`
  and must match `NATIVE_SCHEME` in `src/lib/nativeAuth.js`. The bundle id is a placeholder pending approval.
- `npm run check` reads configuration files only. It is not a build and not a device test.

## Sign-in round trip (to verify on a device)
1. Tap Sign in -> system browser opens the normal Base44 login page.
2. After Google sign-in the browser lands on `<published site>/NativeAuthReturn?s=<one-time code>`.
3. That page opens `com.laundryfun.pro://auth?...` (it also shows an "Open LaundryFun Pro" button, because
   some browsers block script-started app links without a tap).
4. The app checks the code, stores the token, and loads the user's laundry.
**Requires the web change in `src/pages/NativeAuthReturn.jsx` to be published** (publishing is a manual step not done here).

## Web-app changes made for the shell (all inert in a normal browser)
`src/lib/runtimeConfig.js`, `src/lib/nativeAuth.js`, `src/pages/NativeAuthReturn.jsx`,
`src/components/auth/NativeSignIn.jsx`, small edits in `src/api/base44Client.js`, `src/lib/AuthContext.jsx`,
`src/App.jsx`, `src/lib/notificationScheduler.js` (owner isolation), `NativeNotificationSync.jsx`.
