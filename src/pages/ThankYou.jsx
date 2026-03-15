import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";

export default function ThankYou() {
  const navigate = useNavigate();

  useEffect(() => {
    // Fire confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center px-5 pb-24">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full"
      >
        <Card className="p-8 text-center border-0 shadow-xl">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
            className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-12 h-12 text-primary" />
          </motion.div>

          <h1 className="text-2xl font-bold mb-3">Payment Successful!</h1>
          <p className="text-muted-foreground mb-6">
            Thank you for upgrading to LaundryFlow Pro Premium. Your account has been activated.
          </p>

          <div className="bg-primary/5 rounded-xl p-4 mb-6">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-primary">
              <Sparkles className="w-4 h-4" />
              Premium Features Unlocked
            </div>
          </div>

          <div className="space-y-2">
            <Button
              onClick={() => navigate(createPageUrl("Assistant"))}
              className="w-full rounded-xl"
            >
              Explore Premium Features
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate(createPageUrl("Home"))}
              className="w-full rounded-xl"
            >
              Go to Dashboard
            </Button>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}