import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { callClaudeHaiku } from "@/lib/claude";

export const maxDuration = 30;

export async function GET(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = auth;
  const rateCheck = await checkRateLimit(user.id, "general");
  if (!rateCheck.success) return rateCheck.response!;

  const { data: profile } = await supabase
    .from("profiles")
    .select("daily_tip_cache, major_interest, grade")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  const today = new Date().toISOString().split("T")[0];

  // Return cached tip if from today
  if (profile.daily_tip_cache?.date === today) {
    return NextResponse.json({ tip: profile.daily_tip_cache.tip });
  }

  // Generate new tip
  try {
    const result = await callClaudeHaiku(
      "You are a college admissions tip generator. Give one short, actionable tip in 2-3 sentences. Be specific, encouraging, and complete — never end mid-thought. Keep it under 400 characters total.",
      `Generate a tip for a ${profile.grade || "high school"} student interested in ${profile.major_interest || "college"}. Today's date: ${today}. Make it unique and seasonal if relevant.`,
      300
    );

    // Don't truncate — let the full tip through. Claude will keep it short per the prompt.
    const tip = result.trim();
    const tipCache = { tip, date: today };

    await supabase
      .from("profiles")
      .update({ daily_tip_cache: tipCache })
      .eq("id", user.id);

    return NextResponse.json({ tip });
  } catch {
    return NextResponse.json({ tip: "Focus on quality over quantity — one meaningful activity beats five surface-level ones." });
  }
}
