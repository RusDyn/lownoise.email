import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WINDOW_S = 60 * 60;
const MAX_REQUESTS = 5;

export default async function proxy(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

  const key = `rate:email:${ip}`;
  // Atomic INCR + EXPIRE-if-new: redis.eval runs a Lua script server-side,
  // preventing the key from becoming permanent if the process dies between two commands
  const luaScript = [
    "local c = redis.call('INCR', KEYS[1])",
    "if c == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
    "return c",
  ].join("\n");
  const count = (await redis.eval(luaScript, [key], [String(WINDOW_S)])) as number;

  if (count > MAX_REQUESTS) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": "3600",
        "Content-Type": "text/plain",
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/subscribe", "/api/verify-email", "/api/send-manage-link"],
};
