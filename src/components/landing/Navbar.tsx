"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import Button from "@/components/ui/Button";

export default function Navbar() {
  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 px-6 py-4"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between bg-surface/60 backdrop-blur-2xl border border-white/5 rounded-[20px] px-6 py-3">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple to-accent flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-heading font-bold text-xl text-text-primary">Pathly</span>
        </Link>

        <div className="hidden md:flex items-center gap-2">
          <Link href="/pricing">
            <Button variant="ghost" size="sm">Pricing</Button>
          </Link>
          <Link href="/auth">
            <Button variant="ghost" size="sm">Sign In</Button>
          </Link>
          <Link href="/auth">
            <Button variant="primary" size="sm">Get Started</Button>
          </Link>
        </div>

        <Link href="/auth" className="md:hidden">
          <Button variant="primary" size="sm">Get Started</Button>
        </Link>
      </div>
    </motion.nav>
  );
}
