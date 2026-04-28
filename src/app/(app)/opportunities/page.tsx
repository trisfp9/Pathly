"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useDebounceValue } from "@/hooks/useDebounce";
import { CollegeCard } from "@/types";
import { scholarships as allScholarships } from "@/lib/scholarships";
import { competitions as allCompetitions } from "@/lib/competitions";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { GraduationCap, Trophy, Award, Search, Bookmark, BookmarkCheck, MapPin, BarChart3, TrendingUp, Sparkles, RotateCw, ExternalLink, Info } from "lucide-react";
import ProgressBar from "@/components/ui/ProgressBar";
import Link from "next/link";
import toast from "react-hot-toast";

type Tab = "colleges" | "scholarships" | "competitions";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: i * 0.05, ease: "easeOut" as const },
  }),
};

export default function OpportunitiesPage() {
  const { profile, session, refreshProfile } = useAuth();
  const [tab, setTab] = useState<Tab>("colleges");
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounceValue(searchQuery, 300);
  const [collegeList, setCollegeList] = useState<{ reach: CollegeCard[]; target: CollegeCard[]; safety: CollegeCard[] } | null>(null);
  const [collegeLoading, setCollegeLoading] = useState(false);
  const [scholarshipFilter, setScholarshipFilter] = useState<string>("all");
  const [competitionFilter, setCompetitionFilter] = useState<string>("all");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (profile?.college_list_cache) {
      setCollegeList(profile.college_list_cache);
    }
  }, [profile]);

  // Load saved item IDs so we can show filled bookmark icons
  useEffect(() => {
    if (!profile?.id) return;
    const load = async () => {
      const { createBrowserClient } = await import("@/lib/supabase");
      const supabase = createBrowserClient();
      const { data } = await supabase
        .from("saved_items")
        .select("item_id");
      if (data) setSavedIds(new Set(data.map((r: { item_id: string }) => r.item_id)));
    };
    load();
  }, [profile?.id]);

  const generateColleges = async () => {
    if (!session?.access_token) return;
    setCollegeLoading(true);
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 60000);
    try {
      const res = await fetch("/api/opportunities/colleges", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        signal: abortController.signal,
      });
      if (res.status === 429) { toast.error("You're going too fast — please wait a moment."); return; }
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed with status ${res.status}`);
      }
      const data = await res.json();
      setCollegeList(data.colleges);
      await refreshProfile();
    } catch (err) {
      let message = "Something went wrong. Please try again.";
      if (err instanceof Error) {
        message = err.name === "AbortError"
          ? "Request timed out. Please try again."
          : err.message;
      }
      toast.error(message);
    } finally {
      clearTimeout(timeoutId);
      setCollegeLoading(false);
    }
  };

  const saveItem = async (type: string, itemId: string, itemData: Record<string, unknown>) => {
    if (!session?.access_token) return;
    if (savedIds.has(itemId)) return; // already saved
    setSavedIds((prev) => new Set(prev).add(itemId)); // optimistic
    try {
      const { createBrowserClient } = await import("@/lib/supabase");
      const supabase = createBrowserClient();
      const { error } = await supabase.from("saved_items").upsert({
        user_id: profile!.id,
        item_type: type,
        item_id: itemId,
        item_data: itemData,
      }, { onConflict: "user_id,item_id" });
      if (error) throw error;
      toast.success("Saved!");
    } catch {
      setSavedIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
      toast.error("Failed to save.");
    }
  };

  const filteredScholarships = allScholarships.filter((s) => {
    const matchSearch = !debouncedSearch || s.name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchFilter = scholarshipFilter === "all" || s.tags.includes(scholarshipFilter);
    return matchSearch && matchFilter;
  });

  const filteredCompetitions = allCompetitions.filter((c) => {
    const matchSearch = !debouncedSearch || c.name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchFilter = competitionFilter === "all" || c.field === competitionFilter;
    return matchSearch && matchFilter;
  });

  const scholarshipTags = ["all", "need-based", "merit", "STEM", "arts", "first-gen", "international"];
  const competitionFields = ["all", ...Array.from(new Set(allCompetitions.map((c) => c.field)))];

  if (!profile) return <CardSkeleton />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading font-bold text-3xl text-text-primary">Opportunities</h1>
        <p className="text-text-muted mt-1">Colleges, scholarships, and competitions curated for you.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 rounded-button p-1 w-fit">
        {([
          { id: "colleges", label: "Colleges", icon: GraduationCap },
          { id: "scholarships", label: "Scholarships", icon: Award },
          { id: "competitions", label: "Competitions", icon: Trophy },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearchQuery(""); }}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-medium transition-all ${
              tab === t.id ? "bg-purple text-white" : "text-text-muted hover:text-text-primary"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Search bar for scholarships & competitions */}
      {tab !== "colleges" && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${tab}...`}
            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 transition-colors text-sm"
          />
        </div>
      )}

      {/* Colleges Tab */}
      {tab === "colleges" && (
        <div className="space-y-6">
          {/* Profile strength card */}
          <StrengthForCollegeList
            strength={profile.profile_strength || 0}
            lastListGenAt={profile.college_list_cache?.generated_at || null}
            strengthUpdatedAt={profile.profile_strength_updated_at || null}
            isPro={profile.is_pro}
            hasList={!!collegeList}
            onRegenerate={generateColleges}
            loading={collegeLoading}
          />

          {!collegeList ? (
            <div className="glass-card p-8 text-center max-w-xl mx-auto">
              <GraduationCap className="w-12 h-12 text-purple mx-auto mb-4" />
              <h2 className="font-heading font-semibold text-xl text-text-primary mb-2">Generate Your College List</h2>
              <p className="text-text-muted text-sm mb-6">AI will create a personalized Reach / Target / Safety list based on your profile.</p>
              <Button variant="primary" size="lg" onClick={generateColleges} loading={collegeLoading}>
                {collegeLoading ? "Generating..." : "Generate My List"}
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {(["reach", "target", "safety"] as const).map((tier) => (
                <div key={tier}>
                  <h3 className="font-heading font-semibold text-lg text-text-primary mb-3 capitalize flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-full ${
                      tier === "reach" ? "bg-red-400" : tier === "target" ? "bg-amber-400" : "bg-green-400"
                    }`} />
                    {tier} Schools
                  </h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    {collegeList[tier]?.map((college, i) => (
                      <motion.div key={college.name} initial="hidden" animate="visible" variants={fadeUp} custom={i} className="glass-card p-5">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-1 gap-2">
                          <h4 className="font-heading font-semibold text-text-primary leading-tight">{college.name}</h4>
                          <button
                            onClick={() => saveItem("college", college.name, college as unknown as Record<string, unknown>)}
                            className={`transition-colors flex-shrink-0 mt-0.5 ${savedIds.has(college.name) ? "text-purple cursor-default" : "text-text-muted hover:text-purple"}`}
                            title={savedIds.has(college.name) ? "Saved" : "Save"}
                          >
                            {savedIds.has(college.name)
                              ? <BookmarkCheck className="w-4 h-4" />
                              : <Bookmark className="w-4 h-4" />}
                          </button>
                        </div>
                        <div className="flex items-center gap-2 text-text-muted text-xs mb-3">
                          <MapPin className="w-3 h-3" /> {college.location}
                        </div>
                        <div className="flex gap-2 flex-wrap mb-4">
                          <Badge variant="muted">GPA: {college.avg_gpa}</Badge>
                          <Badge variant="muted">SAT: {college.avg_sat}</Badge>
                          <Badge variant="muted"><BarChart3 className="w-3 h-3 mr-1" /> {college.acceptance_rate}</Badge>
                        </div>

                        {/* Scores panel */}
                        {(college.fit_score != null || college.profile_strength_needed != null) && (() => {
                          const hasMeasured = !!profile.profile_strength_updated_at;
                          const odds = (college.profile_strength_needed != null && hasMeasured)
                            ? getCombinedOdds(profile.profile_strength, college.profile_strength_needed, college.fit_score ?? null)
                            : null;
                          const fitScore = college.fit_score;
                          const needed = college.profile_strength_needed;

                          const fitColor = fitScore == null ? "" : fitScore >= 80 ? "text-pop" : fitScore >= 60 ? "text-amber-400" : "text-red-400";
                          const oddsColor = odds == null ? "" : odds >= 60 ? "text-pop" : odds >= 35 ? "text-amber-400" : "text-red-400";

                          const colCount = [fitScore, odds ?? (needed != null ? "ph" : null), needed].filter(Boolean).length || 1;

                          return (
                            <div className="relative mb-4 group/scores">
                              <div className={`bg-white/5 rounded-xl p-3 grid gap-0 divide-x divide-white/10`}
                                style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
                                {fitScore != null && (
                                  <div className="text-center px-2">
                                    <p className="text-text-muted text-[10px] uppercase tracking-wide mb-1">Fit</p>
                                    <p className={`font-heading font-bold text-xl ${fitColor}`}>{fitScore}</p>
                                    <p className="text-text-muted text-[10px]">/ 100</p>
                                  </div>
                                )}
                                {needed != null && (
                                  <div className="text-center px-2">
                                    {hasMeasured && odds != null ? (
                                      <>
                                        <p className="text-text-muted text-[10px] uppercase tracking-wide mb-1">Odds</p>
                                        <p className={`font-heading font-bold text-xl ${oddsColor}`}>{odds}%</p>
                                        <p className="text-text-muted text-[10px]">admission</p>
                                      </>
                                    ) : (
                                      <>
                                        <p className="text-text-muted text-[10px] uppercase tracking-wide mb-1">Odds</p>
                                        <p className="font-heading font-bold text-xl text-text-muted/40">—</p>
                                        <p className="text-text-muted text-[10px]">needs score</p>
                                      </>
                                    )}
                                  </div>
                                )}
                                {needed != null && (
                                  <div className="text-center px-2">
                                    <p className="text-text-muted text-[10px] uppercase tracking-wide mb-1">Required</p>
                                    <p className="font-heading font-bold text-xl text-text-primary">{needed}</p>
                                    <p className="text-text-muted text-[10px]">score</p>
                                  </div>
                                )}
                                {/* Info icon */}
                                <div className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-surface border border-white/10 flex items-center justify-center cursor-default">
                                  <Info className="w-2.5 h-2.5 text-text-muted" />
                                </div>
                              </div>
                              {/* Tooltip */}
                              <div className="absolute top-full left-0 right-0 mt-2 bg-surface border border-white/10 rounded-xl p-3 shadow-2xl opacity-0 invisible group-hover/scores:opacity-100 group-hover/scores:visible transition-all z-50 pointer-events-none">
                                <ul className="space-y-2 text-xs">
                                  {fitScore != null && (
                                    <li className="flex gap-2">
                                      <span className={`font-bold shrink-0 ${fitColor}`}>Fit {fitScore}</span>
                                      <span className="text-text-muted">How well this college matches your major, goals, and environment preferences (0 = poor match, 100 = ideal match).</span>
                                    </li>
                                  )}
                                  {needed != null && (
                                    <li className="flex gap-2">
                                      <span className="font-bold text-text-primary shrink-0">Odds {odds != null ? `${odds}%` : "—"}</span>
                                      <span className="text-text-muted">Estimated admission probability combining your profile strength and fit score. {!hasMeasured && "Calculate your profile strength first."}</span>
                                    </li>
                                  )}
                                  {needed != null && (
                                    <li className="flex gap-2">
                                      <span className="font-bold text-text-primary shrink-0">Required {needed}</span>
                                      <span className="text-text-muted">Minimum profile score competitive applicants typically have. Your score: {hasMeasured ? profile.profile_strength : "not measured yet"}.</span>
                                    </li>
                                  )}
                                </ul>
                                {!hasMeasured && (
                                  <p className="mt-2 text-[10px] text-purple border-t border-white/10 pt-2">
                                    → Head to <strong>Progress</strong> and hit Recalculate to unlock Odds.
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        <p className="text-text-muted text-xs mb-3 italic">&ldquo;{college.fit_reason}&rdquo;</p>
                        {college.url && (
                          <a
                            href={college.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-purple hover:text-purple-light text-xs font-medium transition-colors"
                          >
                            Visit website <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              ))}

            </div>
          )}
        </div>
      )}

      {/* Scholarships Tab */}
      {tab === "scholarships" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {scholarshipTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setScholarshipFilter(tag)}
                className={`px-3 py-1.5 rounded-badge text-xs font-medium transition-all border ${
                  scholarshipFilter === tag
                    ? "bg-purple/15 text-purple border-purple/30"
                    : "bg-white/5 text-text-muted border-white/10 hover:border-white/20"
                }`}
              >
                {tag === "all" ? "All" : tag}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {filteredScholarships.map((s, i) => (
              <motion.div key={s.id} initial="hidden" animate="visible" variants={fadeUp} custom={i} className="glass-card p-5">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-heading font-semibold text-text-primary text-sm">{s.name}</h4>
                  <button
                    onClick={() => saveItem("scholarship", s.id, s as unknown as Record<string, unknown>)}
                    className={`transition-colors flex-shrink-0 ${savedIds.has(s.id) ? "text-purple cursor-default" : "text-text-muted hover:text-purple"}`}
                    title={savedIds.has(s.id) ? "Saved" : "Save"}
                  >
                    {savedIds.has(s.id) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-purple font-heading font-bold text-lg mb-1">{s.amount}</p>
                <p className="text-text-muted text-xs mb-3">{s.description}</p>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex gap-1 flex-wrap">
                    {s.tags.map((tag) => (
                      <Badge key={tag} variant="muted">{tag}</Badge>
                    ))}
                  </div>
                  <span className="text-text-muted text-xs">Due: {s.deadline}</span>
                </div>
                {s.url && s.url !== "#" && (
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-purple hover:text-purple-light text-xs font-medium transition-colors"
                  >
                    Visit official site <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Competitions Tab */}
      {tab === "competitions" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            {competitionFields.map((f) => (
              <button
                key={f}
                onClick={() => setCompetitionFilter(f)}
                className={`px-3 py-1.5 rounded-badge text-xs font-medium transition-all border ${
                  competitionFilter === f
                    ? "bg-purple/15 text-purple border-purple/30"
                    : "bg-white/5 text-text-muted border-white/10 hover:border-white/20"
                }`}
              >
                {f === "all" ? "All" : f}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {filteredCompetitions.map((c, i) => (
              <motion.div key={c.id} initial="hidden" animate="visible" variants={fadeUp} custom={i} className="glass-card p-5">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-heading font-semibold text-text-primary text-sm">{c.name}</h4>
                  <button
                    onClick={() => saveItem("competition", c.id, c as unknown as Record<string, unknown>)}
                    className={`transition-colors flex-shrink-0 ${savedIds.has(c.id) ? "text-purple cursor-default" : "text-text-muted hover:text-purple"}`}
                    title={savedIds.has(c.id) ? "Saved" : "Save"}
                  >
                    {savedIds.has(c.id) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-text-muted text-xs mb-3">{c.description}</p>
                <div className="flex gap-2 mb-3">
                  <Badge variant="accent">{c.field}</Badge>
                  <Badge variant={c.difficulty === "Advanced" ? "warning" : c.difficulty === "Intermediate" ? "accent" : "muted"}>
                    {c.difficulty}
                  </Badge>
                </div>
                {c.url && c.url !== "#" && (
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-purple hover:text-purple-light text-xs font-medium transition-colors"
                  >
                    Visit official site <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Profile-only admission likelihood (sigmoid curve).
// At par = ~55%, +10 = ~80%, -10 = ~25%, -20 = ~8%.
function getProfileLikelihood(studentScore: number, neededScore: number): number {
  const delta = studentScore - neededScore;
  const raw = 100 / (1 + Math.exp(-0.18 * (delta + 3)));
  return Math.max(1, Math.min(99, Math.round(raw)));
}

// Combined odds: if fit score available, blend 70% profile likelihood + 30% fit score.
// If no fit score (old cached list), use pure profile likelihood so we don't manufacture a fake constant.
function getCombinedOdds(studentScore: number, neededScore: number, fitScore: number | null): number {
  const profileOdds = getProfileLikelihood(studentScore, neededScore);
  if (fitScore == null) return profileOdds;
  // Fit nudges odds: high fit (90+) adds ~+9pts, low fit (30) subtracts ~-9pts.
  const combined = profileOdds * 0.70 + fitScore * 0.30;
  return Math.max(1, Math.min(99, Math.round(combined)));
}

function StrengthForCollegeList({
  strength,
  lastListGenAt,
  strengthUpdatedAt,
  isPro,
  hasList,
  onRegenerate,
  loading,
}: {
  strength: number;
  lastListGenAt: string | null;
  strengthUpdatedAt: string | null;
  isPro: boolean;
  hasList: boolean;
  onRegenerate: () => void;
  loading: boolean;
}) {
  // Free users: can regenerate when profile strength has been recomputed after last list generation.
  // Pro users: always.
  const strengthUpdatedSinceList =
    strengthUpdatedAt && lastListGenAt && new Date(strengthUpdatedAt) > new Date(lastListGenAt);
  const canRegenerate = isPro || !hasList || !!strengthUpdatedSinceList;

  return (
    <div className="glass-card p-5 border-purple/20 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent via-purple to-energy" />
      <div className="flex items-center justify-between gap-4 mb-3 flex-wrap">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-purple" />
          <div>
            <p className="text-text-primary font-medium text-sm">Profile Strength</p>
            <p className="text-text-muted text-xs">College list is matched to this score.</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-heading font-bold text-2xl text-text-primary">{strength}%</span>
          {hasList ? (
            <Button
              variant={strengthUpdatedSinceList ? "purple" : "ghost"}
              size="sm"
              onClick={onRegenerate}
              loading={loading}
              disabled={!canRegenerate && !loading}
            >
              {strengthUpdatedSinceList ? <Sparkles className="w-4 h-4" /> : <RotateCw className="w-4 h-4" />}
              {strengthUpdatedSinceList ? "Regenerate (new score!)" : "Regenerate"}
            </Button>
          ) : null}
        </div>
      </div>
      <ProgressBar value={strength} variant={strength >= 70 ? "pop" : strength >= 40 ? "accent" : "purple"} />
      {hasList && !canRegenerate && (
        <p className="text-text-muted/70 text-xs mt-3">
          Update your grades or mark activities complete in{" "}
          <Link href="/progress" className="text-purple hover:underline">Progress</Link>{" "}
          to unlock a fresh list.
        </p>
      )}
      {strength === 0 && (
        <p className="text-text-muted/70 text-xs mt-3">
          No score yet — head to{" "}
          <Link href="/progress" className="text-purple hover:underline">Progress</Link>{" "}
          and click Recalculate for an honest AI assessment.
        </p>
      )}
    </div>
  );
}
