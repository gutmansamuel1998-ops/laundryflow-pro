import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Building2, Clock, Bell, Eye, Zap, TrendingDown, Sparkles, Info, Package, ShoppingCart, Mic, Smartphone } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import EnvironmentalAnchorEditor from "@/components/laundry/EnvironmentalAnchorEditor";
import PreciseTimePreferences from "@/components/laundry/PreciseTimePreferences";
import { motion } from "framer-motion";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMES = ["Morning", "Afternoon", "Evening"];
const ALERT_CHANNELS = [
  { id: "push", Icon: Smartphone, label: "Push" },
];

export default function Settings() {
  const navigate = useNavigate();
  const [saved, setSaved] = useState(false);
  const [hasPremium, setHasPremium] = useState(false);
  const [settings, setSettings] = useState({
    laundry_environment: "private",
    preferred_days_of_week: [],
    preferred_time_windows: [],
    precise_time_preferences: [],
    enable_laundry_reminders: true,
    forgotten_threshold_minutes: 30,
    enable_supply_alerts: true,
    text_size: "normal",
    reduced_motion: false,
    high_contrast: false,
    dyslexia_font: false,
    environmental_anchors: [],
    friction_detection_enabled: true,
    idle_threshold_minutes: 120,
    max_idle_time_load_created: 240,
    voice_commands_enabled: false,
    keyboard_navigation: false,
    alert_channels: {
      wash_finished: { push: true },
      dryer_finished: { push: true },
    },
  });

  useEffect(() => {
    base44.auth.me().then((u) => {
      setHasPremium(u?.has_premium === true);
      setSettings(prev => ({
        ...prev,
        laundry_environment: u?.laundry_environment || "private",
        preferred_days_of_week: u?.preferred_days_of_week || [],
        preferred_time_windows: u?.preferred_time_windows || [],
        precise_time_preferences: u?.precise_time_preferences || [],
        enable_laundry_reminders: u?.enable_laundry_reminders !== false,
        forgotten_threshold_minutes: u?.forgotten_threshold_minutes ?? 30,
        enable_supply_alerts: u?.enable_supply_alerts !== false,
        text_size: u?.text_size || "normal",
        reduced_motion: u?.reduced_motion || false,
        high_contrast: u?.high_contrast || false,
        dyslexia_font: u?.dyslexia_font || false,
        environmental_anchors: u?.environmental_anchors || [],
        friction_detection_enabled: u?.friction_detection_enabled !== false,
        idle_threshold_minutes: u?.idle_threshold_minutes ?? 120,
        max_idle_time_load_created: u?.max_idle_time_load_created ?? 240,
        voice_commands_enabled: u?.voice_commands_enabled || false,
        keyboard_navigation: u?.keyboard_navigation || false,
        alert_channels: u?.alert_channels || {
          wash_finished: { push: true },
          dryer_finished: { push: true },
        },
      }));
    }).catch(() => {});
  }, []);

  const handleDayToggle = (dayIndex) => {
    setSettings(prev => ({
      ...prev,
      preferred_days_of_week: prev.preferred_days_of_week.includes(dayIndex)
        ? prev.preferred_days_of_week.filter(d => d !== dayIndex)
        : [...prev.preferred_days_of_week, dayIndex],
    }));
  };

  const handleTimeToggle = (time) => {
    setSettings(prev => ({
      ...prev,
      preferred_time_windows: prev.preferred_time_windows.includes(time)
        ? prev.preferred_time_windows.filter(t => t !== time)
        : [...prev.preferred_time_windows, time],
    }));
  };

  useEffect(() => {
    const sizeMap = { small: "87.5%", normal: "100%", large: "118.75%", xlarge: "137.5%" };
    document.documentElement.style.fontSize = sizeMap[settings.text_size] || "100%";
  }, [settings.text_size]);

  useEffect(() => {
    document.documentElement.classList.toggle("high-contrast", settings.high_contrast);
  }, [settings.high_contrast]);

  useEffect(() => {
    document.documentElement.classList.toggle("dyslexia-font", settings.dyslexia_font);
  }, [settings.dyslexia_font]);

  useEffect(() => {
    document.documentElement.classList.toggle("keyboard-nav", settings.keyboard_navigation);
  }, [settings.keyboard_navigation]);

  const handleSave = async () => {
    await base44.auth.updateMe(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <header>
          <h1 className="text-2xl font-semibold tracking-tight mb-6">Settings</h1>
        </header>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* Environment */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Laundry Environment</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm">
              <Select
                value={settings.laundry_environment}
                onValueChange={(v) => setSettings(prev => ({ ...prev, laundry_environment: v }))}
              >
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private Laundry (at home)</SelectItem>
                  <SelectItem value="shared">Shared Laundry Room (dorm, building)</SelectItem>
                </SelectContent>
              </Select>
              {settings.laundry_environment === "shared" && (
                <p className="text-xs text-muted-foreground mt-2">
                  Dorm Mode enabled — reminders will trigger a bit earlier so machines stay available.
                </p>
              )}
            </Card>
          </section>

          {/* Anchor Days */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Preferred Laundry Times</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Days</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS.map((day, index) => (
                    <button
                      key={day}
                      onClick={() => handleDayToggle(index)}
                      aria-label={`${settings.preferred_days_of_week.includes(index) ? "Deselect" : "Select"} ${day}`}
                      aria-pressed={settings.preferred_days_of_week.includes(index)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        settings.preferred_days_of_week.includes(index)
                          ? "bg-primary text-white"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-sm mb-2 block">Time of Day</Label>
                <div className="flex flex-wrap gap-2">
                  {TIMES.map((time) => (
                    <button
                      key={time}
                      onClick={() => handleTimeToggle(time.toLowerCase())}
                      aria-label={`${settings.preferred_time_windows.includes(time.toLowerCase()) ? "Deselect" : "Select"} ${time}`}
                      aria-pressed={settings.preferred_time_windows.includes(time.toLowerCase())}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        settings.preferred_time_windows.includes(time.toLowerCase())
                          ? "bg-primary text-white"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
              </div>
              <div className="pt-2">
                <Label className="text-sm mb-2 block">Precise Time Blocks (Optional)</Label>
                <p className="text-xs text-muted-foreground mb-3">
                  Define exact time ranges for more accurate scheduling suggestions
                </p>
                <PreciseTimePreferences
                  value={settings.precise_time_preferences}
                  onChange={(prefs) => setSettings(prev => ({ ...prev, precise_time_preferences: prefs }))}
                />
              </div>
            </Card>
          </section>

          {/* Notifications */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Bell className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Notifications</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="reminders">Enable laundry reminders</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Get alerts during your preferred times when no loads are active
                  </p>
                </div>
                <Switch
                  id="reminders"
                  checked={settings.enable_laundry_reminders}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, enable_laundry_reminders: v }))}
                />
              </div>
              <div>
                <Label className="text-sm mb-2 block">Forgotten load alert after</Label>
                <Select
                  value={String(settings.forgotten_threshold_minutes)}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, forgotten_threshold_minutes: Number(v) }))}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="60">1 hour</SelectItem>
                    <SelectItem value="120">2 hours</SelectItem>
                    <SelectItem value="240">4 hours</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1.5">
                  A gentle nudge appears when a finished cycle sits longer than this.
                </p>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="supply-alerts">Low supply alerts</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Get notified when supplies fall below threshold
                  </p>
                </div>
                <Switch
                  id="supply-alerts"
                  checked={settings.enable_supply_alerts}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, enable_supply_alerts: v }))}
                />
              </div>

              {/* Cycle alert channels */}
              <div className="pt-2 border-t border-border/50">
                <p className="text-sm font-medium mb-3">Cycle status alerts</p>
                <p className="text-xs text-muted-foreground mb-4">Choose how you want to be notified when each cycle finishes.</p>
                {[
                  { key: "wash_finished", label: "Wash Finished" },
                  { key: "dryer_finished", label: "Dryer Finished" },
                ].map(({ key, label }) => (
                  <div key={key} className="mb-4">
                    <p className="text-sm font-medium mb-2">{label}</p>
                    <div className="flex gap-3">
                      {ALERT_CHANNELS.map(({ id, Icon, label: chanLabel }) => {
                        const active = settings.alert_channels[key]?.[id] ?? false;
                        return (
                          <button
                            key={id}
                            onClick={() =>
                              setSettings(prev => ({
                                ...prev,
                                alert_channels: {
                                  ...prev.alert_channels,
                                  [key]: {
                                    ...prev.alert_channels[key],
                                    [id]: !active,
                                  },
                                },
                              }))
                            }
                            aria-label={`${active ? "Disable" : "Enable"} ${chanLabel} notifications for ${label}`}
                            aria-pressed={active}
                            className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                              active
                                ? "bg-primary/10 border-primary/40 text-primary"
                                : "bg-secondary border-transparent text-muted-foreground"
                            }`}
                          >
                            <Icon className="w-4 h-4" aria-hidden="true" />
                            {chanLabel}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          {/* Supply Inventory */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Package className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Supply Management</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm space-y-2">
              <Button
                variant="outline"
                className="w-full rounded-xl justify-start"
                onClick={() => navigate(createPageUrl("Supplies"))}
              >
                <Package className="w-4 h-4 mr-2" />
                Manage Supply Inventory
              </Button>
              <Button
                variant="outline"
                className="w-full rounded-xl justify-start"
                onClick={() => navigate(createPageUrl("ShoppingList"))}
              >
                <ShoppingCart className="w-4 h-4 mr-2" />
                Shopping List
              </Button>
            </Card>
          </section>

          {/* Accessibility */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Accessibility</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Text Size</Label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { value: "small", label: "A", sizeClass: "text-xs" },
                    { value: "normal", label: "A", sizeClass: "text-sm" },
                    { value: "large", label: "A", sizeClass: "text-base" },
                    { value: "xlarge", label: "A", sizeClass: "text-lg" },
                  ].map(({ value, label, sizeClass }) => (
                    <button
                      key={value}
                      onClick={() => setSettings(prev => ({ ...prev, text_size: value }))}
                      aria-label={`Set text size to ${value}`}
                      aria-pressed={settings.text_size === value}
                      className={`flex-1 py-3 rounded-xl border-2 font-semibold transition-all ${sizeClass} ${
                        settings.text_size === value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary text-muted-foreground hover:border-primary/40"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {settings.text_size === "small" && "Small — compact layout"}
                  {settings.text_size === "normal" && "Normal — default size"}
                  {settings.text_size === "large" && "Large — easier to read"}
                  {settings.text_size === "xlarge" && "Extra Large — maximum readability"}
                </p>
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="motion">Reduced motion</Label>
                <Switch
                  id="motion"
                  checked={settings.reduced_motion}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, reduced_motion: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="contrast">High contrast</Label>
                <Switch
                  id="contrast"
                  checked={settings.high_contrast}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, high_contrast: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="dyslexia-font">Dyslexia-friendly font</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Switches to Lexend — designed for easier reading
                  </p>
                </div>
                <Switch
                  id="dyslexia-font"
                  checked={settings.dyslexia_font}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, dyslexia_font: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="keyboard-nav">Keyboard navigation</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Enhances focus indicators so all buttons and links are fully operable by keyboard
                  </p>
                </div>
                <Switch
                  id="keyboard-nav"
                  checked={settings.keyboard_navigation}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, keyboard_navigation: v }))}
                />
              </div>
            </Card>
          </section>

          {/* Environmental Anchors */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Environmental Anchors</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm">
              <p className="text-sm text-muted-foreground mb-4">
                Select situations that trigger laundry for you. The app will prompt you with a suggested load type.
              </p>
              <EnvironmentalAnchorEditor
                value={settings.environmental_anchors}
                onChange={(anchors) => setSettings(prev => ({ ...prev, environmental_anchors: anchors }))}
              />
            </Card>
          </section>

          {/* Friction Detection */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Friction Detection</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="friction">Enable friction detection</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Get alerts when loads are stuck at specific stages
                  </p>
                </div>
                <Switch
                  id="friction"
                  checked={settings.friction_detection_enabled}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, friction_detection_enabled: v }))}
                />
              </div>
              {settings.friction_detection_enabled && (
                <>
                  <div>
                    <Label className="text-sm mb-2 block">General idle time threshold</Label>
                    <Select
                      value={String(settings.idle_threshold_minutes)}
                      onValueChange={(v) => setSettings(prev => ({ ...prev, idle_threshold_minutes: Number(v) }))}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="60">1 hour</SelectItem>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="180">3 hours</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Alert when a load sits idle at transfer stage longer than this
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm mb-2 block">Load created idle time</Label>
                    <Select
                      value={String(settings.max_idle_time_load_created)}
                      onValueChange={(v) => setSettings(prev => ({ ...prev, max_idle_time_load_created: Number(v) }))}
                    >
                      <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="120">2 hours</SelectItem>
                        <SelectItem value="180">3 hours</SelectItem>
                        <SelectItem value="240">4 hours</SelectItem>
                        <SelectItem value="360">6 hours</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Alert when a load is created but not started after this time
                    </p>
                  </div>
                </>
              )}
            </Card>
          </section>

          {/* Business Info */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">About</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm">
              <Button
                variant="outline"
                className="w-full rounded-xl justify-start"
                onClick={() => navigate(createPageUrl("BusinessInfo"))}
              >
                <Building2 className="w-4 h-4 mr-2" />
                Business Info & Contact
              </Button>
            </Card>
          </section>

          {/* Voice Commands */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Mic className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Voice Commands</h2>
            </div>
            <Card className="p-4 border-0 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="voice-cmds">Enable hands-free voice commands</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Control laundry actions while moving between machines
                  </p>
                </div>
                <Switch
                  id="voice-cmds"
                  checked={settings.voice_commands_enabled}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, voice_commands_enabled: v }))}
                />
              </div>
              {settings.voice_commands_enabled && (
                <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground mb-1.5">Available commands:</p>
                  <p>🎙 <span className="font-medium">"Start wash"</span> — begins the wash cycle</p>
                  <p>🎙 <span className="font-medium">"Snooze timer"</span> — snoozes the wash-complete alert</p>
                  <p>🎙 <span className="font-medium">"Shopping list"</span> — adds an item prompt</p>
                  <p className="pt-1 text-muted-foreground/70">Microphone access is required. You can revoke it any time in your browser settings.</p>
                </div>
              )}
            </Card>
          </section>

          {/* Premium — prominent, just before Save */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-primary">Premium</h2>
            </div>
            {hasPremium ? (
              <Card className="p-5 border-2 border-primary/30 bg-primary/5 shadow-md">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-primary">Premium Active ✓</p>
                    <p className="text-xs text-muted-foreground mt-0.5">You have full access to AI laundry help and advanced guidance</p>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-5 border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 shadow-md">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-base">Unlock Premium</p>
                    <p className="text-xs text-muted-foreground mt-0.5">AI help, smart predictions & advanced guidance</p>
                  </div>
                </div>
                <Button className="w-full rounded-xl" onClick={() => navigate("/Premium")}>
                  View Premium Features
                </Button>
              </Card>
            )}
          </section>

          {/* Save */}
          <Button
            onClick={handleSave}
            className="w-full rounded-2xl py-5 shadow-lg shadow-primary/20"
            size="lg"
          >
            {saved ? (
              <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Saved</span>
            ) : (
              "Save Settings"
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}