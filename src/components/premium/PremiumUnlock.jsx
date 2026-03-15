import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PremiumCheckout from "./PremiumCheckout";

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
          <PremiumCheckout />

          <Button
            variant="ghost"
            size="lg"
            onClick={() => navigate(createPageUrl("Home"))}
            className="w-full rounded-2xl mt-3"
          >
            Maybe Later
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-6">
            Your core laundry features remain fully available
          </p>
        </motion.div>
      </div>
    </div>
  );
}