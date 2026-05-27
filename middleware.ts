import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5;

const hits = new Map<string, number[]>();

export default function middleware(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const timestamps = (hits.get(ip) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": "3600",
        "Content-Type": "text/plain",
      },
    });
  }

  timestamps.push(now);
  hits.set(ip, timestamps);

  return NextResponse.next();
}

export const config = {
  matcher: "/api/subscribe",
};
