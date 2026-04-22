import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { callClaude, buildProfilePrompt } from "@/lib/claude";

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

  try {
    const systemPrompt = buildProfilePrompt(profile) + `

You are analyzing this student's profile to recommend extracurricular categories.

Return ONLY valid JSON (no markdown, no backticks) as an array of 5-8 objects with this exact shape:
[
  {
    "category": "Category Name",
    "explanation": "2-3 sentence explanation of why this category fits this student specifically.",
    "effort_level": "Low" | "Medium" | "High",
    "impact_level": "Medium" | "High" | "Very High",
    "example": "One generic example sentence (no specific competition names)."
  }
]

Tailor categories to the student's major interest and goals. Be specific about WHY each category matters for their application.`;

    const result = await callClaude(systemPrompt, "Analyze my profile and recommend extracurricular categories.");

    let recommendations;
    try {
      // Try to extract JSON from the response
      const jsonMatch = result.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        recommendations = JSON.parse(jsonMatch[0]);
      } else {
        recommendations = JSON.parse(result);
      }
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response. Please try again." }, { status: 500 });
    }

    // Save to profile
    await supabase
      .from("profiles")
      .update({ extracurricular_recommendations: recommendations })
      .eq("id", user.id);

    return NextResponse.json({ recommendations });
  } catch (err) {
    console.error("EC analysis error:", err);
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message.includes("API") ? message : "Analysis failed. Please try again." }, { status: 500 });
  }
}
