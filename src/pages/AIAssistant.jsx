import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, Lock, AlertTriangle, ShoppingCart, ChevronDown, ChevronUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const SUGGESTED_QUESTIONS = [
  "What do these laundry symbols mean?",
  "How do I wash bedsheets?",
  "Can cotton and polyester be washed together?",
  "What temperature should I use for delicates?",
  "How do I prevent color bleeding on new clothes?"
];

export default function AIAssistant() {
  const [question, setQuestion] = useState("");
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isPremium, setIsPremium] = useState(null);
  const [newGarments, setNewGarments] = useState([]);
  const [firstWashExpanded, setFirstWashExpanded] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then((user) => {
      setIsPremium(user?.has_premium === true);
    }).catch(() => setIsPremium(false));

    base44.entities.ClothingItem.filter({ is_new_garment: true }).then(setNewGarments).catch(() => {});
  }, []);

  const handleAsk = async (customQuestion = null) => {
    const q = customQuestion || question;
    if (!q.trim()) return;

    const userMessage = { role: "user", content: q };
    setConversation(prev => [...prev, userMessage]);
    setQuestion("");
    setLoading(true);

    try {
      const newGarmentContext = newGarments.length > 0
        ? `\n\nThe user currently has these brand-new garments in their closet that haven't been washed yet: ${newGarments.map(g => g.name).join(", ")}. If the question is related to any of these items or to new/first-wash clothes in general, proactively mention color bleed risks and first-wash precautions.`
        : "";

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a supportive laundry assistant. Answer this question in a calm, clear, and helpful way. Avoid judgment or urgency. Keep it simple and actionable.${newGarmentContext}\n\nQuestion: ${q}`,
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

  if (isPremium === null) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!isPremium) {
    return (
      <div className="min-h-screen pb-24">
        <div className="max-w-lg mx-auto px-5 pt-8">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-5 h-5 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">AI Laundry Assistant</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-10">Ask any laundry question in plain language</p>

          <div className="flex flex-col items-center text-center gap-5 mt-16">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center" aria-hidden="true">
            <Lock className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold mb-2">Premium Feature</h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                The AI Assistant is available exclusively to Premium members. Upgrade to get instant laundry answers, fabric tips, and more.
              </p>
            </div>
            <button
              onClick={() => navigate("/Settings")}
              aria-label="Go to Settings to upgrade to Premium"
              className="mt-2 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-medium text-sm shadow-lg shadow-primary/20 hover:opacity-90 transition-opacity"
            >
              Upgrade in Settings
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          {/* Proactive new garment alert */}
          {newGarments.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
                <button
                  className="w-full flex items-start justify-between gap-3 text-left"
                  onClick={() => setFirstWashExpanded(e => !e)}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-amber-800">
                        You have {newGarments.length} new garment{newGarments.length > 1 ? "s" : ""} — First wash tips
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {newGarments.map(g => (
                          <Badge key={g.id} className="bg-amber-100 text-amber-800 border border-amber-300 text-xs">🆕 {g.name}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  {firstWashExpanded
                    ? <ChevronUp className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    : <ChevronDown className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />}
                </button>
                <AnimatePresence>
                  {firstWashExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-1.5 pt-3 border-t border-amber-200">
                        {[
                          "Wash new garments alone or only with similar dark colors on the first wash.",
                          "Always use cold water — it minimizes dye release.",
                          "Add a color catcher sheet to trap any bleeding dye.",
                          "Turn the garment inside out before placing in the machine.",
                          "Avoid fabric softener on the first wash — it can set dyes unevenly.",
                          "Once washed and no bleeding occurs, toggle off 'New garment' in your Digital Closet.",
                        ].map((tip, i) => (
                          <p key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                            <span className="font-bold mt-0.5">•</span> {tip}
                          </p>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 rounded-xl border-amber-300 text-amber-800 bg-amber-100 hover:bg-amber-200 text-xs"
                          onClick={() => handleAsk(`I have these new garments: ${newGarments.map(g => g.name).join(", ")}. Give me a personalized first-wash plan for each of them.`)}
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Get personalized first-wash plan
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full rounded-xl border-amber-300 text-amber-800 bg-amber-100 hover:bg-amber-200 text-xs"
                          onClick={() => handleAsk("Should I add color catcher sheets to my shopping list for washing new clothes?")}
                        >
                          <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Do I need color catchers?
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}

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
                  aria-label={`Ask: ${q}`}
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
              aria-label="Send message"
              className="h-auto w-12 rounded-xl"
            >
              <Send className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}