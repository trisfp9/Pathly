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

  // Pro-only detailed profile fields
  const detailedProfile = profile.detailed_profile as Record<string, string> | null;

  let detailedSection = "";
  if (detailedProfile) {
    detailedSection = `

Detailed Student Background (Pro Profile):
- Current Activities: ${sanitize(detailedProfile.current_activities)}
- Achievements & Awards: ${sanitize(detailedProfile.achievements)}
- Leadership Roles: ${sanitize(detailedProfile.leadership)}
- Work/Internship Experience: ${sanitize(detailedProfile.work_experience)}
- Community Service: ${sanitize(detailedProfile.community_service)}
- Personal Strengths: ${sanitize(detailedProfile.strengths)}
- Areas for Improvement: ${sanitize(detailedProfile.weaknesses)}
- Essay Topics / Personal Story: ${sanitize(detailedProfile.personal_story)}
- Family Background: ${sanitize(detailedProfile.family_background)}
- Financial Situation: ${sanitize(detailedProfile.financial_situation)}
- Special Circumstances: ${sanitize(detailedProfile.special_circumstances)}

Use this detailed information to give highly personalized, specific advice. Reference their actual activities and experiences when relevant.`;
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
- Pro Member: ${profile.is_pro ? "Yes" : "No"}${detailedSection}

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

// Non-streaming call with retries for analysis endpoints
export async function callClaude(
  systemPrompt: string,
  userMessage: string,
  retries = 2
): Promise<string> {
  const anthropic = getAnthropicClient();

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
