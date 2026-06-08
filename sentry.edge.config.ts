import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.SENTRY_DSN,

  // Edge runtime is minimal — traces only, no file I/O
  tracesSampleRate: 0,

  environment: process.env.VERCEL_ENV || "development",

  sendDefaultPii: false,

  enabled: process.env.NODE_ENV !== "development" || !!process.env.SENTRY_DSN,
});
