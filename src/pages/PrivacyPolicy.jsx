import React from "react";
import { Card } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { motion } from "framer-motion";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-2xl mx-auto px-5 pt-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-6 h-6 text-primary" />
            <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
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
              <h2 className="text-lg font-semibold mb-3">Introduction</h2>
              <p className="text-sm text-muted-foreground mb-4">
                LifeHarbor Tech ("we", "us", or "our") operates LaundryFlow Pro. This Privacy Policy explains how we collect, use, and protect your personal information.
              </p>

              <h2 className="text-lg font-semibold mb-3 mt-6">Information We Collect</h2>
              <p className="text-sm text-muted-foreground mb-2">
                We collect information you provide directly to us, including:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Account information (email, name)</li>
                <li>Laundry preferences and settings</li>
                <li>Load tracking data</li>
                <li>Premium feature usage (if applicable)</li>
              </ul>

              <h2 className="text-lg font-semibold mb-3 mt-6">How We Use Your Information</h2>
              <p className="text-sm text-muted-foreground mb-2">
                We use your information to:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Provide and improve LaundryFlow Pro services</li>
                <li>Personalize your laundry experience</li>
                <li>Send notifications and reminders</li>
                <li>Provide customer support</li>
                <li>Process Premium subscriptions</li>
              </ul>

              <h2 className="text-lg font-semibold mb-3 mt-6">Data Storage and Security</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Your data is stored securely and encrypted. We implement industry-standard security measures to protect your information from unauthorized access.
              </p>

              <h2 className="text-lg font-semibold mb-3 mt-6">Data Sharing</h2>
              <p className="text-sm text-muted-foreground mb-4">
                We do not sell your personal data. We may share information only when required by law or to provide core app functionality (e.g., payment processing for Premium subscriptions).
              </p>

              <h2 className="text-lg font-semibold mb-3 mt-6">Your Rights</h2>
              <p className="text-sm text-muted-foreground mb-2">
                You have the right to:
              </p>
              <ul className="text-sm text-muted-foreground list-disc pl-5 space-y-1">
                <li>Access your personal data</li>
                <li>Request data deletion</li>
                <li>Update your information</li>
                <li>Opt out of notifications</li>
              </ul>

              <h2 className="text-lg font-semibold mb-3 mt-6">Contact Us</h2>
              <p className="text-sm text-muted-foreground">
                For privacy-related questions, contact us at:{" "}
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