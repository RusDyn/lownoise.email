import { Resend } from "resend";
import { inngest } from "@/lib/inngest";
import { getJobsSince } from "@/lib/jobs/store";
import {
  clearSendSegment,
  loadActiveSubscribers,
  prepareDigestRecipients,
  selectDailySubscribers,
  sendDigestBroadcast,
} from "@/lib/email/digest-send";
import { logger } from "@/lib/logger";

export const sendDigest = inngest.createFunction(
  { id: "send-digest", name: "Send Daily Digest", triggers: [{ cron: "0 * * * *" }] },
  async ({ step }) => {
    await step.run("clear-send-segment", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const segmentId = process.env.RESEND_DAILY_SEND_SEGMENT_ID;
      if (!segmentId) throw new Error("RESEND_DAILY_SEND_SEGMENT_ID is not configured");
      return clearSendSegment(resend, segmentId);
    });

    const jobs = await step.run("get-recent-jobs", () =>
      getJobsSince(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (jobs.length === 0) {
      logger.metric("digest_daily_sent", 0);
      return { sent: 0, reason: "no jobs today" };
    }

    const currentUtcHour = new Date().getUTCHours();
    const subscribers = await step.run("list-contacts", async () =>
      selectDailySubscribers(await loadActiveSubscribers(), currentUtcHour)
    );

    if (subscribers.length === 0) {
      logger.metric("digest_daily_sent", 0);
      return { sent: 0, reason: "no active subscribers" };
    }

    const recipients = await step.run("process-contacts", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const segmentId = process.env.RESEND_DAILY_SEND_SEGMENT_ID;
      if (!segmentId) throw new Error("RESEND_DAILY_SEND_SEGMENT_ID is not configured");

      return prepareDigestRecipients({
        resend,
        subscribers,
        jobs,
        segmentId,
        includeEmptyMatches: true,
      });
    });

    if (recipients === 0) {
      logger.metric("digest_daily_sent", 0);
      return { sent: 0, reason: "no daily recipients" };
    }

    await step.run("send-broadcast", async () => {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const segmentId = process.env.RESEND_DAILY_SEND_SEGMENT_ID;
      if (!segmentId) throw new Error("RESEND_DAILY_SEND_SEGMENT_ID is not configured");
      return sendDigestBroadcast({ resend, segmentId, name: "Daily digest" });
    });

    logger.metric("digest_daily_sent", recipients);
    logger.info("digest daily run complete", { sent: recipients, totalJobs: jobs.length });
    return { sent: recipients };
  }
);
