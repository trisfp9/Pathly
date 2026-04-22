"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { createBrowserClient } from "@/lib/supabase";
import { CurrentActivity, CompletedActivity, ProfileStrengthBreakdown } from "@/types";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import Skeleton from "@/components/ui/Skeleton";
import {
  TrendingUp, Sparkles, Plus, Trash2, CheckCircle2, GraduationCap, Award, BookOpen, PenLine,
} from "lucide-react";
import toast from "react-hot-toast";

const GPA_RANGES = ["Below 2.5", "2.5 - 3.0", "3.0 - 3.5", "3.5 - 3.8", "3.8 - 4.0", "4.0+"];

export default function ProgressPage() {
  const { profile, session, refreshProfile, loading } = useAuth();
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [gpaRange, setGpaRange] = useState("");
  const [testScores, setTestScores] = useState("");
  const [activities, setActivities] = useState<CurrentActivity[]>([]);
  const [newActivity, setNewActivity] = useState<CurrentActivity>({ name: "", description: "", role: "", hours_per_week: "", years: "" });

  useEffect(() => {
    if (profile) {
      setGpaRange(profile.gpa_range || "");
      setTestScores(profile.test_scores || "");
      setActivities(profile.current_activities || []);
    }
  }, [profile]);

  const saveAcademics = async () => {
    if (!profile) return;
    setSaving(true);
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from("profiles")
      .update({ gpa_range: gpaRange, test_scores: testScores })
      .eq("id", profile.id);
    if (error) {
      toast.error("Failed to save.");
    } else {
      toast.success("Academics saved.");
      await refreshProfile();
    }
    setSaving(false);
  };

  const saveActivities = async (next: CurrentActivity[]) => {
    if (!profile) return;
    const supabase = createBrowserClient();
    const { error } = await supabase
      .from("profiles")
      .update({ current_activities: next })
      .eq("id", profile.id);
    if (error) {
      toast.error("Failed to save activities.");
    } else {
      setActivities(next);
      await refreshProfile();
    }
  };

  const addActivity = async () => {
    if (!newActivity.name.trim()) {
      toast.error("Add a name for the activity.");
      return;
    }
    const next = [...activities, { ...newActivity, name: newActivity.name.trim() }];
    await saveActivities(next);
    setNewActivity({ name: "", description: "", role: "", hours_per_week: "", years: "" });
    toast.success("Added.");
  };

  const removeActivity = async (idx: number) => {
    const next = activities.filter((_, i) => i !== idx);
    await saveActivities(next);
  };

  const recalculateStrength = async () => {
    if (!session?.access_token) return;
    setRecalculating(true);
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 60000);
    try {
      const res = await fetch("/api/profile-strength", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal: abortController.signal,
      });
      if (res.status === 429) { toast.error("Slow down — try again in a minute."); return; }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed with status ${res.status}`);
      }
      await refreshProfile();
      toast.success("Profile strength updated.");
    } catch (err) {
      let message = "Something went wrong.";
      if (err instanceof Error) {
        message = err.name === "AbortError" ? "Request timed out. Please try again." : err.message;
      }
      toast.error(message);
    } finally {
      clearTimeout(timeoutId);
      setRecalculating(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="space-y-8 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const breakdown = profile.profile_strength_breakdown as ProfileStrengthBreakdown | null;
  const strength = profile.profile_strength || 0;
  const completed: CompletedActivity[] = profile.completed_activities || [];

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-heading font-bold text-3xl text-text-primary">Your Progress</h1>
        <p className="text-text-muted mt-1">
          Track what you&apos;ve done, update your grades, and let the AI score your admissions strength honestly.
        </p>
      </div>

      {/* Profile Strength */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 border-purple/20 relative overflow-hidden"
      >
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent via-purple to-energy" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-purple" />
            <h2 className="font-heading font-semibold text-text-primary">Profile Strength</h2>
            {breakdown?.target_college && (
              <Badge variant="muted">vs. {breakdown.target_college}</Badge>
            )}
          </div>
          <Button variant="purple" size="sm" onClick={recalculateStrength} loading={recalculating}>
            <Sparkles className="w-4 h-4" /> {recalculating ? "Scoring..." : "Recalculate"}
          </Button>
        </div>

        <div className="mb-4">
          <div className="flex items-baseline gap-2 mb-2">
            <span className="font-heading font-bold text-4xl text-text-primary">{strength}%</span>
            <span className="text-text-muted text-sm">overall</span>
          </div>
          <ProgressBar
            value={strength}
            variant={strength >= 70 ? "pop" : strength >= 40 ? "accent" : "purple"}
            size="lg"
          />
        </div>

        {breakdown ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <BreakdownTile label="Academics" value={breakdown.academics} icon={GraduationCap} />
              <BreakdownTile label="Activities" value={breakdown.activities} icon={BookOpen} />
              <BreakdownTile label="Achievements" value={breakdown.achievements} icon={Award} />
              <BreakdownTile label="Essays" value={breakdown.essays} icon={PenLine} />
            </div>
            {breakdown.explanation && (
              <p className="text-text-muted text-sm leading-relaxed">{breakdown.explanation}</p>
            )}
            {breakdown.suggestions && breakdown.suggestions.length > 0 && (
              <div>
                <p className="text-text-primary text-xs font-semibold uppercase tracking-wide mb-2">What to focus on</p>
                <ul className="space-y-1.5">
                  {breakdown.suggestions.map((s, i) => (
                    <li key={i} className="text-text-muted text-sm flex items-start gap-2">
                      <span className="text-purple mt-0.5">•</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {profile.profile_strength_updated_at && (
              <p className="text-text-muted/60 text-xs">
                Last updated {new Date(profile.profile_strength_updated_at).toLocaleDateString()}
              </p>
            )}
          </div>
        ) : (
          <p className="text-text-muted text-sm">
            Click Recalculate to get an AI-powered, honest assessment of where you stand for admission to your target school.
          </p>
        )}
      </motion.div>

      {/* Academics */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-5 h-5 text-purple" />
          <h2 className="font-heading font-semibold text-text-primary">Academics</h2>
          <span className="text-text-muted/60 text-xs">These change over time — keep them current.</span>
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-2">GPA Range</label>
          <select
            value={gpaRange}
            onChange={(e) => setGpaRange(e.target.value)}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-button text-text-primary focus:outline-none focus:border-purple/50 transition-colors text-sm"
          >
            <option value="" className="bg-surface">Select...</option>
            {GPA_RANGES.map((g) => (
              <option key={g} value={g} className="bg-surface">{g}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-text-muted mb-2">Test Scores</label>
          <input
            type="text"
            value={testScores}
            onChange={(e) => setTestScores(e.target.value)}
            placeholder="e.g. SAT 1480, ACT 33, 3 APs (5, 5, 4)"
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 transition-colors text-sm"
          />
        </div>

        <Button variant="secondary" size="sm" onClick={saveAcademics} loading={saving}>
          Save Academics
        </Button>
      </div>

      {/* Current Activities */}
      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-purple" />
          <h2 className="font-heading font-semibold text-text-primary">Activities & Achievements</h2>
          <span className="text-text-muted/60 text-xs">Things you&apos;ve done or are currently doing.</span>
        </div>

        {activities.length > 0 ? (
          <ul className="space-y-2">
            {activities.map((a, i) => (
              <li key={i} className="flex items-start justify-between gap-3 bg-white/5 rounded-button p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-medium">
                    {a.name}
                    {a.role ? <span className="text-text-muted font-normal"> — {a.role}</span> : null}
                  </p>
                  {a.description && <p className="text-text-muted text-xs mt-0.5">{a.description}</p>}
                  <div className="flex gap-2 mt-1 text-text-muted/70 text-xs">
                    {a.hours_per_week && <span>{a.hours_per_week}/wk</span>}
                    {a.years && <span>• {a.years}</span>}
                  </div>
                </div>
                <button
                  onClick={() => removeActivity(i)}
                  className="text-text-muted hover:text-red-400 transition-colors p-1"
                  aria-label="Remove activity"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-text-muted text-sm italic">
            Nothing yet. Add what you&apos;re involved in so the AI can give you grounded advice.
          </p>
        )}

        {/* Add new */}
        <div className="border-t border-white/5 pt-4 space-y-3">
          <p className="text-text-primary text-sm font-medium">Add an activity</p>
          <input
            type="text"
            value={newActivity.name}
            onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
            placeholder="Activity name (e.g., Math Team)"
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={newActivity.role || ""}
              onChange={(e) => setNewActivity({ ...newActivity, role: e.target.value })}
              placeholder="Your role (optional)"
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 text-sm"
            />
            <input
              type="text"
              value={newActivity.hours_per_week || ""}
              onChange={(e) => setNewActivity({ ...newActivity, hours_per_week: e.target.value })}
              placeholder="Hours/week (optional)"
              className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 text-sm"
            />
          </div>
          <input
            type="text"
            value={newActivity.years || ""}
            onChange={(e) => setNewActivity({ ...newActivity, years: e.target.value })}
            placeholder="Duration (e.g., '2 years', '9th–11th grade')"
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 text-sm"
          />
          <textarea
            value={newActivity.description || ""}
            onChange={(e) => setNewActivity({ ...newActivity, description: e.target.value })}
            placeholder="Short description / achievements (optional)"
            rows={2}
            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 text-sm resize-none"
          />
          <Button variant="secondary" size="sm" onClick={addActivity}>
            <Plus className="w-4 h-4" /> Add Activity
          </Button>
        </div>
      </div>

      {/* Completed via Pathly */}
      {completed.length > 0 && (
        <div className="glass-card p-6 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-pop" />
            <h2 className="font-heading font-semibold text-text-primary">Completed via Pathly</h2>
          </div>
          <ul className="space-y-2">
            {completed.map((c, i) => (
              <li key={i} className="flex items-center gap-3 bg-white/5 rounded-button p-3">
                <CheckCircle2 className="w-4 h-4 text-pop flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-text-primary text-sm font-medium">{c.category} — {c.name}</p>
                  {c.description && <p className="text-text-muted text-xs">{c.description}</p>}
                </div>
                <span className="text-text-muted/60 text-xs">
                  {new Date(c.completed_at).toLocaleDateString()}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BreakdownTile({ label, value, icon: Icon }: { label: string; value: number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-white/5 rounded-button p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-purple" />
        <span className="text-text-muted text-xs">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-heading font-bold text-xl text-text-primary">{value}</span>
        <span className="text-text-muted text-xs">/100</span>
      </div>
    </div>
  );
}
