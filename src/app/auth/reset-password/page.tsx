"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase";
import Link from "next/link";
import Button from "@/components/ui/Button";
import toast from "react-hot-toast";
import { motion } from "framer-motion";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const supabase = createBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });
      if (error) throw error;
      setSent(true);
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
            {sent ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center space-y-4"
              >
                <div className="w-16 h-16 rounded-full bg-purple/15 border border-purple/20 flex items-center justify-center mx-auto">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <h2 className="font-heading font-bold text-2xl text-text-primary">Check your email</h2>
                <p className="text-text-muted text-sm leading-relaxed">
                  We sent a reset link to <span className="text-text-primary font-medium">{email}</span>. Click the link to set a new password.
                </p>
                <p className="text-text-muted/60 text-xs">Didn&apos;t receive it? Check your spam folder.</p>
                <Link href="/auth?mode=signin" className="block text-center text-purple text-sm font-medium hover:underline pt-2">
                  Back to sign in
                </Link>
              </motion.div>
            ) : (
              <>
                <h2 className="font-heading font-bold text-2xl text-text-primary mb-2">Reset your password</h2>
                <p className="text-text-muted text-sm mb-8">
                  Enter your email and we&apos;ll send you a link to reset your password.
                </p>

                <form onSubmit={handleSubmit} className="space-y-5">
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

                  <Button type="submit" variant="purple" loading={loading} className="w-full" size="lg">
                    Send reset link
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <Link href="/auth?mode=signin" className="text-text-muted text-sm hover:text-text-primary transition-colors">
                    ← Back to sign in
                  </Link>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </main>
  );
}
