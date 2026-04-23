import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { callClaude, buildProfilePrompt } from "@/lib/claude";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = auth;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  if (!profile.is_pro) {
    return NextResponse.json({ error: "Essay review is a Pro feature." }, { status: 403 });
  }

  // Strict weekly cap: check last reviewed timestamp
  if (profile.essay_last_reviewed_at) {
    const last = new Date(profile.essay_last_reviewed_at).getTime();
    const weekMs = 7 * 24 * 3_600_000;
    if (Date.now() - last < weekMs) {
      const nextAt = new Date(last + weekMs);
      return NextResponse.json(
        { error: `You can submit one essay per week. Next submission available ${nextAt.toLocaleDateString()}.` },
        { status: 429 }
      );
    }
  }

  const rateCheck = await checkRateLimit(user.id, "essay");
  if (!rateCheck.success) return rateCheck.response!;

  const body = await request.json().catch(() => ({}));
  const essay: string = (body.essay || "").toString().trim();

  if (essay.length < 100) {
    return NextResponse.json({ error: "Essay must be at least 100 characters." }, { status: 400 });
  }
  if (essay.length > 8000) {
    return NextResponse.json({ error: "Essay is too long (max 8,000 characters)." }, { status: 400 });
  }

  try {
    const systemPrompt = buildProfilePrompt(profile) + `

You are a strict, honest admissions essay reader for elite US colleges. You've read thousands of essays. You do NOT hand out grades higher than 85 unless the writing is genuinely outstanding. Median accepted-at-top-20 essays score 65–78. Cliché, generic, or poorly structured essays score 30–55. Mechanically broken essays score below 30.

Evaluate on: narrative voice & specificity, emotional honesty, structure, command of language, and authenticity. Penalize clichés, name-dropping, humblebrag, summarizing a résumé, and "I want to change the world" generics.

Return ONLY valid JSON (no markdown, no backticks, no prose) with this exact shape:
{
  "score": <integer 0-100>,
  "strengths": ["<specific strength>", "<specific strength>", "<specific strength>"],
  "weaknesses": ["<specific weakness>", "<specific weakness>", "<specific weakness>"],
  "rewrite_suggestions": ["<concrete rewrite suggestion>", "<concrete rewrite suggestion>", "<concrete rewrite suggestion>"],
  "overall": "<1-2 sentence honest summary, e.g. 'A solid mid-tier essay with real voice but derivative structure.'>"
}`;

    const result = await callClaude(systemPrompt, `Please review this essay:\n\n${essay}`);

    let feedback;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      feedback = JSON.parse(jsonMatch ? jsonMatch[0] : result);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response." }, { status: 500 });
    }

    const score = Math.max(0, Math.min(100, Math.round(feedback.score || 0)));

    await supabase
      .from("profiles")
      .update({
        essay_text: essay,
        essay_score: score,
        essay_feedback: {
          strengths: feedback.strengths || [],
          weaknesses: feedback.weaknesses || [],
          rewrite_suggestions: feedback.rewrite_suggestions || [],
          overall: feedback.overall || "",
        },
        essay_last_reviewed_at: new Date().toISOString(),
        xp: (profile.xp || 0) + 30, // +30 XP per essay submission per XP_SOURCES
      })
      .eq("id", user.id);

    return NextResponse.json({ score, feedback });
  } catch (err) {
    console.error("Essay review error:", err);
    const message = err instanceof Error ? err.message : "Review failed";
    return NextResponse.json({ error: message.includes("API") ? message : "Review failed. Please try again." }, { status: 500 });
  }
}
