import React from "react";
import { Card } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { motion } from "framer-motion";

export default function RefundPolicy() {
  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Refund Policy</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Last updated: March 15, 2026
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-6 space-y-4"
        >
          <Card className="p-6 border-0 shadow-sm">
            <div className="prose prose-sm max-w-none">
              <h2 className="text-lg font-semibold mb-3">Premium Subscription Refunds</h2>
              <p className="text-sm text-muted-foreground mb-4">
                LaundryFlow Pro Premium subscriptions may be eligible for refunds under certain conditions.
              </p>

              <h2 className="text-lg font-semibold mb-3 mt-6">Refund Eligibility</h2>
              <p className="text-sm text-muted-foreground mb-2">
                You may request a refund if:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>You were charged in error</li>
                <li>The service was unavailable for an extended period</li>
                <li>You request within 7 days of initial Premium purchase</li>
                <li>You experienced technical issues that prevented use of Premium features</li>
              </ul>

              <h2 className="text-lg font-semibold mb-3 mt-6">Refund Process</h2>
              <p className="text-sm text-muted-foreground mb-2">
                To request a refund:
              </p>
              <ol className="text-sm text-muted-foreground list-decimal pl-5 space-y-1">
                <li>Email us at gutman.samuel1998@gmail.com</li>
                <li>Include your account email and reason for refund</li>
                <li>We will review your request within 5 business days</li>
                <li>Approved refunds will be processed within 7-10 business days</li>
              </ol>

              <h2 className="text-lg font-semibold mb-3 mt-6">Non-Refundable Items</h2>
              <p className="text-sm text-muted-foreground mb-2">
                The following are not eligible for refunds:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Subscription renewals (cancel before renewal date to avoid charges)</li>
                <li>Partial subscription periods after 7 days</li>
                <li>Change of mind after using Premium features for more than 7 days</li>
              </ul>

              <h2 className="text-lg font-semibold mb-3 mt-6">Cancellation Policy</h2>
              <p className="text-sm text-muted-foreground mb-4">
                You may cancel your Premium subscription at any time. Cancellation takes effect at the end of your current billing period. No refunds are provided for the unused portion of a billing period.
              </p>

              <h2 className="text-lg font-semibold mb-3 mt-6">Contact for Refund Requests</h2>
              <p className="text-sm text-muted-foreground">
                Email:{" "}
                <a href="mailto:gutman.samuel1998@gmail.com" className="text-primary hover:underline">
                  gutman.samuel1998@gmail.com
                </a>
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Include "Refund Request" in the subject line and provide your account details.
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}