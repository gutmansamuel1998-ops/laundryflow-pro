import React from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { BookOpen, Calendar, ScanLine, ShoppingCart, Wind, Shirt, Droplets } from "lucide-react";

const FREE_LINKS = [
  { page: "FabricCareLibrary", label: "Fabric Care Library", icon: BookOpen,     color: "bg-blue-50 text-blue-600" },
  { page: "LaundryCalendar",   label: "Laundry Calendar",   icon: Calendar,      color: "bg-green-50 text-green-600" },
  { page: "TagScanner",        label: "Tag Scanner",        icon: ScanLine,      color: "bg-purple-50 text-purple-600" },
  { page: "StainGuidance",     label: "Stain Guidance",     icon: Droplets,      color: "bg-red-50 text-red-500" },
  { page: "ShoppingList",      label: "Shopping List",      icon: ShoppingCart,  color: "bg-amber-50 text-amber-600" },
  { page: "AirDryTracker",     label: "Air Dry Tracker",    icon: Wind,          color: "bg-cyan-50 text-cyan-600" },
  { page: "IroningDashboard",  label: "Ironing",            icon: Shirt,         color: "bg-orange-50 text-orange-600" },
];

export default function QuickLinksSection() {
  return (
    <section className="mt-8 mb-4">
      <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">More Features</h2>
      <div className="grid grid-cols-2 gap-3">
        {FREE_LINKS.map(({ page, label, icon: Icon, color }) => (
          <Link
            key={page}
            to={createPageUrl(page)}
            className="flex items-center gap-3 bg-card border border-border rounded-2xl px-4 py-3.5 hover:border-primary/30 hover:shadow-sm transition-all"
          >
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-sm font-medium text-foreground leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}