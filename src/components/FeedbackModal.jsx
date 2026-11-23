import React, { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquarePlus, Bug, Lightbulb, Star, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const TYPES = [
  { value: "bug", label: "Bug Report", icon: Bug },
  { value: "feedback", label: "Feedback", icon: Star },
  { value: "suggestion", label: "Suggestion", icon: Lightbulb },
];

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export default function FeedbackModal() {
  const [open, setOpen] = useState(false);
  const launcherRef = useRef(null);
  const dialogRef = useRef(null);
  const reduceMotion = useReducedMotion();

  const close = useCallback(() => setOpen(false), []);

  const handleSend = (type) => {
    const subject = encodeURIComponent(`[${type.label}] LaundryFun Pro`);
    window.location.href = `mailto:gutman.samuel1998@gmail.com?subject=${subject}`;
    setOpen(false);
  };

  // Dialog focus management (WAI-ARIA dialog pattern, WCAG 2.4.3 / 2.1.2):
  //  - focus moves into the dialog when it opens,
  //  - Tab and Shift+Tab stay inside it (the page behind is covered and marked aria-modal),
  //  - Escape closes it,
  //  - focus returns to the "Send feedback" button when it closes.
  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    dialog?.focus();
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const items = [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const outside = !dialog.contains(active) || active === dialog;
      if (event.shiftKey && (active === first || outside)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || outside)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      launcherRef.current?.focus();
    };
  }, [open, close]);

  // With "reduce motion" on, the sheet fades in place instead of sliding and springing.
  const sheetMotion = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 40 }, transition: { type: "spring", damping: 28, stiffness: 300 } };

  return (
    <>
      <button
        ref={launcherRef}
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(var(--bottom-nav-h,5rem)+0.75rem)] right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:opacity-90 transition-all active:scale-95"
        aria-label="Send feedback"
        aria-haspopup="dialog"
      >
        <MessageSquarePlus className="w-5 h-5" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* z-[60]: above the bottom navigation (z-50), so the bar can never sit on top of the options. */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={reduceMotion ? { duration: 0 } : undefined}
              className="fixed inset-0 bg-black/40 z-[60]"
              onClick={close}
              aria-hidden="true"
            />
            <motion.div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="feedback-modal-title"
              tabIndex={-1}
              {...sheetMotion}
              className="feedback-sheet fixed bottom-0 left-0 right-0 z-[60] bg-card rounded-t-3xl shadow-xl max-w-lg mx-auto focus:outline-none"
            >
              {/* The header stays in view while the sheet scrolls (large text on a small screen), so Close is always reachable. */}
              <div className="sticky top-0 z-10 bg-card rounded-t-3xl">
                <div className="flex justify-center pt-3 pb-1" aria-hidden="true">
                  <div className="w-10 h-1 rounded-full bg-border" />
                </div>
                <div className="flex items-center justify-between gap-3 pl-6 pr-4 py-1">
                  <h2 id="feedback-modal-title" className="text-base font-semibold">Send Feedback</h2>
                  <button
                    onClick={close}
                    aria-label="Close feedback"
                    className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-5 h-5" aria-hidden="true" />
                  </button>
                </div>
              </div>

              <p className="px-6 pb-3 text-sm text-muted-foreground">Choose a type — your email app will open with the recipient prefilled.</p>

              <div className="px-6 pb-6 space-y-2" style={{ paddingBottom: `calc(1.5rem + env(safe-area-inset-bottom, 0px))` }}>
                {TYPES.map(({ value, label, icon: Icon }) => (
                  <button
                   key={value}
                   onClick={() => handleSend({ value, label })}
                   className="w-full flex min-h-[44px] items-center gap-3 px-4 py-3.5 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all text-sm font-medium text-left"
                  >
                   <Icon className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
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
