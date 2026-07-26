import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import MessageBubble from "@/components/bubbles/MessageBubble";

const AGENT_NAME = "bubbles";

export default function Bubbles() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const convs = await base44.agents.listConversations({ agent_name: AGENT_NAME });
        let conv = convs && convs.length > 0 ? convs[0] : null;
        if (!conv) {
          conv = await base44.agents.createConversation({
            agent_name: AGENT_NAME,
            metadata: { name: "Bubbles", description: "Your laundry accountability companion" },
          });
        }
        if (!active) return;
        const full = await base44.agents.getConversation(conv.id);
        setConversation(full);
        setMessages(full.messages || []);
      } catch (e) {
        // ignore
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!conversation) return;
    const unsub = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });
    return unsub;
  }, [conversation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !conversation || sending) return;
    setInput("");
    setSending(true);
    try {
      await base44.agents.addMessage(conversation, { role: "user", content: text });
    } catch (e) {
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const assistantBusy = sending || (messages.length > 0 && messages[messages.length - 1].role === "user");

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
            {messages.length === 0 && (
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
            {assistantBusy && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl px-4 py-3 flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span className="text-sm">Bubbles is thinking…</span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        {!loading && (
          <div className="fixed bottom-20 left-0 right-0 bg-background/80 backdrop-blur-xl border-t p-4">
            <div className="max-w-lg mx-auto flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Say something to Bubbles…"
                className="resize-none rounded-xl"
                rows={2}
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