import { Resend } from "resend";
import { createManageToken } from "@/lib/auth";
import { callResendWithRetry, listActiveContacts, type ResendContact } from "@/lib/contacts";
import { buildBroadcastHtml, formatJobHtml, JOB_DIVIDER_HTML } from "@/lib/email/digest";
import { stripTimezone, extractTimezone } from "@/lib/jobs/normalize";
import { filterAndRankJobs } from "@/lib/jobs/score";
import type { StructuredJob, Subscriber } from "@/lib/jobs/types";
import { logger } from "@/lib/logger";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://lownoise.email";
export const DEFAULT_DAILY_SEND_HOUR_UTC = "16";

export function normalizeDailySendHourUtc(value: string | undefined): string {
  if (!value) return DEFAULT_DAILY_SEND_HOUR_UTC;
  const trimmed = value.trim();
  if (!/^\d{1,2}$/.test(trimmed)) return DEFAULT_DAILY_SEND_HOUR_UTC;
  const hour = Number(trimmed);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return DEFAULT_DAILY_SEND_HOUR_UTC;
  return String(hour);
}

export function mapContactToSubscriber(c: ResendContact): Subscriber {
  const kwStr = c.properties.keywords ?? "";
  const authStr = c.properties.auth_countries ?? "";
  const remoteStr = c.properties.remote ?? "";
  const locationStr = (c.properties.location ?? "").toLowerCase();
  const tzProp = c.properties.timezone ?? "";
  const authCountries = authStr.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

  return {
    id: c.id,
    email: c.email,
    keywords: kwStr.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean),
    remote: remoteStr.toLowerCase(),
    location: stripTimezone(locationStr),
    timezone: tzProp.toUpperCase() || extractTimezone(locationStr),
    authCountries,
    hasUSVisa: authCountries.includes("US"),
    dailySendHourUtc: normalizeDailySendHourUtc(c.properties.daily_send_hour_utc),
    premium: c.properties.premium ?? "",
    hourly: c.properties.hourly ?? "",
  };
}

export function selectDailySubscribers(subscribers: Subscriber[], currentUtcHour: number): Subscriber[] {
  return subscribers.filter((sub) => Number(normalizeDailySendHourUtc(sub.dailySendHourUtc)) === currentUtcHour);
}

export function isHourlySubscriber(subscriber: Subscriber): boolean {
  return subscriber.premium?.toLowerCase() === "true" && subscriber.hourly?.toLowerCase() === "true";
}

export function selectHourlySubscribers(subscribers: Subscriber[]): Subscriber[] {
  return subscribers.filter(isHourlySubscriber);
}

export async function loadActiveSubscribers(): Promise<Subscriber[]> {
  const contacts = await listActiveContacts();
  return contacts.map(mapContactToSubscriber);
}

export async function clearSendSegment(resend: Resend, segmentId: string): Promise<number> {
  let removed = 0;

  while (true) {
    const { data, error } = await resend.contacts.list({
      segmentId,
      limit: 100,
    });

    if (error || !data) {
      throw new Error(`contacts.list failed for segment ${segmentId}: ${JSON.stringify(error)}`);
    }

    for (const contact of data.data) {
      const { error: removeError } = await resend.contacts.segments.remove({
        contactId: contact.id,
        segmentId,
      });
      if (removeError) {
        throw new Error(`contacts.segments.remove failed for ${contact.id}: ${JSON.stringify(removeError)}`);
      }
      removed += 1;
    }

    if (!data.has_more || data.data.length === 0) break;
  }

  return removed;
}

interface PrepareDigestOptions {
  resend: Resend;
  subscribers: Subscriber[];
  jobs: StructuredJob[];
  segmentId: string;
  includeEmptyMatches: boolean;
}

export async function prepareDigestRecipients({
  resend,
  subscribers,
  jobs,
  segmentId,
  includeEmptyMatches,
}: PrepareDigestOptions): Promise<number> {
  let recipients = 0;
  let totalMatched = 0;
  let totalZeroMatch = 0;
  const batchSize = 4;

  for (let i = 0; i < subscribers.length; i += batchSize) {
    const batch = subscribers.slice(i, i + batchSize);
    const counts = await Promise.all(
      batch.map(async (sub, idx): Promise<number> => {
        const ranked = filterAndRankJobs(jobs, sub);

        // Log matching decisions — searchable in Sentry as info-level events
        if (ranked.length === 0) {
          totalZeroMatch++;
          logger.info("digest: zero matches for subscriber", {
            contactId: sub.id,
            keywords: sub.keywords.join(","),
            remote: sub.remote,
            totalJobs: jobs.length,
          });
        } else {
          totalMatched += ranked.length;
          // Log top-3 scores so you can spot scoring anomalies
          logger.debug("digest: subscriber matched", {
            contactId: sub.id,
            matchCount: ranked.length,
            topScores: ranked.slice(0, 3).map((j) =>
              `${j.company}:${j.title.slice(0, 40)}`
            ),
          });
        }

        if (!includeEmptyMatches && ranked.length === 0) return 0;

        const jobsHtml =
          ranked.length > 0
            ? ranked.map((j, idx) => formatJobHtml(j, idx + 1)).join(JOB_DIVIDER_HTML)
            : `<span style="color:#7a7a6e;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px">your matches are empty today - check back tomorrow.</span>`;

        const manageToken = await createManageToken(sub.email);
        const manageUrl = `${BASE_URL}/manage?token=${encodeURIComponent(manageToken)}`;

        // Stagger API calls within the batch so we don't spike Resend's
        // rate limiter with 4 simultaneous contacts.update calls.
        if (idx > 0) await new Promise((r) => setTimeout(r, idx * 200));

        const { error: updateError } = await callResendWithRetry(
          () =>
            resend.contacts.update({
              id: sub.id,
              properties: {
                jobs_count: ranked.length === 0 ? "No" : String(ranked.length),
                jobs: jobsHtml,
                manage_url: manageUrl,
              },
            }),
          `contacts.update[${sub.id}]`,
        );
        if (updateError) throw new Error(`contacts.update failed for ${sub.id}: ${JSON.stringify(updateError)}`);

        const { error: segmentError } = await callResendWithRetry(
          () =>
            resend.contacts.segments.add({
              contactId: sub.id,
              segmentId,
            }),
          `contacts.segments.add[${sub.id}]`,
        );
        if (segmentError) {
          throw new Error(`contacts.segments.add failed for ${sub.id}: ${JSON.stringify(segmentError)}`);
        }

        return 1;
      }),
    );

    recipients += counts.reduce((sum, count) => sum + count, 0);
    if (i + batchSize < subscribers.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // Aggregate matching summary — searchable in Sentry
  logger.info("digest: matching complete", {
    totalSubscribers: subscribers.length,
    recipients,
    totalMatched,
    totalZeroMatch,
    totalJobs: jobs.length,
    matchRate: subscribers.length > 0
      ? `${Math.round((recipients / subscribers.length) * 100)}%`
      : "0%",
  });

  return recipients;
}

interface SendDigestBroadcastOptions {
  resend: Resend;
  segmentId: string;
  name: string;
}

export async function sendDigestBroadcast({ resend, segmentId, name }: SendDigestBroadcastOptions) {
  const { data, error } = await resend.broadcasts.create({
    segmentId,
    name,
    from: "Alex <dyn@lownoise.email>",
    subject: "{{{contact.jobs_count}}} fresh remote backend/platform jobs",
    html: buildBroadcastHtml(),
    send: true,
  });

  if (error) throw new Error(`Resend broadcasts.create failed: ${JSON.stringify(error)}`);
  return data;
}
