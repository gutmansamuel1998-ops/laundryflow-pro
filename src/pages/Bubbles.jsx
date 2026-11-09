import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { legacyAi, legacyAiMessage } from "@/lib/legacyAi";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import MessageBubble from "@/components/bubbles/MessageBubble";

// Legacy Bubbles chat (Premium).
//
// Phase 3F: chat now goes through the `legacyAi` backend function (operations bubbles_history / bubbles_chat), which
// checks Premium on the server, applies the AI usage budget and stores the conversation where only the server can
// reach it. The older platform agent is no longer written to from here. The person's earlier agent conversation, if
// they have one, is still shown read-only so nothing they wrote disappears.
// (The simple V1 Bubbles mascot is separate and unchanged.)

const AGENT_NAME = "bubbles";

export default function Bubbles() {
  const [messages, setMessages] = useState([]);
  const [earlier, setEarlier] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [locked, setLocked] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const history = await legacyAi("bubbles_history", {});
        if (active) setMessages(Array.isArray(history.messages) ? history.messages : []);
      } catch (e) {
        if (!active) return;
        if (e && e.code === "premium_required") setLocked(true);
        else setError(legacyAiMessage(e));
      }
      try {
        // Read-only: earlier conversation from before this change (nothing is created or sent to the agent).
        const convs = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        if (convs && convs.length > 0) {
          const full = await base44.agents.getConversation(convs[0].id);
          const old = (full.messages || []).filter((m) => (m.role === "user" || m.role === "assistant") && m.content);
          if (active) setEarlier(old);
        }
      } catch (e) {
        // no earlier conversation, or it is no longer available
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || locked) return;
    setInput("");
    setError("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    try {
      const res = await legacyAi("bubbles_chat", { message: text });
      setMessages((prev) => [...prev, { role: "assistant", content: res.reply }]);
    } catch (e) {
      setMessages((prev) => prev.slice(0, -1));
      setInput(text);
      if (e && e.code === "premium_required") setLocked(true);
      else setError(legacyAiMessage(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen pb-24 flex flex-col">
      <div className="max-w-lg mx-auto w-full px-5 pt-8 flex-1 flex flex-col">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 mb-1">
          <span className="text-2xl leading-none" role="img" aria-label="Bubbles">🫧</span>
          <h1 className="text-2xl font-semibold tracking-tight">Bubbles</h1>
        </motion.div>
        <p className="text-sm text-muted-foreground mb-4">Your warm laundry accountability companion</p>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" aria-label="Loading" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 mb-4" role="log" aria-live="polite" aria-label="Conversation with Bubbles">
            {earlier.length > 0 && (
              <details className="rounded-xl border p-3 text-sm">
                <summary className="cursor-pointer text-muted-foreground">Earlier conversation (read only)</summary>
                <div className="space-y-3 mt-3">
                  {earlier.map((m, i) => (
                    <MessageBubble key={`e${i}`} message={m} />
                  ))}
                </div>
              </details>
            )}
            {locked && (
              <div className="text-center text-sm text-muted-foreground mt-8 px-6" role="status">
                <p className="mb-2">Chatting with Bubbles is part of Premium.</p>
                <p>Your simple Bubbles buddy is still with you on the Home screen.</p>
              </div>
            )}
            {!locked && messages.length === 0 && (
              <div className="text-center text-sm text-muted-foreground mt-8 px-6">
                <p className="mb-2">Hi! I'm Bubbles 🫧</p>
                <p>Tell me how your laundry's going, ask what to wash next, or just say hi. No pressure — we'll take it one step at a time.</p>
              </div>
            )}
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <MessageBubble message={m} />
              </motion.div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl px-4 py-3 flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span className="text-sm">Bubbles is thinking…</span>
                </div>
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive text-center" role="alert">{error}</p>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {!loading && !locked && (
          <div className="fixed bottom-20 left-0 right-0 bg-background/80 backdrop-blur-xl border-t p-4">
            <div className="max-w-lg mx-auto flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value.slice(0, 500))}
                placeholder="Say something to Bubbles…"
                className="resize-none rounded-xl"
                rows={2}
                maxLength={500}
                aria-label="Message Bubbles"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                size="icon"
                aria-label="Send message"
                className="h-auto w-12 rounded-xl"
              >
                <Send className="w-4 h-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
