import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, Calendar, ScanLine, ShoppingCart, Wind, Shirt, Droplets, Zap, BarChart2, Brain, CalendarClock, Lock, Users, ClipboardList } from "lucide-react";
import { usePremium } from "@/hooks/usePremium";
import { useLaundryProfile } from "@/hooks/useLaundryProfile";

const FREE_LINKS = [
  { page: "FabricCareLibrary", label: "Fabric Care Library", icon: BookOpen,     color: "bg-blue-50 text-blue-600" },
  { page: "LaundryCalendar",   label: "Laundry Calendar",   icon: Calendar,      color: "bg-green-50 text-green-600" },
  { page: "ShoppingList",      label: "Shopping List",      icon: ShoppingCart,  color: "bg-amber-50 text-amber-600" },
  { page: "AirDryTracker",     label: "Air Dry Tracker",    icon: Wind,          color: "bg-cyan-50 text-cyan-600" },
  { page: "IroningDashboard",  label: "Ironing",            icon: Shirt,         color: "bg-orange-50 text-orange-600" },
];

const PREMIUM_LINKS = [
  { page: "StainGuidance",    label: "Stain Assistant",     icon: Droplets,      color: "bg-rose-50 text-rose-600" },
  { page: "TagScanner",       label: "AI Tag Scanner",      icon: ScanLine,      color: "bg-purple-50 text-purple-600" },
  { page: "SmartWash",        label: "Smart Wash",          icon: Zap,           color: "bg-violet-50 text-violet-600" },
  { page: "SmartPredictions", label: "Smart Predictions",   icon: Brain,         color: "bg-indigo-50 text-indigo-600" },
  { page: "SmartPlanner",     label: "Smart Planner",       icon: CalendarClock, color: "bg-sky-50 text-sky-600" },
  { page: "SmartScheduler",   label: "Smart Scheduler",     icon: CalendarClock, color: "bg-teal-50 text-teal-600" },
  { page: "SupplyAnalytics",  label: "Supply Analytics",    icon: BarChart2,     color: "bg-emerald-50 text-emerald-600" },
  { page: "SupplyDashboard",  label: "Supply Dashboard",    icon: BarChart2,     color: "bg-lime-50 text-lime-600" },
  { page: "RoutineBuilder",   label: "Routine Builder",     icon: CalendarClock, color: "bg-pink-50 text-pink-600" },
];

export default function QuickLinksSection() {
  const { isPremium } = usePremium();
  const { isFamily, showDormUtilities } = useLaundryProfile();
  const navigate = useNavigate();

  return (
    <section className="mt-8 mb-4">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">More Features</h2>
      <div className="grid grid-cols-2 gap-3">
        {isFamily && (
          <Link
            to={createPageUrl("HouseholdManagement")}
            className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 min-h-[56px] hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-violet-50 text-violet-600" aria-hidden="true">
              <Users className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-foreground leading-tight">Household</span>
          </Link>
        )}
        {showDormUtilities && (
          <Link
            to={createPageUrl("DormUtilities")}
            className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 min-h-[56px] hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-teal-50 text-teal-600" aria-hidden="true">
              <ClipboardList className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-foreground leading-tight">Dorm Utilities</span>
          </Link>
        )}
        {FREE_LINKS.map(({ page, label, icon: Icon, color }) => (
          <Link
            key={page}
            to={createPageUrl(page)}
            className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 min-h-[56px] hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`} aria-hidden="true">
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-foreground leading-tight">{label}</span>
          </Link>
        ))}

        {PREMIUM_LINKS.map(({ page, label, icon: Icon, color }) => {
          const canAccess = isPremium === true;
          return canAccess ? (
            <Link
              key={page}
              to={createPageUrl(page)}
              className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 min-h-[56px] hover:border-primary/30 hover:shadow-sm transition-all"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`} aria-hidden="true">
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-foreground leading-tight">{label}</span>
            </Link>
          ) : (
            <button
              key={page}
              onClick={() => navigate(createPageUrl("Premium"))}
              aria-label={`${label} — Pro feature, upgrade to unlock`}
              className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 min-h-[56px] hover:border-primary/30 hover:shadow-sm transition-all opacity-60 text-left"
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`} aria-hidden="true">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-foreground leading-tight">{label}</span>
                <span className="flex items-center gap-1 text-xs text-foreground/60 mt-0.5">
                  <Lock className="w-2.5 h-2.5" aria-hidden="true" /> Pro
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}