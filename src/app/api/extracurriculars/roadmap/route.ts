import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { callClaude, buildProfilePrompt } from "@/lib/claude";

export const maxDuration = 60;

// Generates a comprehensive roadmap for a SINGLE category.
// Returns project-idea options (user picks or supplies their own), a flat
// weekly task list they can check off, and real competitions.
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
  if (!profile.is_pro) return NextResponse.json({ error: "Pro subscription required" }, { status: 403 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const category: string = typeof body.category === "string" ? body.category.slice(0, 120) : "";
  if (!category) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }

  try {
    const systemPrompt = buildProfilePrompt(profile) + `

Generate a comprehensive, actionable extracurricular roadmap for ONE category. The student will pick a project idea (or supply their own) and work through a weekly checklist.

Return ONLY valid JSON (no markdown, no backticks) with this exact shape:
{
  "category": "Category Name",
  "project_idea_options": [
    "Specific, concrete project idea 1 (1-2 sentences — what they'd build/do and why it fits them)",
    "Specific, concrete project idea 2",
    "Specific, concrete project idea 3",
    "Specific, concrete project idea 4"
  ],
  "competitions": [
    {"name": "Real Competition Name", "description": "What it is and why it's worth entering", "deadline": "Month Day or rolling"}
  ],
  "tasks": [
    {"week": 1, "description": "Concrete task the student can check off"},
    {"week": 1, "description": "Another week-1 task"},
    {"week": 2, "description": "..."},
    {"week": 3, "description": "..."},
    {"week": 4, "description": "..."}
  ],
  "weekly_hours": "X-Y hours",
  "common_app_tip": "How to write about this activity on the Common App (1-2 sentences)."
}

Requirements:
- 4 DISTINCT project ideas, each tailored to the student's profile (grade, interests, dream school, existing activities). Vary difficulty and scope so they have real choice.
- Use REAL competition/program names (e.g. "Intel ISEF", "MIT PRIMES", "USABO", "Regeneron STS"). No made-up names.
- Tasks are a FLAT list with week numbers (1-8 range). Each task is a single concrete action the student can mark done. Aim for 3-5 tasks per week across 4-8 weeks.
- Be specific. Avoid generic filler like "research the topic" — say what to research, where, and what to produce.`;

    const result = await callClaude(
      systemPrompt,
      `Build the comprehensive roadmap for: ${category}`
    );

    let roadmap;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      roadmap = JSON.parse(jsonMatch ? jsonMatch[0] : result);
    } catch {
      return NextResponse.json({ error: "Failed to parse roadmap. Please try again." }, { status: 500 });
    }

    // Normalize into shape the client expects
    const normalized = {
      category: roadmap.category || category,
      project_idea_options: Array.isArray(roadmap.project_idea_options)
        ? roadmap.project_idea_options.slice(0, 4).map((s: unknown) => String(s))
        : [],
      competitions: Array.isArray(roadmap.competitions) ? roadmap.competitions : [],
      tasks: Array.isArray(roadmap.tasks)
        ? roadmap.tasks
            .filter((t: { week?: unknown; description?: unknown }) => t && typeof t.description === "string")
            .map((t: { week?: unknown; description: string }) => ({
              week: typeof t.week === "number" ? t.week : 1,
              description: t.description,
            }))
        : [],
      weekly_hours: roadmap.weekly_hours || "3-5 hours",
      common_app_tip: roadmap.common_app_tip || "",
    };

    return NextResponse.json({ roadmap: normalized });
  } catch (err) {
    console.error("Roadmap error:", err);
    const message = err instanceof Error ? err.message : "Roadmap generation failed";
    return NextResponse.json({ error: message.includes("API") ? message : "Roadmap generation failed. Please try again." }, { status: 500 });
  }
}
