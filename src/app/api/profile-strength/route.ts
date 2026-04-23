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
- Achievements & awards — 20%. Score this dimension based on the AWARDS LIST only, weighted by prestige: International/National-level (IMO/IOI/USAMO/Intel ISEF/Regeneron STS) → 80–100. State/Provincial → 50–70. Regional → 30–50. School-only → 10–25. No awards → 0–10.
- Essay readiness — 10%. If the student has an essay_score from AI review, use it directly. If no essay has been submitted yet, set essays to 0 and state clearly in the explanation that essays are unrated until submitted.

IMPORTANT — suggestions MUST be high-level admissions priorities only: grades/GPA, standardized test prep (SAT/ACT), building a deeper/longer-term activity, winning a notable award, writing a stronger personal narrative, essay work. Do NOT name specific extracurricular programs, clubs, competitions, or projects — that is handled in a separate Activities tab. Keep suggestions abstract and category-level (e.g. "Push your GPA above 3.9 — academics carry the most weight", "Aim for at least one regional-or-higher award this year", "Start drafting your personal narrative early"). NEVER write suggestions like "Join Science Olympiad" or "Start a nonprofit".

If the student has submitted NO essay yet, set "essays" to 0 and note that the essay component is unrated until they submit one for review.

Return ONLY valid JSON (no markdown, no backticks, no prose) with this exact shape:
{
  "overall": <integer 0-100>,
  "academics": <integer 0-100>,
  "activities": <integer 0-100>,
  "achievements": <integer 0-100>,
  "essays": <integer 0-100>,
  "explanation": "<2-3 sentence honest assessment>",
  "suggestions": ["<high-level priority>", "<high-level priority>", "<high-level priority>"],
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
        xp: (profile.xp || 0) + 5, // +5 XP per recalc — matches XP_SOURCES
      })
      .eq("id", user.id);

    return NextResponse.json({ breakdown });
  } catch (err) {
    console.error("Profile strength error:", err);
    const message = err instanceof Error ? err.message : "Calculation failed";
    return NextResponse.json({ error: message.includes("API") ? message : "Calculation failed. Please try again." }, { status: 500 });
  }
}
