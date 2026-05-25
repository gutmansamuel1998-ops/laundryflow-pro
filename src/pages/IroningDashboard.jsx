import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Plus, Shirt, ChevronRight, CheckCircle2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";

const categoryEmoji = {
  tops: "👕", bottoms: "👖", outerwear: "🧥", underwear: "🩲",
  activewear: "🩳", delicates: "🩱", bedding: "🛏️", towels: "🏖️", other: "👔",
};

const heatColor = {
  no_iron: "text-blue-500",
  low: "text-yellow-500",
  medium: "text-orange-500",
  high: "text-red-500",
};

function encouragingMessage(count) {
  if (count === 0) return { headline: "All ironed up!", sub: "Nothing in the queue — enjoy your fresh wardrobe." };
  if (count === 1) return { headline: "Just 1 item waiting.", sub: "Quick win — it'll only take a minute!" };
  if (count <= 3) return { headline: `${count} items ready.`, sub: "Want to knock them out now?" };
  return { headline: `${count} items in the queue.`, sub: "Pick a good podcast and let's get started." };
}

export default function IroningDashboard() {
  const navigate = useNavigate();

  const { data: allItems = [], isLoading } = useQuery({
    queryKey: ["ironing-dashboard-items"],
    queryFn: () => base44.entities.ClothingItem.list(),
  });

  const needsIroning = allItems.filter((i) => i.needs_ironing_now || i.requires_ironing);
  const recentlyIroned = allItems
    .filter((i) => i.last_ironed)
    .sort((a, b) => (a.last_ironed < b.last_ironed ? 1 : -1))
    .slice(0, 5);

  const { headline, sub } = encouragingMessage(needsIroning.length);

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold">Ironing</h1>
        </div>
        <Link to="/IroningGuide">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
            <BookOpen className="w-3.5 h-3.5" /> Guide
          </Button>
        </Link>
      </div>

      {/* Live region: announces ironing queue count after load */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {!isLoading && `${needsIroning.length} item${needsIroning.length !== 1 ? "s" : ""} in the ironing queue. ${sub}`}
      </div>

      <div className="max-w-md mx-auto px-4 pt-8 space-y-6">

        {/* Hero: count + CTA */}
        <div className="bg-card border border-border rounded-3xl p-6 space-y-4 text-center shadow-sm">
          {isLoading ? (
            <div className="py-6 flex justify-center">
              <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              <div className="text-6xl font-bold text-foreground tabular-nums leading-none">
                {needsIroning.length}
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{headline}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{sub}</p>
              </div>

              {needsIroning.length > 0 ? (
                <Button
                  className="w-full h-14 rounded-2xl text-base font-semibold gap-2"
                  onClick={() => navigate("/IroningQueue")}
                >
                  <Shirt className="w-5 h-5" />
                  Start Ironing Session
                </Button>
              ) : (
                <Link to="/DigitalCloset">
                  <Button variant="outline" className="w-full h-12 rounded-2xl gap-2">
                    <Plus className="w-4 h-4" />
                    Add Clothing Item
                  </Button>
                </Link>
              )}
            </>
          )}
        </div>

        {/* Items needing ironing — preview */}
        {!isLoading && needsIroning.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
              In the queue
            </p>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
              {needsIroning.slice(0, 4).map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl shrink-0">{categoryEmoji[item.category] || "👔"}</span>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">{item.name}</span>
                  {item.ironing_heat && (
                    <span className={`text-xs font-medium capitalize ${heatColor[item.ironing_heat]}`}>
                      {item.ironing_heat === "no_iron" ? "No iron" : `${item.ironing_heat} heat`}
                    </span>
                  )}
                </div>
              ))}
              {needsIroning.length > 4 && (
                <div className="px-4 py-2.5 text-xs text-muted-foreground text-center">
                  + {needsIroning.length - 4} more
                </div>
              )}
            </div>
            {/* Shortcut to add item */}
            <Link to="/DigitalCloset">
              <button className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all">
                <Plus className="w-4 h-4" /> Add a clothing item
              </button>
            </Link>
          </div>
        )}

        {/* Recent ironing history */}
        {!isLoading && recentlyIroned.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-1">
              Recently ironed
            </p>
            <div className="bg-card border border-border rounded-2xl divide-y divide-border overflow-hidden">
              {recentlyIroned.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                  <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="text-xl shrink-0">{categoryEmoji[item.category] || "👔"}</span>
                  <span className="flex-1 text-sm font-medium text-foreground truncate">{item.name}</span>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {format(parseISO(item.last_ironed), "MMM d")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/IroningQueue">
            <button className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/30 transition-all space-y-1">
              <Shirt className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium text-foreground">Queue</p>
              <p className="text-xs text-muted-foreground">One item at a time</p>
            </button>
          </Link>
          <Link to="/IroningGuide">
            <button className="w-full bg-card border border-border rounded-2xl p-4 text-left hover:border-primary/30 transition-all space-y-1">
              <BookOpen className="w-5 h-5 text-primary" />
              <p className="text-sm font-medium text-foreground">Guide</p>
              <p className="text-xs text-muted-foreground">Fabric heat settings</p>
            </button>
          </Link>
        </div>

      </div>
    </div>
  );
}