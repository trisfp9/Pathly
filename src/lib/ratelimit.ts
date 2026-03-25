import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Lazy initialization to avoid build-time errors with placeholder env vars
let _redis: Redis | null = null;
function getRedis() {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

type RateLimitConfig = { limit: number; window: string; prefix: string };

const configs: Record<string, RateLimitConfig> = {
  counselor: { limit: 10, window: "1 m", prefix: "rl:counselor" },
  analyze: { limit: 3, window: "1 h", prefix: "rl:analyze" },
  colleges: { limit: 3, window: "1 h", prefix: "rl:colleges" },
  auth: { limit: 5, window: "15 m", prefix: "rl:auth" },
  general: { limit: 60, window: "1 m", prefix: "rl:general" },
};

const _limiters: Record<string, Ratelimit> = {};

function getLimiter(type: string): Ratelimit {
  if (!_limiters[type]) {
    const config = configs[type] || configs.general;
    _limiters[type] = new Ratelimit({
      redis: getRedis(),
      limiter: Ratelimit.slidingWindow(config.limit, config.window as Parameters<typeof Ratelimit.slidingWindow>[1]),
      prefix: config.prefix,
    });
  }
  return _limiters[type];
}

export type RateLimitType = "counselor" | "analyze" | "colleges" | "auth" | "general";

export async function checkRateLimit(
  userId: string,
  type: RateLimitType = "general"
): Promise<{ success: boolean; response?: Response }> {
  try {
    const limiter = getLimiter(type);
    const result = await limiter.limit(userId);

    if (!result.success) {
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

    return { success: true };
  } catch {
    // If Redis is down, allow the request (fail open for availability)
    return { success: true };
  }
}
