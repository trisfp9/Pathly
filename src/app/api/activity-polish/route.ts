import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { callClaude, buildProfilePrompt } from "@/lib/claude";

export const maxDuration = 60;

// Polishes a single activity into ready-to-paste Common App (150 char) and
// UC Application (350 char) descriptions. Counts against AI message quota.
export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = auth;
  const rateCheck = await checkRateLimit(user.id, "analyze");
  if (!rateCheck.success) return rateCheck.response!;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Check message limits
  const messagesUsed = profile.is_pro ? profile.ai_messages_this_month : profile.ai_messages_used;
  const messagesMax = profile.is_pro ? 500 : 7;
  if (messagesUsed >= messagesMax) {
    return NextResponse.json({ error: "Message limit reached" }, { status: 403 });
  }

  let body: {
    activity?: {
      name?: string;
      role?: string;
      description?: string;
      hours_per_week?: string;
      years?: string;
    };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { activity } = body;
  if (!activity?.name) {
    return NextResponse.json({ error: "Activity name is required" }, { status: 400 });
  }

  try {
    const systemPrompt = buildProfilePrompt(profile) + `

You are an expert college application writer specializing in activity descriptions. Your job is to transform raw activity info into powerful, polished application descriptions that maximize impact with admissions officers.

Key principles:
- Start with a strong, specific action verb (Led, Founded, Designed, Coached, Published, etc.)
- Quantify everything possible: member count, hours, rankings, percentages, money raised, events organized
- Show impact and scope, not just what you did
- No filler words, no "I", no passive voice
- Every word earns its spot

Return ONLY valid JSON (no markdown, no backticks):
{
  "common_app": "Max 150 characters. Tight, punchy, verb-first. Counts spaces. Must be ≤150 chars.",
  "uc": "Max 350 characters. More room for context and impact. Must be ≤350 chars.",
  "tips": ["1-2 short tips for how the student can strengthen this activity further before applying"]
}`;

    const userMessage = `Polish this activity for college applications:

Name: ${activity.name}
Role: ${activity.role || "not specified"}
Hours per week: ${activity.hours_per_week || "not specified"}
Duration: ${activity.years || "not specified"}
What I did / achievements: ${activity.description || "not specified"}

Write both a Common App description (≤150 chars) and UC description (≤350 chars).`;

    const result = await callClaude(systemPrompt, userMessage);

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
    } catch {
      return NextResponse.json({ error: "Failed to parse response. Try again." }, { status: 500 });
    }

    // Enforce character limits server-side (trim if AI went over)
    const commonApp = typeof parsed.common_app === "string"
      ? parsed.common_app.slice(0, 150)
      : "";
    const uc = typeof parsed.uc === "string"
      ? parsed.uc.slice(0, 350)
      : "";
    const tips = Array.isArray(parsed.tips) ? parsed.tips.slice(0, 2) : [];

    // Increment message counter
    const updateField = profile.is_pro ? "ai_messages_this_month" : "ai_messages_used";
    await supabase
      .from("profiles")
      .update({ [updateField]: messagesUsed + 1 })
      .eq("id", user.id);

    return NextResponse.json({ common_app: commonApp, uc, tips });
  } catch (err) {
    console.error("Activity polish error:", err);
    const message = err instanceof Error ? err.message : "Polish failed";
    return NextResponse.json({
      error: message.includes("API") ? message : "Polish failed. Please try again.",
    }, { status: 500 });
  }
}
