"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { ExtracurricularRecommendation } from "@/types";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Sparkles, ChevronRight, Lock, RotateCw, BookOpen, Clock, TrendingUp, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.06, ease: "easeOut" as const },
  }),
};

export default function ExtracurricularsPage() {
  const { profile, session, refreshProfile } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [recommendations, setRecommendations] = useState<ExtracurricularRecommendation[] | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [roadmapData, setRoadmapData] = useState<Record<string, unknown> | null>(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);

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
    try {
      const res = await fetch("/api/extracurriculars/analyze", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
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
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
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

  const generateRoadmap = async () => {
    if (!session?.access_token || !profile?.is_pro) return;
    setRoadmapLoading(true);
    try {
      const res = await fetch("/api/extracurriculars/roadmap", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ categories: selectedCategories }),
      });
      if (res.status === 429) {
        toast.error("You're going too fast — please wait a moment.");
        return;
      }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Roadmap generation failed with status ${res.status}`);
      }
      const data = await res.json();
      setRoadmapData(data.roadmap);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      toast.error(message);
    } finally {
      setRoadmapLoading(false);
    }
  };

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : prev.length < 3 ? [...prev, cat] : prev
    );
  };

  if (!profile) return <div className="space-y-4"><CardSkeleton /><CardSkeleton /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading font-bold text-3xl text-text-primary">Extracurriculars</h1>
        <p className="text-text-muted mt-1">Build a standout activity profile that admissions officers love.</p>
      </div>

      {/* Step indicator */}
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
          {step === 1 ? "AI Analysis" : step === 2 ? "Select Categories" : "Your Roadmap"}
        </span>
      </div>

      <AnimatePresence mode="wait">
        {/* Step 1: Analyze */}
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

        {/* Step 2: Select Categories */}
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

        {/* Step 3: Roadmap */}
        {step === 3 && recommendations && (
          <motion.div key="step3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {selectedCategories.map((cat, i) => {
              const rec = recommendations.find((r) => r.category === cat);
              if (!rec) return null;
              return (
                <motion.div key={cat} initial="hidden" animate="visible" variants={fadeUp} custom={i} className="glass-card p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-purple/10 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-purple" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-heading font-semibold text-lg text-text-primary mb-2">{rec.category}</h3>
                      <div className="space-y-3 text-sm text-text-muted">
                        <div>
                          <p className="font-medium text-text-primary text-xs uppercase tracking-wide mb-1">What this involves</p>
                          <p>{rec.explanation}</p>
                        </div>
                        <div>
                          <p className="font-medium text-text-primary text-xs uppercase tracking-wide mb-1">Why admissions officers value this</p>
                          <p>Demonstrates initiative, intellectual curiosity, and dedication to your field. Shows you go beyond the classroom.</p>
                        </div>
                        <div>
                          <p className="font-medium text-text-primary text-xs uppercase tracking-wide mb-1">Getting started</p>
                          <p>Start by exploring what&apos;s available at your school and in your community. Look for online opportunities too.</p>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          <Badge variant={rec.effort_level === "High" ? "warning" : "muted"}>
                            <Clock className="w-3 h-3 mr-1" /> {rec.effort_level} Effort
                          </Badge>
                          <Badge variant={rec.impact_level === "Very High" ? "pop" : "accent"}>
                            <TrendingUp className="w-3 h-3 mr-1" /> {rec.impact_level} Impact
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}

            {/* Pro roadmap section */}
            {!profile.is_pro ? (
              <div className="glass-card p-8 border-pop/20 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/90 z-10" />
                <div className="relative z-20">
                  <Lock className="w-8 h-8 text-pop mx-auto mb-4" />
                  <h3 className="font-heading font-semibold text-xl text-text-primary mb-2">
                    Unlock the full roadmap
                  </h3>
                  <p className="text-text-muted text-sm mb-6 max-w-md mx-auto">
                    Get real competition names, specific project ideas, week-by-week plans, and Common App writing tips.
                  </p>
                  <Link href="/pricing">
                    <Button variant="pop">Upgrade to Pro</Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {!roadmapData ? (
                  <div className="text-center py-8">
                    <Button variant="primary" size="lg" onClick={generateRoadmap} loading={roadmapLoading}>
                      {roadmapLoading ? "Generating your roadmap..." : "Generate Full Roadmap"}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {Object.entries(roadmapData).map(([category, data]: [string, unknown]) => {
                      const roadmap = data as {
                        competitions?: { name: string; description: string; deadline?: string }[];
                        project_ideas?: string[];
                        weekly_plan?: { week: number; tasks: string[] }[];
                        weekly_hours?: string;
                        common_app_tip?: string;
                      };
                      return (
                        <div key={category} className="glass-card p-6 space-y-4">
                          <h3 className="font-heading font-bold text-lg text-purple">{category} — Full Roadmap</h3>

                          {roadmap.competitions && (
                            <div>
                              <p className="font-medium text-text-primary text-xs uppercase tracking-wide mb-2">Competitions & Programs</p>
                              <div className="space-y-2">
                                {roadmap.competitions.map((c, j) => (
                                  <div key={j} className="bg-white/5 rounded-button p-3">
                                    <p className="text-text-primary text-sm font-medium">{c.name}</p>
                                    <p className="text-text-muted text-xs">{c.description}</p>
                                    {c.deadline && <Badge variant="muted" className="mt-1">{c.deadline}</Badge>}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {roadmap.project_ideas && (
                            <div>
                              <p className="font-medium text-text-primary text-xs uppercase tracking-wide mb-2">Project Ideas</p>
                              <ul className="space-y-1">
                                {roadmap.project_ideas.map((idea, j) => (
                                  <li key={j} className="text-text-muted text-sm flex items-start gap-2">
                                    <span className="text-purple mt-0.5">&#8226;</span> {idea}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {roadmap.weekly_plan && (
                            <div>
                              <p className="font-medium text-text-primary text-xs uppercase tracking-wide mb-2">4-Week Starter Plan</p>
                              <div className="grid grid-cols-2 gap-2">
                                {roadmap.weekly_plan.map((w) => (
                                  <div key={w.week} className="bg-white/5 rounded-button p-3">
                                    <p className="text-purple text-xs font-bold mb-1">Week {w.week}</p>
                                    <ul className="space-y-0.5">
                                      {w.tasks.map((t, k) => (
                                        <li key={k} className="text-text-muted text-xs">{t}</li>
                                      ))}
                                    </ul>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {roadmap.common_app_tip && (
                            <div className="bg-purple/5 border border-purple/10 rounded-button p-4">
                              <p className="font-medium text-purple text-xs uppercase tracking-wide mb-1">Common App Tip</p>
                              <p className="text-text-muted text-sm">{roadmap.common_app_tip}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <Button variant="ghost" onClick={() => setStep(2)} size="sm">
              Change selection
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
