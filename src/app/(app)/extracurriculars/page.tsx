"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import {
  ExtracurricularRecommendation,
  CompletedActivity,
  SavedRoadmap,
  RoadmapTask,
} from "@/types";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import {
  Sparkles, ChevronRight, Lock, RotateCw, BookOpen, Clock, TrendingUp,
  CheckCircle2, Circle, Calendar, ArrowLeft, MessageSquare, Wand2, Plus, Trash2,
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: "easeOut" as const },
  }),
};

type MainTab = "active" | "completed" | "roadmaps";

// Minimal id helper — crypto.randomUUID is available in modern browsers
function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function ExtracurricularsPage() {
  const { profile, session, refreshProfile } = useAuth();
  const [mainTab, setMainTab] = useState<MainTab>("active");
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [recommendations, setRecommendations] = useState<ExtracurricularRecommendation[] | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [completing, setCompleting] = useState<string | null>(null);

  // Roadmap state
  const [activeRoadmapId, setActiveRoadmapId] = useState<string | null>(null);
  const [creatingFor, setCreatingFor] = useState<string | null>(null); // category being created
  const [draftRoadmap, setDraftRoadmap] = useState<{
    category: string;
    project_idea_options: string[];
    competitions: { name: string; description: string; deadline?: string }[];
    tasks: { week: number; description: string }[];
    weekly_hours: string;
    common_app_tip: string;
  } | null>(null);
  const [chosenIdea, setChosenIdea] = useState<string>("");
  const [customIdea, setCustomIdea] = useState<string>("");
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [adjustInstruction, setAdjustInstruction] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  useEffect(() => {
    if (profile?.extracurricular_recommendations) {
      setRecommendations(profile.extracurricular_recommendations);
      if (profile.selected_extracurricular_categories?.length) {
        setSelectedCategories(profile.selected_extracurricular_categories);
        setStep(3);
      } else {
        setStep(2);
      }
    }
  }, [profile]);

  const runAnalysis = async () => {
    if (!session?.access_token) return;
    setAnalyzing(true);
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 60000);
    try {
      const res = await fetch("/api/extracurriculars/analyze", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        signal: abortController.signal,
      });
      if (res.status === 429) {
        toast.error("You're going too fast — please wait a moment.");
        return;
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Analysis failed with status ${res.status}`);
      }
      const data = await res.json();
      setRecommendations(data.recommendations);
      await refreshProfile();
      setStep(2);
    } catch (err) {
      let message = "Something went wrong. Please try again.";
      if (err instanceof Error) {
        message = err.name === "AbortError" ? "Request timed out. Please try again." : err.message;
      }
      toast.error(message);
    } finally {
      clearTimeout(timeoutId);
      setAnalyzing(false);
    }
  };

  const confirmSelection = async () => {
    if (!session?.access_token || selectedCategories.length === 0) return;
    try {
      const { createBrowserClient } = await import("@/lib/supabase");
      const supabase = createBrowserClient();
      await supabase.from("profiles").update({
        selected_extracurricular_categories: selectedCategories,
      }).eq("id", profile!.id);
      await refreshProfile();
      setStep(3);
    } catch {
      toast.error("Failed to save selection.");
    }
  };

  const markComplete = async (category: string) => {
    if (!profile) return;
    if (!confirm(`Mark "${category}" as completed? It'll move to your completed list and boost your profile strength.`)) return;
    setCompleting(category);
    try {
      const rec = recommendations?.find((r) => r.category === category);
      const { createBrowserClient } = await import("@/lib/supabase");
      const supabase = createBrowserClient();

      const newCompleted: CompletedActivity[] = [
        ...(profile.completed_activities || []),
        {
          category,
          name: rec?.example || category,
          description: rec?.explanation,
          completed_at: new Date().toISOString(),
        },
      ];
      const newSelected = (profile.selected_extracurricular_categories || []).filter((c) => c !== category);

      await supabase.from("profiles").update({
        completed_activities: newCompleted,
        selected_extracurricular_categories: newSelected,
        xp: (profile.xp || 0) + 25,
      }).eq("id", profile.id);

      if (session?.access_token) {
        fetch("/api/profile-strength", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }).catch(() => {});
      }

      setSelectedCategories(newSelected);
      await refreshProfile();
      toast.success("Nice! Moved to Completed and updating strength...");
    } catch {
      toast.error("Failed to mark complete.");
    } finally {
      setCompleting(null);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : prev.length < 3 ? [...prev, cat] : prev
    );
  };

  // ---------- Roadmap actions ----------

  const startCreatingRoadmap = async (category: string) => {
    if (!session?.access_token || !profile?.is_pro) return;
    setCreatingFor(category);
    setRoadmapLoading(true);
    setDraftRoadmap(null);
    setChosenIdea("");
    setCustomIdea("");
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 60000);
    try {
      const res = await fetch("/api/extracurriculars/roadmap", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ category }),
        signal: abortController.signal,
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Roadmap generation failed with status ${res.status}`);
      }
      const data = await res.json();
      setDraftRoadmap(data.roadmap);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(message);
      setCreatingFor(null);
    } finally {
      clearTimeout(timeoutId);
      setRoadmapLoading(false);
    }
  };

  const saveRoadmap = async () => {
    if (!profile || !draftRoadmap) return;
    const finalIdea = customIdea.trim() || chosenIdea.trim();
    if (!finalIdea) {
      toast.error("Pick an idea or write your own first.");
      return;
    }
    const now = new Date().toISOString();
    const newRoadmap: SavedRoadmap = {
      id: makeId(),
      category: draftRoadmap.category,
      project_idea: finalIdea,
      project_idea_options: draftRoadmap.project_idea_options,
      competitions: draftRoadmap.competitions,
      tasks: draftRoadmap.tasks.map((t, i) => ({
        id: `task-${Date.now()}-${i}`,
        week: t.week,
        description: t.description,
        done: false,
      })),
      weekly_hours: draftRoadmap.weekly_hours,
      common_app_tip: draftRoadmap.common_app_tip,
      status: "planning",
      created_at: now,
      updated_at: now,
    };

    try {
      const { createBrowserClient } = await import("@/lib/supabase");
      const supabase = createBrowserClient();
      const next = [...(profile.roadmaps || []), newRoadmap];
      const { error } = await supabase.from("profiles").update({ roadmaps: next }).eq("id", profile.id);
      if (error) throw error;
      await refreshProfile();
      setCreatingFor(null);
      setDraftRoadmap(null);
      setActiveRoadmapId(newRoadmap.id);
      setMainTab("roadmaps");
      toast.success("Roadmap saved!");
    } catch {
      toast.error("Failed to save roadmap.");
    }
  };

  const toggleTask = async (roadmapId: string, taskId: string) => {
    if (!profile) return;
    const roadmaps = profile.roadmaps || [];
    const next = roadmaps.map((r) => {
      if (r.id !== roadmapId) return r;
      const updatedTasks = r.tasks.map((t) => t.id === taskId ? { ...t, done: !t.done } : t);
      const allDone = updatedTasks.length > 0 && updatedTasks.every((t) => t.done);
      return {
        ...r,
        tasks: updatedTasks,
        status: (allDone ? "completed" : (r.status === "planning" ? "active" : r.status)) as SavedRoadmap["status"],
        updated_at: new Date().toISOString(),
      };
    });
    // Optimistic
    try {
      const { createBrowserClient } = await import("@/lib/supabase");
      const supabase = createBrowserClient();
      await supabase.from("profiles").update({ roadmaps: next }).eq("id", profile.id);
      await refreshProfile();
    } catch {
      toast.error("Failed to save task.");
    }
  };

  const deleteRoadmap = async (roadmapId: string) => {
    if (!profile) return;
    if (!confirm("Delete this roadmap? This can't be undone.")) return;
    try {
      const { createBrowserClient } = await import("@/lib/supabase");
      const supabase = createBrowserClient();
      const next = (profile.roadmaps || []).filter((r) => r.id !== roadmapId);
      await supabase.from("profiles").update({ roadmaps: next }).eq("id", profile.id);
      await refreshProfile();
      if (activeRoadmapId === roadmapId) setActiveRoadmapId(null);
      toast.success("Deleted.");
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const adjustRoadmap = async (roadmap: SavedRoadmap) => {
    if (!session?.access_token || !adjustInstruction.trim()) return;
    setAdjusting(true);
    try {
      const res = await fetch("/api/extracurriculars/adjust-roadmap", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ roadmap, instruction: adjustInstruction.trim() }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to adjust.");
      }
      await refreshProfile();
      setAdjustInstruction("");
      toast.success("Roadmap updated!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to adjust.";
      toast.error(message);
    } finally {
      setAdjusting(false);
    }
  };

  if (!profile) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;

  const completedActivities: CompletedActivity[] = profile.completed_activities || [];
  const roadmaps: SavedRoadmap[] = profile.roadmaps || [];
  const activeRoadmap = roadmaps.find((r) => r.id === activeRoadmapId) || null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-3xl text-text-primary">Extracurriculars</h1>
        <p className="text-text-muted mt-1">Build a standout activity profile that admissions officers love.</p>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-button p-1 w-fit overflow-x-auto">
        {([
          { id: "active", label: "Active", count: (profile.selected_extracurricular_categories?.length || 0) },
          { id: "roadmaps", label: "Roadmaps", count: roadmaps.length },
          { id: "completed", label: "Completed", count: completedActivities.length },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => { setMainTab(t.id); setActiveRoadmapId(null); setCreatingFor(null); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-medium transition-all whitespace-nowrap ${
              mainTab === t.id ? "bg-purple text-white" : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t.label}
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              mainTab === t.id ? "bg-white/20" : "bg-white/10"
            }`}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* COMPLETED TAB */}
      {mainTab === "completed" && (
        <div className="space-y-3">
          {completedActivities.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-text-muted/40 mx-auto mb-3" />
              <p className="text-text-muted text-sm">
                No completed activities yet. Finish one in the Active tab to move it here.
              </p>
            </div>
          ) : (
            completedActivities.map((c, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass-card p-5 flex items-start gap-4"
              >
                <div className="w-10 h-10 rounded-xl bg-pop/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-pop" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-heading font-semibold text-text-primary">{c.category}</h3>
                    <Badge variant="pop">Completed</Badge>
                  </div>
                  {c.description && <p className="text-text-muted text-sm mb-1">{c.description}</p>}
                  <p className="text-text-muted/60 text-xs">
                    <Calendar className="inline w-3 h-3 mr-1" />
                    Completed {new Date(c.completed_at).toLocaleDateString()}
                  </p>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* ROADMAPS TAB */}
      {mainTab === "roadmaps" && (
        <RoadmapsTab
          profile={profile}
          isPro={profile.is_pro}
          roadmaps={roadmaps}
          activeRoadmap={activeRoadmap}
          setActiveRoadmapId={setActiveRoadmapId}
          creatingFor={creatingFor}
          setCreatingFor={setCreatingFor}
          draftRoadmap={draftRoadmap}
          roadmapLoading={roadmapLoading}
          chosenIdea={chosenIdea}
          setChosenIdea={setChosenIdea}
          customIdea={customIdea}
          setCustomIdea={setCustomIdea}
          startCreatingRoadmap={startCreatingRoadmap}
          saveRoadmap={saveRoadmap}
          toggleTask={toggleTask}
          deleteRoadmap={deleteRoadmap}
          adjustInstruction={adjustInstruction}
          setAdjustInstruction={setAdjustInstruction}
          adjustRoadmap={adjustRoadmap}
          adjusting={adjusting}
          selectedCategories={selectedCategories}
        />
      )}

      {/* ACTIVE TAB */}
      {mainTab === "active" && (
        <>
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
              step >= s ? "bg-purple text-white" : "bg-white/5 text-text-muted"
            }`}>
              {step > s ? <CheckCircle2 className="w-4 h-4" /> : s}
            </div>
            {s < 3 && <div className={`w-12 h-0.5 ${step > s ? "bg-purple" : "bg-white/10"}`} />}
          </div>
        ))}
        <span className="text-text-muted text-xs ml-2">
          {step === 1 ? "AI Analysis" : step === 2 ? "Select Categories" : "Your Focus"}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass-card p-8 text-center max-w-xl mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-purple/10 flex items-center justify-center mx-auto mb-6">
                <Sparkles className="w-8 h-8 text-purple" />
              </div>
              <h2 className="font-heading font-bold text-2xl text-text-primary mb-3">
                Let AI analyze your profile
              </h2>
              <p className="text-text-muted mb-8 max-w-md mx-auto">
                Based on your interests, major, and goals, we&apos;ll recommend the best extracurricular categories for your college application.
              </p>
              <Button variant="primary" size="lg" onClick={runAnalysis} loading={analyzing}>
                {analyzing ? "Analyzing your profile..." : "Analyze My Profile"}
              </Button>
            </div>
          </motion.div>
        )}

        {step === 2 && recommendations && (
          <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading font-semibold text-xl text-text-primary">Recommended for you</h2>
                <p className="text-text-muted text-sm">Select 2-3 categories to focus on.</p>
              </div>
              {profile.is_pro && (
                <Button variant="ghost" size="sm" onClick={runAnalysis} loading={analyzing}>
                  <RotateCw className="w-4 h-4" /> Regenerate
                </Button>
              )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {recommendations.map((rec, i) => {
                const selected = selectedCategories.includes(rec.category);
                return (
                  <motion.button
                    key={rec.category}
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    custom={i}
                    onClick={() => toggleCategory(rec.category)}
                    className={`glass-card p-6 text-left transition-all duration-200 ${
                      selected ? "border-purple/40 bg-purple/5" : "hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-heading font-semibold text-text-primary">{rec.category}</h3>
                      {selected && <CheckCircle2 className="w-5 h-5 text-purple flex-shrink-0" />}
                    </div>
                    <p className="text-text-muted text-sm mb-4 leading-relaxed">{rec.explanation}</p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant={rec.effort_level === "High" ? "warning" : rec.effort_level === "Medium" ? "accent" : "muted"}>
                        <Clock className="w-3 h-3 mr-1" /> {rec.effort_level} Effort
                      </Badge>
                      <Badge variant={rec.impact_level === "Very High" ? "pop" : "accent"}>
                        <TrendingUp className="w-3 h-3 mr-1" /> {rec.impact_level} Impact
                      </Badge>
                      {rec.estimated_time && (
                        <Badge variant="muted">
                          <Calendar className="w-3 h-3 mr-1" /> {rec.estimated_time}
                        </Badge>
                      )}
                    </div>
                    <p className="text-text-muted/60 text-xs mt-3 italic">{rec.example}</p>
                  </motion.button>
                );
              })}
            </div>

            <div className="flex justify-end">
              <Button
                variant="primary"
                onClick={confirmSelection}
                disabled={selectedCategories.length === 0}
              >
                Confirm Selection ({selectedCategories.length}/3)
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && recommendations && (
          <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {selectedCategories.map((cat, i) => {
              const rec = recommendations.find((r) => r.category === cat);
              if (!rec) return null;
              const existingRoadmap = roadmaps.find((r) => r.category === cat);
              return (
                <motion.div key={cat} initial="hidden" animate="visible" variants={fadeUp} custom={i} className="glass-card p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-purple" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                        <h3 className="font-heading font-semibold text-lg text-text-primary">{rec.category}</h3>
                        <button
                          onClick={() => markComplete(cat)}
                          disabled={completing === cat}
                          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-pop transition-colors flex-shrink-0 disabled:opacity-50"
                        >
                          {completing === cat ? (
                            <CheckCircle2 className="w-4 h-4 text-pop animate-pulse" />
                          ) : (
                            <Circle className="w-4 h-4" />
                          )}
                          Mark complete
                        </button>
                      </div>
                      <div className="space-y-3 text-sm text-text-muted">
                        <p>{rec.explanation}</p>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant={rec.effort_level === "High" ? "warning" : "muted"}>
                            <Clock className="w-3 h-3 mr-1" /> {rec.effort_level} Effort
                          </Badge>
                          <Badge variant={rec.impact_level === "Very High" ? "pop" : "accent"}>
                            <TrendingUp className="w-3 h-3 mr-1" /> {rec.impact_level} Impact
                          </Badge>
                          {rec.estimated_time && (
                            <Badge variant="muted">
                              <Calendar className="w-3 h-3 mr-1" /> {rec.estimated_time}
                            </Badge>
                          )}
                        </div>

                        {/* Roadmap CTA */}
                        <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-3 flex-wrap">
                          {existingRoadmap ? (
                            <>
                              <p className="text-text-muted text-xs">
                                You have a roadmap for this category with {existingRoadmap.tasks.filter((t) => t.done).length}/{existingRoadmap.tasks.length} tasks done.
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => { setActiveRoadmapId(existingRoadmap.id); setMainTab("roadmaps"); }}
                              >
                                Open roadmap <ChevronRight className="w-4 h-4" />
                              </Button>
                            </>
                          ) : profile.is_pro ? (
                            <>
                              <p className="text-text-muted text-xs">
                                Generate a full roadmap with project ideas, tasks, and competitions.
                              </p>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => { startCreatingRoadmap(cat); setMainTab("roadmaps"); }}
                                loading={roadmapLoading && creatingFor === cat}
                              >
                                <Wand2 className="w-4 h-4" /> Generate roadmap
                              </Button>
                            </>
                          ) : (
                            <>
                              <p className="text-text-muted text-xs flex items-center gap-1.5">
                                <Lock className="w-3 h-3 text-pop" />
                                Full roadmaps with checklists are a Pro feature.
                              </p>
                              <Link href="/pricing">
                                <Button variant="pop" size="sm">Upgrade</Button>
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            <Button variant="ghost" onClick={() => setStep(2)} size="sm">
              Change selection
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ----------------------------- Roadmaps sub-component -----------------------------

interface RoadmapsTabProps {
  profile: { id: string };
  isPro: boolean;
  roadmaps: SavedRoadmap[];
  activeRoadmap: SavedRoadmap | null;
  setActiveRoadmapId: (id: string | null) => void;
  creatingFor: string | null;
  setCreatingFor: (c: string | null) => void;
  draftRoadmap: {
    category: string;
    project_idea_options: string[];
    competitions: { name: string; description: string; deadline?: string }[];
    tasks: { week: number; description: string }[];
    weekly_hours: string;
    common_app_tip: string;
  } | null;
  roadmapLoading: boolean;
  chosenIdea: string;
  setChosenIdea: (s: string) => void;
  customIdea: string;
  setCustomIdea: (s: string) => void;
  startCreatingRoadmap: (category: string) => void;
  saveRoadmap: () => void;
  toggleTask: (roadmapId: string, taskId: string) => void;
  deleteRoadmap: (roadmapId: string) => void;
  adjustInstruction: string;
  setAdjustInstruction: (s: string) => void;
  adjustRoadmap: (roadmap: SavedRoadmap) => void;
  adjusting: boolean;
  selectedCategories: string[];
}

function RoadmapsTab(props: RoadmapsTabProps) {
  const {
    isPro, roadmaps, activeRoadmap, setActiveRoadmapId,
    creatingFor, setCreatingFor, draftRoadmap, roadmapLoading,
    chosenIdea, setChosenIdea, customIdea, setCustomIdea,
    startCreatingRoadmap, saveRoadmap, toggleTask, deleteRoadmap,
    adjustInstruction, setAdjustInstruction, adjustRoadmap, adjusting,
    selectedCategories,
  } = props;

  // Pro paywall for non-Pro
  if (!isPro) {
    return (
      <div className="glass-card p-8 border-pop/20 text-center">
        <Lock className="w-8 h-8 text-pop mx-auto mb-4" />
        <h3 className="font-heading font-semibold text-xl text-text-primary mb-2">
          Comprehensive roadmaps are Pro
        </h3>
        <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
          Pick a category, choose a project idea, and track your progress week-by-week with an AI-guided checklist.
        </p>
        <Link href="/pricing">
          <Button variant="pop">Upgrade to Pro</Button>
        </Link>
      </div>
    );
  }

  // Draft roadmap flow (picking idea)
  if (creatingFor) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => setCreatingFor(null)}
          className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm"
        >
          <ArrowLeft className="w-4 h-4" /> Back to roadmaps
        </button>

        <div className="glass-card p-6">
          <div className="flex items-center gap-3 mb-1">
            <Wand2 className="w-5 h-5 text-purple" />
            <h2 className="font-heading font-bold text-xl text-text-primary">
              New roadmap: {creatingFor}
            </h2>
          </div>

          {roadmapLoading || !draftRoadmap ? (
            <div className="py-8 text-center text-text-muted text-sm">
              <div className="inline-flex gap-1 mb-3">
                <span className="w-2 h-2 bg-purple/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-purple/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-purple/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
              <p>Generating ideas and a personalized checklist...</p>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="text-text-muted text-sm">
                Pick one of these AI-suggested project ideas, or write your own below. You can change it later.
              </p>

              <div className="space-y-2">
                {draftRoadmap.project_idea_options.map((idea, i) => (
                  <button
                    key={i}
                    onClick={() => { setChosenIdea(idea); setCustomIdea(""); }}
                    className={`w-full text-left glass-card p-4 transition-all ${
                      chosenIdea === idea && !customIdea ? "border-purple/40 bg-purple/5" : "hover:border-white/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-5 h-5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0 ${
                        chosenIdea === idea && !customIdea ? "bg-purple" : "border border-white/20"
                      }`}>
                        {chosenIdea === idea && !customIdea && <CheckCircle2 className="w-5 h-5 text-white" />}
                      </div>
                      <p className="text-sm text-text-primary flex-1">{idea}</p>
                    </div>
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-text-muted text-xs font-medium mb-2">Or write your own:</label>
                <textarea
                  value={customIdea}
                  onChange={(e) => { setCustomIdea(e.target.value); if (e.target.value) setChosenIdea(""); }}
                  placeholder="e.g. Build a data tool to help my school's robotics team track match stats..."
                  rows={3}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 text-sm resize-none"
                />
              </div>

              {/* Preview of what they'll get */}
              <div className="bg-white/5 rounded-button p-4 text-xs text-text-muted">
                <p className="font-medium text-text-primary mb-1">What you&apos;ll get after saving:</p>
                <ul className="space-y-0.5 list-disc list-inside">
                  <li>{draftRoadmap.tasks.length} weekly tasks you can check off</li>
                  <li>{draftRoadmap.competitions.length} real competitions and programs</li>
                  <li>Estimated {draftRoadmap.weekly_hours} per week</li>
                  <li>Common App writing tip tailored to this activity</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCreatingFor(null)}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={saveRoadmap}
                  disabled={!chosenIdea && !customIdea.trim()}
                >
                  Save Roadmap
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Active roadmap detail view
  if (activeRoadmap) {
    return (
      <RoadmapDetail
        roadmap={activeRoadmap}
        onBack={() => setActiveRoadmapId(null)}
        toggleTask={toggleTask}
        deleteRoadmap={deleteRoadmap}
        adjustInstruction={adjustInstruction}
        setAdjustInstruction={setAdjustInstruction}
        adjustRoadmap={adjustRoadmap}
        adjusting={adjusting}
      />
    );
  }

  // List view
  return (
    <div className="space-y-4">
      {roadmaps.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Wand2 className="w-10 h-10 text-text-muted/40 mx-auto mb-3" />
          <h3 className="font-heading font-semibold text-text-primary mb-1">No roadmaps yet</h3>
          <p className="text-text-muted text-sm mb-5 max-w-md mx-auto">
            Generate a roadmap from one of your selected categories to get a weekly checklist, project ideas, and competitions.
          </p>
          {selectedCategories.length === 0 ? (
            <p className="text-text-muted/70 text-xs">
              Head to the Active tab and pick 2-3 categories first.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2 justify-center">
              {selectedCategories.map((cat) => (
                <Button
                  key={cat}
                  variant="primary"
                  size="sm"
                  onClick={() => startCreatingRoadmap(cat)}
                >
                  <Plus className="w-4 h-4" /> {cat}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Create another */}
          {selectedCategories.length > 0 && (
            <div className="glass-card p-4 flex items-center gap-3 flex-wrap">
              <p className="text-text-muted text-sm flex-1 min-w-[180px]">Generate a new roadmap for:</p>
              {selectedCategories
                .filter((cat) => !roadmaps.some((r) => r.category === cat))
                .map((cat) => (
                  <Button
                    key={cat}
                    variant="ghost"
                    size="sm"
                    onClick={() => startCreatingRoadmap(cat)}
                  >
                    <Plus className="w-4 h-4" /> {cat}
                  </Button>
                ))}
            </div>
          )}

          {roadmaps.map((r, i) => {
            const done = r.tasks.filter((t) => t.done).length;
            const pct = r.tasks.length ? Math.round((done / r.tasks.length) * 100) : 0;
            return (
              <motion.button
                key={r.id}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={i}
                onClick={() => setActiveRoadmapId(r.id)}
                className="w-full text-left glass-card p-5 hover:border-purple/30 transition-all"
              >
                <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading font-semibold text-text-primary">{r.category}</h3>
                    <p className="text-text-muted text-sm truncate">{r.project_idea}</p>
                  </div>
                  <Badge variant={r.status === "completed" ? "pop" : r.status === "active" ? "accent" : "muted"}>
                    {r.status}
                  </Badge>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple to-accent transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-text-muted text-xs whitespace-nowrap">{done}/{r.tasks.length} · {pct}%</span>
                </div>
              </motion.button>
            );
          })}
        </>
      )}
    </div>
  );
}

// ----------------------------- Roadmap detail view -----------------------------

interface RoadmapDetailProps {
  roadmap: SavedRoadmap;
  onBack: () => void;
  toggleTask: (roadmapId: string, taskId: string) => void;
  deleteRoadmap: (roadmapId: string) => void;
  adjustInstruction: string;
  setAdjustInstruction: (s: string) => void;
  adjustRoadmap: (roadmap: SavedRoadmap) => void;
  adjusting: boolean;
}

function RoadmapDetail({
  roadmap, onBack, toggleTask, deleteRoadmap,
  adjustInstruction, setAdjustInstruction, adjustRoadmap, adjusting,
}: RoadmapDetailProps) {
  const done = roadmap.tasks.filter((t) => t.done).length;
  const pct = roadmap.tasks.length ? Math.round((done / roadmap.tasks.length) * 100) : 0;

  // Group tasks by week
  const byWeek = roadmap.tasks.reduce<Record<number, RoadmapTask[]>>((acc, t) => {
    (acc[t.week] ||= []).push(t);
    return acc;
  }, {});
  const weeks = Object.keys(byWeek).map(Number).sort((a, b) => a - b);

  return (
    <div className="space-y-5">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-text-muted hover:text-text-primary text-sm"
      >
        <ArrowLeft className="w-4 h-4" /> Back to roadmaps
      </button>

      <div className="glass-card p-6">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h2 className="font-heading font-bold text-2xl text-text-primary">{roadmap.category}</h2>
              <Badge variant={roadmap.status === "completed" ? "pop" : roadmap.status === "active" ? "accent" : "muted"}>
                {roadmap.status}
              </Badge>
            </div>
            <p className="text-text-muted text-sm">{roadmap.project_idea}</p>
          </div>
          <button
            onClick={() => deleteRoadmap(roadmap.id)}
            className="text-text-muted hover:text-red-400 p-2 rounded-button hover:bg-red-500/5 transition-colors"
            aria-label="Delete roadmap"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-purple to-accent transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-text-muted text-xs whitespace-nowrap">{done}/{roadmap.tasks.length} · {pct}%</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Badge variant="muted"><Clock className="w-3 h-3 mr-1" /> {roadmap.weekly_hours}/wk</Badge>
          <Link href={`/counselor?roadmap=${roadmap.id}`}>
            <Badge variant="accent" className="cursor-pointer hover:bg-purple/20">
              <MessageSquare className="w-3 h-3 mr-1" /> Discuss in AI Counselor
            </Badge>
          </Link>
        </div>
      </div>

      {/* Task checklist */}
      <div className="glass-card p-6">
        <h3 className="font-heading font-semibold text-text-primary mb-4">Weekly Checklist</h3>
        <div className="space-y-5">
          {weeks.map((w) => (
            <div key={w}>
              <p className="text-purple text-xs font-bold uppercase tracking-wide mb-2">Week {w}</p>
              <ul className="space-y-1.5">
                {byWeek[w].map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => toggleTask(roadmap.id, t.id)}
                      className="w-full flex items-start gap-3 text-left p-2 -mx-2 rounded-button hover:bg-white/5 transition-colors group"
                    >
                      {t.done ? (
                        <CheckCircle2 className="w-5 h-5 text-pop flex-shrink-0 mt-0.5" />
                      ) : (
                        <Circle className="w-5 h-5 text-text-muted/40 group-hover:text-purple flex-shrink-0 mt-0.5" />
                      )}
                      <span className={`text-sm flex-1 ${t.done ? "text-text-muted line-through" : "text-text-primary"}`}>
                        {t.description}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Competitions */}
      {roadmap.competitions.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="font-heading font-semibold text-text-primary mb-3">Competitions & Programs</h3>
          <div className="space-y-2">
            {roadmap.competitions.map((c, i) => (
              <div key={i} className="bg-white/5 rounded-button p-3">
                <p className="text-text-primary text-sm font-medium">{c.name}</p>
                <p className="text-text-muted text-xs">{c.description}</p>
                {c.deadline && <Badge variant="muted" className="mt-1">{c.deadline}</Badge>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Common App tip */}
      {roadmap.common_app_tip && (
        <div className="glass-card p-6 border-purple/10">
          <p className="font-medium text-purple text-xs uppercase tracking-wide mb-1">Common App Tip</p>
          <p className="text-text-muted text-sm">{roadmap.common_app_tip}</p>
        </div>
      )}

      {/* Adjust with AI */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-2 mb-2">
          <Wand2 className="w-4 h-4 text-purple" />
          <h3 className="font-heading font-semibold text-text-primary">Ask AI to adjust this roadmap</h3>
        </div>
        <p className="text-text-muted text-xs mb-3">
          Tell the AI what to change — swap the project, add tasks, stretch the timeline. Completed tasks stay completed.
        </p>
        <textarea
          value={adjustInstruction}
          onChange={(e) => setAdjustInstruction(e.target.value)}
          placeholder={`e.g. "Stretch this to 8 weeks and add more data-analysis tasks." or "Switch to a cheaper project that doesn't need hardware."`}
          rows={3}
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 text-sm resize-none mb-3"
          disabled={adjusting}
        />
        <div className="flex justify-end">
          <Button
            variant="primary"
            size="sm"
            onClick={() => adjustRoadmap(roadmap)}
            loading={adjusting}
            disabled={!adjustInstruction.trim() || adjusting}
          >
            {adjusting ? "Adjusting..." : "Apply adjustment"}
          </Button>
        </div>
      </div>
    </div>
  );
}
