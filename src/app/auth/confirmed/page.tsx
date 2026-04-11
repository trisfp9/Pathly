"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, Loader2 } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase";

export default function EmailConfirmedPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const handleConfirmation = async () => {
      const supabase = createBrowserClient();

      // Supabase client automatically picks up the #access_token from the URL hash
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error || !session?.user) {
        setStatus("error");
        return;
      }

      // Create profile row if it doesn't exist
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", session.user.id)
        .single();

      if (!existing) {
        await supabase.from("profiles").upsert({
          id: session.user.id,
          onboarding_completed: false,
          xp: 0,
          streak: 0,
          ai_messages_used: 0,
          ai_messages_this_month: 0,
          profile_strength: 0,
          is_pro: false,
        });
      }

      // Sign out so the user signs in fresh on the original tab
      await supabase.auth.signOut();
      setStatus("success");
    };

    handleConfirmation();
  }, []);

  if (status === "loading") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="glass-card p-10 max-w-md w-full text-center">
          <Loader2 className="w-8 h-8 text-purple animate-spin mx-auto mb-4" />
          <p className="text-text-muted">Verifying your email...</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
        <div className="glass-card p-10 max-w-md w-full text-center">
          <p className="text-text-primary font-heading font-bold text-xl mb-3">
            Verification failed
          </p>
          <p className="text-text-muted text-sm">
            The link may have expired. Go back and try signing up again.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card p-10 max-w-md w-full text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.4, delay: 0.2, type: "spring" }}
          className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-6"
        >
          <CheckCircle className="w-8 h-8 text-accent" />
        </motion.div>

        <h1 className="font-heading font-bold text-2xl text-text-primary mb-3">
          Email confirmed!
        </h1>

        <p className="text-text-muted mb-2">
          Your account has been verified successfully.
        </p>

        <p className="text-text-muted text-sm">
          You can close this tab and go back to sign in.
        </p>
      </motion.div>
    </main>
  );
}
