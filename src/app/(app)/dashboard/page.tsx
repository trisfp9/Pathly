"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import { useAuth } from "@/lib/auth-context";
import { getXPLevel, XP_SOURCES } from "@/types";
import ProgressBar from "@/components/ui/ProgressBar";
import Badge from "@/components/ui/Badge";
import { CardSkeleton } from "@/components/ui/Skeleton";
import { Flame, Target, BookmarkCheck, MessageSquare, Zap, TrendingUp, Star, Info, Crown } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.5, delay: i * 0.08, ease: "easeOut" as const },
  }),
};

export default function DashboardPage() {
  const { profile, loading, session, user, refreshProfile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [tip, setTip] = useState<string | null>(null);
  const [tipLoading, setTipLoading] = useState(true);
  const [savedCount, setSavedCount] = useState<number | null>(null);

  // Fallback Pro activation: if we just came back from a successful checkout,
  // verify the subscription with Stripe directly and flip is_pro. This way
  // Pro works even if the webhook didn't fire.
  useEffect(() => {
    if (!session?.access_token) return;
    if (searchParams.get("checkout") !== "success") return;

    const activate = async () => {
      const toastId = toast.loading("Activating Pro...");
      try {
        // Give the webhook a brief chance first
        await new Promise((r) => setTimeout(r, 1200));
        await refreshProfile();

        // If webhook already flipped it, we're done
        const res = await fetch("/api/stripe/verify", {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.is_pro) {
          await refreshProfile();
          toast.success("Welcome to Pro!", { id: toastId });
        } else {
          toast.error("Couldn't verify your subscription yet. Refresh in a minute.", { id: toastId });
        }
      } catch {
        toast.error("Activation check failed.", { id: toastId });
      } finally {
        // Strip the query param so refreshing doesn't re-run this
        router.replace("/dashboard");
      }
    };
    activate();
  }, [searchParams, session, refreshProfile, router]);

  useEffect(() => {
    if (!session?.access_token) return;
    const fetchTip = async () => {
      try {
        const res = await fetch("/api/tip", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setTip(data.tip);
        }
      } catch { /* tip is non-critical */ }
      setTipLoading(false);
    };
    fetchTip();
  }, [session]);

  useEffect(() => {
    if (!user) return;
    const fetchSavedCount = async () => {
      try {
        const { createBrowserClient } = await import("@/lib/supabase");
        const supabase = createBrowserClient();
        const { count } = await supabase
          .from("saved_items")
          .select("*", { count: "exact", head: true });
        setSavedCount(count ?? 0);
      } catch { /* non-critical */ }
    };
    fetchSavedCount();
  }, [user]);

  if (loading || !profile) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <div className="grid md:grid-cols-3 gap-4">
          <CardSkeleton /><CardSkeleton /><CardSkeleton />
        </div>
      </div>
    );
  }

  const xpInfo = getXPLevel(profile.xp);
  const messagesUsed = profile.is_pro ? profile.ai_messages_this_month : profile.ai_messages_used;
  const messagesMax = profile.is_pro ? 500 : 7;
  const breakdown = profile.profile_strength_breakdown as { dream_college_target?: number } | null;

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-heading font-bold text-3xl md:text-4xl text-text-primary">
            Hey {profile.name || "there"}, let&apos;s build your path
          </h1>
          {profile.is_pro && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r from-pop/20 to-purple/20 border border-pop/30 text-pop text-xs font-bold uppercase tracking-wider">
              <Crown className="w-3.5 h-3.5" /> Pro
            </span>
          )}
        </div>
        <p className="text-text-muted mt-2">Your daily progress snapshot</p>
      </motion.div>

      {/* Streak + XP Row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Streak */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1} className="glass-card p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                className="w-12 h-12 rounded-2xl bg-orange-500/10 flex items-center justify-center"
              >
                <Flame className="w-6 h-6 text-orange-400" />
              </motion.div>
              <div>
                <p className="text-text-muted text-sm">Daily Streak</p>
                <p className="font-heading font-bold text-3xl text-text-primary">{profile.streak}</p>
              </div>
            </div>
            <Badge variant={profile.streak >= 7 ? "pop" : "muted"}>
              {profile.streak >= 7 ? "On Fire" : "Keep Going"}
            </Badge>
          </div>
          <p className="text-text-muted text-xs">
            {profile.streak > 0 ? `${profile.streak} day${profile.streak > 1 ? "s" : ""} in a row!` : "Log in daily to build your streak."}
          </p>
        </motion.div>

        {/* XP Level */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={2} className="glass-card p-6 relative group z-10 hover:z-50">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-purple/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-purple" />
              </div>
              <div>
                <p className="text-text-muted text-sm flex items-center gap-1.5">
                  Level
                  <Info className="w-3 h-3 text-text-muted/50 group-hover:text-purple transition-colors" />
                </p>
                <p className="font-heading font-bold text-xl text-text-primary">{xpInfo.current.name}</p>
              </div>
            </div>
            <Badge variant="accent">{profile.xp} XP</Badge>
          </div>
          <ProgressBar
            value={xpInfo.progress}
            variant="accent"
            size="md"
            label={xpInfo.next ? `${xpInfo.next.xp - profile.xp} XP to ${xpInfo.next.name}` : "Max Level!"}
            showLabel
          />
          {/* Hover: how to earn XP */}
          <div className="absolute top-full right-0 mt-2 w-72 bg-surface border border-white/10 rounded-card p-4 shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[100] pointer-events-none">
            <p className="text-text-primary text-xs font-semibold uppercase tracking-wide mb-2">How to earn XP</p>
            <ul className="space-y-1.5">
              {XP_SOURCES.map((s) => (
                <li key={s.action} className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">{s.action}</span>
                  <span className="text-purple font-semibold">+{s.xp}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>

      {/* Dream College Card */}
      {profile.dream_college && (
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={3} className="glass-card p-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-pop/10 flex items-center justify-center flex-shrink-0">
            <Target className="w-6 h-6 text-pop" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-text-muted text-sm">Dream School</p>
            <p className="font-heading font-semibold text-lg text-text-primary">{profile.dream_college}</p>
          </div>
          {breakdown?.dream_college_target != null && (
            <div className="text-right flex-shrink-0">
              <p className="text-text-muted text-xs">Target score</p>
              <p className="font-heading font-bold text-xl text-pop">{breakdown.dream_college_target}</p>
            </div>
          )}
        </motion.div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Profile Strength", value: profile.profile_strength_updated_at ? `${profile.profile_strength}%` : "Unmeasured", icon: TrendingUp, color: "text-accent", href: "/progress" },
          { label: "Items Saved", value: savedCount === null ? "—" : String(savedCount), icon: BookmarkCheck, color: "text-pop", href: "/saved" },
          { label: "Messages Used", value: `${messagesUsed}/${messagesMax}`, icon: MessageSquare, color: "text-orange-400", href: "/counselor" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial="hidden" animate="visible" variants={fadeUp} custom={4 + i}>
            <Link
              href={stat.href}
              className="glass-card p-4 md:p-6 text-center block hover:border-purple/30 hover:-translate-y-0.5 transition-all"
            >
              <stat.icon className={`w-5 h-5 ${stat.color} mx-auto mb-2`} />
              <p className="font-heading font-bold text-xl text-text-primary">{stat.value}</p>
              <p className="text-text-muted text-xs mt-1">{stat.label}</p>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* AI Tip of the Day */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={7} className="glass-card p-6">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Star className="w-5 h-5 text-purple" />
          </div>
          <div className="flex-1">
            <p className="text-text-muted text-sm font-medium mb-1">AI Tip of the Day</p>
            {tipLoading ? (
              <div className="h-4 w-full bg-white/5 rounded shimmer" />
            ) : tip ? (
              <p className="text-text-primary text-sm leading-relaxed">{tip}</p>
            ) : (
              <p className="text-text-muted text-sm italic">Complete your profile to get daily tips!</p>
            )}
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={8} className="grid md:grid-cols-2 gap-4">
        <Link href="/extracurriculars" className="glass-card p-6 hover:border-purple/20 transition-colors group">
          <h3 className="font-heading font-semibold text-text-primary mb-1 group-hover:text-purple transition-colors">Explore Extracurriculars</h3>
          <p className="text-text-muted text-sm">Get AI-powered activity recommendations tailored to your profile.</p>
        </Link>
        <Link href="/counselor" className="glass-card p-6 hover:border-purple/20 transition-colors group">
          <h3 className="font-heading font-semibold text-text-primary mb-1 group-hover:text-purple transition-colors">Chat with AI Counselor</h3>
          <p className="text-text-muted text-sm">Ask anything about college admissions, essays, or your plan.</p>
        </Link>
      </motion.div>

      {/* Upgrade nudge for free users */}
      {!profile.is_pro && (
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={9} className="glass-card p-6 border-pop/20">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <p className="font-heading font-semibold text-text-primary">Unlock the full experience</p>
              <p className="text-text-muted text-sm">Get detailed roadmaps, real competition names, and 500 monthly AI messages.</p>
            </div>
            <Link href="/pricing">
              <Button variant="pop" size="sm">Upgrade to Pro</Button>
            </Link>
          </div>
        </motion.div>
      )}
    </div>
  );
}
