// Static checks for the native shell. They read configuration files only: they do not build the app and
// they do not prove anything about behaviour on a phone. Run with `npm run check` from native/.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const FORBIDDEN_PERMISSIONS = [
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.USE_EXACT_ALARM",
  "android.permission.USE_FULL_SCREEN_INTENT",
  "android.permission.SYSTEM_ALERT_WINDOW",
  "android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS",
];
// Everything we expect in the final merged manifest. Anything else is reported so it gets reviewed.
const EXPECTED_PERMISSIONS = [
  "android.permission.INTERNET",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.RECEIVE_BOOT_COMPLETED", // from the notification plugin: re-arms reminders after a restart
  "android.permission.WAKE_LOCK", // from the notification plugin: lets a due reminder show while asleep
];

const strip = (xml) => xml.replace(/<!--[\s\S]*?-->/g, "");

export function permissionsOf(xml) {
  const out = [];
  for (const m of strip(xml).matchAll(/<uses-permission\b([^>]*?)\/?>/g)) {
    const name = /android:name="([^"]+)"/.exec(m[1]);
    const node = /tools:node="([^"]+)"/.exec(m[1]);
    if (name) out.push({ name: name[1], remove: !!node && node[1] === "remove" });
  }
  return out;
}

// The merged manifest = app permissions + plugin permissions, minus anything the app marks tools:node="remove".
export function mergedPermissions(appXml, pluginXmls = []) {
  const app = permissionsOf(appXml);
  const removed = new Set(app.filter((p) => p.remove).map((p) => p.name));
  const all = new Set([...app.filter((p) => !p.remove).map((p) => p.name)]);
  for (const xml of pluginXmls) for (const p of permissionsOf(xml)) if (!removed.has(p.name)) all.add(p.name);
  return { merged: [...all].sort(), removed: [...removed].sort() };
}

export function analyze({ config, appManifest, pluginManifests, plist, authSource }) {
  const errors = [];
  const warnings = [];

  if (config?.server?.url) errors.push("capacitor.config.json sets server.url: the app must use bundled web assets, not a hosted site");
  if (config?.webDir !== "../dist") errors.push(`webDir should be ../dist, found ${config?.webDir}`);
  if (config?.appId !== "com.laundryfun.pro") errors.push(`appId changed to ${config?.appId}; update src/lib/nativeAuth.js, the manifest and Info.plist too`);

  const { merged, removed } = mergedPermissions(appManifest, pluginManifests);
  for (const p of FORBIDDEN_PERMISSIONS) {
    if (merged.includes(p)) errors.push(`${p} is present in the merged Android manifest (needs approval)`);
  }
  for (const p of ["android.permission.SCHEDULE_EXACT_ALARM", "android.permission.USE_EXACT_ALARM"]) {
    if (!removed.includes(p)) errors.push(`${p} must be explicitly removed with tools:node="remove" (the notification plugin declares it)`);
  }
  for (const p of merged) if (!EXPECTED_PERMISSIONS.includes(p)) warnings.push(`unexpected permission in merged manifest: ${p}`);
  for (const p of EXPECTED_PERMISSIONS) if (!merged.includes(p)) warnings.push(`expected permission missing from merged manifest: ${p}`);

  if (!/android:allowBackup="false"/.test(appManifest)) errors.push("android:allowBackup must be false (local storage holds the sign-in token)");
  if (!/android:scheme="com\.laundryfun\.pro"[^>]*android:host="auth"/.test(appManifest)) errors.push("Android sign-in return intent filter (com.laundryfun.pro://auth) is missing");
  if (/android:usesCleartextTraffic="true"/.test(appManifest)) errors.push("cleartext traffic must stay disabled");

  if (!/<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>com\.laundryfun\.pro<\/string>/.test(plist)) errors.push("iOS URL scheme com.laundryfun.pro is missing from Info.plist");
  if (/UIBackgroundModes/.test(plist)) warnings.push("Info.plist declares UIBackgroundModes; local reminders do not need any");

  const scheme = /NATIVE_SCHEME\s*=\s*"([^"]+)"/.exec(authSource || "");
  if (!scheme || scheme[1] !== "com.laundryfun.pro") errors.push("NATIVE_SCHEME in src/lib/nativeAuth.js does not match the manifest and Info.plist");

  return { errors, warnings, merged, removed };
}

export function checkNative(root) {
  const read = (p) => readFileSync(join(root, p), "utf8");
  const pluginDir = (n) => join(root, "node_modules/@capacitor", n, "android/src/main/AndroidManifest.xml");
  const pluginManifests = ["local-notifications", "app", "browser"]
    .map(pluginDir)
    .filter(existsSync)
    .map((p) => readFileSync(p, "utf8"));
  return analyze({
    config: JSON.parse(read("capacitor.config.json")),
    appManifest: read("android/app/src/main/AndroidManifest.xml"),
    pluginManifests,
    plist: read("ios/App/App/Info.plist"),
    authSource: readFileSync(join(root, "../src/lib/nativeAuth.js"), "utf8"),
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const r = checkNative(root);
  console.log("Merged Android permissions:\n  " + r.merged.join("\n  "));
  console.log("Explicitly removed:\n  " + r.removed.join("\n  "));
  r.warnings.forEach((w) => console.log("WARNING: " + w));
  r.errors.forEach((e) => console.error("ERROR: " + e));
  console.log(r.errors.length ? `\n${r.errors.length} error(s)` : "\nnative configuration checks passed");
  process.exit(r.errors.length ? 1 : 0);
}
