import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import EmptyState from "@/components/laundry/EmptyState";
import LoadCard from "@/components/laundry/LoadCard";
import NextAction from "@/components/laundry/NextAction";
import LoadBuilder from "@/components/laundry/LoadBuilder";
import OnboardingFlow from "@/components/onboarding/OnboardingFlow";
import ForgottenLoadAlert from "@/components/laundry/ForgottenLoadAlert";
import ReadinessPrompt from "@/components/laundry/ReadinessPrompt";
import { AnimatePresence, motion } from "framer-motion";

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(null);
  const [user, setUser] = useState(null);
  const [forgottenThreshold, setForgottenThreshold] = useState(30);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      setOnboardingDone(u?.onboarding_done === true);
      setForgottenThreshold(u?.forgotten_load_threshold ?? 30);
    }).catch(() => setOnboardingDone(true));
  }, []);

  const { data: activeLoads = [], isLoading } = useQuery({
    queryKey: ["active-loads"],
    queryFn: () => base44.entities.Load.filter({ status: "active" }, "-created_date", 3),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Load.create(data),
    onSuccess: (newLoad) => {
      queryClient.invalidateQueries({ queryKey: ["active-loads"] });
      setShowBuilder(false);
      navigate(createPageUrl("LaundryMode") + `?loadId=${newLoad.id}`);
    },
  });

  const handleOnboardingComplete = async (preferences, startLoad = false) => {
    await base44.auth.updateMe({
      onboarding_done: true,
      laundry_environment: preferences.environment,
      anchor_days: preferences.anchor_days,
      anchor_times: preferences.anchor_times,
    });
    setOnboardingDone(true);
    if (startLoad) setShowBuilder(true);
  };

  const handleAction = (load, actionKey) => {
    navigate(createPageUrl("LaundryMode") + `?loadId=${load.id}`);
  };

  if (onboardingDone === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!onboardingDone) {
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  // Find the most actionable load
  const actionableLoad = activeLoads.find(l =>
    ["load_created", "wash_finished", "dry_finished", "abandoned"].includes(l.current_state)
  ) || activeLoads[0];

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm text-muted-foreground mb-1">
            {user?.full_name ? `Hi, ${user.full_name.split(" ")[0]}` : "Hi there"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {activeLoads.length > 0 ? "Your Laundry" : "LaundryFlow"}
          </h1>
        </motion.div>

        <AnimatePresence mode="wait">
          {showBuilder ? (
            <motion.div key="builder" className="mt-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadBuilder
                onCreateLoad={(data) => createMutation.mutate(data)}
                onCancel={() => setShowBuilder(false)}
                isFirstLoad={activeLoads.length === 0}
              />
            </motion.div>
          ) : (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                </div>
              ) : activeLoads.length === 0 ? (
                <div className="mt-6 space-y-4">
                  <ReadinessPrompt user={user} activeLoads={activeLoads} onStartLoad={() => setShowBuilder(true)} />
                  <EmptyState onStartLoad={() => setShowBuilder(true)} />
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  <ReadinessPrompt user={user} activeLoads={activeLoads} onStartLoad={() => setShowBuilder(true)} />
                  <ForgottenLoadAlert loads={activeLoads} thresholdMinutes={forgottenThreshold} />
                  {actionableLoad && (
                    <NextAction load={actionableLoad} onAction={handleAction} />
                  )}

                  <div>
                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
                      Active Loads
                    </h2>
                    <div className="space-y-3">
                      {activeLoads.map((load) => (
                        <LoadCard
                          key={load.id}
                          load={load}
                          onClick={(l) => navigate(createPageUrl("LaundryMode") + `?loadId=${l.id}`)}
                        />
                      ))}
                    </div>
                  </div>

                  <motion.div
                    className="pt-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.2 }}
                  >
                    <button
                      onClick={() => setShowBuilder(true)}
                      className="w-full py-4 rounded-2xl border-2 border-dashed border-border text-muted-foreground text-sm font-medium hover:border-primary/30 hover:text-foreground transition-all"
                    >
                      + Start another load
                    </button>
                  </motion.div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}