import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, X, Bug, Lightbulb, Star, Send, CheckCircle2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TYPES = [
  { value: "bug", label: "Bug Report", icon: Bug, color: "text-destructive" },
  { value: "feedback", label: "Feedback", icon: Star, color: "text-yellow-500" },
  { value: "suggestion", label: "Suggestion", icon: Lightbulb, color: "text-accent" },
];

export default function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState("feedback");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await base44.integrations.Core.SendEmail({
        to: "support@laundryflowpro.com",
        from_name: "LaundryFlow Pro Feedback",
        subject: `[${type.toUpperCase()}] User Feedback`,
        body: `Type: ${type}\nFrom: ${email || "Anonymous"}\n\nMessage:\n${message}`,
      });
      setDone(true);
      setTimeout(() => {
        setOpen(false);
        setDone(false);
        setMessage("");
        setEmail("");
        setType("feedback");
      }, 2500);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-24 right-4 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
        aria-label="Send feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl p-6 pb-10 shadow-xl max-w-lg mx-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-semibold">Send Feedback</h2>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {done ? (
                <div className="flex flex-col items-center gap-3 py-8">
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                  <p className="text-sm font-medium text-foreground">Thanks for your feedback!</p>
                  <p className="text-xs text-muted-foreground">We'll look into it soon.</p>
                </div>
              ) : (
                <>
                  {/* Type selector */}
                  <div className="flex gap-2 mb-4">
                    {TYPES.map(({ value, label, icon: Icon, color }) => (
                      <button
                        key={value}
                        onClick={() => setType(value)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                          type === value
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border text-muted-foreground"
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${type === value ? color : ""}`} />
                        {label}
                      </button>
                    ))}
                  </div>

                  {/* Message */}
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    placeholder={
                      type === "bug"
                        ? "Describe what happened and how to reproduce it…"
                        : type === "suggestion"
                        ? "What feature or improvement would you like to see?"
                        : "Share your thoughts about the app…"
                    }
                    rows={4}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring mb-3"
                  />

                  {/* Optional email */}
                  <input
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="Your email (optional, for follow-up)"
                    type="email"
                    className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring mb-4"
                  />

                  <button
                    onClick={handleSubmit}
                    disabled={sending || !message.trim()}
                    className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {sending ? "Sending…" : "Submit"}
                  </button>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}