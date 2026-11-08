import React, { useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { createPageUrl } from "@/utils";
import { usePrefs, setPrefs } from "@/lib/sessionPrefs";
import {
  ensureServiceWorker,
  getPermission,
  requestNotificationPermission,
  showLaundryNotification,
} from "@/lib/notify";
import { BigButton, MinutesStepper, OptionGroup, Panel, ToggleRow } from "@/components/session/ui";
import CarePanel from "@/components/session/CarePanel";
import { gameAudio, TIMER_VOLUME } from "@/lib/gameAudio";
import { sensoryProfile, soundForEvent } from "@/lib/gameRewards";

const REMINDER_OPTIONS = [
  { value: "off", label: "Off", hint: "No pop-up reminders. Messages still show inside the app." },
  { value: "minimal", label: "Minimal", hint: "One reminder when a timer ends." },
  {
    value: "standard",
    label: "Standard (recommended)",
    hint: "A heads-up at 5 minutes and 1 minute left, a reminder when the timer ends, then a few gentle follow-ups.",
  },
  {
    value: "persistent",
    label: "Gently persistent",
    hint: "The same heads-ups, plus a friendly nudge every few minutes until you confirm.",
  },
];

const TEXT_SIZE_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "normal", label: "Normal" },
  { value: "large", label: "Large" },
  { value: "xlarge", label: "Extra large" },
];

const ANIMATION_OPTIONS = [
  { value: "auto", label: "Follow my device setting", hint: "Uses your phone or computer's reduce-motion setting." },
  { value: "full", label: "Normal", hint: "Gentle, short animations such as the finish celebration." },
  { value: "reduced", label: "Reduced", hint: "No decorative animation." },
  { value: "off", label: "Off", hint: "No animation or motion at all." },
];

const ARCHIVED_LINKS = [
  ["Previous home screen", "LegacyHome"],
  ["Previous settings", "Settings"],
  ["Load history", "Loads"],
  ["Digital closet", "DigitalCloset"],
  ["Supplies", "Supplies"],
  ["Shopping list", "ShoppingList"],
  ["Laundry calendar", "LaundryCalendar"],
  ["Ironing queue", "IroningQueue"],
  ["Air-dry tracker", "AirDryTracker"],
  ["Household", "HouseholdManagement"],
  ["Laundry funds", "LaundryFunds"],
  ["Bubbles chat (earlier version)", "Bubbles"],
];

