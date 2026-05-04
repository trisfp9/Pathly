"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import toast from "react-hot-toast";

const GRADES = ["9th Grade", "10th Grade", "11th Grade", "12th Grade"];
const AIMING = ["Reach-focused", "Balanced", "Safety-focused"];
const MAJORS = ["Engineering", "Biology/Pre-Med", "Business", "CS/Tech", "Humanities", "Arts", "Law", "Medicine", "Other"];
const GPA_RANGES = ["Below 2.5", "2.5 - 3.0", "3.0 - 3.5", "3.5 - 3.8", "3.8 - 4.0", "4.0+"];
const EC_INTERESTS = ["Sports", "Arts", "Tech", "Research", "Community Service", "Business", "Writing", "Music", "Science", "Math", "Other"];
const TIME_OPTIONS = ["Less than 2 hours", "2-5 hours", "5-10 hours", "10+ hours"];
const CONCERNS = ["Grades", "Extracurriculars", "Essays", "Financial Aid", "All of the above"];

interface OnboardingData {
  name: string;
  grade: string;
  country: string;
  target_country: string;
  dream_college: string;
  aiming_level: string;
  major_interest: string;
  major_other: string;
  gpa_range: string;
  test_scores: string;
  extracurricular_interests: string[];
  time_available: string;
  biggest_concern: string;
  current_activities_raw: string; // free-text, parsed into current_activities array
}

const TOTAL_STEPS = 9;

