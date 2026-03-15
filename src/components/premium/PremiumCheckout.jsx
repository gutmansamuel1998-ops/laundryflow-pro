import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { base44 } from "@/api/base44Client";
import { Sparkles, Loader2 } from "lucide-react";

export default function PremiumCheckout() {
  const [loading, setLoading] = useState(false);

  const handleCheckout = async () => {
    try {
      setLoading(true);

      const response = await base44.functions.invoke("createCheckout", {
        items: [
          {
            name: "LaundryFlow Pro Premium - Monthly",
            quantity: 1,
            price: "9.99"
          }
        ]
      });

      if (response.data.redirectUrl) {
        window.location.href = response.data.redirectUrl;
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("Failed to start checkout. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 border-0 shadow-lg">
      <div className="text-center mb-6">
        <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-8 h-8 text-primary" />
        </div>
        <h3 className="text-2xl font-bold mb-2">LaundryFlow Pro Premium</h3>
        <div className="text-4xl font-bold text-primary mb-1">$9.99</div>
        <p className="text-sm text-muted-foreground">per month</p>
      </div>

      <div className="space-y-3 mb-6">
        <div className="flex items-start gap-2 text-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
          <span>AI Laundry Assistant</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
          <span>Tag Scanner & Care Instructions</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
          <span>Stain Removal Guidance</span>
        </div>
        <div className="flex items-start gap-2 text-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5" />
          <span>Personalized Laundry Routines</span>
        </div>
      </div>

      <Button
        onClick={handleCheckout}
        disabled={loading}
        className="w-full rounded-xl h-12 text-base"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Processing...
          </>
        ) : (
          <>
            <Sparkles className="w-5 h-5 mr-2" />
            Upgrade to Premium
          </>
        )}
      </Button>

      <p className="text-xs text-center text-muted-foreground mt-4">
        Secure payment powered by Base44 Payments
      </p>
    </Card>
  );
}