import React, { useState, useEffect } from "react";
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

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleClose = () => {
    if (sending) return;
    setOpen(false);
    // Reset after animation
    setTimeout(() => {
      setDone(false);
      setMessage("");
      setEmail("");
      setType("feedback");
    }, 300);
  };

  const handleSubmit = async () => {
    if (!message.trim() || sending) return;
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
        handleClose();
      }, 2500);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating trigger — sits above bottom nav (nav is ~64px, add 8px gap) */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
        aria-label="Send feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </button>

      {/* Modal */}
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-50"
              onClick={handleClose}
            />

            {/* Sheet — scrollable, safe-area aware, capped height */}
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-xl max-w-lg mx-auto flex flex-col"
              style={{ maxHeight: "90dvh" }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-6 py-3 flex-shrink-0">
                <h2 className="text-base font-semibold">Send Feedback</h2>
                <button
                  onClick={handleClose}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg"
                  aria-label="Close feedback"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable content */}
              <div className="overflow-y-auto flex-1 px-6 pb-6" style={{ WebkitOverflowScrolling: "touch" }}>
                {done ? (
                  <div className="flex flex-col items-center gap-3 py-10">
                    <CheckCircle2 className="w-12 h-12 text-primary" />
                    <p className="text-sm font-semibold text-foreground">Thanks for your feedback!</p>
                    <p className="text-xs text-muted-foreground text-center">We appreciate you taking the time — we'll look into it soon.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Type selector */}
                    <div className="flex gap-2">
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
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                    />

                    {/* Optional email */}
                    <input
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="Your email (optional, for follow-up)"
                      type="email"
                      className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />

                    {/* Submit — always visible at bottom of scroll area */}
                    <button
                      onClick={handleSubmit}
                      disabled={sending || !message.trim()}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl py-3.5 text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                      {sending ? "Sending…" : "Submit Feedback"}
                    </button>
                  </div>
                )}
              </div>

              {/* Safe area spacer for devices with home bar */}
              <div className="flex-shrink-0" style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}