import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { callClaude, buildProfilePrompt } from "@/lib/claude";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = auth;
  const rateCheck = await checkRateLimit(user.id, "colleges");
  if (!rateCheck.success) return rateCheck.response!;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  // Check if non-pro user already has a cached list
  if (!profile.is_pro && profile.college_list_cache) {
    return NextResponse.json({ colleges: profile.college_list_cache });
  }

  try {
    const systemPrompt = buildProfilePrompt(profile) + `

Generate a personalized college list for this student.

Return ONLY valid JSON (no markdown, no backticks) with this exact shape:
{
  "reach": [3-4 colleges],
  "target": [4-5 colleges],
  "safety": [3-4 colleges]
}

Each college object must have ALL of these fields:
{
  "name": "University Name",
  "location": "City, State/Country",
  "avg_gpa": "X.XX",
  "avg_sat": "XXXX",
  "acceptance_rate": "XX%",
  "fit_reason": "One sentence about why this school fits the student.",
  "url": "https://www.university.edu",
  "profile_strength_needed": <integer 0-100>
}

"profile_strength_needed" is the estimated minimum universal profile strength score a competitive applicant to that school typically needs, using this scale:
  MIT, Harvard, Yale, Princeton, Stanford → 96–100
  Columbia, UChicago, Caltech, Duke, Penn → 93–97
  Dartmouth, Northwestern, Brown, Rice, Vanderbilt, Notre Dame → 88–94
  UCLA, Michigan, Georgetown, Emory, Tufts → 80–90
  Boston University, Fordham, Tulane, Pepperdine → 72–82
  Large state flagships (Ohio State, Indiana, Arizona State) → 60–75
  Community colleges / open-admission → 30–55

Only use real, verifiable college website URLs.

Consider the student's GPA, test scores, major interest, dream college, aiming level, and target country. Use real, current data. If unsure about stats, give reasonable estimates.`;

    const result = await callClaude(systemPrompt, "Generate my personalized college list.");

    let colleges;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        colleges = JSON.parse(jsonMatch[0]);
      } else {
        colleges = JSON.parse(result);
      }
    } catch {
      return NextResponse.json({ error: "Failed to parse college list. Please try again." }, { status: 500 });
    }

    colleges.generated_at = new Date().toISOString();

    // Cache on profile
    await supabase
      .from("profiles")
      .update({ college_list_cache: colleges })
      .eq("id", user.id);

    return NextResponse.json({ colleges });
  } catch (err) {
    console.error("College list error:", err);
    const message = err instanceof Error ? err.message : "College list generation failed";
    return NextResponse.json({ error: message.includes("API") ? message : "College list generation failed. Please try again." }, { status: 500 });
  }
}
