// One-off preview sender — renders the digest template and sends to a single address.
// Does not update any contacts or trigger a broadcast.
import { Resend } from "resend";
import { getJobsSince } from "@/lib/jobs/store";
import { filterAndRankJobs } from "@/lib/jobs/score";
import { formatJobHtml, buildBroadcastHtml, JOB_DIVIDER_HTML } from "@/lib/email/digest";
import type { Subscriber } from "@/lib/jobs/types";

const TO = process.argv[2] ?? "dyn.see@gmail.com";

const PREVIEW_SUB: Subscriber = {
  id: "preview",
  email: TO,
  keywords: ["backend", "platform", "go", "typescript"],
  remote: "remote",
  location: "",
  authCountries: [],
  hasUSVisa: false,
};

async function main() {
  const resend = new Resend(process.env.RESEND_API_KEY);

  console.log("→ Fetching jobs (last 24h)…");
  const jobs = await getJobsSince(Date.now() - 24 * 60 * 60 * 1000);
  console.log(`  ${jobs.length} job(s) found`);

  const ranked = jobs.length > 0 ? filterAndRankJobs(jobs, PREVIEW_SUB) : [];
  const jobsHtml =
    ranked.length > 0
      ? ranked.map((j, idx) => formatJobHtml(j, idx + 1)).join(JOB_DIVIDER_HTML)
      : "<span style=\"color:#7a7a6e;font-size:13px\">No matches — Redis may be empty locally.</span>";

  // Inline the jobs into the template (replacing the Resend template variable)
  const html = buildBroadcastHtml().replace("{{{contact.jobs}}}", jobsHtml);

  console.log(`→ Sending preview to ${TO}…`);
  const { error } = await resend.emails.send({
    from: "Alex <dyn@lownoise.email>",
    to: TO,
    subject: `[preview] ${ranked.length} fresh remote backend/platform jobs`,
    html,
  });

  if (error) { console.error("send error", error); process.exit(1); }
  console.log("✓ Preview sent.");
}

main().catch((err) => { console.error(err); process.exit(1); });
