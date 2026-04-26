import React, { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowLeft, Plus, CheckCircle, Clock, Trash2, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format, isPast, isToday } from "date-fns";

export default function IroningQueue() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ item_names: "", scheduled_for: "", notes: "" });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["ironing-sessions"],
    queryFn: () => base44.entities.IroningSession.filter({ status: "pending" }, "-scheduled_for"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.IroningSession.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ironing-sessions"] });
      setForm({ item_names: "", scheduled_for: "", notes: "" });
      setShowForm(false);
    },
  });

  const doneMutation = useMutation({
    mutationFn: (id) => base44.entities.IroningSession.update(id, { status: "done" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ironing-sessions"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.IroningSession.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ironing-sessions"] }),
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.item_names.trim() || !form.scheduled_for) return;
    createMutation.mutate(form);
  };

  const getUrgency = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    if (isToday(d)) return { label: "Today", cls: "bg-orange-100 text-orange-700 border-orange-200" };
    if (isPast(d))  return { label: "Overdue", cls: "bg-red-100 text-red-700 border-red-200" };
    return { label: format(d, "MMM d"), cls: "bg-muted text-muted-foreground border-border" };
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold leading-tight">Ironing Queue</h1>
            <p className="text-xs text-muted-foreground">Track & get reminders</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/IroningGuide">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <BookOpen className="w-3.5 h-3.5" /> Guide
            </Button>
          </Link>
          <Button size="sm" className="gap-1.5" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" /> Add
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-5 space-y-4">

        {/* Add Form */}
        {showForm && (
          <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <p className="text-sm font-semibold text-foreground">New Ironing Session</p>
            <div className="space-y-2">
              <Input
                placeholder="Items to iron (e.g. dress shirt, linen trousers)"
                value={form.item_names}
                onChange={(e) => setForm({ ...form, item_names: e.target.value })}
                required
              />
              <Input
                type="date"
                value={form.scheduled_for}
                onChange={(e) => setForm({ ...form, scheduled_for: e.target.value })}
                required
              />
              <Input
                placeholder="Notes (optional)"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        )}

        {/* Session List */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground text-sm">Loading…</div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <p className="text-4xl">👔</p>
            <p className="font-medium text-foreground">No items queued</p>
            <p className="text-sm text-muted-foreground">Tap "Add" to schedule an ironing session.</p>
          </div>
        ) : (
          sessions.map((session) => {
            const urgency = getUrgency(session.scheduled_for);
            const items = session.item_names.split(",").map(s => s.trim()).filter(Boolean);
            return (
              <div key={session.id} className="bg-card border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${urgency.cls}`}>
                        {urgency.label}
                      </span>
                      {session.notified && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" /> Reminded
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {items.map((item) => (
                        <span key={item} className="text-xs bg-muted rounded-lg px-2 py-0.5 text-foreground">{item}</span>
                      ))}
                    </div>
                    {session.notes && (
                      <p className="text-xs text-muted-foreground">{session.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => doneMutation.mutate(session.id)}
                      title="Mark done"
                    >
                      <CheckCircle className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() => deleteMutation.mutate(session.id)}
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}