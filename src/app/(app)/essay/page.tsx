"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { EssayFeedback } from "@/types";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Skeleton from "@/components/ui/Skeleton";
import { PenLine, Sparkles, Lock, Crown } from "lucide-react";
import toast from "react-hot-toast";

export default function EssayPage() {
  const { profile, session, refreshProfile, loading } = useAuth();
  const [essayDraft, setEssayDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (profile) setEssayDraft(profile.essay_text || "");
  }, [profile]);

  const submitEssay = async () => {
    if (!session?.access_token) return;
    if (essayDraft.trim().length < 100) {
      toast.error("Essay must be at least 100 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/essay-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ essay: essayDraft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || "Review failed.");
        return;
      }
      await refreshProfile();
      toast.success(`Essay reviewed — score ${data.score}/100. +30 XP`);
    } catch {
      toast.error("Review failed.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="space-y-8 max-w-3xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const feedback = profile.essay_feedback as EssayFeedback | null;
  const score = profile.essay_score;
  const last = profile.essay_last_reviewed_at ? new Date(profile.essay_last_reviewed_at) : null;
  const nextAt = last ? new Date(last.getTime() + 7 * 24 * 3_600_000) : null;
  const canSubmit = !nextAt || Date.now() >= nextAt.getTime();

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-heading font-bold text-3xl text-text-primary">Essay Review</h1>
          <Badge variant="pop">Pro</Badge>
        </div>
        <p className="text-text-muted mt-1">
          Get a brutally honest AI critique of your personal statement or supplements. One submission per week.
        </p>
      </div>

      {!profile.is_pro ? (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-10 text-center space-y-4 border-pop/20"
        >
          <div className="w-16 h-16 rounded-2xl bg-pop/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-pop" />
          </div>
          <h2 className="font-heading font-bold text-2xl text-text-primary">Unlock AI Essay Review</h2>
          <p className="text-text-muted text-sm max-w-md mx-auto leading-relaxed">
            Submit a personal statement or supplement and get a brutally honest, detailed AI critique every week —
            the kind of feedback that actually lifts your essay score. Includes strengths, weaknesses, and
            concrete rewrite suggestions.
          </p>
          <Link href="/pricing" className="inline-block">
            <Button variant="pop" size="md">
              <Crown className="w-4 h-4" /> Upgrade to Pro
            </Button>
          </Link>
        </motion.div>
      ) : (
        <>
          {score != null && feedback && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 space-y-4 border-purple/20"
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="text-text-muted text-xs uppercase tracking-wide">Latest essay score</p>
                  <p className="font-heading font-bold text-4xl text-text-primary">
                    {score}
                    <span className="text-text-muted text-base">/100</span>
                  </p>
                </div>
                {last && (
                  <div className="text-right text-xs text-text-muted/70">
                    Reviewed {last.toLocaleDateString()}
                  </div>
                )}
              </div>
              {feedback.overall && (
                <p className="text-text-primary text-sm italic leading-relaxed">&ldquo;{feedback.overall}&rdquo;</p>
              )}
              <div className="grid md:grid-cols-3 gap-3">
                <FeedbackList title="Strengths" color="text-pop" items={feedback.strengths} />
                <FeedbackList title="Weaknesses" color="text-orange-400" items={feedback.weaknesses} />
                <FeedbackList title="Rewrite ideas" color="text-purple" items={feedback.rewrite_suggestions} />
              </div>
            </motion.div>
          )}

          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-3">
              <PenLine className="w-5 h-5 text-purple" />
              <h2 className="font-heading font-semibold text-text-primary">Submit an essay</h2>
              <span className="text-text-muted/60 text-xs">100–8,000 characters</span>
            </div>
            <textarea
              value={essayDraft}
              onChange={(e) => setEssayDraft(e.target.value)}
              placeholder="Paste your essay here..."
              rows={14}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 text-sm resize-y"
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-text-muted/60 text-xs">
                {essayDraft.length} chars
                {!canSubmit && nextAt && ` · next submission ${nextAt.toLocaleDateString()}`}
              </p>
              <Button
                variant="purple"
                size="sm"
                onClick={submitEssay}
                loading={submitting}
                disabled={!canSubmit || submitting}
              >
                <Sparkles className="w-4 h-4" /> {submitting ? "Grading..." : "Submit for review"}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function FeedbackList({ title, color, items }: { title: string; color: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-white/5 rounded-button p-3">
      <p className={`text-xs font-semibold uppercase tracking-wide mb-1.5 ${color}`}>{title}</p>
      <ul className="space-y-1">
        {items.map((s, i) => (
          <li key={i} className="text-text-muted text-xs leading-relaxed">• {s}</li>
        ))}
      </ul>
    </div>
  );
}
