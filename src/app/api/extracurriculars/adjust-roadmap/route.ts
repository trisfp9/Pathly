import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { callClaude, buildProfilePrompt } from "@/lib/claude";
import type { SavedRoadmap, RoadmapTask } from "@/types";

export const maxDuration = 60;

// AI-powered adjustment of an existing roadmap.
// The client sends the current roadmap + a free-text instruction
// ("swap the project idea to something cheaper", "add more weeks on data analysis", etc.)
// and we return the updated tasks / project_idea / competitions.
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

  // Count against the monthly AI message cap — this is a real Claude call
  const messagesUsed = profile.is_pro ? profile.ai_messages_this_month : profile.ai_messages_used;
  const messagesMax = profile.is_pro ? 500 : 7;
  if (messagesUsed >= messagesMax) {
    return NextResponse.json({ error: "Message limit reached" }, { status: 403 });
  }

  let body: { roadmap?: SavedRoadmap; instruction?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { roadmap, instruction } = body;
  if (!roadmap || typeof instruction !== "string" || !instruction.trim()) {
    return NextResponse.json({ error: "roadmap and instruction are required" }, { status: 400 });
  }

  try {
    const systemPrompt = buildProfilePrompt(profile) + `

You are adjusting an existing roadmap based on the student's instruction. Preserve completed tasks (done=true) unless the instruction explicitly says to remove them. You may add, remove, reorder, or reword tasks. You may change the project_idea and competitions if the instruction calls for it.

Return ONLY valid JSON (no markdown, no backticks) with this shape:
{
  "project_idea": "Updated project idea (or same as before)",
  "competitions": [{"name": "Real name", "description": "...", "deadline": "Month Day or rolling"}],
  "tasks": [
    {"id": "existing-task-id-if-preserved-or-new-uuid", "week": 1, "description": "...", "done": false}
  ],
  "weekly_hours": "X-Y hours",
  "common_app_tip": "..."
}

Keep ids stable for tasks you preserve (and their done state). Use a fresh id like "new-1", "new-2" for brand-new tasks.

If you add or change competitions, prioritize real ones available in the student's country (${profile.country || "their country"}), plus a couple of well-known international competitions open to international participants. No made-up names.`;

    const userMessage = `Current roadmap (category: ${roadmap.category}):
Project idea: ${roadmap.project_idea}
Weekly hours: ${roadmap.weekly_hours}
Competitions: ${JSON.stringify(roadmap.competitions)}
Tasks: ${JSON.stringify(roadmap.tasks)}
Common App tip: ${roadmap.common_app_tip}

Student's adjustment request: ${instruction.slice(0, 1000)}`;

    const result = await callClaude(systemPrompt, userMessage);

    let parsed;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
    } catch {
      return NextResponse.json({ error: "Failed to parse adjustment. Try again." }, { status: 500 });
    }

    // Build new task list — preserve done state where the id matches
    const existingById = new Map(roadmap.tasks.map((t) => [t.id, t]));
    const newTasks: RoadmapTask[] = Array.isArray(parsed.tasks)
      ? parsed.tasks
          .filter((t: { description?: unknown }) => t && typeof t.description === "string")
          .map((t: { id?: string; week?: number; description: string; done?: boolean }, i: number) => {
            const prior = t.id ? existingById.get(t.id) : undefined;
            return {
              id: prior?.id ?? t.id ?? `task-${Date.now()}-${i}`,
              week: typeof t.week === "number" ? t.week : 1,
              description: t.description,
              done: prior?.done ?? Boolean(t.done),
            };
          })
      : roadmap.tasks;

    const updated: SavedRoadmap = {
      ...roadmap,
      project_idea: typeof parsed.project_idea === "string" ? parsed.project_idea : roadmap.project_idea,
      competitions: Array.isArray(parsed.competitions) ? parsed.competitions : roadmap.competitions,
      tasks: newTasks,
      weekly_hours: typeof parsed.weekly_hours === "string" ? parsed.weekly_hours : roadmap.weekly_hours,
      common_app_tip: typeof parsed.common_app_tip === "string" ? parsed.common_app_tip : roadmap.common_app_tip,
      updated_at: new Date().toISOString(),
    };

    // Persist back to profile.roadmaps + increment the AI message counter
    const allRoadmaps: SavedRoadmap[] = Array.isArray(profile.roadmaps) ? profile.roadmaps : [];
    const nextRoadmaps = allRoadmaps.map((r) => (r.id === roadmap.id ? updated : r));
    const updateField = profile.is_pro ? "ai_messages_this_month" : "ai_messages_used";
    await supabase
      .from("profiles")
      .update({
        roadmaps: nextRoadmaps,
        [updateField]: messagesUsed + 1,
      })
      .eq("id", user.id);

    return NextResponse.json({ roadmap: updated });
  } catch (err) {
    console.error("Adjust roadmap error:", err);
    const message = err instanceof Error ? err.message : "Adjustment failed";
    return NextResponse.json({ error: message.includes("API") ? message : "Adjustment failed. Please try again." }, { status: 500 });
  }
}
