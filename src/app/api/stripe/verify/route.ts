import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import Stripe from "stripe";

// Fallback activation path. Called client-side right after a successful
// checkout redirect. If the Stripe webhook didn't fire (common in dev /
// preview or when STRIPE_WEBHOOK_SECRET is misconfigured), we still flip
// the user to Pro by asking Stripe directly whether they have an active
// subscription.

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
});

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = auth;

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, is_pro")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (profile.is_pro) return NextResponse.json({ is_pro: true });

  // Find the customer — by stripe_customer_id if we have one, otherwise by email
  let customerId = profile.stripe_customer_id;
  if (!customerId && user.email) {
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data[0]) {
      customerId = customers.data[0].id;
      await supabase
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }
  }

  if (!customerId) {
    return NextResponse.json({ is_pro: false, reason: "no_customer" });
  }

  try {
    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });

    const active = subs.data.find(
      (s) => s.status === "active" || s.status === "trialing" || s.status === "past_due"
    );

    if (active) {
      await supabase
        .from("profiles")
        .update({
          is_pro: true,
          ai_messages_this_month: 0,
          subscription_start: new Date().toISOString().split("T")[0],
        })
        .eq("id", user.id);
      return NextResponse.json({ is_pro: true });
    }

    return NextResponse.json({ is_pro: false, reason: "no_active_subscription" });
  } catch (err) {
    console.error("Stripe verify error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
