import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { callClaude, buildProfilePrompt } from "@/lib/claude";

export const maxDuration = 60;

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

  const categories = body.categories;
  if (!Array.isArray(categories) || categories.length === 0 || categories.length > 3) {
    return NextResponse.json({ error: "Select 1-3 categories" }, { status: 400 });
  }

  try {
    const systemPrompt = buildProfilePrompt(profile) + `

Generate a detailed extracurricular roadmap for the selected categories.

Return ONLY valid JSON (no markdown, no backticks) as an object where each key is a category name, with this shape:
{
  "Category Name": {
    "competitions": [{"name": "Real Name", "description": "Brief description", "deadline": "Month Day"}],
    "project_ideas": ["Specific idea 1", "Specific idea 2", "Specific idea 3"],
    "weekly_plan": [
      {"week": 1, "tasks": ["Task 1", "Task 2"]},
      {"week": 2, "tasks": ["Task 1", "Task 2"]},
      {"week": 3, "tasks": ["Task 1", "Task 2"]},
      {"week": 4, "tasks": ["Task 1", "Task 2"]}
    ],
    "weekly_hours": "X-Y hours",
    "common_app_tip": "How to write about this activity in Common App."
  }
}

Include REAL competition/program names (e.g., "Intel ISEF", "MIT PRIMES", "USABO"). Be specific and actionable.`;

    const result = await callClaude(
      systemPrompt,
      `Generate detailed roadmaps for these categories: ${categories.map((c: string) => c.slice(0, 100)).join(", ")}`
    );

    let roadmap;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        roadmap = JSON.parse(jsonMatch[0]);
      } else {
        roadmap = JSON.parse(result);
      }
    } catch {
      return NextResponse.json({ error: "Failed to parse roadmap. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ roadmap });
  } catch (err) {
    console.error("Roadmap error:", err);
    const message = err instanceof Error ? err.message : "Roadmap generation failed";
    return NextResponse.json({ error: message.includes("API") ? message : "Roadmap generation failed. Please try again." }, { status: 500 });
  }
}
