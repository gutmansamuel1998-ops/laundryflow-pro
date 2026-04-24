import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import LoadCard from "@/components/laundry/LoadCard";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Shirt, Bath, BedDouble, Sparkles, Layers, CheckCircle, XCircle } from "lucide-react";
import { motion } from "framer-motion";

const loadTypeConfig = {
  everyday_clothes: { label: "Clothes", icon: Shirt, color: "bg-blue-50 text-blue-600" },
  towels: { label: "Towels", icon: Bath, color: "bg-teal-50 text-teal-600" },
  bedding: { label: "Bedding", icon: BedDouble, color: "bg-purple-50 text-purple-600" },
  delicates: { label: "Delicates", icon: Sparkles, color: "bg-pink-50 text-pink-600" },
  mixed: { label: "Mixed", icon: Layers, color: "bg-amber-50 text-amber-600" },
};

export default function Loads() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("active");

  const { data: allLoads = [], isLoading } = useQuery({
    queryKey: ["all-loads"],
    queryFn: () => base44.entities.Load.list("-created_date", 50),
  });

  const activeLoads = allLoads.filter(l => l.status === "active");
  const completedLoads = allLoads.filter(l => l.status === "completed");
  const abandonedLoads = allLoads.filter(l => l.status === "abandoned");

  return (
    <div className="min-h-screen pb-28">
      <div className="max-w-lg mx-auto px-6 pt-10">
        <h1 className="text-2xl font-semibold tracking-tight mb-8">Loads</h1>

        <Tabs value={tab} onValueChange={setTab} className="mb-8">
          <TabsList className="w-full bg-muted/50 rounded-2xl p-1">
            <TabsTrigger value="active" className="flex-1 rounded-xl data-[state=active]:shadow-sm">
              Active ({activeLoads.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex-1 rounded-xl data-[state=active]:shadow-sm">
              History ({completedLoads.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          </div>
        ) : (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            {tab === "active" && (
              <>
                {activeLoads.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">No active loads right now.</p>
                ) : (
                  activeLoads.map(load => (
                    <LoadCard
                      key={load.id}
                      load={load}
                      onClick={(l) => navigate(createPageUrl("LaundryMode") + `?loadId=${l.id}`)}
                    />
                  ))
                )}
                {abandonedLoads.length > 0 && (
                  <div className="pt-6">
                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">
                      Set Aside
                    </h2>
                    {abandonedLoads.map(load => (
                      <LoadCard
                        key={load.id}
                        load={load}
                        onClick={(l) => navigate(createPageUrl("LaundryMode") + `?loadId=${l.id}`)}
                      />
                    ))}
                  </div>
                )}
              </>
            )}

            {tab === "completed" && (
              <>
                {completedLoads.length === 0 ? (
                  <p className="text-center text-muted-foreground py-12">No completed loads yet.</p>
                ) : (
                  completedLoads.map(load => {
                    const config = loadTypeConfig[load.load_type] || loadTypeConfig.mixed;
                    const Icon = config.icon;
                    return (
                      <Card key={load.id} className="p-5 border-0 shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${config.color}`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-sm">{config.label}</p>
                            <p className="text-xs text-muted-foreground">
                              {load.completed_at ? format(new Date(load.completed_at), "MMM d, h:mm a") : format(new Date(load.updated_date), "MMM d, h:mm a")}
                            </p>
                          </div>
                          <Badge variant="secondary" className="bg-emerald-50 text-emerald-600">
                            <CheckCircle className="w-3 h-3 mr-1" /> Done
                          </Badge>
                        </div>
                        {load.notes && (
                          <p className="text-sm text-muted-foreground mt-3 pl-14">{load.notes}</p>
                        )}
                      </Card>
                    );
                  })
                )}
              </>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}