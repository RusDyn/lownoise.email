import { Resend } from "resend";
import { inngest } from "@/lib/inngest";
import { getJobsSince } from "@/lib/jobs/store";
import { filterAndRankJobs } from "@/lib/jobs/score";
import { formatJobHtml, buildBroadcastHtml, JOB_DIVIDER_HTML } from "@/lib/email/digest";
import type { Subscriber } from "@/lib/jobs/types";

export const sendDigest = inngest.createFunction(
  { id: "send-digest", name: "Send Daily Digest", triggers: [{ cron: "0 16 * * *" }] }, // 4 PM UTC = 8 AM PT
  async ({ step }) => {
    const jobs = await step.run("get-recent-jobs", () =>
      getJobsSince(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (jobs.length === 0) return { sent: 0, reason: "no jobs today" };

    // Fetch all contacts + their custom properties (list gives basic fields, get gives properties)
    const subscribers = await step.run("list-contacts", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const segmentId = process.env.RESEND_SEGMENT_ID;
      if (!segmentId) throw new Error("RESEND_SEGMENT_ID is not configured");

      const all: Subscriber[] = [];
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

        // contacts.list omits custom properties — fetch each contact individually
        const detailed = await Promise.all(
          active.map(async (c) => {
            const { data: detail } = await resend.contacts.get(c.id);
            if (!detail) return null;

            const props = (detail.properties ?? {}) as unknown as Record<string, string>;
            const kwStr = props["keywords"] ?? "";
            const authStr = props["auth_countries"] ?? "";

            return {
              id: c.id,
              email: c.email,
              keywords: kwStr.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean),
              remote: (props["remote"] ?? "").toLowerCase(),
              location: (props["location"] ?? "").toLowerCase(),
              authCountries: authStr.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean),
              hasUSVisa: authStr.toUpperCase().includes("US"),
            } satisfies Subscriber;
          })
        );

        all.push(...detailed.filter((s): s is Subscriber => s !== null));

        if (!data.has_more) break;
        after = data.data.at(-1)?.id;
      }

      return all;
    });

    if (subscribers.length === 0) return { sent: 0, reason: "no active subscribers" };

    // Score jobs per subscriber and update their Resend contact properties
    await step.run("process-contacts", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const batchSize = 10;
      for (let i = 0; i < subscribers.length; i += batchSize) {
        const batch = subscribers.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (sub) => {
            const ranked = filterAndRankJobs(jobs, sub);

            const jobsHtml =
              ranked.length > 0
                ? ranked.map((j, idx) => formatJobHtml(j, idx + 1)).join(JOB_DIVIDER_HTML)
                : "No new matches today — check back tomorrow.";

            await resend.contacts.update({
              id: sub.id,
              properties: {
                jobs_count: String(ranked.length),
                jobs: jobsHtml,
              },
            });
          })
        );
      }
    });

    // Create broadcast and send immediately; Resend substitutes {{{contact.jobs}}} per recipient
    await step.run("send-broadcast", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const segmentId = process.env.RESEND_SEGMENT_ID;
      if (!segmentId) throw new Error("RESEND_SEGMENT_ID is not configured");

      await resend.broadcasts.create({
        segmentId,
        from: "Alex <dyn@lownoise.email>",
        subject: "{{{contact.jobs_count}}} fresh remote backend/platform jobs",
        html: buildBroadcastHtml(),
        send: true,
      });
    });

    return { sent: subscribers.length };
  }
);
