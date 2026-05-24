import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Loader2 } from "lucide-react";

export default function RestorePremiumSection() {
  const [restoring, setRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg] = useState(null);

  const handleRestoreAccess = async () => {
    setRestoring(true);
    setRestoreMsg(null);
    try {
      const user = await base44.auth.me();
      if (user?.has_premium) {
        window.location.href = "/";
      } else {
        setRestoreMsg("No premium purchase found for your account. If you just purchased, try logging out and back in.");
      }
    } catch {
      setRestoreMsg("Could not verify your account. Please try logging out and back in.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="border-t border-border pt-5 pb-2 text-center mt-4">
      <p className="text-xs text-muted-foreground mb-2">Already purchased? Your access may not have loaded yet.</p>
      <button
        onClick={handleRestoreAccess}
        disabled={restoring}
        className="inline-flex items-center gap-2 text-sm text-primary font-medium underline underline-offset-2 hover:opacity-70 transition-opacity disabled:opacity-40"
      >
        {restoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
        {restoring ? "Checking…" : "Restore my Premium access"}
      </button>
      {restoreMsg && <p className="text-xs text-muted-foreground mt-2 max-w-xs mx-auto">{restoreMsg}</p>}
    </div>
  );
}