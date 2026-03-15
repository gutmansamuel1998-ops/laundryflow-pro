import React from "react";
import { Card } from "@/components/ui/card";
import { Building2, Mail, Sparkles, Info } from "lucide-react";
import { motion } from "framer-motion";

export default function BusinessInfo() {
  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-semibold tracking-tight">Business Info</h1>
          <p className="text-sm text-muted-foreground mt-1">
            About ND Life Harbor
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-6 space-y-4"
        >
          {/* Company Info */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Company
              </h2>
            </div>
            <Card className="p-5 border-0 shadow-sm">
              <h3 className="text-xl font-semibold mb-2">ND Life Harbor</h3>
              <p className="text-sm text-muted-foreground">
                Provider of LaundryFlow Pro — helping you manage laundry with calm, intelligent guidance
              </p>
            </Card>
          </section>

          {/* Contact Info */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Contact
              </h2>
            </div>
            <Card className="p-5 border-0 shadow-sm space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <a
                  href="mailto:gutman.samuel1998@gmail.com"
                  className="text-sm text-primary hover:underline"
                >
                  gutman.samuel1998@gmail.com
                </a>
              </div>
            </Card>
          </section>

          {/* About LaundryFlow Pro */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                About LaundryFlow Pro
              </h2>
            </div>
            <Card className="p-5 border-0 shadow-sm">
              <p className="text-sm text-foreground leading-relaxed">
                LaundryFlow Pro is designed to make laundry simpler and less stressful. 
                We provide calm, intelligent guidance to help you manage loads, avoid 
                friction, and build sustainable routines.
              </p>
            </Card>
          </section>

          {/* Additional Info */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                Privacy & Data
              </h2>
            </div>
            <Card className="p-5 border-0 shadow-sm">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your laundry data stays private. We don't sell user data, and we're 
                committed to transparency in how we handle your information.
              </p>
            </Card>
          </section>
        </motion.div>
      </div>
    </div>
  );
}