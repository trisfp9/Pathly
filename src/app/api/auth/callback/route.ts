import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Create profile row using admin client (bypasses RLS)
      const adminClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      );

      const { data: existing } = await adminClient
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .single();

      if (!existing) {
        await adminClient.from("profiles").insert({
          id: data.user.id,
          onboarding_completed: false,
          xp: 0,
          streak: 0,
          ai_messages_used: 0,
          ai_messages_this_month: 0,
          profile_strength: 0,
          is_pro: false,
        });
      }

      // Redirect to confirmed page — user will close this tab and sign in
      return NextResponse.redirect(`${origin}/auth/confirmed`);
    }
  }

  // Code was missing or invalid
  return NextResponse.redirect(`${origin}/auth?error=invalid_code`);
}
