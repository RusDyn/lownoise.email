import * as Sentry from "@sentry/nextjs";

/**
 * Structured logging wrapper that feeds everything into Sentry.
 *
 * Design principles:
 * - Fire-and-forget: never throws, never blocks the caller
 * - Context-rich: every log carries an operation name and structured data
 * - Test-friendly: the `createLogger` factory lets tests inject a mock
 * - Single pipe: all levels route to Sentry (errors, warnings, info breadcrumbs, metrics)
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.error("contacts.update failed", { error, contactId: id });
 *   logger.metric("jobs_scraped", stored);
 */

export interface LogContext {
  /** The Error object, if this is an exception log */
  error?: unknown;
  /** Arbitrary key-value tags attached to the event */
  [key: string]: unknown;
}

export interface Logger {
  /**
   * Critical errors and exceptions. Sent to Sentry as a captured exception
   * AND logged to console.error for Vercel's 30-min window.
   */
  error(message: string, context?: LogContext): void;

  /**
   * Warnings — things that shouldn't happen but aren't crashes.
   * Sent to Sentry as captureMessage("warning") + console.warn.
   * Searchable in Sentry under the "warning" level.
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Business-level informational logs — matching results, pipeline decisions,
   * filter outcomes. Sent to Sentry as captureMessage("info") so they are
   * SEARCHABLE and persistent. Each call counts as a Sentry event.
   *
   * Use this for events you want to query later (e.g. "show me all matches
   * for subscriber X"). For high-frequency trace events, use debug() instead.
   */
  info(message: string, context?: LogContext): void;

  /**
   * High-frequency trace events (redirects, dedup decisions, batch progress).
   * Sent to Sentry as a breadcrumb (attaches to the current span) + console.log.
   * NOT searchable — use info() for events you need to query later.
   *
   * Cheap — safe for events that fire hundreds of times per run.
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Business metric — a numeric value with optional tags.
   * Sent to Sentry metrics for dashboarding and alerting.
   * Never throws; silently no-ops if Sentry metrics aren't configured.
   */
  metric(name: string, value: number, tags?: Record<string, string>): void;
}

/**
 * Create a Sentry-backed logger. The factory pattern lets tests inject
 * a no-op or spy logger without importing the Sentry SDK.
 */
export function createLogger(): Logger {
  /**
   * Sentry tags must be string values. Coerce unknown values and drop
   * non-serializable ones. The `extra` field (below) carries the full
   * structured data; `tags` power Sentry's indexed search/filter UI.
   */
  function toSentryTags(
    context?: LogContext,
  ): Record<string, string> {
    if (!context) return {};
    const { error, ...rest } = context;
    const tags: Record<string, string> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v === null || v === undefined) continue;
      if (typeof v === "string") { tags[k] = v.slice(0, 200); }
      else if (typeof v === "number" || typeof v === "boolean") { tags[k] = String(v); }
      // Skip objects, arrays, and other non-primitive values
    }
    return tags;
  }

  /**
   * Normalize error objects. Sentry's captureException handles Error
   * instances well; for non-Error throwables we wrap them so the stack
   * trace in Sentry is useful.
   */
  function normalizeError(err: unknown): Error {
    if (err instanceof Error) return err;
    if (typeof err === "string") return new Error(err);
    try {
      return new Error(JSON.stringify(err));
    } catch {
      return new Error("Unknown error (non-serializable)");
    }
  }

  return {
    error(message: string, context?: LogContext): void {
      try {
        const { error, ...rest } = context ?? {};
        const err = error ? normalizeError(error) : new Error(message);
        const tags = toSentryTags(context);
        Sentry.captureException(err, {
          level: "error",
          tags,
          extra: { message, ...rest },
        });
        console.error(`[ERROR] ${message}`, context ?? "");
      } catch {
        // Last-resort fallback: at minimum, hit console
        console.error(`[ERROR] ${message}`, context ?? "");
      }
    },

    warn(message: string, context?: LogContext): void {
      try {
        const { error: _, ...rest } = context ?? {};
        const tags = toSentryTags(context);
        Sentry.captureMessage(message, {
          level: "warning",
          tags,
          extra: rest,
        });
        console.warn(`[WARN] ${message}`, context ?? "");
      } catch {
        console.warn(`[WARN] ${message}`, context ?? "");
      }
    },

    info(message: string, context?: LogContext): void {
      try {
        const { error: _, ...rest } = context ?? {};
        const tags = toSentryTags(context);
        Sentry.captureMessage(message, {
          level: "info",
          tags,
          extra: rest,
        });
        console.log(`[INFO] ${message}`, context ?? "");
      } catch {
        console.log(`[INFO] ${message}`, context ?? "");
      }
    },

    debug(message: string, context?: LogContext): void {
      try {
        const { error: _, ...rest } = context ?? {};
        Sentry.addBreadcrumb({
          category: "app",
          message,
          data: rest,
          level: "info",
        });
        console.log(`[DEBUG] ${message}`, context ?? "");
      } catch {
        console.log(`[DEBUG] ${message}`, context ?? "");
      }
    },

    metric(name: string, value: number, tags?: Record<string, string>): void {
      try {
        Sentry.metrics.count(name, value, tags);
      } catch {
        // Metrics are best-effort; Sentry SDK handles sampling/aggregation
        console.log(`[METRIC] ${name}=${value}`, tags ?? "");
      }
    },
  };
}

/** Default singleton — use everywhere except tests */
export const logger: Logger = createLogger();
