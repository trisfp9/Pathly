"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createBrowserClient } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import GeometricGrid from "@/components/landing/GeometricGrid";
import Link from "next/link";
import toast from "react-hot-toast";

export default function AuthPage() {
  return (
    <Suspense>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/confirmed` },
        });
        if (error) throw error;

        // Redirect to verification page — profile will be created after email confirm
        router.push("/auth/verify");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Check if onboarding completed
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("onboarding_completed")
            .eq("id", user.id)
            .single();

          if (profile?.onboarding_completed) {
            router.push(redirectTo || "/dashboard");
          } else {
            router.push("/onboarding");
          }
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-12 items-center">
        {/* Left — Branding */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:block"
        >
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple to-accent flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-heading font-bold text-2xl text-text-primary">Pathly</span>
          </Link>

          <h1 className="font-heading font-bold text-4xl text-text-primary mb-4 leading-tight">
            Your roadmap to the
            <br />
            <span className="text-gradient">school of your dreams.</span>
          </h1>
          <p className="text-text-muted text-lg mb-8">
            Join thousands of students building their path to top colleges.
          </p>

          <div className="glass-card p-6 overflow-hidden">
            <GeometricGrid />
          </div>
        </motion.div>

        {/* Right — Auth Form */}
        <motion.div
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <div className="glass-card p-8 md:p-10">
            <div className="lg:hidden flex items-center gap-2 mb-8">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple to-accent flex items-center justify-center">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="font-heading font-bold text-xl text-text-primary">Pathly</span>
            </div>

            {/* Toggle */}
            <div className="flex bg-white/5 rounded-button p-1 mb-8">
              {(["signup", "signin"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 py-2.5 rounded-[8px] text-sm font-medium transition-all duration-200 ${
                    mode === m
                      ? "bg-purple text-white"
                      : "text-text-muted hover:text-text-primary"
                  }`}
                >
                  {m === "signup" ? "Sign Up" : "Sign In"}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                <h2 className="font-heading font-bold text-2xl text-text-primary">
                  {mode === "signup" ? "Create your account" : "Welcome back"}
                </h2>
                <p className="text-text-muted text-sm">
                  {mode === "signup"
                    ? "Start building your path to your dream school."
                    : "Pick up right where you left off."}
                </p>

                <div>
                  <label className="block text-sm text-text-muted mb-2">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.edu"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 transition-colors text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm text-text-muted mb-2">Password</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 transition-colors text-sm"
                  />
                </div>

                <Button
                  type="submit"
                  variant="purple"
                  loading={loading}
                  className="w-full"
                  size="lg"
                >
                  {mode === "signup" ? "Create Account" : "Sign In"}
                </Button>
              </motion.form>
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
