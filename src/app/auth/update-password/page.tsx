"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import Button from "@/components/ui/Button";
import Link from "next/link";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

export default function UpdatePasswordPage() {
  return (
    <Suspense>
      <UpdatePasswordContent />
    </Suspense>
  );
}

function UpdatePasswordContent() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [done, setDone] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createBrowserClient();

  useEffect(() => {
    const code = searchParams.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
        if (error) {
          toast.error("This reset link is invalid or has expired.");
          router.push("/auth/reset-password");
        } else {
          setSessionReady(true);
        }
      });
    } else {
      // Fallback: check if session already exists (implicit flow)
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setSessionReady(true);
        } else {
          toast.error("Invalid reset link. Please request a new one.");
          router.push("/auth/reset-password");
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) { toast.error("Passwords don't match"); return; }
    if (password.length < 6) { toast.error("Password must be at least 6 characters"); return; }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
      setTimeout(() => router.push("/auth?mode=signin"), 2500);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Link href="/" className="flex items-center gap-2 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple to-accent flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <span className="font-heading font-bold text-xl text-text-primary">Pathly</span>
          </Link>

          <div className="glass-card p-8 md:p-10">
            {done ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/20 flex items-center justify-center mx-auto">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </div>
                <h2 className="font-heading font-bold text-2xl text-text-primary">Password updated!</h2>
                <p className="text-text-muted text-sm">Redirecting you to sign in…</p>
              </motion.div>
            ) : !sessionReady ? (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-purple/30 border-t-purple rounded-full animate-spin mx-auto mb-4" />
                <p className="text-text-muted text-sm">Verifying your reset link…</p>
              </div>
            ) : (
              <>
                <h2 className="font-heading font-bold text-2xl text-text-primary mb-2">Set a new password</h2>
                <p className="text-text-muted text-sm mb-8">Choose a strong password you haven&apos;t used before.</p>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label className="block text-sm text-text-muted mb-2">New password</label>
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
                  <div>
                    <label className="block text-sm text-text-muted mb-2">Confirm new password</label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Type it again"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-button text-text-primary placeholder:text-text-muted/50 focus:outline-none focus:border-purple/50 transition-colors text-sm"
                    />
                  </div>

                  <Button type="submit" variant="purple" loading={loading} className="w-full" size="lg">
                    Update password
                  </Button>
                </form>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
