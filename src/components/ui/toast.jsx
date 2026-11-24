import * as React from "react";
import { cva } from "class-variance-authority";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// P8.9: both layers are always on screen, even with no toast. They are click-through (pointer-events-none) so an
// empty toast region cannot swallow taps meant for the page; each toast turns pointer events back on for itself
// ("pointer-events-auto" in toastVariants), so toasts and their close buttons stay clickable.
//
// P8.11: the provider is also the page's polite live region. It is always in the page (empty until a toast arrives),
// so a screen reader is already listening when a toast is added, and it speaks only the new toast (aria-atomic="false").
const ToastProvider = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    role="status"
    aria-live="polite"
    aria-atomic="false"
    aria-relevant="additions text"
    aria-label="Notifications"
    className="pointer-events-none fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
    {...props}
  />
));
ToastProvider.displayName = "ToastProvider";

const ToastViewport = React.forwardRef(({ ...props }, ref) => (
  <div
    ref={ref}
    className="pointer-events-none fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4 sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
    {...props}
  />
));
ToastViewport.displayName = "ToastViewport";

// pr-14 leaves room for the always-visible 44px close button (P8.11), so it never sits on top of the message.
const toastVariants = cva(
  "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border p-6 pr-14 shadow-lg transition-all motion-reduce:transition-none",
  {
    variants: {
      variant: {
        default: "border bg-background text-foreground",
        destructive:
          "destructive group border-destructive bg-destructive text-destructive-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

const Toast = React.forwardRef(({ className, variant, ...props }, ref) => {
  return (
    <div
      ref={ref}
      className={cn(toastVariants({ variant }), className)}
      {...props}
    />
  );
});
Toast.displayName = "Toast";

const ToastAction = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium ring-offset-background transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
      className
    )}
    {...props}
  />
));
ToastAction.displayName = "ToastAction";

// P8.11: always visible (it used to be opacity-0 until hover or focus, which touch screens never reveal) and a 44px
// target. It is a real button, so Enter and Space work; the handler is supplied by Toaster.
const ToastClose = React.forwardRef(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-md text-foreground/80 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring group-[.destructive]:text-red-100 group-[.destructive]:hover:text-red-50 group-[.destructive]:focus-visible:ring-red-300",
      className
    )}
    toast-close=""
    aria-label="Close notification"
    {...props}
  >
    <X className="h-5 w-5" aria-hidden="true" />
  </button>
));
ToastClose.displayName = "ToastClose";

const ToastTitle = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm font-semibold", className)}
    {...props}
  />
));
ToastTitle.displayName = "ToastTitle";

const ToastDescription = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm opacity-90", className)}
    {...props}
  />
));
ToastDescription.displayName = "ToastDescription";

export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
}; 
