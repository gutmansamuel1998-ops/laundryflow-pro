import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useLaundryProfile } from "@/hooks/useLaundryProfile";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Users, Tag, NotebookPen, Plus } from "lucide-react";
import HouseholdMemberCard from "@/components/household/HouseholdMemberCard";
import HouseholdMemberForm from "@/components/household/HouseholdMemberForm";
import HouseholdCategoriesSection from "@/components/household/HouseholdCategoriesSection";
import HouseholdNotesSection from "@/components/household/HouseholdNotesSection";

export default function HouseholdManagement() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { profile, loading } = useLaundryProfile();
  const [showAddMember, setShowAddMember] = useState(false);

  const { data: members = [] } = useQuery({
    queryKey: ["household-members"],
    queryFn: () => base44.entities.HouseholdMember.list("-created_date"),
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["household-categories"],
    queryFn: () => base44.entities.HouseholdCategory.list("-created_date"),
  });
  const { data: notes = [] } = useQuery({
    queryKey: ["household-notes"],
    queryFn: () => base44.entities.HouseholdNote.list("-created_date"),
  });

  const addMember = useMutation({
    mutationFn: (data) => base44.entities.HouseholdMember.create(data),
    onSuccess: (m) => { qc.setQueryData(["household-members"], (old = []) => [m, ...old]); setShowAddMember(false); },
  });
  const saveMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.HouseholdMember.update(id, data),
    onSuccess: (m) => qc.setQueryData(["household-members"], (old = []) => old.map((x) => x.id === m.id ? m : x)),
  });
  const deleteMember = useMutation({
    mutationFn: (id) => base44.entities.HouseholdMember.delete(id),
    onSuccess: (_, id) => qc.setQueryData(["household-members"], (old = []) => old.filter((x) => x.id !== id)),
  });

  const addCategory = useMutation({
    mutationFn: (data) => base44.entities.HouseholdCategory.create(data),
    onSuccess: (c) => qc.setQueryData(["household-categories"], (old = []) => [c, ...old]),
  });
  const deleteCategory = useMutation({
    mutationFn: (id) => base44.entities.HouseholdCategory.delete(id),
    onSuccess: (_, id) => qc.setQueryData(["household-categories"], (old = []) => old.filter((x) => x.id !== id)),
  });

  const addNote = useMutation({
    mutationFn: (data) => base44.entities.HouseholdNote.create(data),
    onSuccess: (n) => qc.setQueryData(["household-notes"], (old = []) => [n, ...old]),
  });
  const deleteNote = useMutation({
    mutationFn: (id) => base44.entities.HouseholdNote.delete(id),
    onSuccess: (_, id) => qc.setQueryData(["household-notes"], (old = []) => old.filter((x) => x.id !== id)),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" role="status" aria-label="Loading" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      <div className="max-w-lg mx-auto px-5 pt-8">
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back" className="rounded-xl">
            <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Household</h1>
            <p className="text-sm text-muted-foreground">Organize laundry for your household</p>
          </div>
        </div>

        {profile !== "family" ? (
          <Card className="p-5 border-0 shadow-sm text-center space-y-3">
            <p className="text-sm text-muted-foreground">
              Household management is designed for the Family laundry profile.
            </p>
            <Button className="rounded-xl" onClick={() => navigate(createPageUrl("Settings"))}>
              Switch to Family Profile in Settings
            </Button>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Household Members */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Household Members</h2>
                </div>
                <Button size="sm" variant="outline" className="rounded-xl gap-1" onClick={() => setShowAddMember((v) => !v)}>
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" /> Add
                </Button>
              </div>
              <div className="space-y-2">
                {showAddMember && (
                  <Card className="border-primary/20 border-2 overflow-hidden">
                    <HouseholdMemberForm
                      isSaving={addMember.isPending}
                      onCancel={() => setShowAddMember(false)}
                      onSave={(data) => addMember.mutate(data)}
                    />
                  </Card>
                )}
                {members.length === 0 && !showAddMember && (
                  <p className="text-sm text-muted-foreground">No household members yet — add one whenever you're ready.</p>
                )}
                {members.map((m) => (
                  <HouseholdMemberCard
                    key={m.id}
                    member={m}
                    isSaving={saveMember.isPending}
                    onSave={(id, data) => saveMember.mutate({ id, data })}
                    onDelete={(id) => deleteMember.mutate(id)}
                  />
                ))}
              </div>
            </section>

            {/* Household Categories */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Household Categories</h2>
              </div>
              <Card className="p-4 border-0 shadow-sm">
                <HouseholdCategoriesSection
                  customCategories={categories}
                  isSaving={addCategory.isPending}
                  onAdd={(data) => addCategory.mutate(data)}
                  onDelete={(id) => deleteCategory.mutate(id)}
                />
              </Card>
            </section>

            {/* Household Notes */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <NotebookPen className="w-4 h-4 text-muted-foreground" />
                <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Household Notes</h2>
              </div>
              <Card className="p-4 border-0 shadow-sm">
                <HouseholdNotesSection
                  notes={notes}
                  isSaving={addNote.isPending}
                  onAdd={(data) => addNote.mutate(data)}
                  onDelete={(id) => deleteNote.mutate(id)}
                />
              </Card>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}