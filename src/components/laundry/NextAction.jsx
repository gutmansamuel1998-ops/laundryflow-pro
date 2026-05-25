import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, RefreshCw, FolderOpen } from "lucide-react";
import { motion } from "framer-motion";

const actionConfig = {
  start_wash: {
    message: "Ready to start washing",
    action: "Start Washer",
    icon: Play,
    color: "from-blue-500/10 to-blue-600/5",
  },
  transfer: {
    message: "Time to move clothes to the dryer",
    action: "Transfer to Dryer",
    icon: RefreshCw,
    color: "from-amber-500/10 to-amber-600/5",
  },
  remove: {
    message: "Your clothes are done drying",
    action: "Remove & Finish",
    icon: FolderOpen,
    color: "from-emerald-500/10 to-emerald-600/5",
  },
  recover: {
    message: "A load may need attention — no rush",
    action: "Take a Look",
    icon: RefreshCw,
    color: "from-orange-500/10 to-orange-600/5",
  },
};

function getNextAction(load) {
  if (!load) return null;
  switch (load.current_state) {
    case "load_created": return "start_wash";
    case "wash_finished": return "transfer";
    case "dry_finished": return "remove";
    case "abandoned": return "recover";
    default: return null;
  }
}

export default function NextAction({ load, onAction }) {
  const actionKey = getNextAction(load);
  if (!actionKey) return null;

  const config = actionConfig[actionKey];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className={`p-5 border-0 shadow-sm bg-gradient-to-br ${config.color}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center" aria-hidden="true">
              <Icon className="w-4 h-4 text-foreground" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Next Step</p>
              <p className="font-medium text-[15px]">{config.message}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => onAction(load, actionKey)}
            className="rounded-xl shadow-sm"
          >
            {config.action}
            <ArrowRight className="w-3.5 h-3.5 ml-1.5" aria-hidden="true" />
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}