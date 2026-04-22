"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { createBrowserClient } from "@/lib/supabase";
import { updateStreak } from "@/lib/streak";
import {
  LayoutDashboard, BookOpen, MessageSquare, Compass, User, LogOut,
  Crown, ChevronLeft, Menu, Bookmark, TrendingUp,
} from "lucide-react";
import Skeleton from "@/components/ui/Skeleton";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/extracurriculars", label: "Activities", icon: BookOpen },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/counselor", label: "Counselor", icon: MessageSquare },
  { href: "/opportunities", label: "Discover", icon: Compass },
  { href: "/saved", label: "Saved", icon: Bookmark },
  { href: "/profile", label: "Profile", icon: User },
];

function AppLayoutInner({ children }: { children: ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Streak check on mount
  useEffect(() => {
    if (user) {
      const supabase = createBrowserClient();
      updateStreak(supabase, user.id).catch(() => {});
    }
  }, [user]);

  // Redirect if not authed
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-4 w-64">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-white/5 bg-surface/50 p-6 fixed h-full z-40">
        <Link href="/dashboard" className="flex items-center gap-2 mb-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple to-accent flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <span className="font-heading font-bold text-lg text-text-primary">Pathly</span>
        </Link>

        <nav className="flex-1 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-button text-sm font-medium transition-all duration-200 ${
                  active
                    ? "bg-purple/10 text-purple"
                    : "text-text-muted hover:text-text-primary hover:bg-white/5"
                }`}
              >
                <item.icon className="w-5 h-5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 pt-4 border-t border-white/5">
          {!profile?.is_pro && (
            <Link
              href="/pricing"
              className="flex items-center gap-3 px-4 py-3 rounded-button text-sm font-medium text-pop hover:bg-pop/5 transition-colors"
            >
              <Crown className="w-5 h-5" />
              Upgrade to Pro
            </Link>
          )}
          <button
            onClick={signOut}
            className="flex items-center gap-3 px-4 py-3 rounded-button text-sm font-medium text-text-muted hover:text-red-400 hover:bg-red-500/5 transition-colors w-full"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-72 bg-surface border-r border-white/5 z-50 lg:hidden p-6"
            >
              <div className="flex items-center justify-between mb-8">
                <span className="font-heading font-bold text-lg text-text-primary">Pathly</span>
                <button onClick={() => setSidebarOpen(false)} className="text-text-muted">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-button text-sm font-medium transition-all ${
                        active ? "bg-purple/10 text-purple" : "text-text-muted hover:text-text-primary"
                      }`}
                    >
                      <item.icon className="w-5 h-5" />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 lg:ml-64 pb-20 lg:pb-0">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between px-6 py-4 border-b border-white/5">
          <button onClick={() => setSidebarOpen(true)} className="text-text-muted">
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-heading font-bold text-text-primary">Pathly</span>
          <Link href="/profile">
            <User className="w-5 h-5 text-text-muted" />
          </Link>
        </div>

        <div className="p-6 lg:p-10 max-w-6xl">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-xl border-t border-white/5 z-40">
        <div className="flex items-center justify-around py-2">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-2 px-3 ${
                  active ? "text-purple" : "text-text-muted"
                }`}
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </AuthProvider>
  );
}
