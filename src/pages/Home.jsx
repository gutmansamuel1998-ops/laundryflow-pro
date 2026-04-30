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
import LowSupplyAlert from "@/components/laundry/LowSupplyAlert";
import EnvironmentalAnchorPrompt from "@/components/laundry/EnvironmentalAnchorPrompt";
import FrictionAlert from "@/components/laundry/FrictionAlert";
import ShoppingList from "@/components/laundry/ShoppingList";
import SmartSupplySuggestion from "@/components/laundry/SmartSupplySuggestion";
import SmartSchedule from "@/components/laundry/SmartSchedule";
import OptimalTimePrompt from "@/components/laundry/OptimalTimePrompt";
import { AnimatePresence, motion } from "framer-motion";
import WearingTodaySection from "@/components/home/WearingTodaySection";
import LaundryBasketSection from "@/components/home/LaundryBasketSection";
import IroningQueueSection from "@/components/home/IroningQueueSection";

export default function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showBuilder, setShowBuilder] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(null);
  const [user, setUser] = useState(null);
  const [forgottenThreshold, setForgottenThreshold] = useState(30);
  const [environmentalAnchors, setEnvironmentalAnchors] = useState([]);
  const [preselectedLoadType, setPreselectedLoadType] = useState(null);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      setOnboardingDone(u?.onboarding_done === true);
      setForgottenThreshold(u?.forgotten_load_threshold ?? 30);
      setEnvironmentalAnchors(u?.environmental_anchors || []);
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
      environmental_anchors: preferences.environmental_anchors || [],
    });
    setOnboardingDone(true);
    if (startLoad) setShowBuilder(true);
  };

  const handleAnchorTrigger = (anchor) => {
    setPreselectedLoadType(anchor.load_type);
    setShowBuilder(true);
  };

  const handleAction = (load, actionKey) => {
    navigate(createPageUrl("LaundryMode") + `?loadId=${load.id}`);
  };

  if (onboardingDone === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" role="status" aria-label="Loading your profile" />
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
    <div className="min-h-screen pb-28">
      <div className="max-w-lg mx-auto px-6 pt-12">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <p className="text-sm text-muted-foreground mb-1">
            {user?.full_name ? `Hi, ${user.full_name.split(" ")[0]}` : "Hi there"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {activeLoads.length > 0 ? "Your Laundry" : "LaundryFlow"}
          </h1>
        </motion.div>

        {/* Live region: announces load count changes and builder state */}
        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {showBuilder ? "Load builder opened." : isLoading ? "Loading your laundry loads." : activeLoads.length === 0 ? "No active loads." : `You have ${activeLoads.length} active load${activeLoads.length !== 1 ? 's' : ''}.`}
        </div>

        <AnimatePresence mode="wait">
          {showBuilder ? (
            <motion.div key="builder" className="mt-8" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <LoadBuilder
                onCreateLoad={(data) => { setPreselectedLoadType(null); createMutation.mutate(data); }}
                onCancel={() => { setPreselectedLoadType(null); setShowBuilder(false); }}
                isFirstLoad={activeLoads.length === 0}
                preselectedType={preselectedLoadType}
              />
            </motion.div>
          ) : (
            <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-busy={isLoading}>
              {isLoading ? (
                <div className="flex justify-center py-20">
                  <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" role="status" aria-label="Loading your laundry loads" />
                </div>
              ) : activeLoads.length === 0 ? (
                <div>
                  <WearingTodaySection />
                  <LaundryBasketSection />
                  <IroningQueueSection />
                  <OptimalTimePrompt />
                  <SmartSchedule />
                  <ReadinessPrompt user={user} />
                  <SmartSupplySuggestion />
                  <ShoppingList />
                  <LowSupplyAlert />
                  <EnvironmentalAnchorPrompt anchors={environmentalAnchors} onTrigger={handleAnchorTrigger} />
                  <EmptyState onStartLoad={() => setShowBuilder(true)} />
                </div>
              ) : (
                <div className="mt-10 space-y-6">
                  <WearingTodaySection />
                  <LaundryBasketSection />
                  <IroningQueueSection />
                  <OptimalTimePrompt />
                  <SmartSchedule />
                  <SmartSupplySuggestion />
                  <ShoppingList />
                  <LowSupplyAlert />
                  <EnvironmentalAnchorPrompt anchors={environmentalAnchors} onTrigger={handleAnchorTrigger} />
                  <FrictionAlert loads={activeLoads} />
                  <ForgottenLoadAlert loads={activeLoads} thresholdMinutes={forgottenThreshold} />
                  {actionableLoad && (
                    <NextAction load={actionableLoad} onAction={handleAction} />
                  )}

                  <section aria-label="Active laundry loads" aria-live="polite" aria-atomic="false" className="pt-4">
                   <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-5">
                     Active Loads
                   </h2>
                   <div className="space-y-5" role="list" aria-label={`${activeLoads.length} active load${activeLoads.length !== 1 ? 's' : ''}`}>
                      {activeLoads.map((load) => (
                        <div key={load.id} role="listitem">
                          <LoadCard
                            load={load}
                            onClick={(l) => navigate(createPageUrl("LaundryMode") + `?loadId=${l.id}`)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>

                  <motion.div
                   className="pt-8"
                   initial={{ opacity: 0 }}
                   animate={{ opacity: 1 }}
                   transition={{ delay: 0.2 }}
                  >
                   <button
                     onClick={() => setShowBuilder(true)}
                     aria-label="Start another laundry load"
                     className="w-full py-5 rounded-2xl border-2 border-dashed border-border text-muted-foreground text-sm font-medium hover:border-primary/30 hover:text-foreground transition-all"
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