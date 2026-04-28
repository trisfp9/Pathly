"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Crown, CreditCard, Calendar, AlertCircle, ExternalLink } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function BillingPage() {
  const { profile, session } = useAuth();
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    if (!session?.access_token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/billing-portal", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open portal");
      window.location.href = data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong";
      toast.error(message);
      setLoading(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-8 max-w-xl">
      <div>
        <h1 className="font-heading font-bold text-3xl text-text-primary">Billing & Subscription</h1>
        <p className="text-text-muted mt-1">Manage your Pro subscription and billing details.</p>
      </div>

      {profile.is_pro ? (
        <>
          {/* Status card */}
          <div className="glass-card p-6 border-pop/20 relative overflow-hidden">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-pop to-purple" />
            <div className="flex items-center gap-4 mb-5">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pop/20 to-purple/20 flex items-center justify-center">
                <Crown className="w-6 h-6 text-pop" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-heading font-bold text-xl text-text-primary">Pathly Pro</p>
                  <Badge variant="pop">Active</Badge>
                </div>
                <p className="text-text-muted text-sm">You have access to all Pro features.</p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              {profile.subscription_start && (
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-text-muted flex-shrink-0" />
                  <span className="text-text-muted">
                    Member since{" "}
                    <span className="text-text-primary">
                      {new Date(profile.subscription_start).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm">
                <CreditCard className="w-4 h-4 text-text-muted flex-shrink-0" />
                <span className="text-text-muted">Billing managed securely through Stripe</span>
              </div>
            </div>

            <Button variant="primary" onClick={openPortal} loading={loading} className="w-full sm:w-auto">
              <ExternalLink className="w-4 h-4" />
              {loading ? "Opening portal..." : "Manage subscription"}
            </Button>

            <p className="text-text-muted/60 text-xs mt-3">
              You can cancel, update payment method, or download invoices in the billing portal.
            </p>
          </div>

          {/* What Pro includes */}
          <div className="glass-card p-6">
            <h2 className="font-heading font-semibold text-text-primary mb-4">What&apos;s included</h2>
            <ul className="space-y-2">
              {[
                "500 AI counselor messages per month",
                "Full roadmaps with weekly checklists",
                "AI-powered Common App Writer",
                "Essay review with AI scoring",
                "Essay score in profile strength breakdown",
                "Profile strength comparison vs. dream school",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-text-muted">
                  <Crown className="w-3.5 h-3.5 text-pop flex-shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        /* Non-Pro state */
        <div className="glass-card p-8 text-center border-pop/15">
          <div className="w-16 h-16 rounded-2xl bg-pop/10 flex items-center justify-center mx-auto mb-5">
            <Crown className="w-8 h-8 text-pop" />
          </div>
          <h2 className="font-heading font-bold text-xl text-text-primary mb-2">You&apos;re on the free plan</h2>
          <p className="text-text-muted text-sm mb-6 max-w-sm mx-auto">
            Upgrade to Pro to unlock roadmaps, essay review, Common App Writer, and 500 monthly AI messages.
          </p>
          <Link href="/pricing">
            <Button variant="pop">Upgrade to Pro</Button>
          </Link>

          <div className="mt-6 flex items-start gap-2 text-xs text-text-muted/60 bg-white/5 rounded-button p-3 text-left">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>If you recently upgraded and don&apos;t see Pro features, try signing out and back in.</span>
          </div>
        </div>
      )}
    </div>
  );
}
