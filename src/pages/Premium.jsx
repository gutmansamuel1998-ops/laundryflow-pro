import React, { useState } from "react";
import { motion } from "framer-motion";
import { base44 } from "@/api/base44Client";
import {
  Sparkles, Brain, CalendarClock, BarChart2, Package,
  ShieldCheck, Zap, CheckCircle2, ArrowRight, Star, MessageCircle, Loader2
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

const PLANS = [
  { id: "month", label: "Monthly",  price: "$1",  amount: "1.00",  sub: "/month",    name: "LaundryFlow Pro – Monthly",    note: "Billed monthly",           badge: null },
  { id: "year",  label: "Yearly",   price: "$10", amount: "10.00", sub: "/year",     name: "LaundryFlow Pro – Yearly",     note: "Save 17% vs monthly",     badge: "Best Value" },
  { id: "life",  label: "Lifetime", price: "$15", amount: "15.00", sub: " one-time", name: "LaundryFlow Pro – Lifetime",   note: "Pay once, own it forever", badge: "🔥 Most Popular" },
];

export default function Premium() {
  const [selected, setSelected] = useState("year");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCheckout = async () => {
    const plan = PLANS.find(p => p.id === selected);
    setLoading(true);
    setError(null);
    const res = await base44.functions.invoke("createCheckout", {
      items: [{ name: plan.name, quantity: 1, price: plan.amount }]
    });
    if (res.data?.redirectUrl) {
      window.location.href = res.data.redirectUrl;
    } else {
      setError("Could not start checkout. Please try again.");
      setLoading(false);
    }
  };
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

        {/* Pricing Cards */}
        {(()=>{
          const plans = PLANS;
          return (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider text-center">Choose your plan</p>
              {plans.map(plan => (
                <button
                  key={plan.id}
                  onClick={() => setSelected(plan.id)}
                  className={`w-full flex items-center justify-between rounded-2xl border-2 px-5 py-4 transition-all text-left ${
                    selected === plan.id ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                      selected === plan.id ? "border-primary" : "border-muted-foreground/40"
                    }`}>
                      {selected === plan.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{plan.label}</p>
                        {plan.badge && <span className="text-[10px] bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-full">{plan.badge}</span>}
                      </div>
                      <p className="text-xs text-muted-foreground">{plan.note}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-bold text-foreground">{plan.price}</span>
                    <span className="text-xs text-muted-foreground">{plan.sub}</span>
                  </div>
                </button>
              ))}
              {error && <p className="text-xs text-destructive text-center">{error}</p>}
              <button
                onClick={handleCheckout}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full bg-primary text-primary-foreground font-semibold text-sm rounded-2xl py-3.5 hover:opacity-90 transition-opacity mt-2 disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><span>Get Premium</span><ArrowRight className="w-4 h-4" /></>}
              </button>
              <p className="text-xs text-muted-foreground text-center">
                {selected === "life" ? "One-time payment. Yours forever." : "Cancel anytime. No hidden fees."}
              </p>
            </motion.div>
          );
        })()}

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
          <button
            onClick={handleCheckout}
            disabled={loading}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-sm rounded-2xl px-6 py-3 hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Sparkles className="w-4 h-4" /><span>Upgrade to Premium</span></>}
          </button>
        </div>
      </div>
    </div>
  );
}