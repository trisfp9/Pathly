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
  if (!profile.is_pro) return NextResponse.json({ error: "Pro subscription required." }, { status: 403 });

  const rateCheck = await checkRateLimit(user.id, "opportunities");
  if (!rateCheck.success) return rateCheck.response!;

  try {
    const systemPrompt = buildProfilePrompt(profile) + `

Generate a personalised list of 8-10 scholarships highly relevant to this specific student.

Return ONLY valid JSON (no markdown, no backticks) with this exact shape:
{
  "scholarships": [
    {
      "id": "unique-kebab-id",
      "name": "Scholarship Name",
      "amount": "$X,XXX or Full ride",
      "deadline": "Month DD",
      "description": "2 sentences: what it is and why it fits this student specifically.",
      "tags": ["tag1", "tag2"],
      "url": "https://official-url.org/",
      "country": "US or International or specific country",
      "eligibility": "Brief eligibility note e.g. 'US citizens only', 'STEM students', 'Financial need required'"
    }
  ]
}

Selection criteria — pick scholarships that match ALL of:
1. Student's country of residence or target country (${profile.country} / ${profile.target_country})
2. Student's major interest (${profile.major_interest})
3. Student's grade/timeline (${profile.grade})
4. Any need-based flags from their financial situation
5. Diversity/identity scholarships if applicable

Include a mix of:
- Large prestigious scholarships (Gates, QuestBridge-level)
- Mid-size merit scholarships
- Field-specific scholarships (in student's major)
- Local/regional scholarships if student is in a specific country/state
- At least 2-3 that the student has a realistic shot at given their profile

Only use real, verifiable scholarship URLs. Do not invent scholarships.`;

    const result = await callClaude(systemPrompt, "Generate my personalised scholarship list.", 2, 3000);

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
    } catch (parseErr) {
      console.error("Scholarship JSON parse error:", parseErr, "\nRaw result:", result.slice(0, 500));
      return NextResponse.json({ error: "Failed to parse scholarship list. Please try again." }, { status: 500 });
    }

    const cache = {
      scholarships: parsed.scholarships || [],
      generated_at: new Date().toISOString(),
    };

    await supabase
      .from("profiles")
      .update({ ai_scholarships_cache: cache })
      .eq("id", user.id);

    return NextResponse.json(cache);
  } catch (err) {
    console.error("AI scholarships error:", err);
    return NextResponse.json({ error: "Scholarship generation failed. Please try again." }, { status: 500 });
  }
}
