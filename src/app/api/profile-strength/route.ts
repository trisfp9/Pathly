import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { callClaude, buildProfilePrompt } from "@/lib/claude";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = auth;
  const rateCheck = await checkRateLimit(user.id, "strength");
  if (!rateCheck.success) return rateCheck.response!;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  try {
    const target = profile.dream_college || "a competitive college in their target country";

    const systemPrompt = buildProfilePrompt(profile) + `

You are scoring this student's profile strength for admission to ${target}.

Be HONEST and REALISTIC — this is not a pep talk. If they've done almost nothing and have weak grades, the overall score should be LOW (5-20%). A typical admitted applicant to a top school would score 75-90%. A student at the start of 9th grade with nothing done should score 5-15%.

Weigh these factors:
- Academics (GPA, test scores) — 35% of overall
- Activities & leadership (current_activities, completed_activities, extracurricular interests) — 35%
- Achievements & awards (from detailed_profile or activities) — 20%
- Essay readiness & personal story (from detailed_profile if available) — 10%

Return ONLY valid JSON (no markdown, no backticks, no prose) with this exact shape:
{
  "overall": <integer 0-100>,
  "academics": <integer 0-100>,
  "activities": <integer 0-100>,
  "achievements": <integer 0-100>,
  "essays": <integer 0-100>,
  "explanation": "<2-3 sentence honest assessment>",
  "suggestions": ["<specific suggestion>", "<specific suggestion>", "<specific suggestion>"],
  "target_college": "${target}"
}`;

    const result = await callClaude(systemPrompt, "Score my profile honestly.");

    let breakdown;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      breakdown = JSON.parse(jsonMatch ? jsonMatch[0] : result);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response." }, { status: 500 });
    }

    const overall = Math.max(0, Math.min(100, Math.round(breakdown.overall || 0)));

    await supabase
      .from("profiles")
      .update({
        profile_strength: overall,
        profile_strength_breakdown: breakdown,
        profile_strength_updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return NextResponse.json({ breakdown });
  } catch (err) {
    console.error("Profile strength error:", err);
    const message = err instanceof Error ? err.message : "Calculation failed";
    return NextResponse.json({ error: message.includes("API") ? message : "Calculation failed. Please try again." }, { status: 500 });
  }
}
