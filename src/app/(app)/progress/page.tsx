"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { createBrowserClient } from "@/lib/supabase";
import { CurrentActivity, CompletedActivity, ProfileStrengthBreakdown, Award as AwardType } from "@/types";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import Skeleton from "@/components/ui/Skeleton";
import {
  TrendingUp, Sparkles, Plus, Trash2, CheckCircle2, GraduationCap, Award,
  BookOpen, PenLine, Lock, Copy, Check, ChevronDown, ChevronUp, Wand2, Info,
} from "lucide-react";
import toast from "react-hot-toast";

const GPA_RANGES = ["Below 2.5", "2.5 - 3.0", "3.0 - 3.5", "3.5 - 3.8", "3.8 - 4.0", "4.0+"];

type PageTab = "progress" | "commonapp";

interface PolishResult {
  common_app: string;
  uc: string;
  tips: string[];
}

export default function ProgressPage() {
  const { profile, session, refreshProfile, loading } = useAuth();
  const [pageTab, setPageTab] = useState<PageTab>("progress");
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [gpaRange, setGpaRange] = useState("");
  const [testScores, setTestScores] = useState("");
  const [activities, setActivities] = useState<CurrentActivity[]>([]);
  const [newActivity, setNewActivity] = useState<CurrentActivity>({ name: "", description: "", role: "", hours_per_week: "", years: "" });
  const [awards, setAwards] = useState<AwardType[]>([]);
  const [newAward, setNewAward] = useState<AwardType>({ name: "", level: "School", year: "", description: "" });

  // Common App writer state
  const [polishResults, setPolishResults] = useState<Record<number, PolishResult>>({});
  const [polishing, setPolishing] = useState<number | null>(null);
  const [expandedPolish, setExpandedPolish] = useState<Record<number, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setGpaRange(profile.gpa_range || "");
      setTestScores(profile.test_scores || "");
      setActivities(profile.current_activities || []);
      setAwards(profile.awards || []);
    }
  }, [profile]);

  const saveAwards = async (next: AwardType[]) => {
    if (!profile) return;
    const supabase = createBrowserClient();
    const { error } = await supabase.from("profiles").update({ awards: next }).eq("id", profile.id);
    if (error) { toast.error("Failed to save awards."); }
    else { setAwards(next); await refreshProfile(); }
  };

  const addAward = async () => {
    if (!newAward.name.trim()) { toast.error("Add an award name."); return; }
    const next = [...awards, { ...newAward, name: newAward.name.trim() }];
    await saveAwards(next);
    const supabase = createBrowserClient();
    await supabase.from("profiles").update({ xp: (profile?.xp || 0) + 15 }).eq("id", profile!.id);
    await refreshProfile();
    setNewAward({ name: "", level: "School", year: "", description: "" });
    toast.success("Award added. +15 XP");
  };

  const removeAward = async (idx: number) => {
    await saveAwards(awards.filter((_, i) => i !== idx));
  };

  const saveAcademics = async () => {
    if (!profile) return;
    setSaving(true);
    const supabase = createBrowserClient();
    const { error } = await supabase.from("profiles").update({ gpa_range: gpaRange, test_scores: testScores }).eq("id", profile.id);
    if (error) { toast.error("Failed to save."); }
    else { toast.success("Academics saved."); await refreshProfile(); }
    setSaving(false);
  };

  const saveActivities = async (next: CurrentActivity[]) => {
    if (!profile) return;
    const supabase = createBrowserClient();
    const { error } = await supabase.from("profiles").update({ current_activities: next }).eq("id", profile.id);
    if (error) { toast.error("Failed to save activities."); }
    else { setActivities(next); await refreshProfile(); }
  };

  const addActivity = async () => {
    if (!newActivity.name.trim()) { toast.error("Add a name for the activity."); return; }
    const next = [...activities, { ...newActivity, name: newActivity.name.trim() }];
    await saveActivities(next);
    setNewActivity({ name: "", description: "", role: "", hours_per_week: "", years: "" });
    toast.success("Added.");
  };

  const removeActivity = async (idx: number) => {
    await saveActivities(activities.filter((_, i) => i !== idx));
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
      const message = err instanceof Error
        ? (err.name === "AbortError" ? "Request timed out. Please try again." : err.message)
        : "Something went wrong.";
      toast.error(message);
    } finally {
      clearTimeout(timeoutId);
      setRecalculating(false);
    }
  };

  const polishActivity = async (idx: number) => {
    if (!session?.access_token) return;
    setPolishing(idx);
    try {
      const res = await fetch("/api/activity-polish", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activity: activities[idx] }),
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Polish failed.");
      }
      const data = await res.json();
      setPolishResults((prev) => ({ ...prev, [idx]: data }));
      setExpandedPolish((prev) => ({ ...prev, [idx]: true }));
      await refreshProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(message);
    } finally {
      setPolishing(null);
    }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    });
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-heading font-bold text-3xl text-text-primary">Progress</h1>
        <p className="text-text-muted mt-1">Track your academics, activities, and how you stack up for your target school.</p>
      </div>

      {/* Page tabs */}
      <div className="flex gap-1 bg-white/5 rounded-button p-1 w-fit">
        {([
          { id: "progress", label: "My Profile" },
          { id: "commonapp", label: "Common App Writer" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setPageTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-medium transition-all ${
              pageTab === t.id ? "bg-purple text-white" : "text-text-muted hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ── PROGRESS TAB ── */}
        {pageTab === "progress" && (
          <motion.div key="progress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-8">

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
                  <span className="font-heading font-bold text-4xl text-text-primary">
                    {profile.profile_strength_updated_at ? `${strength}%` : "—"}
                  </span>
                  <span className="text-text-muted text-sm">
                    {profile.profile_strength_updated_at ? "overall" : "not yet graded"}
                  </span>
                </div>
                <ProgressBar
                  value={profile.profile_strength_updated_at ? strength : 0}
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
                    <BreakdownTile label="Essays" value={breakdown.essays} icon={PenLine} locked={!profile.is_pro} />
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
                <span className="text-text-muted/60 text-xs">Keep these current as they change.</span>
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

            {/* Activities */}
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

            {/* Awards */}
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-center gap-3">
                <Award className="w-5 h-5 text-pop" />
                <h2 className="font-heading font-semibold text-text-primary">Awards & Honors</h2>
                <span className="text-text-muted/60 text-xs">Prestige matters — higher levels weigh much more.</span>
              </div>

              {awards.length > 0 ? (
                <ul className="space-y-2">
                  {awards.map((a, i) => (
                    <li key={i} className="flex items-start justify-between gap-3 bg-white/5 rounded-button p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-text-primary text-sm font-medium">{a.name}</p>
                          {a.level && (
                            <Badge variant={a.level === "International" || a.level === "National" ? "pop" : a.level === "State" || a.level === "Regional" ? "accent" : "muted"}>
                              {a.level}
                            </Badge>
                          )}
                          {a.year && <span className="text-text-muted/70 text-xs">{a.year}</span>}
                        </div>
                        {a.description && <p className="text-text-muted text-xs mt-1">{a.description}</p>}
                      </div>
                      <button
                        onClick={() => removeAward(i)}
                        className="text-text-muted hover:text-red-400 transition-colors p-1"
                        aria-label="Remove award"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-text-muted text-sm italic">
                  No awards yet. A regional-or-higher win meaningfully moves your strength score.
                </p>
              )}

              <div className="border-t border-white/5 pt-4 space-y-3">
                <p className="text-text-primary text-sm font-medium">Add an award</p>
                <input
                  type="text"
                  value={newAward.name}
                  onChange={(e) => setNewAward({ ...newAward, name: e.target.value })}
                  placeholder="Award name (e.g., IOI Gold Medal, USAMO Qualifier)"
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newAward.level || "School"}
                    onChange={(e) => setNewAward({ ...newAward, level: e.target.value as AwardType["level"] })}
                    className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-button text-text-primary focus:outline-none focus:border-purple/50 text-sm"
                  >
                    <option value="International" className="bg-surface">International</option>
                    <option value="National" className="bg-surface">National</option>
                    <option value="State" className="bg-surface">State / Provincial</option>
                    <option value="Regional" className="bg-surface">Regional</option>
                    <option value="School" className="bg-surface">School</option>
                    <option value="Other" className="bg-surface">Other</option>
                  </select>
                  <input
                    type="text"
                    value={newAward.year || ""}
                    onChange={(e) => setNewAward({ ...newAward, year: e.target.value })}
                    placeholder="Year (optional)"
                    className="px-4 py-2.5 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 text-sm"
                  />
                </div>
                <textarea
                  value={newAward.description || ""}
                  onChange={(e) => setNewAward({ ...newAward, description: e.target.value })}
                  placeholder="Short context (optional)"
                  rows={2}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 text-sm resize-none"
                />
                <Button variant="secondary" size="sm" onClick={addAward}>
                  <Plus className="w-4 h-4" /> Add Award (+15 XP)
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
          </motion.div>
        )}

        {/* ── COMMON APP WRITER TAB ── */}
        {pageTab === "commonapp" && (
          <motion.div key="commonapp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">

            {/* Explainer banner */}
            <div className="glass-card p-5 border-purple/15">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-purple flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-text-primary text-sm font-medium">How this works</p>
                  <p className="text-text-muted text-sm leading-relaxed">
                    The AI rewrites each activity into a punchy, verb-first description that fits the Common App (150 chars) and UC Application (350 chars). It surfaces numbers, impact, and scope — the things admissions officers actually look for.
                  </p>
                  <p className="text-text-muted text-xs mt-1">
                    Each polish uses 1 AI message. More detail in your activity description = better output.
                  </p>
                </div>
              </div>
            </div>

            {activities.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <BookOpen className="w-10 h-10 text-text-muted/40 mx-auto mb-3" />
                <p className="text-text-muted text-sm mb-3">
                  No activities to polish yet. Add them in the My Profile tab first.
                </p>
                <Button variant="ghost" size="sm" onClick={() => setPageTab("progress")}>
                  Go to My Profile
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {activities.map((a, i) => {
                  const result = polishResults[i];
                  const expanded = expandedPolish[i];
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="glass-card p-5 space-y-4"
                    >
                      {/* Activity header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-text-primary font-medium">
                            {a.name}
                            {a.role && <span className="text-text-muted font-normal"> — {a.role}</span>}
                          </p>
                          <div className="flex gap-2 text-text-muted/70 text-xs mt-0.5">
                            {a.hours_per_week && <span>{a.hours_per_week}/wk</span>}
                            {a.years && <span>• {a.years}</span>}
                          </div>
                          {a.description && (
                            <p className="text-text-muted/70 text-xs mt-1 italic">&ldquo;{a.description}&rdquo;</p>
                          )}
                        </div>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => polishActivity(i)}
                          loading={polishing === i}
                          className="flex-shrink-0"
                        >
                          <Wand2 className="w-4 h-4" />
                          {result ? "Regenerate" : "Polish"}
                        </Button>
                      </div>

                      {/* Results */}
                      {result && (
                        <div className="space-y-3 border-t border-white/5 pt-4">
                          {/* Common App */}
                          <PolishCard
                            label="Common App"
                            limit={150}
                            text={result.common_app}
                            copyKey={`ca-${i}`}
                            copiedKey={copiedKey}
                            onCopy={copyText}
                          />

                          {/* UC */}
                          <PolishCard
                            label="UC Application"
                            limit={350}
                            text={result.uc}
                            copyKey={`uc-${i}`}
                            copiedKey={copiedKey}
                            onCopy={copyText}
                          />

                          {/* Tips */}
                          {result.tips.length > 0 && (
                            <div>
                              <button
                                onClick={() => setExpandedPolish((prev) => ({ ...prev, [i]: !expanded }))}
                                className="flex items-center gap-1.5 text-text-muted text-xs hover:text-text-primary transition-colors"
                              >
                                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                {expanded ? "Hide" : "Show"} tips to strengthen this activity
                              </button>
                              {expanded && (
                                <ul className="mt-2 space-y-1.5">
                                  {result.tips.map((tip, j) => (
                                    <li key={j} className="text-text-muted text-xs flex items-start gap-2">
                                      <span className="text-purple mt-0.5 flex-shrink-0">•</span> {tip}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* Tip: add more detail */}
            {activities.length > 0 && (
              <div className="text-center text-text-muted/60 text-xs pb-4">
                The more detail you add to each activity (numbers, achievements, context), the stronger the AI output.{" "}
                <button className="text-purple hover:underline" onClick={() => setPageTab("progress")}>
                  Edit activities →
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Sub-components ──

function BreakdownTile({ label, value, icon: Icon, locked }: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  locked?: boolean;
}) {
  return (
    <div className={`bg-white/5 rounded-button p-3 relative ${locked ? "opacity-70" : ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-3.5 h-3.5 text-purple" />
        <span className="text-text-muted text-xs">{label}</span>
        {locked && <Lock className="w-3 h-3 text-text-muted/60 ml-auto" />}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="font-heading font-bold text-xl text-text-primary">{value}</span>
        <span className="text-text-muted text-xs">/100</span>
      </div>
    </div>
  );
}

function PolishCard({ label, limit, text, copyKey, copiedKey, onCopy }: {
  label: string;
  limit: number;
  text: string;
  copyKey: string;
  copiedKey: string | null;
  onCopy: (text: string, key: string) => void;
}) {
  const len = text.length;
  const pct = Math.min(len / limit, 1);
  const over = len > limit;

  return (
    <div className="bg-white/5 rounded-button p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-text-primary text-xs font-semibold uppercase tracking-wide">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-xs font-mono ${over ? "text-red-400" : len > limit * 0.9 ? "text-amber-400" : "text-text-muted"}`}>
            {len}/{limit}
          </span>
          <button
            onClick={() => onCopy(text, copyKey)}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-purple transition-colors"
          >
            {copiedKey === copyKey ? (
              <><Check className="w-3.5 h-3.5 text-pop" /> Copied</>
            ) : (
              <><Copy className="w-3.5 h-3.5" /> Copy</>
            )}
          </button>
        </div>
      </div>
      <p className="text-text-primary text-sm leading-relaxed">{text}</p>
      {/* character bar */}
      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-400" : pct > 0.9 ? "bg-amber-400" : "bg-purple"}`}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}
