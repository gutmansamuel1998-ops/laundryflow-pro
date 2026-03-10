import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Check, Building2, Clock, Bell, Eye, Zap, TrendingDown } from "lucide-react";
import EnvironmentalAnchorEditor from "@/components/laundry/EnvironmentalAnchorEditor";
import { motion } from "framer-motion";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMES = ["Morning", "Afternoon", "Evening"];

export default function Settings() {
  const [user, setUser] = useState(null);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState({
    laundry_environment: "private",
    anchor_days: [],
    anchor_times: [],
    reminders_enabled: true,
    forgotten_load_threshold: 30,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    text_size: "normal",
    reduced_motion: false,
    high_contrast: false,
    environmental_anchors: [],
    friction_detection_enabled: true,
    max_idle_time_wash_finished: 120,
    max_idle_time_load_created: 240,
  });

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      setSettings(prev => ({
        ...prev,
        laundry_environment: u?.laundry_environment || "private",
        anchor_days: u?.anchor_days || [],
        anchor_times: u?.anchor_times || [],
        reminders_enabled: u?.reminders_enabled !== false,
        forgotten_load_threshold: u?.forgotten_load_threshold ?? 30,
        quiet_hours_start: u?.quiet_hours_start || "22:00",
        quiet_hours_end: u?.quiet_hours_end || "08:00",
        text_size: u?.text_size || "normal",
        reduced_motion: u?.reduced_motion || false,
        high_contrast: u?.high_contrast || false,
        environmental_anchors: u?.environmental_anchors || [],
        friction_detection_enabled: u?.friction_detection_enabled !== false,
        max_idle_time_wash_finished: u?.max_idle_time_wash_finished ?? 120,
        max_idle_time_load_created: u?.max_idle_time_load_created ?? 240,
      }));
    }).catch(() => {});
  }, []);

  const handleDayToggle = (day) => {
    setSettings(prev => ({
      ...prev,
      anchor_days: prev.anchor_days.includes(day)
        ? prev.anchor_days.filter(d => d !== day)
        : [...prev.anchor_days, day],
    }));
  };

  const handleTimeToggle = (time) => {
    setSettings(prev => ({
      ...prev,
      anchor_times: prev.anchor_times.includes(time)
        ? prev.anchor_times.filter(t => t !== time)
        : [...prev.anchor_times, time],
    }));
  };

  const handleSave = async () => {
    await base44.auth.updateMe(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <h1 className="text-2xl font-semibold tracking-tight mb-6">Settings</h1>

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
                  {DAYS.map((day) => (
                    <button
                      key={day}
                      onClick={() => handleDayToggle(day)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        settings.anchor_days.includes(day)
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
                      onClick={() => handleTimeToggle(time)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        settings.anchor_times.includes(time)
                          ? "bg-primary text-white"
                          : "bg-secondary text-secondary-foreground"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
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
                <Label htmlFor="reminders">Enable reminders</Label>
                <Switch
                  id="reminders"
                  checked={settings.reminders_enabled}
                  onCheckedChange={(v) => setSettings(prev => ({ ...prev, reminders_enabled: v }))}
                />
              </div>
              <div>
                <Label className="text-sm mb-2 block">Forgotten load alert after</Label>
                <Select
                  value={String(settings.forgotten_load_threshold)}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, forgotten_load_threshold: Number(v) }))}
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
                <Select
                  value={settings.text_size}
                  onValueChange={(v) => setSettings(prev => ({ ...prev, text_size: v }))}
                >
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="large">Large</SelectItem>
                  </SelectContent>
                </Select>
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
                    <Label className="text-sm mb-2 block">Transfer stage idle time</Label>
                    <Select
                      value={String(settings.max_idle_time_wash_finished)}
                      onValueChange={(v) => setSettings(prev => ({ ...prev, max_idle_time_wash_finished: Number(v) }))}
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
                      Alert when a load waits at wash_finished longer than this
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