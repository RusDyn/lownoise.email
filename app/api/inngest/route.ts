import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { scrapeJobs } from "@/inngest/scrape-jobs";
import { sendDigest } from "@/inngest/send-digest";
import { sendDigestHourly } from "@/inngest/send-digest-hourly";

// Must be nodejs — Inngest uses Node.js APIs and the jobs pipeline is heavy processing
export const runtime = "nodejs";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [scrapeJobs, sendDigest, sendDigestHourly],
});
