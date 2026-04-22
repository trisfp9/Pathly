import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/supabase";
import { checkRateLimit } from "@/lib/ratelimit";
import { buildProfilePrompt } from "@/lib/claude";
import Anthropic from "@anthropic-ai/sdk";

// Allow up to 60s for streaming AI responses (Vercel Hobby max)
export const maxDuration = 60;

function getAnthropicClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  return new Anthropic({ apiKey });
}

export async function POST(request: Request) {
  // Auth check
  const auth = await getAuthenticatedUser(request);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { user, supabase } = auth;

  // Rate limit
  const rateCheck = await checkRateLimit(user.id, "counselor");
  if (!rateCheck.success) return rateCheck.response!;

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  // Check message limits (server-side enforcement)
  const isProUser = profile.is_pro;
  const messagesUsed = isProUser ? profile.ai_messages_this_month : profile.ai_messages_used;
  const messagesMax = isProUser ? 500 : 7;

  if (messagesUsed >= messagesMax) {
    return NextResponse.json({ error: "Message limit reached" }, { status: 403 });
  }

  // Parse and validate input
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "Messages required" }, { status: 400 });
  }

  // Sanitize messages
  const sanitizedMessages = messages
    .slice(-20)
    .filter((m: { role: string; content: string }) =>
      (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    )
    .map((m: { role: string; content: string }) => ({
      role: m.role as "user" | "assistant",
      content: m.content.slice(0, 5000),
    }));

  // Save user message to DB
  const lastUserMsg = sanitizedMessages[sanitizedMessages.length - 1];
  if (lastUserMsg?.role === "user") {
    await supabase.from("chat_messages").insert({
      user_id: user.id,
      role: "user",
      content: lastUserMsg.content,
    });
  }

  // Stream response
  try {
    const anthropic = getAnthropicClient();

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
        messages: sanitizedMessages,
      },
      { signal: AbortSignal.timeout(30000) }
    );

    let fullResponse = "";

    const encoder = new TextEncoder();
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              const text = event.delta.text;
              fullResponse += text;
              controller.enqueue(encoder.encode(text));
            }
          }

          // Save assistant response to DB
          if (fullResponse) {
            await supabase.from("chat_messages").insert({
              user_id: user.id,
              role: "assistant",
              content: fullResponse,
            });
          }

          // Increment message counter
          const updateField = isProUser ? "ai_messages_this_month" : "ai_messages_used";
          await supabase
            .from("profiles")
            .update({ [updateField]: messagesUsed + 1 })
            .eq("id", user.id);

          // Award XP (+3 for counselor message)
          await supabase
            .from("profiles")
            .update({ xp: profile.xp + 3 })
            .eq("id", user.id);

          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("Counselor API error:", err);
    const message = err instanceof Error ? err.message : "Something went wrong";
    return NextResponse.json(
      { error: message.includes("API") ? message : "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
