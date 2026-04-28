import { createClient } from "@supabase/supabase-js";

// Simple in-memory rate limiter — no external dependencies needed
// For a small app this is perfectly fine. If you scale to multiple server
// instances behind a load balancer, you'd switch to Redis or a DB-based approach.

type RateLimitConfig = { limit: number; windowMs: number };

const configs: Record<string, RateLimitConfig> = {
  counselor: { limit: 10, windowMs: 60_000 },        // 10 per minute
  analyze: { limit: 3, windowMs: 3_600_000 },         // 3 per hour
  colleges: { limit: 3, windowMs: 3_600_000 },        // 3 per hour
  opportunities: { limit: 3, windowMs: 3_600_000 },   // 3 per hour (AI scholarships/competitions)
  strength: { limit: 10, windowMs: 3_600_000 },       // 10 per hour — cheap, fired on events
  essay: { limit: 1, windowMs: 7 * 24 * 3_600_000 },   // 1 per week — strict
  auth: { limit: 5, windowMs: 900_000 },               // 5 per 15 min
  general: { limit: 60, windowMs: 60_000 },            // 60 per minute
};

// In-memory store: key -> array of timestamps
const store = new Map<string, number[]>();

export type RateLimitType = "counselor" | "analyze" | "colleges" | "opportunities" | "strength" | "essay" | "auth" | "general";

export async function checkRateLimit(
  userId: string,
  type: RateLimitType = "general"
): Promise<{ success: boolean; response?: Response }> {
  try {
    const config = configs[type] || configs.general;
    const key = `${type}:${userId}`;
    const now = Date.now();
    const windowStart = now - config.windowMs;

    // Get existing timestamps, filter out expired ones
    const timestamps = (store.get(key) || []).filter((t) => t > windowStart);

    if (timestamps.length >= config.limit) {
      store.set(key, timestamps);
      return {
        success: false,
        response: new Response(
          JSON.stringify({
            error: "You're going too fast — please wait a moment.",
          }),
          {
            status: 429,
            headers: { "Content-Type": "application/json" },
          }
        ),
      };
    }

    // Add current timestamp
    timestamps.push(now);
    store.set(key, timestamps);

    return { success: true };
  } catch {
    // Fail open
    return { success: true };
  }
}

// Periodically clean up old entries to prevent memory leaks (every 5 min)
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamps] of Array.from(store.entries())) {
      const filtered = timestamps.filter((t) => t > now - 3_600_000);
      if (filtered.length === 0) {
        store.delete(key);
      } else {
        store.set(key, filtered);
      }
    }
  }, 300_000);
}
