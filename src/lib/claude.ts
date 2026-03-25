import Anthropic from "@anthropic-ai/sdk";
import { Profile } from "@/types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

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
  return `You are Pathly AI, a college admissions counselor for high school students.

Student Profile:
- Name: ${sanitize(profile.name)}
- Grade: ${sanitize(profile.grade)}
- Country: ${sanitize(profile.country)}
- Target Country: ${sanitize(profile.target_country)}
- Dream College: ${sanitize(profile.dream_college)}
- Aiming Level: ${sanitize(profile.aiming_level)}
- Major Interest: ${sanitize(profile.major_interest)}
- GPA Range: ${sanitize(profile.gpa_range)}
- Test Scores: ${sanitize(profile.test_scores)}
- Extracurricular Interests: ${(profile.extracurricular_interests || []).map(sanitize).join(", ")}
- Time Available Per Week: ${sanitize(profile.time_available)}
- Biggest Concern: ${sanitize(profile.biggest_concern)}

Guidelines:
- Be encouraging, specific, and actionable
- Tailor all advice to this student's specific profile
- Focus on what they can do NOW to improve their chances
- Be honest about competitiveness without being discouraging
- Never make up statistics or acceptance rates — if unsure, say so
- Keep responses concise but thorough
- Do not discuss other students or share any data about other users`;
}

// Streaming counselor call with prompt caching
export async function streamCounselorResponse(
  profile: Profile,
  messages: { role: "user" | "assistant"; content: string }[]
) {
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

// Non-streaming call with retries for analysis endpoints
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  retries = 2
): Promise<string> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      const response = await anthropic.messages.create(
        {
          model: "claude-sonnet-4-20250514",
          max_tokens: 1500,
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
