import { Resend } from "resend";
import { inngest } from "@/lib/inngest";
import { getJobsSince } from "@/lib/jobs/store";
import { filterAndRankJobs } from "@/lib/jobs/score";
import { formatJobHtml, buildBroadcastHtml, JOB_DIVIDER_HTML } from "@/lib/email/digest";
import { createManageToken } from "@/lib/auth";
import { listActiveContacts } from "@/lib/contacts";
import { stripTimezone, extractTimezone } from "@/lib/jobs/normalize";
import type { Subscriber } from "@/lib/jobs/types";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://lownoise.email";

export const sendDigest = inngest.createFunction(
  { id: "send-digest", name: "Send Daily Digest", triggers: [{ cron: "0 16 * * *" }] }, // 4 PM UTC = 8 AM PT
  async ({ step }) => {
    const jobs = await step.run("get-recent-jobs", () =>
      getJobsSince(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (jobs.length === 0) return { sent: 0, reason: "no jobs today" };

    // Fetch all active contacts + their custom properties
    const subscribers = await step.run("list-contacts", async () => {
      const contacts = await listActiveContacts();

      return contacts.map((c) => {
        const kwStr = c.properties["keywords"] ?? "";
        const authStr = c.properties["auth_countries"] ?? "";
        const remoteStr = c.properties["remote"] ?? "";
        const locationStr = (c.properties["location"] ?? "").toLowerCase();
        const tzProp = c.properties["timezone"] ?? "";

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
        } satisfies Subscriber;
      });
    });

    if (subscribers.length === 0) return { sent: 0, reason: "no active subscribers" };

    // Score jobs per subscriber and update their Resend contact properties
    await step.run("process-contacts", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const batchSize = 4; // stay under Resend's 5 req/sec limit
      for (let i = 0; i < subscribers.length; i += batchSize) {
        const batch = subscribers.slice(i, i + batchSize);
        await Promise.all(
          batch.map(async (sub) => {
            const ranked = filterAndRankJobs(jobs, sub);

            const jobsHtml =
              ranked.length > 0
                ? ranked.map((j, idx) => formatJobHtml(j, idx + 1)).join(JOB_DIVIDER_HTML)
                : `<span style="color:#7a7a6e;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:13px">your matches are empty today — check back tomorrow.</span>`;

            const manageToken = await createManageToken(sub.email);
            const manageUrl = `${BASE_URL}/manage?token=${encodeURIComponent(manageToken)}`;

            const { error } = await resend.contacts.update({
              id: sub.id,
              properties: {
                jobs_count: ranked.length === 0 ? "No" : String(ranked.length),
                jobs: jobsHtml,
                manage_url: manageUrl,
              },
            });
            if (error) throw new Error(`contacts.update failed for ${sub.id}: ${JSON.stringify(error)}`);
          })
        );
        if (i + batchSize < subscribers.length) {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    });

    // Create broadcast and send immediately; Resend substitutes {{{contact.jobs}}} per recipient
    await step.run("send-broadcast", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const segmentId = process.env.RESEND_SEGMENT_ID;
      if (!segmentId) throw new Error("RESEND_SEGMENT_ID is not configured");

      const { data, error } = await resend.broadcasts.create({
        segmentId,
        from: "Alex <dyn@lownoise.email>",
        subject: "{{{contact.jobs_count}}} fresh remote backend/platform jobs",
        html: buildBroadcastHtml(),
        send: true,
      });

      if (error) throw new Error(`Resend broadcasts.create failed: ${JSON.stringify(error)}`);
      return data;
    });

    return { sent: subscribers.length };
  }
);
