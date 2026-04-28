import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
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
  if (!profile.is_pro) return NextResponse.json({ error: "Pro subscription required." }, { status: 403 });

  // Once-per-day limit (DB-backed so it survives server restarts)
  if (profile.resume_cache?.generated_at) {
    const hoursSince = (Date.now() - new Date(profile.resume_cache.generated_at).getTime()) / 3_600_000;
    if (hoursSince < 24) {
      const hoursLeft = Math.ceil(24 - hoursSince);
      return NextResponse.json(
        { error: `You can regenerate once per day. Try again in ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }
  }

  try {
    const systemPrompt = buildProfilePrompt(profile) + `

Generate a polished college application resume for this student.

Return ONLY valid JSON (no markdown, no backticks) with this exact shape:
{
  "summary": "2-3 sentence professional summary written in third person, highlighting the student's academic strengths, major interest, and most impressive achievements",
  "education": {
    "gpa": "string",
    "test_scores": "string",
    "grade": "string",
    "intended_major": "string"
  },
  "activities": [
    {
      "name": "string",
      "role": "string",
      "description": "Polished 1-2 sentence description starting with a strong action verb. Quantify where possible. No 'I'.",
      "hours_per_week": "string",
      "years": "string"
    }
  ],
  "awards": [
    {
      "name": "string",
      "level": "string",
      "year": "string",
      "description": "One sentence description of the achievement and its significance"
    }
  ],
  "skills": ["skill1", "skill2", "..."]
}

Instructions:
- Pull activities from the student's current_activities list — write a polished description for each
- Pull awards from the student's awards list — describe each concisely
- Use the student's essay_text (if available) to inform the summary
- Infer skills from the student's activities, major interest, and achievements
- If no activities exist, return an empty array for activities
- If no awards exist, return an empty array for awards
- The summary must be compelling and accurate to this specific student — not generic`;

    const result = await callClaude(systemPrompt, "Generate my college application resume.", 2, 3000);

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
    } catch (parseErr) {
      console.error("Resume JSON parse error:", parseErr, "\nRaw result:", result.slice(0, 500));
      return NextResponse.json({ error: "Failed to parse resume. Please try again." }, { status: 500 });
    }

    const cache = {
      summary: parsed.summary || "",
      education: parsed.education || { gpa: "", test_scores: "", grade: "", intended_major: "" },
      activities: parsed.activities || [],
      awards: parsed.awards || [],
      skills: parsed.skills || [],
      generated_at: new Date().toISOString(),
    };

    await supabase
      .from("profiles")
      .update({ resume_cache: cache })
      .eq("id", user.id);

    return NextResponse.json(cache);
  } catch (err) {
    console.error("Resume generation error:", err);
    return NextResponse.json({ error: "Resume generation failed. Please try again." }, { status: 500 });
  }
}
