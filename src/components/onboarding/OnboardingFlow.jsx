import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIMES = ["Morning", "Afternoon", "Evening"];

export default function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState({
    environment: "private",
    anchor_days: [],
    anchor_times: [],
    reminders_enabled: true,
  });

  const handleDayToggle = (day) => {
    setPreferences(prev => ({
      ...prev,
      anchor_days: prev.anchor_days.includes(day)
        ? prev.anchor_days.filter(d => d !== day)
        : [...prev.anchor_days, day],
    }));
  };

  const handleTimeToggle = (time) => {
    setPreferences(prev => ({
      ...prev,
      anchor_times: prev.anchor_times.includes(time)
        ? prev.anchor_times.filter(t => t !== time)
        : [...prev.anchor_times, time],
    }));
  };

  const steps = [
    // Step 0 — Welcome
    <motion.div key="welcome" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center py-8">
      <div className="w-20 h-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-8">
        <span className="text-4xl">🧺</span>
      </div>
      <h1 className="text-2xl font-semibold mb-3">Welcome to LaundryFlow</h1>
      <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed mb-8">
        LaundryFlow helps make laundry easier to start and finish. No pressure, no judgment — just support.
      </p>
      <Button onClick={() => setStep(1)} className="rounded-2xl px-8 py-5 text-base">
        Get Started <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
      <button onClick={() => onComplete(preferences)} className="block mx-auto mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
        Skip setup
      </button>
    </motion.div>,

    // Step 1 — Environment
    <motion.div key="env" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="py-6">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Step 1 of 3</p>
      <h2 className="text-xl font-semibold mb-2">Where do you do laundry?</h2>
      <p className="text-muted-foreground text-sm mb-6">This helps us time reminders better.</p>
      <div className="space-y-3">
        {[
          { value: "private", label: "Private Laundry", desc: "At home, in-unit" },
          { value: "shared", label: "Shared Laundry Room", desc: "Dorm, apartment building" },
        ].map((opt) => (
          <Card
            key={opt.value}
            className={`p-4 cursor-pointer transition-all border-2 ${
              preferences.environment === opt.value ? "border-primary shadow-sm" : "border-transparent"
            }`}
            onClick={() => setPreferences(prev => ({ ...prev, environment: opt.value }))}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{opt.label}</p>
                <p className="text-sm text-muted-foreground">{opt.desc}</p>
              </div>
              {preferences.environment === opt.value && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
      <div className="flex gap-3 mt-8">
        <Button variant="ghost" onClick={() => setStep(0)} className="rounded-xl">Back</Button>
        <Button onClick={() => setStep(2)} className="flex-1 rounded-xl py-5">Continue <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </motion.div>,

    // Step 2 — Anchors
    <motion.div key="anchors" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="py-6">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Step 2 of 3</p>
      <h2 className="text-xl font-semibold mb-2">When works best for laundry?</h2>
      <p className="text-muted-foreground text-sm mb-6">We can gently remind you around these times. Pick as many as you like, or skip.</p>
      <div className="mb-5">
        <p className="text-sm font-medium mb-3">Days</p>
        <div className="flex flex-wrap gap-2">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => handleDayToggle(day)}
              className={`px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                preferences.anchor_days.includes(day)
                  ? "bg-primary text-white shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {day.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium mb-3">Time of day</p>
        <div className="flex flex-wrap gap-2">
          {TIMES.map((time) => (
            <button
              key={time}
              onClick={() => handleTimeToggle(time)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                preferences.anchor_times.includes(time)
                  ? "bg-primary text-white shadow-sm"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {time}
            </button>
          ))}
        </div>
      </div>
      <div className="flex gap-3 mt-8">
        <Button variant="ghost" onClick={() => setStep(1)} className="rounded-xl">Back</Button>
        <Button onClick={() => setStep(3)} className="flex-1 rounded-xl py-5">Continue <ArrowRight className="w-4 h-4 ml-2" /></Button>
      </div>
    </motion.div>,

    // Step 3 — Ready
    <motion.div key="ready" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="text-center py-8">
      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-6">
        <Check className="w-7 h-7 text-emerald-600" />
      </div>
      <h2 className="text-xl font-semibold mb-2">You're all set</h2>
      <p className="text-muted-foreground max-w-sm mx-auto leading-relaxed mb-8">
        Start your first load whenever you're ready. No rush.
      </p>
      <Button
        onClick={() => onComplete(preferences, true)}
        className="rounded-2xl px-8 py-5 text-base shadow-lg shadow-primary/20"
      >
        Start First Load
      </Button>
      <button onClick={() => onComplete(preferences)} className="block mx-auto mt-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
        I'll start later
      </button>
    </motion.div>,
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-md">
        <AnimatePresence mode="wait">
          {steps[step]}
        </AnimatePresence>
      </div>
    </div>
  );
}