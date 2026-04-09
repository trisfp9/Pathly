"use client";

import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";

export default function EmailConfirmedPage() {
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
