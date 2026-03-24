import React from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Sparkles, Brain, CalendarClock, BarChart2, Package,
  ShieldCheck, Zap, CheckCircle2, ArrowRight, Star, MessageCircle
} from "lucide-react";

const FEATURES = [
  {
    icon: Brain,
    title: "AI Load Recommendations",
    description: "Get intelligent wash & dry settings tailored to your laundry habits — every single load.",
    color: "from-violet-500/20 to-purple-500/10",
    iconColor: "text-violet-500",
  },
  {
    icon: CalendarClock,
    title: "Smart Schedule",
    description: "LaundryFlow analyzes your patterns and recommends the optimal time to do laundry — and reminds you.",
    color: "from-blue-500/20 to-cyan-500/10",
    iconColor: "text-blue-500",
  },
  {
    icon: BarChart2,
    title: "Advanced Supply Analytics",
    description: "Depletion rate charts, restock calendars, and usage trends so you never run out of detergent again.",
    color: "from-emerald-500/20 to-green-500/10",
    iconColor: "text-emerald-500",
  },
  {
    icon: Package,
    title: "Smart Supply Suggestions",
    description: "AI-powered restocking recommendations based on your 30-day usage history.",
    color: "from-amber-500/20 to-yellow-500/10",
    iconColor: "text-amber-500",
  },
  {
    icon: Zap,
    title: "Friction Detection",
    description: "Automatically detects abandoned or forgotten loads and gently nudges you back on track.",
    color: "from-orange-500/20 to-red-500/10",
    iconColor: "text-orange-500",
  },
  {
    icon: MessageCircle,
    title: "AI Laundry Assistant",
    description: "Chat with your personal AI assistant for laundry tips, stain removal advice, fabric care guidance, and more — anytime.",
    color: "from-sky-500/20 to-indigo-500/10",
    iconColor: "text-sky-500",
  },
  {
    icon: ShieldCheck,
    title: "Priority Support",
    description: "Premium users get faster responses and dedicated support for any issue or question.",
    color: "from-pink-500/20 to-rose-500/10",
    iconColor: "text-pink-500",
  },
];

const INCLUDED = [
  "Unlimited laundry loads",
  "Full wash & dry cycle timer",
  "Basic supply tracking",
  "Stain guidance",
  "Laundry calendar",
  "Tag scanner",
];

export default function Premium() {
  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Hero */}
      <div className="bg-gradient-to-br from-primary/15 via-accent/10 to-background px-5 pt-14 pb-10 text-center">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Star className="w-3.5 h-3.5 fill-primary" />
            LaundryFlow Pro Premium
          </div>
          <h1 className="text-2xl font-bold text-foreground leading-tight mb-3">
            Do laundry smarter,<br />not harder.
          </h1>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            Unlock AI-powered tools that help you stay on top of every load, supply, and schedule — effortlessly.
          </p>
        </motion.div>
      </div>

      <div className="px-5 max-w-lg mx-auto space-y-6 mt-6">

        {/* Pricing Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-primary text-primary-foreground rounded-3xl p-6 text-center shadow-lg"
        >
          <p className="text-xs font-semibold uppercase tracking-wider opacity-80 mb-1">Premium Plan</p>
          <div className="flex items-end justify-center gap-1 mb-1">
            <span className="text-4xl font-bold">$4.99</span>
            <span className="text-sm opacity-70 mb-1.5">/month</span>
          </div>
          <p className="text-xs opacity-70 mb-5">or $39.99/year — save 33%</p>
          <Link
            to="/ThankYou"
            className="block w-full bg-white text-primary font-semibold text-sm rounded-2xl py-3 hover:opacity-90 transition-opacity"
          >
            Get Premium <ArrowRight className="inline w-4 h-4 ml-1" />
          </Link>
          <p className="text-xs opacity-60 mt-3">Cancel anytime. No hidden fees.</p>
        </motion.div>

        {/* Premium Features */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">What you unlock</h2>
          <div className="space-y-3">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.06 }}
                  className={`bg-gradient-to-br ${f.color} border border-border/50 rounded-2xl p-4 flex items-start gap-3`}
                >
                  <div className="w-9 h-9 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
                    <Icon className={`w-4.5 h-4.5 ${f.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Free Plan */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-3">Always free</h2>
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            {INCLUDED.map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center pt-2 pb-4">
          <p className="text-xs text-muted-foreground mb-3">Join thousands of users doing laundry smarter.</p>
          <Link
            to="/ThankYou"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-sm rounded-2xl px-6 py-3 hover:opacity-90 transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            Upgrade to Premium
          </Link>
        </div>
      </div>
    </div>
  );
}