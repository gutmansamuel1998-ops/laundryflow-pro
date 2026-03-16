import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff } from "lucide-react";

/**
 * Floating mic indicator shown in LaundryMode when voice commands are active.
 * Shows a brief transcript bubble when something is heard.
 */
export default function VoiceCommandIndicator({ enabled, lastTranscript }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!lastTranscript) return;
    setShow(true);
    const t = setTimeout(() => setShow(false), 2500);
    return () => clearTimeout(t);
  }, [lastTranscript]);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-28 right-5 z-40 flex flex-col items-end gap-2">
      <AnimatePresence>
        {show && lastTranscript && (
          <motion.div
            key={lastTranscript}
            initial={{ opacity: 0, y: 6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-foreground text-background text-xs px-3 py-1.5 rounded-xl max-w-[180px] text-right shadow-lg"
          >
            "{lastTranscript}"
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className="w-11 h-11 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/30"
      >
        <Mic className="w-5 h-5 text-primary-foreground" />
      </motion.div>
    </div>
  );
}