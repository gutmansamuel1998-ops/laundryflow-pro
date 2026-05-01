import React from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Sparkles, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { usePremium } from "@/hooks/usePremium";

export default function OptimalTimePrompt() {
  const { isPremium } = usePremium();
  const { data, isLoading } = useQuery({
    queryKey: ["optimal-time"],
    queryFn: () => base44.functions.invoke("suggestOptimalTime", {}),
    refetchInterval: 300000,
    enabled: isPremium === true, // Only fetch for premium users
  });

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = date - now;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);

    if (diffMins < 60) {
      return `in ${diffMins} minutes`;
    } else if (diffHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } else {
      return date.toLocaleString('en-US', { 
        weekday: 'short', 
        hour: 'numeric', 
        minute: '2-digit', 
        hour12: true 
      });
    }
  };

  if (isLoading || !data?.data) return null;
  
  const result = data.data;
  
  if (result.has_active_loads || !result.suggestions || result.suggestions.length === 0) {
    return null;
  }

  const topSuggestion = result.suggestions[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <Card className="p-4 border-0 shadow-sm bg-gradient-to-br from-violet-50/50 to-purple-50/50">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-xl bg-violet-100">
            <Sparkles className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-sm">Optimal Time Suggestion</h3>
              <Badge variant="secondary" className="text-xs">
                {result.facility_type === 'shared' ? 'Shared' : 'Home'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-violet-700 font-medium mb-1.5">
              <Clock className="w-3.5 h-3.5" />
              <span className="text-sm">{formatTime(topSuggestion.time)}</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {topSuggestion.reason}
            </p>
            {result.suggestions.length > 1 && (
              <div className="mt-3 pt-3 border-t border-border/50">
                <p className="text-xs text-muted-foreground mb-2">Other good times:</p>
                <div className="flex gap-2 flex-wrap">
                  {result.suggestions.slice(1).map((suggestion, idx) => (
                    <Badge key={idx} variant="outline" className="text-xs">
                      {formatTime(suggestion.time)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}