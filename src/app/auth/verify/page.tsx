"use client";

import { motion } from "framer-motion";
import { Mail, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default function VerifyEmailPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="glass-card p-10 max-w-md w-full text-center"
      >
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="w-16 h-16 rounded-2xl bg-purple/10 flex items-center justify-center mx-auto mb-6"
        >
          <Mail className="w-8 h-8 text-purple" />
        </motion.div>

        <h1 className="font-heading font-bold text-2xl text-text-primary mb-3">
          Check your email
        </h1>

        <p className="text-text-muted mb-2">
          We&apos;ve sent a verification link to your email address.
        </p>

        <p className="text-text-muted text-sm mb-8">
          Click the link in the email to verify your account, then come back and sign in.
          It may take a minute — check your spam folder too.
        </p>

        <div className="space-y-3">
          <Link href="/auth" className="block">
            <Button variant="purple" className="w-full" size="lg">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Button>
          </Link>
        </div>

        <p className="text-text-muted text-xs mt-6">
          Didn&apos;t receive it? Check your spam folder or try signing up again.
        </p>
      </motion.div>
    </main>
  );
}