export default function OnboardingPage() {
  const [step, setStep] = useState(0); // 0 = welcome screen, 1-9 = setup steps
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    name: "", grade: "", country: "", target_country: "",
    dream_college: "", aiming_level: "", major_interest: "",
    major_other: "", gpa_range: "", test_scores: "",
    extracurricular_interests: [], time_available: "", biggest_concern: "",
    current_activities_raw: "",
  });
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);

  useEffect(() => {
    const loadExisting = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/auth"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (profile) {
        const currentAct = Array.isArray(profile.current_activities) ? profile.current_activities : [];
        const raw = currentAct.map((a: { name?: string; role?: string; description?: string }) =>
          `${a.name || ""}${a.role ? ` (${a.role})` : ""}${a.description ? ` — ${a.description}` : ""}`
        ).filter(Boolean).join("\n");
        setData((d) => ({
          ...d,
          name: profile.name || "",
          grade: profile.grade || "",
          country: profile.country || "",
          target_country: profile.target_country || "",
          dream_college: profile.dream_college || "",
          aiming_level: profile.aiming_level || "",
          major_interest: profile.major_interest || "",
          gpa_range: profile.gpa_range || "",
          test_scores: profile.test_scores || "",
          extracurricular_interests: profile.extracurricular_interests || [],
          time_available: profile.time_available || "",
          biggest_concern: profile.biggest_concern || "",
          current_activities_raw: raw,
        }));
      }
    };
    loadExisting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveStep = async (fields: Partial<OnboardingData>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const updates: Record<string, unknown> = {};
    Object.entries(fields).forEach(([key, value]) => {
      if (key !== "major_other") updates[key] = value;
    });
    const { error } = await supabase.from("profiles").upsert({ id: user.id, ...updates });
    if (error) throw error;
  };

  const next = async () => {
    setLoading(true);
    try {
      switch (step) {
        case 1: await saveStep({ name: data.name, grade: data.grade, country: data.country, target_country: data.target_country }); break;
        case 2: await saveStep({ dream_college: data.dream_college }); break;
        case 3: await saveStep({ aiming_level: data.aiming_level }); break;
        case 4: {
          const major = data.major_interest === "Other" ? data.major_other : data.major_interest;
          await saveStep({ major_interest: major }); break;
        }
        case 5: await saveStep({ gpa_range: data.gpa_range, test_scores: data.test_scores }); break;
        case 6: await saveStep({ extracurricular_interests: data.extracurricular_interests }); break;
        case 7: await saveStep({ time_available: data.time_available }); break;
        case 8: {
          const parsed = parseCurrentActivities(data.current_activities_raw);
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("profiles").update({ current_activities: parsed }).eq("id", user.id);
          }
          break;
        }
        case 9: {
          await saveStep({ biggest_concern: data.biggest_concern });
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.from("profiles").update({
              onboarding_completed: true,
              xp: 50,
              last_active: new Date().toISOString().split("T")[0],
              streak: 1,
              // Profile strength starts at 0 — the AI will compute the real score
              // based on grades, activities, awards, and essays. Filling out
              // fields doesn't make you strong; doing things does.
              profile_strength: 0,
            }).eq("id", user.id);
            // Kick off AI profile strength calculation in the background —
            // don't block onboarding on it. We need a fresh session.
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
              fetch("/api/profile-strength", {
                method: "POST",
                headers: { Authorization: `Bearer ${session.access_token}` },
              }).catch(() => {});
            }
          }
          router.push("/dashboard");
          return;
        }
      }
      setStep((s) => s + 1);
    } catch {
      toast.error("Failed to save — please try again.");
    } finally {
      setLoading(false);
    }
  };

  const toggleEC = (interest: string) => {
    setData((d) => ({
      ...d,
      extracurricular_interests: d.extracurricular_interests.includes(interest)
        ? d.extracurricular_interests.filter((i) => i !== interest)
        : [...d.extracurricular_interests, interest],
    }));
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple to-accent flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-heading font-bold text-lg text-text-primary">Pathly</span>
          </div>
          {step > 0 && (
            <>
              <ProgressBar value={step} max={TOTAL_STEPS} variant="purple" size="sm" />
              <p className="text-text-muted text-xs mt-2">Step {step} of {TOTAL_STEPS}</p>
            </>
          )}
        </motion.div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="glass-card p-8"
          >
            {step === 0 && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <h2 className="font-heading font-bold text-3xl text-text-primary leading-tight">
                    Welcome to <span className="text-gradient">Pathly</span>
                  </h2>
                  <p className="text-text-muted text-sm leading-relaxed">
                    Your AI-powered college admissions counselor. We&apos;ll help you build the strongest application possible — step by step.
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    {
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                        </svg>
                      ),
                      title: "Profile Strength Score",
                      desc: "See exactly where you stand and what to improve",
                    },
                    {
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                          <path d="M6 12v5c3 3 9 3 12 0v-5" />
                        </svg>
                      ),
                      title: "Personalized College List",
                      desc: "AI-matched reach, target & safety schools based on your profile",
                    },
                    {
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M8.56 2.9A7 7 0 0 1 19 9v4" />
                          <path d="M19 13a7 7 0 1 1-13.48-2.71" />
                          <circle cx="12" cy="13" r="3" />
                        </svg>
                      ),
                      title: "Extracurricular Roadmaps",
                      desc: "Week-by-week plans to build standout activities",
                    },
                    {
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                      ),
                      title: "AI Counselor",
                      desc: "24/7 guidance on any admissions question, tailored to you",
                    },
                    {
                      icon: (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" x2="8" y1="13" y2="13" />
                          <line x1="16" x2="8" y1="17" y2="17" />
                          <line x1="10" x2="8" y1="9" y2="9" />
                        </svg>
                      ),
                      title: "Essay Review & Scholarships",
                      desc: "AI feedback on your personal statement + curated funding opportunities",
                    },
                  ].map((feat) => (
                    <div key={feat.title} className="flex items-start gap-3 p-3 rounded-button bg-white/3 border border-white/8">
                      <div className="w-8 h-8 rounded-lg bg-purple/15 border border-purple/20 flex items-center justify-center flex-shrink-0 text-purple mt-0.5">
                        {feat.icon}
                      </div>
                      <div>
                        <p className="text-text-primary text-sm font-medium">{feat.title}</p>
                        <p className="text-text-muted text-xs mt-0.5 leading-relaxed">{feat.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <p className="text-text-muted/60 text-xs text-center">
                  Takes about 2 minutes to set up. You can edit everything later.
                </p>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl text-text-primary">Let&apos;s get to know you</h2>
                <Input label="What's your name?" value={data.name} onChange={(v) => setData({...data, name: v})} placeholder="Your first name" />
                <SelectGrid label="What grade are you in?" options={GRADES} value={data.grade} onChange={(v) => setData({...data, grade: v})} />
                <Input label="Country" value={data.country} onChange={(v) => setData({...data, country: v})} placeholder="e.g. United States" />
                <Input label="Target country for college" value={data.target_country} onChange={(v) => setData({...data, target_country: v})} placeholder="e.g. United States" />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl text-text-primary">Dream school?</h2>
                <p className="text-text-muted text-sm">No pressure — you can always change this later.</p>
                <Input label="Dream college (optional)" value={data.dream_college} onChange={(v) => setData({...data, dream_college: v})} placeholder="e.g. MIT, Stanford, Harvard" />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl text-text-primary">What&apos;s your strategy?</h2>
                <SelectGrid label="How are you aiming?" options={AIMING} value={data.aiming_level} onChange={(v) => setData({...data, aiming_level: v})} />
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl text-text-primary">What are you interested in?</h2>
                <SelectGrid label="Primary interest / major" options={MAJORS} value={data.major_interest} onChange={(v) => setData({...data, major_interest: v})} />
                {data.major_interest === "Other" && (
                  <Input label="Tell us more" value={data.major_other} onChange={(v) => setData({...data, major_other: v})} placeholder="Your interest area" />
                )}
              </div>
            )}

            {step === 5 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl text-text-primary">Academics</h2>
                <SelectGrid label="GPA range" options={GPA_RANGES} value={data.gpa_range} onChange={(v) => setData({...data, gpa_range: v})} />
                <Input label="Test scores (optional)" value={data.test_scores} onChange={(v) => setData({...data, test_scores: v})} placeholder="e.g. SAT 1450, ACT 33" />
              </div>
            )}

            {step === 6 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl text-text-primary">Extracurricular interests</h2>
                <p className="text-text-muted text-sm">Select all that interest you.</p>
                <div className="flex flex-wrap gap-2">
                  {EC_INTERESTS.map((interest) => (
                    <button
                      key={interest}
                      onClick={() => toggleEC(interest)}
                      className={`px-4 py-2 rounded-badge text-sm font-medium transition-all duration-200 border ${
                        data.extracurricular_interests.includes(interest)
                          ? "bg-purple/15 text-purple border-purple/30"
                          : "bg-white/5 text-text-muted border-white/10 hover:border-white/20"
                      }`}
                    >
                      {interest}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step === 7 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl text-text-primary">Time commitment</h2>
                <SelectGrid label="Hours per week for extracurriculars?" options={TIME_OPTIONS} value={data.time_available} onChange={(v) => setData({...data, time_available: v})} />
              </div>
            )}

            {step === 8 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl text-text-primary">What have you already done?</h2>
                <p className="text-text-muted text-sm">
                  List any clubs, activities, awards, leadership roles, jobs, or projects you&apos;ve done.
                  Put each on its own line. Leave blank if you&apos;re starting from scratch — that&apos;s totally fine.
                </p>
                <p className="text-text-muted/70 text-xs">
                  Example: <span className="italic">Math team captain — 2 years</span><br />
                  <span className="italic">Volunteered at food bank — 80 hours</span><br />
                  <span className="italic">Started a coding club at school</span>
                </p>
                <textarea
                  value={data.current_activities_raw}
                  onChange={(e) => setData({ ...data, current_activities_raw: e.target.value })}
                  placeholder="One activity per line..."
                  rows={6}
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/40 focus:outline-none focus:border-purple/50 transition-colors text-sm resize-none"
                />
                <p className="text-text-muted/60 text-xs">
                  You&apos;ll be able to edit this anytime in your Progress tab.
                </p>
              </div>
            )}

            {step === 9 && (
              <div className="space-y-5">
                <h2 className="font-heading font-bold text-2xl text-text-primary">What concerns you most?</h2>
                <SelectGrid label="Biggest worry" options={CONCERNS} value={data.biggest_concern} onChange={(v) => setData({...data, biggest_concern: v})} />
              </div>
            )}

            <div className="flex justify-between mt-8">
              {step > 1 && (
                <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                  Back
                </Button>
              )}
              <Button
                variant="primary"
                onClick={step === 0 ? () => setStep(1) : next}
                loading={loading}
                className="ml-auto"
                disabled={step > 0 && !canProceed(step, data)}
              >
                {step === 0 ? "Get started →" : step === TOTAL_STEPS ? "Complete Setup" : "Continue"}
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </main>
  );
}

