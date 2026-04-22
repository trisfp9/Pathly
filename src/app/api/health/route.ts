import { NextResponse } from "next/server";

export const maxDuration = 15;

// Health check endpoint — tells you if env vars are configured
// Visit /api/health in your browser to see status
export async function GET() {
  const checks = {
    anthropic_api_key: !!process.env.ANTHROPIC_API_KEY,
    anthropic_api_key_prefix: process.env.ANTHROPIC_API_KEY?.slice(0, 12) + "...",
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabase_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabase_service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    stripe_secret: !!process.env.STRIPE_SECRET_KEY,
    stripe_webhook: !!process.env.STRIPE_WEBHOOK_SECRET,
    app_url: process.env.NEXT_PUBLIC_APP_URL || "not set",
  };

  // Try a real Anthropic call if key is set
  let anthropic_test: { ok: boolean; error?: string; model?: string } = { ok: false };
  if (checks.anthropic_api_key) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await client.messages.create(
        {
          model: "claude-sonnet-4-20250514",
          max_tokens: 20,
          messages: [{ role: "user", content: "Say 'ok' in one word." }],
        },
        { signal: controller.signal }
      );
      clearTimeout(timeout);
      const block = res.content[0];
      anthropic_test = { ok: true, model: res.model, error: block.type === "text" ? block.text : "no text" };
    } catch (err) {
      anthropic_test = {
        ok: false,
        error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
      };
    }
  }

  return NextResponse.json({ env: checks, anthropic_test });
}
