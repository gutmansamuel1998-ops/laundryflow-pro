import { useEffect, useRef, useState } from "react";
import { useToast, dismissToast, DEFAULT_TOAST_DURATION } from "@/components/ui/use-toast";
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast";

// P8.11: one toast. It dismisses itself after its own `duration` (milliseconds; 5000 if none was given), and the timer
// waits while the mouse is over it or keyboard focus is inside it, so it never disappears under someone who is
// reading it or about to press Close. Touch has no hover, so a touch toast simply times out.
function ToastItem({ id, title, description, action, duration, open: _open, onOpenChange: _onOpenChange, ...props }) {
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(null);
  const returnFocusTo = useRef(null);
  const ms = typeof duration === "number" ? duration : DEFAULT_TOAST_DURATION;

  useEffect(() => {
    if (paused || !Number.isFinite(ms)) return undefined;
    const timer = setTimeout(() => dismissToast(id), ms);
    return () => clearTimeout(timer);
  }, [paused, ms, id]);

  const handleClose = () => {
    // If the keyboard user was on the Close button, put focus back where it was instead of dropping it to <body>.
    const hadFocus = closeRef.current && closeRef.current === document.activeElement;
    const target = returnFocusTo.current;
    dismissToast(id);
    if (hadFocus && target && target.isConnected) target.focus();
  };

  return (
    <Toast
      {...props}
      onPointerEnter={(e) => { if (e.pointerType === "mouse") setPaused(true); }}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") setPaused(false); }}
      onFocus={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) returnFocusTo.current = e.relatedTarget;
        setPaused(true);
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setPaused(false);
      }}
    >
      <div className="grid min-w-0 gap-1 break-words">
        {title && <ToastTitle>{title}</ToastTitle>}
        {description && <ToastDescription>{description}</ToastDescription>}
      </div>
      {action}
      <ToastClose ref={closeRef} onClick={handleClose} />
    </Toast>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <ToastProvider>
      {toasts
        .filter((t) => t.open !== false)
        .map(({ id, ...rest }) => (
          <ToastItem key={id} id={id} {...rest} />
        ))}
      <ToastViewport />
    </ToastProvider>
  );
}
