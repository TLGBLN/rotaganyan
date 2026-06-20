import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

function createRateLimiter(requests: number, window: `${number} ${"s" | "m" | "h" | "d"}`) {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
  });
}

// 5 login attempt per minute per IP
export const loginLimiter = createRateLimiter(5, "1 m");

// 3 register per hour per IP
export const registerLimiter = createRateLimiter(3, "1 h");

// 3 password reset requests per hour per IP
export const passwordResetLimiter = createRateLimiter(3, "1 h");

export async function checkRateLimit(
  limiter: ReturnType<typeof createRateLimiter>,
  identifier: string
): Promise<{ success: boolean; reset?: number }> {
  if (!limiter) return { success: true };

  const result = await limiter.limit(identifier);
  return { success: result.success, reset: result.reset };
}
