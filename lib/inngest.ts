import { Inngest } from "inngest";
import { sentryMiddleware } from "@inngest/middleware-sentry";

/**
 * Inngest client with Sentry middleware for error capture and distributed tracing.
 *
 * - Errors are captured on the final retry attempt only (noise reduction)
 * - Step-level errors appear as spans/breadcrumbs but not separate Sentry events
 *
 * Requires Sentry.init() to have been called (via instrumentation.ts).
 */
export const inngest = new Inngest({
  id: "lownoise-email",
  middleware: [
    sentryMiddleware({
      captureStepErrors: false,
      onlyCaptureFinalAttempt: true,
    }),
  ],
});
