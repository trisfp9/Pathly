import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { callClaude, buildProfilePrompt } from "@/lib/claude";

export const maxDuration = 60;

export async function POST(request: Request) {
  const auth = await getAuthenticatedUser(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { user, supabase } = auth;
  const rateCheck = await checkRateLimit(user.id, "strength");
  if (!rateCheck.success) return rateCheck.response!;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  try {
    const dreamCollege = profile.dream_college || null;

    const systemPrompt = buildProfilePrompt(profile) + `

You are computing a UNIVERSAL US college admissions profile strength score (0–100). This score is NOT tied to any specific school — it measures the student's raw competitiveness across all US universities. The same student with 4.0 GPA and 1600 SAT should receive the same score each time, regardless of their dream school.

═══════════════════════════════════════
SCORING RUBRIC — FOLLOW THIS EXACTLY
═══════════════════════════════════════

──────────────────────────────
ACADEMICS (0–100)
──────────────────────────────
Step 1 — GPA component (0–70 pts):
  "4.0+" or "3.8–4.0" → 65–70 pts
  "3.5–3.8"           → 50–62 pts
  "3.0–3.5"           → 35–48 pts
  "2.5–3.0"           → 20–32 pts
  "Below 2.5"         → 5–18 pts
  Not provided        → 20 pts

Step 2 — Test score component (0–30 pts):
  SAT 1550–1600 / ACT 35–36 → 27–30 pts
  SAT 1450–1540 / ACT 32–34 → 22–26 pts
  SAT 1300–1440 / ACT 28–31 → 14–21 pts
  SAT 1100–1290 / ACT 23–27 → 7–13 pts
  SAT <1100    / ACT <23   → 2–6 pts
  Not provided                → 12 pts

academics = GPA component + test score component (cap at 100)

──────────────────────────────
ACTIVITIES (0–100)
──────────────────────────────
Count ALL activities across current_activities AND completed_activities.

Step 1 — Base score:
  0 activities → 0–5 pts
  1–2          → 12–22 pts
  3–4          → 28–42 pts
  5–6          → 46–58 pts
  7+           → 60–68 pts

Step 2 — Quality modifiers (additive):
  Has clear leadership role (Captain, President, Founder, Editor, etc.) in ≥1 activity → +8 pts
  Founded or built something original (nonprofit, app, publication, etc.) → +12 pts
  Multi-year commitment noted for ≥2 activities → +5 pts

Step 3 — Thematic coherence bonus:
  3+ activities cluster around a single theme matching the student's major interest → +8 pts
  2 activities with clear thematic focus → +4 pts
  Activities are scattered with no clear theme → +0 pts

activities = Step1 + Step2 + Step3 (cap at 100)

──────────────────────────────
ACHIEVEMENTS (0–100)
──────────────────────────────
Score each award then sum (cap at 100). Use ONLY the awards listed in the Awards section.

Per-award point values by prestige tier:
  TIER 5 — International olympiad / top US national competition:
    Examples: IMO, IOI, USAMO, USABO, USNCO, Intel ISEF grand prize, Regeneron STS Top 10, Google Code Jam finalist, IPhO, IChO
    Points: +55–80 pts each. A single Tier 5 award can push achievements to 75–100.

  TIER 4 — Strong national (US or home country):
    Examples: AMC/AIME qualifier, USACO Platinum, national science fair finalist, national debate champion, national robotics champion, nationally recognized award
    Points: +30–50 pts each.

  TIER 3 — State/provincial:
    Examples: State science fair winner, state math olympiad, state debate champion
    Points: +18–28 pts each.

  TIER 2 — Regional/local:
    Examples: Regional science fair, city/district competition winner
    Points: +8–15 pts each.

  TIER 1 — School-level:
    Examples: Valedictorian, school award, honor roll, school club award
    Points: +4–8 pts each.

  SPECIAL NOTE — World Scholar's Cup (WSC):
    WSC is a participation-based debate/trivia competition. Despite its "Global" round branding, it is NOT equivalent to a math or science olympiad. Treat WSC awards as TIER 2 (Regional, +8–15 pts) regardless of the round level. Do not give it Tier 4 or Tier 5 treatment.

  No awards at all → 0–3 pts.

achievements = sum of all award points (cap at 100)

──────────────────────────────
ESSAYS (0–100)
──────────────────────────────
  Essay submitted and AI-scored → use essay_score directly (0–100)
  No essay submitted yet       → 0 (mandatory — always 0 with no exceptions)

──────────────────────────────
OVERALL FORMULA
──────────────────────────────
overall = round(academics × 0.35 + activities × 0.35 + achievements × 0.20 + essays × 0.10)

Do NOT adjust the overall score up or down based on the dream college.
Do NOT give bonus points for a "good attitude" or for being early in high school.
The formula is the formula.

──────────────────────────────
CALIBRATION SANITY CHECK
──────────────────────────────
Before finalising your JSON, verify your numbers produce roughly these outcomes:
  4.0 GPA + 1600 SAT + 0 activities + 0 awards + no essay → overall ≈ 52–58
  4.0 GPA + 1600 SAT + 5 activities (leadership, themed) + 1 national award + strong essay → overall ≈ 90–95
  MIT/Harvard-competitive applicant (near perfect on all) → overall ≈ 96–100
  Freshman with nothing done yet → overall ≈ 5–18

──────────────────────────────
SUGGESTIONS RULES
──────────────────────────────
- ONLY high-level admissions priorities: grades, test prep, depth/leadership in activities, prestigious awards, essay quality, thematic focus
- NEVER name specific competitions, clubs, programs, or extracurriculars (that lives in the Activities tab)
- 3 suggestions maximum, each under 15 words

${dreamCollege ? `\nDREAM COLLEGE TARGET SCORE:
Also estimate the approximate minimum profile strength score a competitive applicant to ${dreamCollege} typically has. This is a rough benchmark only.
Use these reference points: MIT/Harvard/Yale/Princeton ≈ 96–100, Stanford/Columbia/UChicago ≈ 94–99, Top 20 schools ≈ 88–96, Top 50 schools ≈ 78–90, Top 100 schools ≈ 65–80.
Include this as "dream_college_target" (integer) in your JSON.` : ""}

═══════════════════════════════════════
Return ONLY valid JSON (no markdown, no backticks):
{
  "overall": <integer 0–100>,
  "academics": <integer 0–100>,
  "activities": <integer 0–100>,
  "achievements": <integer 0–100>,
  "essays": <integer 0–100>,
  "explanation": "<2–3 sentence honest assessment. Mention the thematic coherence of their activities if relevant.>",
  "suggestions": ["<priority 1>", "<priority 2>", "<priority 3>"],
  "target_college": "${dreamCollege || "universal"}",
  "dream_college_target": <integer 0–100 or null if no dream college>
}`;

    const result = await callClaude(systemPrompt, "Score my profile using the rubric above. Follow the formula exactly.");

    let breakdown;
    try {
      const jsonMatch = result.match(/\{[\s\S]*\}/);
      breakdown = JSON.parse(jsonMatch ? jsonMatch[0] : result);
    } catch {
      return NextResponse.json({ error: "Failed to parse AI response." }, { status: 500 });
    }

    // Clamp all scores 0–100
    const clamp = (v: unknown) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)));
    const academics   = clamp(breakdown.academics);
    const activities  = clamp(breakdown.activities);
    const achievements = clamp(breakdown.achievements);
    const essays      = clamp(breakdown.essays);

    // Re-apply the formula server-side so the client always gets a consistent overall
    const overall = Math.round(academics * 0.35 + activities * 0.35 + achievements * 0.20 + essays * 0.10);

    const finalBreakdown = {
      ...breakdown,
      overall,
      academics,
      activities,
      achievements,
      essays,
      dream_college_target: breakdown.dream_college_target != null
        ? clamp(breakdown.dream_college_target)
        : null,
    };

    await supabase
      .from("profiles")
      .update({
        profile_strength: overall,
        profile_strength_breakdown: finalBreakdown,
        profile_strength_updated_at: new Date().toISOString(),
        xp: (profile.xp || 0) + 5,
      })
      .eq("id", user.id);

    return NextResponse.json({ breakdown: finalBreakdown });
  } catch (err) {
    console.error("Profile strength error:", err);
    const message = err instanceof Error ? err.message : "Calculation failed";
    return NextResponse.json({ error: message.includes("API") ? message : "Calculation failed. Please try again." }, { status: 500 });
  }
}
