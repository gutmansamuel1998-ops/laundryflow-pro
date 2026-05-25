import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Send, Loader2, Lock, AlertTriangle, ShoppingCart, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
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
  const [shrinkItems, setShrinkItems] = useState([]);
  const [firstWashExpanded, setFirstWashExpanded] = useState(false);
  const [shrinkExpanded, setShrinkExpanded] = useState(false);
  const navigate = useNavigate();

  const SHRINK_FABRICS = ["cotton", "wool", "linen", "cashmere", "rayon", "bamboo", "silk"];
  const AIR_DRY_METHODS = ["hang_dry", "lay_flat", "air_dry"];

  useEffect(() => {
    base44.auth.me().then((user) => {
      setIsPremium(user?.has_premium === true);
    }).catch(() => setIsPremium(false));

    base44.entities.ClothingItem.filter({ is_new_garment: true }).then(setNewGarments).catch(() => {});

    base44.entities.ClothingItem.list().then(items => {
      const risky = items.filter(i => {
        const fabric = (i.fabric_composition || "").toLowerCase();
        const care = (i.care_instructions || "").toLowerCase();
        return SHRINK_FABRICS.some(f => fabric.includes(f))
          || care.includes("do not tumble") || care.includes("hang dry") || care.includes("air dry") || care.includes("lay flat")
          || AIR_DRY_METHODS.includes(i.preferred_dry_method);
      });
      setShrinkItems(risky);
    }).catch(() => {});
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

      const shrinkContext = shrinkItems.length > 0
        ? `\n\nThe user has these shrink-prone garments in their closet: ${shrinkItems.map(g => `${g.name}${g.fabric_composition ? ` (${g.fabric_composition})` : ""}${g.preferred_dry_method ? `, prefers ${g.preferred_dry_method.replace(/_/g, " ")}` : ""}`).join("; ")}. If the question is about drying, laundry settings, or any of these specific items, proactively warn about shrinkage risks and recommend air drying or low heat.`
        : "";

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a supportive laundry assistant. Answer this question in a calm, clear, and helpful way. Avoid judgment or urgency. Keep it simple and actionable.${newGarmentContext}${shrinkContext}\n\nQuestion: ${q}`,
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
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="flex items-center justify-center h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
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
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="flex items-center justify-center h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <Sparkles className="w-5 h-5 text-primary flex-shrink-0" />
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

          {/* Proactive shrink-risk alert */}
          {shrinkItems.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}>
              <div className="rounded-2xl border border-orange-300 bg-orange-50 p-4">
                <button
                  className="w-full flex items-start justify-between gap-3 text-left"
                  onClick={() => setShrinkExpanded(e => !e)}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-semibold text-orange-800">
                        {shrinkItems.length} garment{shrinkItems.length > 1 ? "s" : ""} at risk of shrinking in the dryer
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {shrinkItems.slice(0, 4).map(g => (
                          <Badge key={g.id} className="bg-orange-100 text-orange-800 border border-orange-300 text-xs">⚠️ {g.name}</Badge>
                        ))}
                        {shrinkItems.length > 4 && <Badge className="bg-orange-100 text-orange-800 border border-orange-300 text-xs">+{shrinkItems.length - 4} more</Badge>}
                      </div>
                    </div>
                  </div>
                  {shrinkExpanded
                    ? <ChevronUp className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                    : <ChevronDown className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />}
                </button>
                <AnimatePresence>
                  {shrinkExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-1.5 pt-3 border-t border-orange-200">
                        {[
                          "Wool, cotton, silk, and linen can shrink significantly in a hot dryer.",
                          "Always use the lowest heat setting — or skip the dryer entirely.",
                          "Lay wool and cashmere flat to dry to preserve their shape.",
                          "Remove shrink-prone items from a mixed load before starting the dryer.",
                        ].map((tip, i) => (
                          <p key={i} className="text-xs text-orange-700 flex items-start gap-1.5">
                            <span className="font-bold mt-0.5">•</span> {tip}
                          </p>
                        ))}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 rounded-xl border-orange-300 text-orange-800 bg-orange-100 hover:bg-orange-200 text-xs"
                          onClick={() => { setShrinkExpanded(false); handleAsk(`I have these shrink-prone garments: ${shrinkItems.map(g => g.name).join(", ")}. Give me specific drying instructions for each.`); }}
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Get drying plan for my closet
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full rounded-xl border-orange-300 text-orange-800 bg-orange-100 hover:bg-orange-200 text-xs"
                          onClick={() => { setShrinkExpanded(false); handleAsk("How can I unshrink clothes that have already shrunk in the dryer?"); }}
                        >
                          <Sparkles className="w-3.5 h-3.5 mr-1.5" /> How to unshrink clothes?
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