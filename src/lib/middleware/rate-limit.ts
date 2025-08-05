import { NextRequest, NextResponse } from "next/server";

import { RedisCache } from "../redis";

// Rate limit configuration
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

// Default rate limit configurations
export const RATE_LIMITS = {
  DEFAULT: { windowMs: 60000, maxRequests: 100 }, // 100 requests per minute
  UPLOAD: { windowMs: 60000, maxRequests: 10 }, // 10 uploads per minute
  EXPORT: { windowMs: 60000, maxRequests: 20 }, // 20 exports per minute
  CHAT: { windowMs: 60000, maxRequests: 60 }, // 60 chat requests per minute
  JOBS: { windowMs: 60000, maxRequests: 100 }, // 100 job requests per minute
  ACCOUNTS: { windowMs: 60000, maxRequests: 200 }, // 200 account requests per minute
  INSIGHTS: { windowMs: 60000, maxRequests: 200 }, // 200 insight requests per minute
} as const;

// Rate limiting middleware
export function withRateLimit(config: RateLimitConfig) {
  return function (handler: (req: NextRequest) => Promise<NextResponse | Response> | NextResponse | Response) {
    return async (req: NextRequest) => {
      try {
        // Get client identifier (IP address or user ID if authenticated)
        const clientId = await getClientId(req);
        const key = `rate_limit:${clientId}:${req.nextUrl.pathname}`;

        // Get current request count
        const current = await RedisCache.get<{ count: number; resetTime: number }>(key);
        const now = Date.now();

        if (!current || now > current.resetTime) {
          // First request in window or window expired
          await RedisCache.set(
            key,
            { count: 1, resetTime: now + config.windowMs },
            Math.ceil(config.windowMs / 1000),
          );

          return handler(req);
        } else if (current.count >= config.maxRequests) {
          // Rate limit exceeded
          return NextResponse.json(
            {
              error: "Too Many Requests",
              message: config.message || "Rate limit exceeded. Please try again later.",
              retryAfter: Math.ceil((current.resetTime - now) / 1000),
            },
            {
              status: 429,
              headers: {
                "X-RateLimit-Limit": config.maxRequests.toString(),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": Math.ceil(current.resetTime / 1000).toString(),
                "Retry-After": Math.ceil((current.resetTime - now) / 1000).toString(),
              },
            },
          );
        } else {
          // Increment counter
          await RedisCache.set(
            key,
            { count: current.count + 1, resetTime: current.resetTime },
            Math.ceil((current.resetTime - now) / 1000),
          );

          // Execute handler and potentially skip counting based on response
          const response = await handler(req);

          // Check if we should skip counting this request
          const shouldSkip =
            (config.skipSuccessfulRequests && response.status >= 200 && response.status < 400) ||
            (config.skipFailedRequests && response.status >= 400);

          if (shouldSkip) {
            // Decrement counter
            await RedisCache.set(
              key,
              { count: current.count, resetTime: current.resetTime },
              Math.ceil((current.resetTime - now) / 1000),
            );
          }

          // Add rate limit headers
          response.headers.set("X-RateLimit-Limit", config.maxRequests.toString());
          response.headers.set(
            "X-RateLimit-Remaining",
            Math.max(0, config.maxRequests - current.count - 1).toString(),
          );
          response.headers.set("X-RateLimit-Reset", Math.ceil(current.resetTime / 1000).toString());

          return response;
        }
      } catch (error) {
        console.error("Rate limiting error:", error);
        // On error, allow the request to proceed
        return handler(req);
      }
    };
  };
}

// Get client identifier for rate limiting
async function getClientId(req: NextRequest): Promise<string> {
  try {
    // Try to get user ID from session
    const { auth } = await import("@/lib/auth");
    const session = await auth();

    if (session?.user?.id) {
      return `user:${session.user.id}`;
    }
  } catch (error) {
    // Fall back to IP address if session check fails
  }

  // Fall back to IP address
  const forwardedFor = req.headers.get("x-forwarded-for");
  const realIp = req.headers.get("x-real-ip");
  const ip = forwardedFor?.split(",")[0] || realIp || "unknown";

  return `ip:${ip}`;
}

// Predefined rate limit middlewares
export const withDefaultRateLimit = withRateLimit(RATE_LIMITS.DEFAULT);
export const withUploadRateLimit = withRateLimit(RATE_LIMITS.UPLOAD);
export const withExportRateLimit = withRateLimit(RATE_LIMITS.EXPORT);
export const withChatRateLimit = withRateLimit(RATE_LIMITS.CHAT);
export const withJobsRateLimit = withRateLimit(RATE_LIMITS.JOBS);
export const withAccountsRateLimit = withRateLimit(RATE_LIMITS.ACCOUNTS);
export const withInsightsRateLimit = withRateLimit(RATE_LIMITS.INSIGHTS);
