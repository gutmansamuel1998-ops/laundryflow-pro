import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Send, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const SUGGESTED_QUESTIONS = [
  "What do these laundry symbols mean?",
  "How do I wash bedsheets?",
  "Can cotton and polyester be washed together?",
  "What temperature should I use for delicates?"
];

export default function AIAssistant() {
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleAsk = async (customQuestion = null) => {
    const q = customQuestion || question;
    if (!q.trim()) return;

    const userMessage = { role: "user", content: q };
    setConversation(prev => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a supportive laundry assistant. Answer this question in a calm, clear, and helpful way. Avoid judgment or urgency. Keep it simple and actionable.\n\nQuestion: ${q}`,
      });

      const aiMessage = { role: "assistant", content: response };
      setConversation(prev => [...prev, aiMessage]);
    } catch (error) {
      const errorMessage = { role: "assistant", content: "I'm having trouble right now. Please try again." };
      setConversation(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">AI Laundry Assistant</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Ask any laundry question in plain language
          </p>
        </motion.div>

        <div className="mt-6 space-y-4">
          {conversation.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              <p className="text-sm text-muted-foreground mb-3">Try asking:</p>
              {SUGGESTED_QUESTIONS.map((q, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="w-full text-left justify-start h-auto py-3 px-4 rounded-xl"
                  onClick={() => handleAsk(q)}
                >
                  {q}
                </Button>
              ))}
            </motion.div>
          )}

          <AnimatePresence>
            {conversation.map((message, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card
                  className={`p-4 border-0 ${
                    message.role === "user"
                      ? "bg-primary/10 ml-8"
                      : "bg-secondary/50 mr-8"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          {loading && (
            <Card className="p-4 border-0 bg-secondary/50 mr-8">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <p className="text-sm">Thinking...</p>
              </div>
            </Card>
          )}
        </div>

        <div className="fixed bottom-20 left-0 right-0 bg-background/80 backdrop-blur-xl border-t p-4">
          <div className="max-w-lg mx-auto flex gap-2">
            <Textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a laundry question..."
              className="resize-none rounded-xl"
              rows={2}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleAsk();
                }
              }}
            />
            <Button
              onClick={() => handleAsk()}
              disabled={!question.trim() || loading}
              size="icon"
              className="h-auto w-12 rounded-xl"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}