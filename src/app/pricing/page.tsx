"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import Button from "@/components/ui/Button";
import Navbar from "@/components/landing/Navbar";
import { Check, Crown, Sparkles, Zap, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: "easeOut" as const },
  }),
};

function PricingContent() {
  const { profile, session, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  const handleBack = () => {
    // Try to go back in history, otherwise go to a sensible default
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push(profile ? "/dashboard" : "/");
    }
  };

  // Handle return from Stripe checkout
  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "cancelled") {
      toast("Checkout cancelled. You can try again anytime.", { icon: "↩️" });
      // Clean up URL
      window.history.replaceState({}, "", "/pricing");
    }
    if (checkout === "success") {
      // Refresh profile to pick up Pro status
      refreshProfile();
    }
  }, [searchParams, refreshProfile]);

  const handleCheckout = async () => {
    if (!session?.access_token) {
      // Redirect to auth with a return URL so they come back to pricing after login
      window.location.href = "/auth?redirect=/pricing";
      return;
    }

    // Double-check that the user has a profile before proceeding
    if (!profile) {
      toast.error("Please complete onboarding first.");
      window.location.href = "/onboarding";
      return;
    }

    if (profile.is_pro) {
      toast("You're already a Pro member!", { icon: "👑" });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Checkout failed");
      }
      const { url } = await res.json();
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to start checkout. Please try again.");
    }
    setLoading(false);
  };

  const free = [
    "AI profile analysis",
    "7 lifetime AI counselor messages",
    "General extracurricular guidance",
    "One-time college list generation",
    "Save up to 5 activities",
    "Scholarship & competition database",
  ];

  const pro = [
    "500 AI messages per month",
    "Full extracurricular roadmaps",
    "Real competition names & deadlines",
    "Week-by-week action plans",
    "Common App writing tips",
    "Unlimited saved activities",
    "Regenerate recommendations anytime",
    "Timeline roadmap view",
    "Priority support",
  ];

  return (
    <main className="min-h-screen bg-background">
      {!profile && <Navbar />}

      <div className={`max-w-4xl mx-auto px-6 ${!profile ? "pt-32" : "pt-12"} pb-20`}>
        {/* Back button */}
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-text-muted hover:text-text-primary transition-colors mb-8 text-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <motion.div
          initial="hidden"
          animate="visible"
          className="text-center mb-16"
        >
          <motion.p variants={fadeUp} custom={0} className="text-purple font-medium text-sm mb-4 tracking-wide uppercase">
            Pricing
          </motion.p>
          <motion.h1 variants={fadeUp} custom={1} className="font-heading font-bold text-4xl md:text-5xl text-text-primary mb-4">
            {profile?.is_pro ? "You're on Pro" : "Unlock your full potential"}
          </motion.h1>
          <motion.p variants={fadeUp} custom={2} className="text-text-muted text-lg max-w-xl mx-auto">
            {profile?.is_pro
              ? "Thanks for being a Pro member. You have access to all features."
              : "Get detailed roadmaps, personalized plans, and unlimited AI guidance."}
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Free Plan */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" as const }}
            whileHover={{ y: -4 }}
            className="glass-card p-8 flex flex-col"
          >
            <div className="flex-1">
              <h3 className="font-heading font-semibold text-lg text-text-primary mb-1">Free</h3>
              <p className="text-text-muted text-sm mb-6">Get started with the basics</p>
              <p className="font-heading font-bold text-5xl text-text-primary mb-8">
                $0<span className="text-lg text-text-muted font-normal">/forever</span>
              </p>
              <ul className="space-y-3">
                {free.map((f, i) => (
                  <motion.li
                    key={f}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.08, ease: "easeOut" as const }}
                    className="flex items-start gap-3 text-sm text-text-muted"
                  >
                    <Check className="w-4 h-4 text-pop flex-shrink-0 mt-0.5" />
                    {f}
                  </motion.li>
                ))}
              </ul>
            </div>
            {!profile && (
              <div className="mt-8">
                <Button variant="secondary" className="w-full" onClick={() => window.location.href = "/auth"}>
                  Get Started Free
                </Button>
              </div>
            )}
          </motion.div>

          {/* Pro Plan */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.45, ease: "easeOut" as const }}
            whileHover={{ y: -4 }}
            className="glass-card p-8 border-purple/30 relative overflow-hidden flex flex-col"
          >
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-accent via-purple to-energy" />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
              className="absolute top-4 right-4"
            >
              <span className="px-3 py-1 rounded-badge bg-purple/15 text-purple text-xs font-medium border border-purple/20">
                Popular
              </span>
            </motion.div>
            <div className="flex-1">
              <h3 className="font-heading font-semibold text-lg text-text-primary mb-1 flex items-center gap-2">
                <Crown className="w-5 h-5 text-purple" /> Pro
              </h3>
              <p className="text-text-muted text-sm mb-6">Everything you need to get in</p>
              <p className="font-heading font-bold text-5xl text-text-primary mb-8">
                $10<span className="text-lg text-text-muted font-normal">/month</span>
              </p>
              <ul className="space-y-3">
                {pro.map((p, i) => (
                  <motion.li
                    key={p}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + i * 0.08, ease: "easeOut" as const }}
                    className="flex items-start gap-3 text-sm text-text-muted"
                  >
                    <Sparkles className="w-4 h-4 text-purple flex-shrink-0 mt-0.5" />
                    {p}
                  </motion.li>
                ))}
              </ul>
            </div>
            <div className="mt-8">
              {profile?.is_pro ? (
                <Button variant="secondary" className="w-full" disabled>
                  Current Plan
                </Button>
              ) : (
                <Button variant="purple" className="w-full" size="lg" onClick={handleCheckout} loading={loading}>
                  <Zap className="w-4 h-4" />
                  Start Pro — $10/mo
                </Button>
              )}
            </div>
          </motion.div>
        </div>

        {/* FAQ / Trust Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" as const }}
          className="mt-16 text-center"
        >
          <p className="text-text-muted text-sm">
            Cancel anytime. No questions asked. All plans include our core AI-powered features.
          </p>
        </motion.div>
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <AuthProvider>
      <Suspense>
        <PricingContent />
      </Suspense>
    </AuthProvider>
  );
}
