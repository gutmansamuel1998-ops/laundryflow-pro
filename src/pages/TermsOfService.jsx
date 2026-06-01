import React from "react";
import { Card } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { motion } from "framer-motion";

export default function TermsOfService() {
  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
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
              <h2 className="text-lg font-semibold mb-3">Agreement to Terms</h2>
              <p className="text-sm text-muted-foreground mb-4">
                By accessing and using LaundryFlow Pro, you agree to be bound by these Terms of Service. If you do not agree, please discontinue use of the app.
              </p>

              <h2 className="text-lg font-semibold mb-3 mt-6">Use of Service</h2>
              <p className="text-sm text-muted-foreground mb-2">
                LaundryFlow Pro provides laundry management tools and guidance. You agree to:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Use the service for personal, non-commercial purposes</li>
                <li>Provide accurate information</li>
                <li>Maintain the security of your account</li>
                <li>Not misuse or attempt to disrupt the service</li>
              </ul>

              <h2 className="text-lg font-semibold mb-3 mt-6">Premium Subscription</h2>
              <p className="text-sm text-muted-foreground mb-4">
                LaundryFlow Pro offers optional Premium features. Premium subscriptions are billed according to the plan you select. You may cancel at any time through your account settings.
              </p>

              <h2 className="text-lg font-semibold mb-3 mt-6">Intellectual Property</h2>
              <p className="text-sm text-muted-foreground mb-4">
                All content, features, and functionality of LaundryFlow Pro are owned by LifeHarbor Tech and protected by copyright and trademark laws.
              </p>

              <h2 className="text-lg font-semibold mb-3 mt-6">Limitation of Liability</h2>
              <p className="text-sm text-muted-foreground mb-4">
                LaundryFlow Pro is provided "as is" without warranties. LifeHarbor Tech is not liable for any damages arising from use of the service, including laundry-related outcomes.
              </p>

              <h2 className="text-lg font-semibold mb-3 mt-6">Termination</h2>
              <p className="text-sm text-muted-foreground mb-4">
                We reserve the right to suspend or terminate access to the service for violations of these terms or for any other reason at our discretion.
              </p>

              <h2 className="text-lg font-semibold mb-3 mt-6">Changes to Terms</h2>
              <p className="text-sm text-muted-foreground mb-4">
                We may update these Terms of Service from time to time. Continued use of the service constitutes acceptance of updated terms.
              </p>

              <h2 className="text-lg font-semibold mb-3 mt-6">Contact Information</h2>
              <p className="text-sm text-muted-foreground">
                For questions about these terms, contact:{" "}
                <a href="mailto:gutman.samuel1998@gmail.com" className="text-primary hover:underline">
                  gutman.samuel1998@gmail.com
                </a>
              </p>
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}