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

  // Read profile_strength so we can anchor reach/target/safety relative to the student
  const studentStrength: number = profile.profile_strength_breakdown?.overall ?? profile.profile_strength ?? 0;

  try {
    const systemPrompt = buildProfilePrompt(profile) + `

Generate a personalized college list for this student.
The student's current universal profile strength score is ${studentStrength}/100.

CRITICAL — define reach / target / safety relative to THIS student's profile score (${studentStrength}):
  SAFETY  → profile_strength_needed < ${studentStrength} - 8   (student is clearly above the bar — high chance of admission)
  TARGET  → profile_strength_needed is within ±12 of ${studentStrength}  (competitive but realistic)
  REACH   → profile_strength_needed > ${studentStrength} + 12  (student is below typical bar — admission is uncertain)

Pick schools accordingly. A safety must have a profile_strength_needed that is genuinely below this student's score.
If profile_strength is 0 or very low (student hasn't measured yet), use their GPA and test scores to estimate placement.

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
  "fit_reason": "1-2 sentences explaining WHY the fit score is what it is — reference the student's major, goals, or preferences specifically.",
  "url": "https://www.university.edu",
  "profile_strength_needed": <integer 0-100>,
  "fit_score": <integer 0-100>
}

PROFILE STRENGTH NEEDED reference table (minimum universal score a competitive applicant typically needs):
  MIT, Harvard, Yale, Princeton, Stanford → 96-100
  Columbia, UChicago, Caltech, Duke, Penn → 93-97
  Dartmouth, Northwestern, Brown, Rice, Vanderbilt, Notre Dame → 88-94
  UCLA, Michigan, Georgetown, Emory, Tufts → 80-90
  Boston University, Fordham, Tulane, Pepperdine → 72-82
  Large state flagships (Ohio State, Indiana, Arizona State) → 60-75
  Regional / less selective universities → 45-60
  Community colleges / open-admission → 20-45

FIT SCORE (0-100) — personalised match score for THIS student. Compute as weighted average:

1. Academic & Major Fit (40% weight):
   Top-5 program in student's major → 90-100
   Recognised strong program → 70-85
   Decent but not standout → 50-65
   Not known for this field → 25-45

2. Admission Alignment (35% weight):
   Student GPA/scores at or above school median → 80-100
   Slightly below median → 55-75
   Clearly below median → 25-50
   Far below median → 5-25

3. Goal & Environment Match (25% weight):
   Strong alignment with student's target country, major goals, campus culture → 75-100
   Moderate alignment → 50-70
   Weak alignment → 20-45

fit_score = round(component1 * 0.40 + component2 * 0.35 + component3 * 0.25)

The fit_reason must explain WHY the fit score is what it is for this specific student — mention their major interest, goals, or location preferences.

Only use real, verifiable college website URLs.
Consider the student's GPA, test scores, major interest, dream college, aiming level, and target country. Use real, current data.`;

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
