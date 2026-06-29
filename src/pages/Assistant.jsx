import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Image, Droplet, Calendar, Lock } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import PremiumUnlock from "@/components/premium/PremiumUnlock";

const PREMIUM_FEATURES = [
  {
    id: "bubbles",
    icon: Sparkles,
    title: "Bubbles 💬",
    description: "Your warm laundry companion & accountability buddy",
    route: "Bubbles"
  },
  {
    id: "tag-scanner",
    icon: Image,
    title: "Tag Scanner",
    description: "Snap a photo of care tags for instant guidance",
    route: "TagScanner"
  },
  {
    id: "stain-guidance",
    icon: Droplet,
    title: "Stain Guidance",
    description: "Get treatment steps for any stain type",
    route: "StainGuidance"
  },
  {
    id: "routine-builder",
    icon: Calendar,
    title: "Routine Builder",
    description: "Create a personalized weekly laundry plan",
    route: "RoutineBuilder"
  }
];

export default function Assistant() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const hasPremium = user?.has_premium === true;

  const handleFeatureClick = (feature) => {
    if (!hasPremium) return;
    navigate(createPageUrl(feature.route));
  };

  if (!hasPremium) {
    return <PremiumUnlock />;
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-2xl font-semibold tracking-tight">🚿 Help & Tools</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Premium assistants & laundry tools
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-6 space-y-3"
        >
          {PREMIUM_FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.id}
                onClick={() => handleFeatureClick(feature)}
                className="p-5 border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}