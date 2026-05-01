import { Lock, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

/**
 * Drop-in component that renders a premium lock overlay for AI features.
 * Use as a wrapper or as a standalone locked state.
 *
 * Props:
 *   featureName  – short name of the locked feature (e.g. "AI Load Suggestion")
 *   compact      – if true, renders a small inline lock badge instead of a full card
 *   className    – extra classes for the container
 */
export default function AIPremiumLock({ featureName = "This AI feature", compact = false, className = "" }) {
  const navigate = useNavigate();

  if (compact) {
    return (
      <button
        onClick={() => navigate("/Premium")}
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold hover:bg-amber-200 transition-colors ${className}`}
        aria-label={`${featureName} requires Premium`}
      >
        <Lock className="w-3 h-3" />
        Premium
      </button>
    );
  }

  return (
    <div className={`flex flex-col items-center text-center gap-4 py-8 px-4 ${className}`}>
      <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center">
        <Lock className="w-7 h-7 text-amber-600" />
      </div>
      <div>
        <h3 className="font-semibold text-base mb-1">{featureName}</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          This AI-powered feature is available to Premium members only.
        </p>
      </div>
      <button
        onClick={() => navigate("/Premium")}
        className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm"
      >
        <Sparkles className="w-4 h-4" />
        Upgrade to Premium
      </button>
    </div>
  );
}