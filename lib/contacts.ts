import { Resend } from "resend";

export interface ResendContact {
  id: string;
  email: string;
  properties: Record<string, string>;
  unsubscribed: boolean;
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

    const contact = data.data.find((c) => c.email === email);
    if (contact) {
      if (!opts?.includeUnsubscribed && contact.unsubscribed) return null;

      const { data: detail } = await resend.contacts.get(contact.id);
      if (!detail) return null;

      return {
        id: contact.id,
        email: contact.email,
        properties: (detail.properties ?? {}) as unknown as Record<string, string>,
        unsubscribed: contact.unsubscribed,
      };
    }

    if (!data.has_more) break;
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

    const detailed = await Promise.all(
      active.map(async (c) => {
        const { data: detail } = await resend.contacts.get(c.id);
        if (!detail) return null;

        return {
          id: c.id,
          email: c.email,
          properties: (detail.properties ?? {}) as unknown as Record<string, string>,
          unsubscribed: c.unsubscribed,
        } satisfies ResendContact;
      }),
    );

    all.push(...detailed.filter((c): c is ResendContact => c !== null));

    if (!data.has_more) break;
    after = data.data.at(-1)?.id;
  }

  return all;
}
