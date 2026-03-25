import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20" as Stripe.LatestApiVersion,
});

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "No signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id;
      if (userId) {
        await supabase.from("profiles").update({
          is_pro: true,
          ai_messages_this_month: 0,
          subscription_start: new Date().toISOString().split("T")[0],
        }).eq("id", userId);
      }
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", customerId)
        .limit(1);

      if (profiles?.[0]) {
        await supabase.from("profiles").update({
          is_pro: false,
        }).eq("id", profiles[0].id);
      }
      break;
    }

    case "invoice.payment_succeeded": {
      // Reset monthly message count on renewal
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;

      if (invoice.billing_reason === "subscription_cycle") {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id")
          .eq("stripe_customer_id", customerId)
          .limit(1);

        if (profiles?.[0]) {
          await supabase.from("profiles").update({
            ai_messages_this_month: 0,
          }).eq("id", profiles[0].id);
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
