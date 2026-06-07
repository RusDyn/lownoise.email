import { Resend } from "resend";
import { contactPropertiesSchema } from "@/lib/schemas";
import { logger } from "@/lib/logger";

export interface ResendContact {
  id: string;
  email: string;
  properties: Record<string, string>;
  unsubscribed: boolean;
}

/**
 * Generic wrapper that retries a Resend API call on 429 rate limits with
 * exponential backoff. Preserves the return shape `{ data, error }` so
 * callers can inspect errors from the final attempt.
 *
 * Non-retriable status codes (403, 404, 422) break immediately.
 * 429 reads `retry-after` when available; otherwise uses 2^attempt * 1000ms.
 */
export async function callResendWithRetry<T>(
  operation: () => Promise<{ data: T | null; error: unknown }>,
  label: string,
  maxRetries = 3,
): Promise<{ data: T | null; error: unknown }> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data, error } = await operation();

    if (!error) return { data, error };

    const status = (error as { statusCode?: number }).statusCode;
    const retryAfter = (error as { headers?: Record<string, string> }).headers?.["retry-after"];

    // Non-retriable — surface the error immediately
    if (status === 403 || status === 404 || status === 422) return { data, error };

    if (status === 429 && attempt < maxRetries) {
      const delay = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : Math.pow(2, attempt) * 1000 * (0.75 + Math.random() * 0.5);
      logger.warn(
        `resend ${label} rate-limited`,
        { attempt: attempt + 1, maxRetries: maxRetries + 1, delayMs: delay },
      );
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    // Unknown error or exhausted retries — surface it
    if (attempt < maxRetries && status == null) {
      // Unknown transient error: retry with backoff
      const delay = Math.pow(2, attempt) * 1000 * (0.75 + Math.random() * 0.5);
      logger.warn(
        `resend ${label} failed, retrying`,
        { attempt: attempt + 1, maxRetries: maxRetries + 1, status, delayMs: delay },
      );
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    return { data, error };
  }

  return { data: null, error: new Error(`${label}: exhausted retries`) };
}

/**
 * Fetch a single contact with retry+backoff on 429 rate limits.
 * Returns null only when the contact genuinely doesn't exist or retries are
 * exhausted; logs transient errors so they surface in observability.
 */
async function fetchContactWithRetry(
  resend: Resend,
  id: string,
  email: string,
  unsubscribed: boolean,
  maxRetries = 3,
): Promise<ResendContact | null> {
  const { data: detail, error } = await callResendWithRetry(
    () => resend.contacts.get(id),
    `contacts.get[${id}]`,
    maxRetries,
  );

  // 403/404 or exhausted retries — contact doesn't exist or is inaccessible
  if (error || !detail) return null;

  // Zod schema coerces every property to string so downstream
  // calls (.toLowerCase, .split, .match, .replace) never crash.
  // safeParse used to guard against non-object detail.properties (e.g. arrays).
  const parsed = contactPropertiesSchema.safeParse(detail.properties ?? {});
  if (!parsed.success) {
    logger.error("contactPropertiesSchema parse failed", {
      contactId: id,
      email,
      issues: parsed.error.flatten(),
    });
  }
  const props = parsed.success ? parsed.data : ({} as Record<string, string>);
  return { id, email, properties: props, unsubscribed };
}

/**
 * Paginate through a Resend segment to find a single contact by email.
 *
 * By default excludes unsubscribed contacts (matching the digest sender's
 * `!c.unsubscribed` filter). Pass `includeUnsubscribed: true` when you need
 * to look up a contact regardless of subscription status (e.g. the manage
 * page, where an unsubscribed user may be trying to re-subscribe).
 *
 * Returns null when the contact is not found, is unsubscribed (by default),
 * or on any Resend API error — safe for non-enumeration flows.
 */
export async function findContactByEmail(
  email: string,
  opts?: { includeUnsubscribed?: boolean },
): Promise<ResendContact | null> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const segmentId = process.env.RESEND_SEGMENT_ID;
  if (!segmentId) return null;

  let after: string | undefined;
  while (true) {
    const { data, error } = await resend.contacts.list({
      segmentId,
      limit: 100,
      ...(after ? { after } : {}),
    });
    if (error || !data) return null;

    const normalized = email.trim().toLowerCase();
    const contact = data.data.find((c) => c.email?.trim().toLowerCase() === normalized);
    if (contact) {
      if (!opts?.includeUnsubscribed && contact.unsubscribed) return null;

      const result = await fetchContactWithRetry(resend, contact.id, contact.email, contact.unsubscribed);
      if (!result) return null;

      return result;
    }

    if (!data.has_more || !data.data.length) break;
    after = data.data.at(-1)?.id;
  }

  return null;
}

/**
 * List all active (non-unsubscribed) contacts in the Resend segment with
 * their full custom properties.
 *
 * Used by the digest sender to build the per-subscriber job list.
 */
export async function listActiveContacts(): Promise<ResendContact[]> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const segmentId = process.env.RESEND_SEGMENT_ID;
  if (!segmentId) throw new Error("RESEND_SEGMENT_ID is not configured");

  const all: ResendContact[] = [];
  let after: string | undefined;

  while (true) {
    const { data, error } = await resend.contacts.list({
      segmentId,
      limit: 100,
      ...(after ? { after } : {}),
    });

    if (error || !data) {
      logger.error("resend contacts.list failed", { error });
      break;
    }

    const active = data.data.filter((c) => !c.unsubscribed);

    // Fetch details in batches of 4 to stay under Resend's 5 req/sec limit,
    // with retry+backoff on 429s. Same pattern as send-digest process-contacts.
    const detailed: (ResendContact | null)[] = [];
    const batchSize = 4;
    for (let i = 0; i < active.length; i += batchSize) {
      const batch = active.slice(i, i + batchSize);
      const results = await Promise.all(
        batch.map(async (c) => {
          const contact = await fetchContactWithRetry(resend, c.id, c.email, c.unsubscribed);
          return contact;
        }),
      );
      detailed.push(...results);
      if (i + batchSize < active.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    all.push(...detailed.filter((c): c is ResendContact => c !== null));

    if (!data.has_more || !data.data.length) break;
    after = data.data.at(-1)?.id;
  }

  return all;
}