function Input({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder: string;
}) {
  return (
    <div>
      <label className="block text-sm text-text-muted mb-2">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 transition-colors text-sm"
      />
    </div>
  );
}

function SelectGrid({ label, options, value, onChange }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-sm text-text-muted mb-3">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`px-4 py-3 rounded-button text-sm font-medium transition-all duration-200 border text-left ${
              value === option
                ? "bg-purple/15 text-purple border-purple/30"
                : "bg-white/5 text-text-muted border-white/10 hover:border-white/20"
            }`}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function canProceed(step: number, data: OnboardingData): boolean {
  switch (step) {
    case 1: return !!data.name && !!data.grade;
    case 2: return true; // dream college is optional
    case 3: return !!data.aiming_level;
    case 4: return !!data.major_interest && (data.major_interest !== "Other" || !!data.major_other);
    case 5: return !!data.gpa_range;
    case 6: return data.extracurricular_interests.length > 0;
    case 7: return !!data.time_available;
    case 8: return true; // current activities is optional — starting from scratch is fine
    case 9: return !!data.biggest_concern;
    default: return true;
  }
}

function parseCurrentActivities(raw: string): { name: string; description?: string }[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      // Split on " — " or " - " to separate name from description if present
      const sep = line.match(/\s[—-]\s/);
      if (sep && sep.index !== undefined) {
        return {
          name: line.slice(0, sep.index).trim(),
          description: line.slice(sep.index + sep[0].length).trim(),
        };
      }
      return { name: line };
    });
}

// Note: we no longer compute profile strength client-side from onboarding.
// The AI-powered /api/profile-strength route is the source of truth.
