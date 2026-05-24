import React, { useState } from "react";
import { MessageSquarePlus, Bug, Lightbulb, Star, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

const TYPES = [
  { value: "bug", label: "Bug Report", icon: Bug },
  { value: "feedback", label: "Feedback", icon: Star },
  { value: "suggestion", label: "Suggestion", icon: Lightbulb },
];

export default function FeedbackModal() {
  const [open, setOpen] = useState(false);

  const handleSend = (type) => {
    const subject = encodeURIComponent(`[${type.label}] LaundryFlow Pro`);
    window.location.href = `mailto:gutman.samuel1998@gmail.com?subject=${subject}`;
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
        aria-label="Send feedback"
      >
        <MessageSquarePlus className="w-5 h-5" />
      </button>

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
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 bg-card rounded-t-3xl shadow-xl max-w-lg mx-auto"
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-border" />
              </div>

              <div className="flex items-center justify-between px-6 py-3">
                <h2 className="text-base font-semibold">Send Feedback</h2>
                <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="px-6 pb-3 text-sm text-muted-foreground">Choose a type — your email app will open with the recipient prefilled.</p>

              <div className="px-6 pb-6 space-y-2" style={{ paddingBottom: `calc(1.5rem + env(safe-area-inset-bottom, 0px))` }}>
                {TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => handleSend({ value, label })}
                    className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium text-left"
                  >
                    <Icon className="w-4 h-4 text-muted-foreground" />
                    {label}
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}