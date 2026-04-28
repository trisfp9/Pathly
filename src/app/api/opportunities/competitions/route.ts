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

  // Once-per-day limit (DB-backed so it survives server restarts)
  if (profile.ai_competitions_cache?.generated_at) {
    const hoursSince = (Date.now() - new Date(profile.ai_competitions_cache.generated_at).getTime()) / 3_600_000;
    if (hoursSince < 24) {
      const hoursLeft = Math.ceil(24 - hoursSince);
      return NextResponse.json(
        { error: `You can regenerate once per day. Try again in ${hoursLeft} hour${hoursLeft === 1 ? "" : "s"}.` },
        { status: 429 }
      );
    }
  };

  try {
    const systemPrompt = buildProfilePrompt(profile) + `

Generate a personalised list of 8-10 competitions and programs highly relevant to this specific student.

Return ONLY valid JSON (no markdown, no backticks) with this exact shape:
{
  "competitions": [
    {
      "id": "unique-kebab-id",
      "name": "Competition Name",
      "field": "STEM | Math | CS/Tech | Business | Humanities | Arts | Community Service | Biology | Chemistry | Physics",
      "difficulty": "Beginner | Intermediate | Advanced",
      "description": "2 sentences: what it is and why it fits this student specifically.",
      "deadline": "Month or Month DD (optional)",
      "url": "https://official-url.org/",
      "country": "US or International or specific country",
      "tags": ["tag1", "tag2"]
    }
  ]
}

Selection criteria — pick competitions that match:
1. Student's major interest (${profile.major_interest}) — at least 5 should be directly in this field
2. Student's country / internationally accessible (${profile.country})
3. Appropriate difficulty for grade ${profile.grade} — include a spread from Beginner to Advanced
4. Student's extracurricular interests (${(profile.extracurricular_interests || []).join(", ")})
5. Competitions that look excellent on college applications for ${profile.target_country} admissions

Prioritise:
- Competitions specific to ${profile.country} if regional ones exist (e.g. national olympiads, local hackathons)
- Well-known international competitions (IMO, USACO, ISEF, etc.) if relevant to the student's field
- At least 2-3 that are beginner/intermediate so the student can start now
- Research programs and summer opportunities count (RSI, MIT PRIMES, etc.)

Only use real, verifiable competition URLs. Do not invent competitions.`;

    const result = await callClaude(systemPrompt, "Generate my personalised competition list.", 2, 3000);

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
    } catch (parseErr) {
      console.error("Competition JSON parse error:", parseErr, "\nRaw result:", result.slice(0, 500));
      return NextResponse.json({ error: "Failed to parse competition list. Please try again." }, { status: 500 });
    }

    const cache = {
      competitions: parsed.competitions || [],
      generated_at: new Date().toISOString(),
    };

    await supabase
      .from("profiles")
      .update({ ai_competitions_cache: cache })
      .eq("id", user.id);

    return NextResponse.json(cache);
  } catch (err) {
    console.error("AI competitions error:", err);
    return NextResponse.json({ error: "Competition generation failed. Please try again." }, { status: 500 });
  }
}
