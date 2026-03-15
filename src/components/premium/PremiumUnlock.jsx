import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const PREMIUM_BENEFITS = [
  "Ask laundry questions in plain language",
  "Scan care tags for instant guidance",
  "Get stain removal treatment steps",
  "Build a personalized laundry routine"
];

export default function PremiumUnlock() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen pb-24 bg-gradient-to-b from-background to-secondary/20">
      <div className="max-w-lg mx-auto px-5 pt-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            LaundryFlow Pro Premium
          </h1>
          <p className="text-muted-foreground mt-2">
            AI help for laundry questions, stains, and clothing tags
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="p-6 border-0 shadow-lg mb-6">
            <div className="space-y-4">
              {PREMIUM_BENEFITS.map((benefit, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Check className="w-3 h-3 text-primary" />
                  </div>
                  <p className="text-sm text-foreground">{benefit}</p>
                </div>
              ))}
            </div>
          </Card>

          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full rounded-2xl py-6 shadow-lg shadow-primary/20"
            >
              Start Premium
            </Button>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => navigate(createPageUrl("Home"))}
              className="w-full rounded-2xl"
            >
              Maybe Later
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Your core laundry features remain fully available
          </p>
        </motion.div>
      </div>
    </div>
  );
}