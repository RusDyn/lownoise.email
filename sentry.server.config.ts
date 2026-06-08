import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Conservative start — adjust after reviewing volume
  tracesSampleRate: 0.05,

  // Vercel environment detection
  environment: process.env.VERCEL_ENV || "development",

  // Disable PII collection — we'll add explicit user context where needed
  sendDefaultPii: false,

  // Only enable in production and preview; skip local dev to avoid noise
  enabled: process.env.NODE_ENV !== "development" || !!process.env.SENTRY_DSN,

  // Ignore transient network errors from external APIs that we already handle
  ignoreErrors: [
    "ECONNRESET",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "Resend rate-limited",
  ],
});
