import Anthropic from "@anthropic-ai/sdk";
import { Profile } from "@/types";

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Please add it to your environment variables.");
  }
  return new Anthropic({ apiKey });
}

// Sanitize user input to prevent prompt injection
function sanitize(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/[<>]/g, "")
    .replace(/\{\{/g, "")
    .replace(/\}\}/g, "")
    .replace(/```/g, "")
    .trim()
    .slice(0, 2000);
}

// Build the user profile system prompt (cached)
export function buildProfilePrompt(profile: Profile): string {
  const name = sanitize(profile.name);
  const grade = sanitize(profile.grade);
  const country = sanitize(profile.country);
  const targetCountry = sanitize(profile.target_country);
  const dreamCollege = sanitize(profile.dream_college);
  const aimingLevel = sanitize(profile.aiming_level);
  const majorInterest = sanitize(profile.major_interest);
  const gpaRange = sanitize(profile.gpa_range);
  const testScores = sanitize(profile.test_scores);
  const ecInterests = (profile.extracurricular_interests || []).map(sanitize).join(", ");
  const timeAvailable = sanitize(profile.time_available);
  const biggestConcern = sanitize(profile.biggest_concern);

  // Activities the student has already done (shared with all users)
  const currentActivities = (profile.current_activities || [])
    .map((a) => `- ${sanitize(a.name)}${a.role ? ` (${sanitize(a.role)})` : ""}${a.description ? `: ${sanitize(a.description)}` : ""}${a.hours_per_week ? ` — ${sanitize(a.hours_per_week)}/wk` : ""}${a.years ? ` — ${sanitize(a.years)}` : ""}`)
    .join("\n");
  const completedActivities = (profile.completed_activities || [])
    .map((a) => `- ${sanitize(a.category)} — ${sanitize(a.name)}${a.description ? `: ${sanitize(a.description)}` : ""}`)
    .join("\n");

  const activitiesSection = (currentActivities || completedActivities)
    ? `\n\nStudent's Actual Track Record:\n${currentActivities ? `Current/Past Activities:\n${currentActivities}\n` : ""}${completedActivities ? `Activities Completed via Pathly:\n${completedActivities}\n` : ""}Use this to ground your advice in what they've actually done — don't recommend things they're already doing unless suggesting how to go deeper.`
    : "\n\nStudent has not yet logged any concrete activities or achievements.";

  // Awards — weight by level (International > National > State > Regional > School)
  const awards = (profile.awards || [])
    .map((a) => `- ${sanitize(a.name)}${a.level ? ` [${sanitize(a.level)}]` : ""}${a.year ? ` (${sanitize(a.year)})` : ""}${a.description ? ` — ${sanitize(a.description)}` : ""}`)
    .join("\n");
  const awardsSection = awards
    ? `\n\nAwards & Achievements:\n${awards}\nWeight these HEAVILY by prestige: International > National > State/Provincial > Regional > School. An IOI/IMO gold, USAMO, Intel ISEF grand prize, Regeneron STS top-10, or similar international/national-level award is transformative for top-20 college admissions. A school-level award barely moves the needle. Be honest about this tier.`
    : "\n\nStudent has no awards logged yet.";

  // Essay review status
  const essayStatus = profile.essay_score != null
    ? `\n\nEssay: Submitted for review — AI score ${profile.essay_score}/100. Last reviewed ${profile.essay_last_reviewed_at || "recently"}.`
    : "\n\nEssay: Not yet submitted for AI review.";

  // Pro-only detailed profile fields
  const detailedProfile = profile.detailed_profile as Record<string, string> | null;

  let detailedSection = "";
  if (detailedProfile) {
    detailedSection = `

Detailed Student Background (Pro Profile):
- Personal Strengths: ${sanitize(detailedProfile.strengths)}
- Areas for Improvement: ${sanitize(detailedProfile.weaknesses)}
- Essay Topics / Personal Story: ${sanitize(detailedProfile.personal_story)}
- Family Background: ${sanitize(detailedProfile.family_background)}
- Financial Situation: ${sanitize(detailedProfile.financial_situation)}
- Special Circumstances: ${sanitize(detailedProfile.special_circumstances)}

(Activities, achievements, leadership, work experience, and community service are captured as structured data in the Activities & Awards sections above — use those, not free-form prose here.)

Use this detailed narrative information to give highly personalized, specific advice. Reference their actual experiences when relevant.`;
  }

  return `You are Pathly AI, a warm, expert college admissions counselor for high school students. You know this student personally — use their name and reference their specific situation.

Student Profile:
- Name: ${name}
- Grade: ${grade}
- Country: ${country}
- Target Country: ${targetCountry}
- Dream College: ${dreamCollege}
- Aiming Level: ${aimingLevel}
- Major Interest: ${majorInterest}
- GPA Range: ${gpaRange}
- Test Scores: ${testScores}
- Extracurricular Interests: ${ecInterests}
- Time Available Per Week: ${timeAvailable}
- Biggest Concern: ${biggestConcern}
- Pro Member: ${profile.is_pro ? "Yes" : "No"}${activitiesSection}${awardsSection}${essayStatus}${detailedSection}

Guidelines:
- Address the student by name (${name || "their name"}) to make it personal
- Be encouraging, specific, and actionable — never give generic advice
- Tailor ALL advice to this student's specific profile, interests, and goals
- Reference their specific dream college (${dreamCollege || "their target school"}), major (${majorInterest || "their field"}), and grade level when relevant
- Focus on what they can do NOW to improve their chances
- Be honest about competitiveness without being discouraging
- Never make up statistics or acceptance rates — if unsure, say so
- Keep responses concise but thorough (3-5 paragraphs max)
- If they're an international student (country: ${country}), factor in international-specific challenges and opportunities
- Do not discuss other students or share any data about other users
- If they ask about something outside your expertise, say so honestly`;
}

// Streaming counselor call with prompt caching
export async function streamCounselorResponse(
  profile: Profile,
  messages: { role: "user" | "assistant"; content: string }[]
) {
  const anthropic = getAnthropicClient();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const stream = await anthropic.messages.stream(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        system: [
          {
            type: "text",
            text: buildProfilePrompt(profile),
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: messages.map((m) => ({
          role: m.role,
          content: sanitize(m.content),
        })),
      },
      { signal: controller.signal }
    );

    return stream;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

// Cheap non-streaming call using Haiku — ~4x cheaper than Sonnet.
// Use for simple/high-frequency tasks: daily tips, activity polish, short summaries.
export async function callClaudeHaiku(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 600
): Promise<string> {
  const anthropic = getAnthropicClient();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const response = await anthropic.messages.create(
      {
        model: "claude-3-5-haiku-20241022",
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: sanitize(userMessage) }],
      },
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    const block = response.content[0];
    return block.type === "text" ? block.text : "";
  } catch (error) {
    throw error;
  }
}

// Non-streaming call with retries for analysis endpoints
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  retries = 2,
  maxTokens = 1500
): Promise<string> {
  const anthropic = getAnthropicClient();

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 55000);

      const response = await anthropic.messages.create(
        {
          model: "claude-sonnet-4-20250514",
          max_tokens: maxTokens,
          system: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: sanitize(userMessage) }],
        },
        { signal: controller.signal }
      );

      clearTimeout(timeout);

      const block = response.content[0];
      if (block.type === "text") return block.text;
      return "";
    } catch (error) {
      if (attempt === retries) throw error;
      // Exponential backoff
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  return "";
}