export default function SettingsCare() {
  const prefs = usePrefs();
  const [permission, setPermission] = useState(getPermission());
  const [testResult, setTestResult] = useState("");
  const [audioMessage, setAudioMessage] = useState("");

  // Mirror accessibility choices onto the existing account fields so the earlier Settings page
  // shows the same values. Best effort: the local setting always applies immediately.
  const change = (patch) => {
    setPrefs(patch);
    const account = {};
    if ("textSize" in patch) account.text_size = patch.textSize;
    if ("highContrast" in patch) account.high_contrast = patch.highContrast;
    if ("dyslexiaFont" in patch) account.dyslexia_font = patch.dyslexiaFont;
    if ("animations" in patch) account.reduced_motion = patch.animations === "reduced" || patch.animations === "off";
    if (Object.keys(account).length) base44.auth.updateMe(account).catch(() => {});
  };

  const toggleNotifications = async (on) => {
    setTestResult("");
    if (!on) {
      setPrefs({ notificationsEnabled: false });
      return;
    }
    const result = await requestNotificationPermission();
    setPermission(result);
    if (result === "granted") {
      await ensureServiceWorker();
      setPrefs({ notificationsEnabled: true });
    }
  };

  const sendTest = async () => {
    const ok = await showLaundryNotification(
      "LaundryFlow Pro",
      "This is a test reminder. Your notifications are working.",
      "laundry-test"
    );
    setTestResult(ok ? "Test sent. Look for it in your notifications." : "Couldn't show a notification. Check your browser's site settings.");
  };

  // Sound tests run from a button press, which is what lets the browser start audio.
  const testAudio = async (kind) => {
    const status = await gameAudio.unlock();
    if (status === "unsupported") {
      setAudioMessage("This browser can't play sounds here. Everything still works, silently.");
      return;
    }
    if (status !== "ready") {
      setAudioMessage("Your browser is blocking sound. Try the button again, or check this site's sound settings.");
      return;
    }
    if (kind === "timer") {
      gameAudio.play("timer_done", { channel: "timer", volume: TIMER_VOLUME });
      setAudioMessage("Played the timer-finished alert. If you didn't hear it, check your device volume and silent mode.");
      return;
    }
    const profile = sensoryProfile(prefs, false);
    const snd = soundForEvent("round", profile);
    if (!snd) {
      setAudioMessage("Game sound is off or the volume is at 0, so nothing played.");
      return;
    }
    gameAudio.play(snd.name, { streak: snd.streak, volume: profile.volume, channel: "game" });
    setAudioMessage("Played a game sound. If you didn't hear it, check your device volume and silent mode.");
  };

  const volumePercent = Math.round((Number.isFinite(prefs.gameVolume) ? prefs.gameVolume : 0.5) * 100);

  const notificationsOn = prefs.notificationsEnabled && permission === "granted";
  const blocked = permission === "denied" || permission === "unsupported";

  return (
    <div className="mx-auto max-w-lg space-y-6 px-5 pb-32 pt-10">
      <header>
        <h1 className="text-3xl font-semibold">Settings &amp; Care</h1>
      </header>

      {/* Reminders */}
      <Panel aria-labelledby="reminders-heading" className="space-y-5">
        <h2 id="reminders-heading" className="text-xl font-semibold">
          Reminders
        </h2>
        <OptionGroup
          legend="How often should Bubbles remind you?"
          name="reminder-level"
          value={prefs.reminderLevel}
          onChange={(v) => change({ reminderLevel: v })}
          options={REMINDER_OPTIONS}
        />

        <div className="space-y-3">
          <ToggleRow
            id="system-notifications"
            label="Show notifications"
            hint={
              permission === "denied"
                ? "Notifications are blocked. Allow them in your browser's site settings, then come back."
                : permission === "unsupported"
                ? "This browser doesn't support notifications."
                : "Pop-up reminders even when you're in another app or tab."
            }
            checked={notificationsOn}
            disabled={blocked}
            onChange={toggleNotifications}
          />
          {notificationsOn && (
            <>
              <BigButton variant="secondary" onClick={sendTest}>
                Send a test notification
              </BigButton>
              {testResult && (
                <p role="status" className="text-base">
                  {testResult}
                </p>
              )}
            </>
          )}
          <p className="text-sm text-muted-foreground">
            Reminders arrive while LaundryFlow Pro is open in a browser tab or installed app, even in the background.
            If you close it completely or your device sleeps, they may be late or missed, so check your machine when
            your estimate ends. Timers themselves stay accurate either way.
          </p>
        </div>
      </Panel>

      {/* Timers */}
      <Panel aria-labelledby="timers-heading" className="space-y-5">
        <h2 id="timers-heading" className="text-xl font-semibold">
          Timer defaults
        </h2>
        <MinutesStepper
          id="default-wash"
          label="Usual wash cycle"
          value={prefs.defaultWashMinutes}
          onChange={(v) => setPrefs({ defaultWashMinutes: v })}
          min={5}
          max={240}
        />
        <MinutesStepper
          id="default-dry"
          label="Usual dryer cycle"
          value={prefs.defaultDryMinutes}
          onChange={(v) => setPrefs({ defaultDryMinutes: v })}
          min={5}
          max={240}
        />
      </Panel>

      {/* Accessibility */}
      <Panel aria-labelledby="a11y-heading" className="space-y-5">
        <h2 id="a11y-heading" className="text-xl font-semibold">
          Accessibility
        </h2>
        <OptionGroup
          legend="Text size"
          name="text-size"
          value={prefs.textSize}
          onChange={(v) => change({ textSize: v })}
          options={TEXT_SIZE_OPTIONS}
        />
        <OptionGroup
          legend="Animations"
          name="animations"
          value={prefs.animations}
          onChange={(v) => change({ animations: v })}
          options={ANIMATION_OPTIONS}
        />
        <ToggleRow
          id="high-contrast"
          label="High contrast"
          hint="Stronger colors and borders."
          checked={prefs.highContrast}
          onChange={(v) => change({ highContrast: v })}
        />
        <ToggleRow
          id="dyslexia-font"
          label="Easier-to-read font"
          hint="Switches to Lexend, designed for readability."
          checked={prefs.dyslexiaFont}
          onChange={(v) => change({ dyslexiaFont: v })}
        />
        <ToggleRow
          id="show-game"
          label="Show the waiting game"
          hint="An optional game during waiting periods. You never have to play."
          checked={prefs.showGame}
          onChange={(v) => setPrefs({ showGame: v })}
        />
      </Panel>

      {/* Game and sound: everything here is optional. Sound never starts until you tap or press a key. */}
      <Panel aria-labelledby="sound-heading" className="space-y-5">
        <h2 id="sound-heading" className="text-xl font-semibold">
          Game and sound
        </h2>
        <ToggleRow
          id="game-sound"
          label="Game sounds"
          hint="Soft sounds when you play Sock Match. The game works the same with sound off."
          checked={prefs.gameSound}
          onChange={(v) => setPrefs({ gameSound: v })}
        />
        <label className="block text-base">
          <span className="font-medium">Game volume: {volumePercent}%</span>
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={volumePercent}
            disabled={!prefs.gameSound}
            aria-valuetext={`${volumePercent} percent`}
            onChange={(e) => setPrefs({ gameVolume: Number(e.target.value) / 100 })}
            className="mt-2 block h-11 w-full"
          />
        </label>
        <ToggleRow
          id="reduced-sensory"
          label="Calmer game"
          hint="Quieter, fewer sounds, and no confetti or card movement."
          checked={prefs.reducedSensory}
          onChange={(v) => setPrefs({ reducedSensory: v })}
        />
        <ToggleRow
          id="timer-sound"
          label="Timer alert sounds"
          hint="A short tone at 5 minutes left, 1 minute left, and when a timer ends. Lower and longer than game sounds, so you can tell them apart. Needs this page open, and you must have tapped once since opening it."
          checked={prefs.timerSound}
          onChange={(v) => setPrefs({ timerSound: v })}
        />
        <div className="space-y-3">
          <BigButton variant="secondary" onClick={() => testAudio("game")}>
            Test game sound
          </BigButton>
          <BigButton variant="secondary" onClick={() => testAudio("timer")}>
            Test timer alert
          </BigButton>
          {audioMessage && (
            <p role="status" className="text-base">
              {audioMessage}
            </p>
          )}
        </div>
      </Panel>

      {/* Care: a secondary link to the same shared guide. The primary places are Home (before you
          start) and each Laundry Session stage, so no one has to come here for care instructions. */}
      <section aria-labelledby="care-heading" className="space-y-3">
        <h2 id="care-heading" className="text-xl font-semibold">
          Care
        </h2>
        <p className="text-sm text-muted-foreground">
          This is the same guide you'll find on Home and during your laundry.
        </p>
        <CarePanel view="all" label="Laundry Care Guide" />
      </section>

      {/* Earlier features: hidden from the menu, nothing deleted */}
      <details className="rounded-3xl border-2 border-border p-5">
        <summary className="min-h-[44px] cursor-pointer text-lg font-semibold">Earlier features</summary>
        <p className="my-3 text-sm text-muted-foreground">
          These are from the previous version. They're hidden from the main menu to keep things simple, and all of your
          data is still saved.
        </p>
        <ul className="space-y-1">
          {ARCHIVED_LINKS.map(([label, page]) => (
            <li key={page}>
              <Link to={createPageUrl(page)} className="block min-h-[48px] py-3 text-base underline underline-offset-4">
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
