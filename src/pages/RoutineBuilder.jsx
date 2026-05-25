import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, Loader2, Edit, Check, ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { usePremium } from "@/hooks/usePremium";
import AIPremiumLock from "@/components/premium/AIPremiumLock";
import { useNavigate } from "react-router-dom";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function RoutineBuilder() {
  const { isPremium, isLoading: premiumLoading } = usePremium();
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [inputs, setInputs] = useState({
    household_size: "1",
    loads_per_week: "2",
    environment: "private"
  });
  const [routine, setRoutine] = useState(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    base44.auth.me().then((u) => {
      setUser(u);
      setInputs(prev => ({
        ...prev,
        environment: u?.laundry_environment || "private"
      }));
    }).catch(() => {});
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setRoutine(null);

    try {
      const prompt = `Create a simple weekly laundry routine suggestion for someone with:
- Household size: ${inputs.household_size} person(s)
- Target loads per week: ${inputs.loads_per_week}
- Environment: ${inputs.environment === "shared" ? "shared laundry room" : "in-unit laundry"}

Provide a suggested schedule with specific days and load types (e.g., "Monday — gym clothes", "Thursday — everyday clothes"). Keep it optional and flexible in tone. Format as a simple list.`;

      const response = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: "object",
          properties: {
            routine: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  day: { type: "string" },
                  load_type: { type: "string" }
                }
              }
            },
            note: { type: "string" }
          }
        }
      });

      setRoutine(response);
    } catch (error) {
      setRoutine({
        routine: [],
        note: "I couldn't generate a routine right now. Please try again."
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = (index, field, value) => {
    const updated = [...routine.routine];
    updated[index] = { ...updated[index], [field]: value };
    setRoutine({ ...routine, routine: updated });
  };

  if (premiumLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex items-center gap-3 mb-1">
            <button
              onClick={() => navigate(-1)}
              aria-label="Go back"
              className="flex items-center justify-center h-11 w-11 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-all flex-shrink-0"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </button>
            <Calendar className="w-5 h-5 text-primary flex-shrink-0" />
            <h1 className="text-2xl font-semibold tracking-tight">Routine Builder</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Create a personalized weekly laundry plan
          </p>
        </motion.div>

        {!isPremium && (
          <div className="mt-6 rounded-2xl border border-border bg-card">
            <AIPremiumLock featureName="AI Routine Builder" />
          </div>
        )}

        {isPremium && <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-6 space-y-4"
        >
          {!routine && (
            <Card className="p-5 border-0 shadow-sm space-y-4">
              <div>
                <Label className="text-sm mb-2 block">Household size</Label>
                <Select
                  value={inputs.household_size}
                  onValueChange={(v) => setInputs(prev => ({ ...prev, household_size: v }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 person</SelectItem>
                    <SelectItem value="2">2 people</SelectItem>
                    <SelectItem value="3">3 people</SelectItem>
                    <SelectItem value="4">4+ people</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Loads per week</Label>
                <Select
                  value={inputs.loads_per_week}
                  onValueChange={(v) => setInputs(prev => ({ ...prev, loads_per_week: v }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 load</SelectItem>
                    <SelectItem value="2">2 loads</SelectItem>
                    <SelectItem value="3">3 loads</SelectItem>
                    <SelectItem value="4">4+ loads</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-sm mb-2 block">Environment</Label>
                <Select
                  value={inputs.environment}
                  onValueChange={(v) => setInputs(prev => ({ ...prev, environment: v }))}
                >
                  <SelectTrigger className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">In-unit laundry</SelectItem>
                    <SelectItem value="shared">Shared laundry room</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleGenerate}
                disabled={loading}
                className="w-full rounded-xl py-5"
                size="lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate Routine"
                )}
              </Button>
            </Card>
          )}

          {routine && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <Card className="p-5 border-0 shadow-sm bg-primary/5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-medium">Your Suggested Routine</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      This is one possible routine that might work for you
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setEditing(!editing)}
                  >
                    {editing ? <Check className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                  </Button>
                </div>

                <div className="space-y-2">
                  {routine.routine?.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 rounded-lg bg-background"
                    >
                      {editing ? (
                        <>
                          <Select
                            value={item.day}
                            onValueChange={(v) => handleUpdate(index, "day", v)}
                          >
                            <SelectTrigger className="w-32 h-9 rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS.map((day) => (
                                <SelectItem key={day} value={day}>{day}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            value={item.load_type}
                            onChange={(e) => handleUpdate(index, "load_type", e.target.value)}
                            className="flex-1 h-9 rounded-lg"
                          />
                        </>
                      ) : (
                        <>
                          <span className="font-medium text-sm min-w-24">{item.day}</span>
                          <span className="text-sm text-muted-foreground">—</span>
                          <span className="text-sm">{item.load_type}</span>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {routine.note && (
                  <p className="text-xs text-muted-foreground mt-4 p-3 rounded-lg bg-background/50">
                    {routine.note}
                  </p>
                )}
              </Card>

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 rounded-xl"
                  onClick={() => setRoutine(null)}
                >
                  Create New
                </Button>
                <Button className="flex-1 rounded-xl">
                  Save Routine
                </Button>
              </div>
            </motion.div>
          )}
        </motion.div>}
      </div>
    </div>
  );
}