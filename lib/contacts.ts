import { Resend } from "resend";

export interface ResendContact {
  id: string;
  email: string;
  properties: Record<string, string>;
  unsubscribed: boolean;
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
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { data: detail, error } = await resend.contacts.get(id);

    if (detail) {
      return {
        id,
        email,
        properties: (detail.properties ?? {}) as unknown as Record<string, string>,
        unsubscribed,
      };
    }

    if (error) {
      const status = (error as { statusCode?: number }).statusCode;
      const retryAfter = (error as { headers?: Record<string, string> }).headers?.["retry-after"];
      console.error(
        `resend.contacts.get failed for ${id} (attempt ${attempt + 1}/${maxRetries + 1}):`,
        `status=${status ?? "unknown"} retryAfter=${retryAfter ?? "none"}`,
        error,
      );

      // Non-retriable: don't waste attempts on forbidden or missing contacts
      if (status === 403 || status === 404) break;

      if (status === 429 && attempt < maxRetries) {
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.pow(2, attempt) * 1000;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }

    // Genuinely missing (no error, no detail) — no point retrying
    break;
  }

  return null;
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
      console.error("resend contacts.list error", error);
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
