import { Resend } from "resend";
import { getJobsSince } from "@/lib/jobs/store";
import { filterAndRankJobs } from "@/lib/jobs/score";
import { formatJobHtml, buildBroadcastHtml, JOB_DIVIDER_HTML } from "@/lib/email/digest";
import type { Subscriber } from "@/lib/jobs/types";

async function main() {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const segmentId = process.env.RESEND_SEGMENT_ID;

  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  if (!segmentId) throw new Error("RESEND_SEGMENT_ID not set");

  // ── 1. Load recent jobs ────────────────────────────────────────────────────
  console.log("→ Fetching jobs from Redis (last 24h)…");
  const jobs = await getJobsSince(Date.now() - 24 * 60 * 60 * 1000);
  console.log(`  ${jobs.length} job(s) found`);
  if (jobs.length === 0) { console.log("No jobs — aborting."); return; }

  // ── 2. Fetch contacts ──────────────────────────────────────────────────────
  console.log("→ Listing contacts in segment…");
  const subscribers: Subscriber[] = [];
  let after: string | undefined;

  while (true) {
    const { data, error } = await resend.contacts.list({
      segmentId,
      limit: 100,
      ...(after ? { after } : {}),
    });
    if (error || !data) { console.error("contacts.list error", error); break; }

    const active = data.data.filter((c) => !c.unsubscribed);
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
    subscribers.push(...detailed.filter((s): s is Subscriber => s !== null));
    if (!data.has_more) break;
    after = data.data.at(-1)?.id;
  }
  console.log(`  ${subscribers.length} active subscriber(s)`);
  if (subscribers.length === 0) { console.log("No subscribers — aborting."); return; }

  // ── 3. Prepare: score + update contact properties ─────────────────────────
  console.log("→ Preparing contacts (scoring jobs, updating properties)…");
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
          properties: { jobs_count: String(ranked.length), jobs: jobsHtml },
        });
        console.log(`  ${sub.email}: ${ranked.length} match(es)`);
      })
    );
  }

  // ── 4. Broadcast ───────────────────────────────────────────────────────────
  console.log("→ Creating and sending broadcast…");
  const { data: bc, error: bcErr } = await resend.broadcasts.create({
    segmentId,
    from: "Alex <dyn@lownoise.email>",
    subject: "{{{contact.jobs_count}}} fresh remote backend/platform jobs",
    html: buildBroadcastHtml(),
    send: true,
  });
  if (bcErr) { console.error("broadcast error", bcErr); process.exit(1); }
  console.log("✓ Broadcast sent:", bc);
}

main().catch((err) => { console.error(err); process.exit(1); });
