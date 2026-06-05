import { Resend } from "resend";
import { inngest } from "@/lib/inngest";
import { getJobsSince } from "@/lib/jobs/store";
import {
  clearSendSegment,
  loadActiveSubscribers,
  prepareDigestRecipients,
  selectHourlySubscribers,
  sendDigestBroadcast,
} from "@/lib/email/digest-send";

export const sendDigestHourly = inngest.createFunction(
  { id: "send-digest-hourly", name: "Send Hourly Premium Digest", triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => {
    await step.run("clear-send-segment", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const segmentId = process.env.RESEND_HOURLY_SEND_SEGMENT_ID;
      if (!segmentId) throw new Error("RESEND_HOURLY_SEND_SEGMENT_ID is not configured");
      return clearSendSegment(resend, segmentId);
    });

    const jobs = await step.run("get-recent-jobs", () =>
      getJobsSince(Date.now() - 60 * 60 * 1000)
    );

    if (jobs.length === 0) return { sent: 0, reason: "no jobs this hour" };

    const subscribers = await step.run("list-contacts", async () =>
      selectHourlySubscribers(await loadActiveSubscribers())
    );

    if (subscribers.length === 0) return { sent: 0, reason: "no hourly subscribers" };

    const recipients = await step.run("process-contacts", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const segmentId = process.env.RESEND_HOURLY_SEND_SEGMENT_ID;
      if (!segmentId) throw new Error("RESEND_HOURLY_SEND_SEGMENT_ID is not configured");

      return prepareDigestRecipients({
        resend,
        subscribers,
        jobs,
        segmentId,
        includeEmptyMatches: false,
      });
    });

    if (recipients === 0) return { sent: 0, reason: "no hourly matches" };

    await step.run("send-broadcast", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const segmentId = process.env.RESEND_HOURLY_SEND_SEGMENT_ID;
      if (!segmentId) throw new Error("RESEND_HOURLY_SEND_SEGMENT_ID is not configured");
      return sendDigestBroadcast({ resend, segmentId, name: "Hourly premium digest" });
    });

    return { sent: recipients };
  }
);
