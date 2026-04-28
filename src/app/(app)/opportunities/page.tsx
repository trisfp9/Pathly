"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useDebounceValue } from "@/hooks/useDebounce";
import { CollegeCard, Scholarship, Competition } from "@/types";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { GraduationCap, Trophy, Award, Search, Bookmark, BookmarkCheck, MapPin, BarChart3, TrendingUp, Sparkles, RotateCw, ExternalLink, Info, Crown } from "lucide-react";
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
  const [scholarshipRegion, setScholarshipRegion] = useState<string>("all");
  const [competitionFilter, setCompetitionFilter] = useState<string>("all");
  const [competitionRegion, setCompetitionRegion] = useState<string>("all");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  // Supabase data
  const [allScholarships, setAllScholarships] = useState<Scholarship[]>([]);
  const [allCompetitions, setAllCompetitions] = useState<Competition[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // AI generation
  const [aiScholarshipsLoading, setAiScholarshipsLoading] = useState(false);
  const [aiCompetitionsLoading, setAiCompetitionsLoading] = useState(false);
  const [aiScholarships, setAiScholarships] = useState(profile?.ai_scholarships_cache ?? null);
  const [aiCompetitions, setAiCompetitions] = useState(profile?.ai_competitions_cache ?? null);

  useEffect(() => {
    if (profile?.college_list_cache) {
      setCollegeList(profile.college_list_cache);
    }
    if (profile?.ai_scholarships_cache) setAiScholarships(profile.ai_scholarships_cache);
    if (profile?.ai_competitions_cache) setAiCompetitions(profile.ai_competitions_cache);
  }, [profile]);

  // Load scholarships + competitions from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        const { createBrowserClient } = await import("@/lib/supabase");
        const supabase = createBrowserClient();
        const [{ data: s }, { data: c }] = await Promise.all([
          supabase.from("scholarships").select("*").order("name"),
          supabase.from("competitions").select("*").order("name"),
        ]);
        setAllScholarships((s as Scholarship[]) || []);
        setAllCompetitions((c as Competition[]) || []);
      } catch (err) {
        console.error("Failed to load opportunities:", err);
      } finally {
        setDataLoading(false);
      }
    };
    loadData();
  }, []);

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

  const generateAiScholarships = async () => {
    if (!session?.access_token) return;
    setAiScholarshipsLoading(true);
    try {
      const res = await fetch("/api/opportunities/scholarships", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 429) { toast.error("Too many requests — wait a moment."); return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Generation failed"); }
      const data = await res.json();
      setAiScholarships(data);
      toast.success("AI scholarship picks ready!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate. Please try again.");
    } finally {
      setAiScholarshipsLoading(false);
    }
  };

  const generateAiCompetitions = async () => {
    if (!session?.access_token) return;
    setAiCompetitionsLoading(true);
    try {
      const res = await fetch("/api/opportunities/competitions", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 429) { toast.error("Too many requests — wait a moment."); return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || "Generation failed"); }
      const data = await res.json();
      setAiCompetitions(data);
      toast.success("AI competition picks ready!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate. Please try again.");
    } finally {
      setAiCompetitionsLoading(false);
    }
  };

  const filteredScholarships = allScholarships.filter((s) => {
    const matchSearch = !debouncedSearch || s.name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchFilter = scholarshipFilter === "all" || (s.tags || []).includes(scholarshipFilter);
    const matchRegion = scholarshipRegion === "all"
      || (scholarshipRegion === "international" && s.country === "International")
      || (scholarshipRegion === "us" && s.country === "US")
      || (scholarshipRegion === "domestic" && s.country === (profile?.country || ""));
    return matchSearch && matchFilter && matchRegion;
  });

  const filteredCompetitions = allCompetitions.filter((c) => {
    const matchSearch = !debouncedSearch || c.name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchFilter = competitionFilter === "all" || c.field === competitionFilter;
    const matchRegion = competitionRegion === "all"
      || (competitionRegion === "international" && c.country === "International")
      || (competitionRegion === "us" && c.country === "US")
      || (competitionRegion === "domestic" && c.country === (profile?.country || ""));
    return matchSearch && matchFilter && matchRegion;
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
                          {college.avg_act && college.avg_act !== "N/A" && (
                            <Badge variant="muted">ACT: {college.avg_act}</Badge>
                          )}
                          <Badge variant="muted"><BarChart3 className="w-3 h-3 mr-1" /> {college.acceptance_rate}</Badge>
                        </div>

                        {/* Scores panel — always show all 3 columns */}
                        {(college.fit_score != null || college.profile_strength_needed != null) && (() => {
                          const hasMeasured = !!profile.profile_strength_updated_at;
                          const odds = (college.profile_strength_needed != null && hasMeasured)
                            ? getCombinedOdds(profile.profile_strength, college.profile_strength_needed, college.fit_score ?? null)
                            : null;
                          const fitScore = college.fit_score;
                          const needed = college.profile_strength_needed;

                          const fitColor = fitScore == null ? "text-text-muted/40" : fitScore >= 80 ? "text-pop" : fitScore >= 60 ? "text-amber-400" : "text-red-400";
                          const oddsColor = odds == null ? "text-text-muted/40" : odds >= 60 ? "text-pop" : odds >= 35 ? "text-amber-400" : "text-red-400";

                          return (
                            <div className="relative mb-4 group/scores">
                              <div className="bg-white/5 rounded-xl p-3 grid grid-cols-3 gap-0 divide-x divide-white/10">
                                {/* Fit */}
                                <div className="text-center px-2">
                                  <p className="text-text-muted text-[10px] uppercase tracking-wide mb-1">Fit</p>
                                  <p className={`font-heading font-bold text-xl ${fitColor}`}>
                                    {fitScore != null ? fitScore : "—"}
                                  </p>
                                  <p className="text-text-muted text-[10px]">{fitScore != null ? "/ 100" : "regen list"}</p>
                                </div>
                                {/* Odds */}
                                <div className="text-center px-2">
                                  <p className="text-text-muted text-[10px] uppercase tracking-wide mb-1">Odds</p>
                                  <p className={`font-heading font-bold text-xl ${oddsColor}`}>
                                    {odds != null ? `${odds}%` : "—"}
                                  </p>
                                  <p className="text-text-muted text-[10px]">{hasMeasured ? "admission" : "needs score"}</p>
                                </div>
                                {/* Required */}
                                <div className="text-center px-2">
                                  <p className="text-text-muted text-[10px] uppercase tracking-wide mb-1">Required</p>
                                  <p className={`font-heading font-bold text-xl ${needed != null ? "text-text-primary" : "text-text-muted/40"}`}>
                                    {needed != null ? needed : "—"}
                                  </p>
                                  <p className="text-text-muted text-[10px]">score</p>
                                </div>
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
                                  <li className="flex gap-2">
                                    <span className={`font-bold shrink-0 ${fitColor}`}>Odds {odds != null ? `${odds}%` : "—"}</span>
                                    <span className="text-text-muted">Estimated admission probability combining your profile strength and fit score. {!hasMeasured && "Calculate your profile strength first."}</span>
                                  </li>
                                  <li className="flex gap-2">
                                    <span className="font-bold text-text-primary shrink-0">Required {needed ?? "—"}</span>
                                    <span className="text-text-muted">Minimum profile score competitive applicants typically have. Your score: {hasMeasured ? profile.profile_strength : "not measured yet"}.</span>
                                  </li>
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
        <div className="space-y-6">
          {/* Pro AI Picks */}
          {profile.is_pro ? (
            <div className="glass-card p-5 border-purple/20 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent via-purple to-energy" />
              <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-purple" />
                  <p className="font-heading font-semibold text-text-primary">AI Picks for You</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple bg-purple/10 px-2 py-0.5 rounded-full">Pro</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Button
                    variant="purple" size="sm"
                    onClick={generateAiScholarships}
                    loading={aiScholarshipsLoading}
                    disabled={aiScholarshipsLoading || cooldownHours(aiScholarships?.generated_at) > 0}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {aiScholarships ? "Regenerate" : "Generate My Picks"}
                  </Button>
                  {cooldownHours(aiScholarships?.generated_at) > 0 && (
                    <p className="text-text-muted/60 text-[10px]">Next in {cooldownHours(aiScholarships?.generated_at)}h</p>
                  )}
                </div>
              </div>
              <p className="text-text-muted text-xs mb-4">
                Scholarships matched to your major, country, and profile — not a generic list.
                {aiScholarships?.generated_at && (
                  <span className="ml-1 text-text-muted/50">Generated {timeAgo(aiScholarships.generated_at)}.</span>
                )}
              </p>
              {aiScholarshipsLoading && (
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="h-28 bg-white/5 rounded-xl shimmer" />
                  <div className="h-28 bg-white/5 rounded-xl shimmer" />
                </div>
              )}
              {!aiScholarshipsLoading && aiScholarships && (
                <div className="grid md:grid-cols-2 gap-3">
                  {aiScholarships.scholarships.map((s, i) => (
                    <ScholarshipCard key={s.id} scholarship={s} savedIds={savedIds} onSave={saveItem} index={i} />
                  ))}
                </div>
              )}
              {!aiScholarshipsLoading && !aiScholarships && (
                <p className="text-text-muted/60 text-xs italic">Click &ldquo;Generate My Picks&rdquo; to get AI-curated scholarships based on your profile.</p>
              )}
            </div>
          ) : (
            <div className="glass-card p-5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-heading font-semibold text-text-primary text-sm">Get AI-matched scholarships ✦</p>
                <p className="text-text-muted text-xs mt-0.5">Pro users get a personalised list matched to their major, country, and profile.</p>
              </div>
              <Link href="/pricing"><Button variant="pop" size="sm">Upgrade to Pro</Button></Link>
            </div>
          )}

          {/* Browse all */}
          <div>
            <p className="text-text-muted text-xs font-medium uppercase tracking-wide mb-3">Browse All Scholarships</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {["all", "need-based", "merit", "STEM", "arts", "first-gen", "international"].map((tag) => (
                <button key={tag} onClick={() => setScholarshipFilter(tag)}
                  className={`px-3 py-1.5 rounded-badge text-xs font-medium transition-all border ${scholarshipFilter === tag ? "bg-purple/15 text-purple border-purple/30" : "bg-white/5 text-text-muted border-white/10 hover:border-white/20"}`}>
                  {tag === "all" ? "All" : tag}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap mb-4">
              {[
                { id: "all", label: "All regions" },
                { id: "international", label: "🌍 International" },
                { id: "us", label: "🇺🇸 US" },
                ...(profile?.country && profile.country !== "US" ? [{ id: "domestic", label: `🏠 ${profile.country}` }] : []),
              ].map((r) => (
                <button key={r.id} onClick={() => setScholarshipRegion(r.id)}
                  className={`px-3 py-1.5 rounded-badge text-xs font-medium transition-all border ${scholarshipRegion === r.id ? "bg-accent/15 text-accent border-accent/30" : "bg-white/5 text-text-muted border-white/10 hover:border-white/20"}`}>
                  {r.label}
                </button>
              ))}
            </div>
            {dataLoading ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="h-32 bg-white/5 rounded-xl shimmer" />
                <div className="h-32 bg-white/5 rounded-xl shimmer" />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredScholarships.map((s, i) => (
                  <ScholarshipCard key={s.id} scholarship={s} savedIds={savedIds} onSave={saveItem} index={i} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Competitions Tab */}
      {tab === "competitions" && (
        <div className="space-y-6">
          {/* Pro AI Picks */}
          {profile.is_pro ? (
            <div className="glass-card p-5 border-purple/20 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent via-purple to-energy" />
              <div className="flex items-center justify-between gap-4 flex-wrap mb-1">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-purple" />
                  <p className="font-heading font-semibold text-text-primary">AI Picks for You</p>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple bg-purple/10 px-2 py-0.5 rounded-full">Pro</span>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Button
                    variant="purple" size="sm"
                    onClick={generateAiCompetitions}
                    loading={aiCompetitionsLoading}
                    disabled={aiCompetitionsLoading || cooldownHours(aiCompetitions?.generated_at) > 0}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {aiCompetitions ? "Regenerate" : "Generate My Picks"}
                  </Button>
                  {cooldownHours(aiCompetitions?.generated_at) > 0 && (
                    <p className="text-text-muted/60 text-[10px]">Next in {cooldownHours(aiCompetitions?.generated_at)}h</p>
                  )}
                </div>
              </div>
              <p className="text-text-muted text-xs mb-4">
                Competitions in your field and country — with difficulty spread so you can start now.
                {aiCompetitions?.generated_at && (
                  <span className="ml-1 text-text-muted/50">Generated {timeAgo(aiCompetitions.generated_at)}.</span>
                )}
              </p>
              {aiCompetitionsLoading && (
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="h-28 bg-white/5 rounded-xl shimmer" />
                  <div className="h-28 bg-white/5 rounded-xl shimmer" />
                </div>
              )}
              {!aiCompetitionsLoading && aiCompetitions && (
                <div className="grid md:grid-cols-2 gap-3">
                  {aiCompetitions.competitions.map((c, i) => (
                    <CompetitionCard key={c.id} competition={c} savedIds={savedIds} onSave={saveItem} index={i} />
                  ))}
                </div>
              )}
              {!aiCompetitionsLoading && !aiCompetitions && (
                <p className="text-text-muted/60 text-xs italic">Click &ldquo;Generate My Picks&rdquo; to get AI-curated competitions based on your profile.</p>
              )}
            </div>
          ) : (
            <div className="glass-card p-5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="font-heading font-semibold text-text-primary text-sm">Get AI-matched competitions ✦</p>
                <p className="text-text-muted text-xs mt-0.5">Pro users get a personalised list matched to their field, country, and grade.</p>
              </div>
              <Link href="/pricing"><Button variant="pop" size="sm">Upgrade to Pro</Button></Link>
            </div>
          )}

          {/* Browse all */}
          <div>
            <p className="text-text-muted text-xs font-medium uppercase tracking-wide mb-3">Browse All Competitions</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {["all", ...Array.from(new Set(allCompetitions.map((c) => c.field)))].map((f) => (
                <button key={f} onClick={() => setCompetitionFilter(f)}
                  className={`px-3 py-1.5 rounded-badge text-xs font-medium transition-all border ${competitionFilter === f ? "bg-purple/15 text-purple border-purple/30" : "bg-white/5 text-text-muted border-white/10 hover:border-white/20"}`}>
                  {f === "all" ? "All" : f}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap mb-4">
              {[
                { id: "all", label: "All regions" },
                { id: "international", label: "🌍 International" },
                { id: "us", label: "🇺🇸 US" },
                ...(profile?.country && profile.country !== "US" ? [{ id: "domestic", label: `🏠 ${profile.country}` }] : []),
              ].map((r) => (
                <button key={r.id} onClick={() => setCompetitionRegion(r.id)}
                  className={`px-3 py-1.5 rounded-badge text-xs font-medium transition-all border ${competitionRegion === r.id ? "bg-accent/15 text-accent border-accent/30" : "bg-white/5 text-text-muted border-white/10 hover:border-white/20"}`}>
                  {r.label}
                </button>
              ))}
            </div>
            {dataLoading ? (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="h-32 bg-white/5 rounded-xl shimmer" />
                <div className="h-32 bg-white/5 rounded-xl shimmer" />
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-4">
                {filteredCompetitions.map((c, i) => (
                  <CompetitionCard key={c.id} competition={c} savedIds={savedIds} onSave={saveItem} index={i} />
                ))}
              </div>
            )}
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

function ScholarshipCard({
  scholarship: s,
  savedIds,
  onSave,
  index,
}: {
  scholarship: Scholarship;
  savedIds: Set<string>;
  onSave: (type: string, id: string, data: Record<string, unknown>) => void;
  index: number;
}) {
  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={index} className="glass-card p-5">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-heading font-semibold text-text-primary text-sm leading-tight">{s.name}</h4>
        <button
          onClick={() => onSave("scholarship", s.id, s as unknown as Record<string, unknown>)}
          className={`transition-colors flex-shrink-0 ml-2 ${savedIds.has(s.id) ? "text-purple cursor-default" : "text-text-muted hover:text-purple"}`}
          title={savedIds.has(s.id) ? "Saved" : "Save"}
        >
          {savedIds.has(s.id) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-purple font-heading font-bold text-lg mb-1">{s.amount}</p>
      <p className="text-text-muted text-xs mb-3">{s.description}</p>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {(s.tags || []).map((tag) => <Badge key={tag} variant="muted">{tag}</Badge>)}
          {s.country && s.country !== "US" && <Badge variant="accent">{s.country}</Badge>}
        </div>
        <span className="text-text-muted text-xs shrink-0">Due: {s.deadline}</span>
      </div>
      {s.eligibility && <p className="text-text-muted/70 text-[11px] mb-2 italic">{s.eligibility}</p>}
      {s.url && s.url !== "#" && (
        <a href={s.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-purple hover:text-purple-light text-xs font-medium transition-colors">
          Visit official site <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </motion.div>
  );
}

function CompetitionCard({
  competition: c,
  savedIds,
  onSave,
  index,
}: {
  competition: Competition;
  savedIds: Set<string>;
  onSave: (type: string, id: string, data: Record<string, unknown>) => void;
  index: number;
}) {
  return (
    <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={index} className="glass-card p-5">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-heading font-semibold text-text-primary text-sm leading-tight">{c.name}</h4>
        <button
          onClick={() => onSave("competition", c.id, c as unknown as Record<string, unknown>)}
          className={`transition-colors flex-shrink-0 ml-2 ${savedIds.has(c.id) ? "text-purple cursor-default" : "text-text-muted hover:text-purple"}`}
          title={savedIds.has(c.id) ? "Saved" : "Save"}
        >
          {savedIds.has(c.id) ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-text-muted text-xs mb-3">{c.description}</p>
      <div className="flex gap-2 mb-3 flex-wrap">
        <Badge variant="accent">{c.field}</Badge>
        <Badge variant={c.difficulty === "Advanced" ? "warning" : c.difficulty === "Intermediate" ? "accent" : "muted"}>
          {c.difficulty}
        </Badge>
        {c.country && c.country !== "US" && c.country !== "International" && (
          <Badge variant="muted">{c.country}</Badge>
        )}
        {c.deadline && <span className="text-text-muted text-xs self-center">Due: {c.deadline}</span>}
      </div>
      {c.url && c.url !== "#" && (
        <a href={c.url} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-purple hover:text-purple-light text-xs font-medium transition-colors">
          Visit official site <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </motion.div>
  );
}

// Hours remaining in 24h cooldown. Returns 0 if no cooldown active.
function cooldownHours(generatedAt: string | undefined): number {
  if (!generatedAt) return 0;
  const hoursLeft = 24 - (Date.now() - new Date(generatedAt).getTime()) / 3_600_000;
  return hoursLeft > 0 ? Math.ceil(hoursLeft) : 0;
}

// Human-readable "X hours ago" / "X days ago"
function timeAgo(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return "just now";
  if (hours < 24) return `${Math.floor(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
