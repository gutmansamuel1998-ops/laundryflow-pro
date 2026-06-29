import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const AGENT_NAME = "bubbles";

function MessageBubble({ message }) {
  const isUser = message.role === "user";

  if (message.role === "tool" || (message.tool_calls?.length > 0 && !message.content)) {
    return null;
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2 flex-shrink-0 mt-1 text-lg">
          🫧
        </div>
      )}
      <div
        className={`max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm"
        }`}
      >
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          <ReactMarkdown className="prose prose-sm max-w-none [&>p]:mb-0 [&>p:last-child]:mb-0">
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

export default function Bubbles() {
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    initConversation();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function initConversation() {
    try {
      const convos = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      let convo = convos?.[0];
      if (!convo) {
        convo = await base44.agents.createConversation({
          agent_name: AGENT_NAME,
          metadata: { name: "Bubbles Chat" },
        });
      }
      setConversation(convo);
      const full = await base44.agents.getConversation(convo.id);
      setMessages(full.messages || []);
      if (!full.messages?.length) {
        await sendGreeting(convo);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function sendGreeting(convo) {
    setSending(true);
    const updated = await base44.agents.addMessage(convo, {
      role: "user",
      content: "Hey Bubbles! How's my laundry looking today?",
    });
    setMessages(updated.messages || []);
    const sub = base44.agents.subscribeToConversation(convo.id, (data) => {
      setMessages(data.messages || []);
    });
    setTimeout(() => sub(), 8000);
    setSending(false);
  }

  async function handleSend() {
    if (!input.trim() || sending || !conversation) return;
    const text = input.trim();
    setInput("");
    setSending(true);

    const optimistic = [...messages, { role: "user", content: text }];
    setMessages(optimistic);

    await base44.agents.addMessage(conversation, { role: "user", content: text });

    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      setMessages(data.messages || []);
    });

    setTimeout(() => {
      unsubscribe();
      setSending(false);
    }, 12000);
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-3">
        <div className="text-4xl animate-bounce">🫧</div>
        <p className="text-muted-foreground text-sm">Waking up Bubbles…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b bg-white/80 backdrop-blur-sm">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-xl">🫧</div>
        <div>
          <p className="font-semibold text-sm">Bubbles</p>
          <p className="text-xs text-muted-foreground">Your laundry accountability companion</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 pb-2">
        {messages.filter(m => m.role !== "tool").map((msg, i) => (
          <MessageBubble key={i} message={msg} />
        ))}
        {sending && (
          <div className="flex justify-start mb-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2 text-lg flex-shrink-0">🫧</div>
            <div className="bg-muted px-4 py-3 rounded-2xl rounded-bl-sm flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Bubbles is thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t bg-white/80 backdrop-blur-sm pb-safe mb-20">
        <div className="flex gap-2 items-center">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Chat with Bubbles…"
            className="flex-1 rounded-full"
            disabled={sending}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="rounded-full w-10 h-10 flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}