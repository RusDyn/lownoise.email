import { inngest } from "@/lib/inngest";
import { scrapeSerper, scrapeApify, scrapeJobPage, normalizeJobUrl } from "@/lib/jobs/scrape";
import { structureJob } from "@/lib/jobs/structure";
import { isKnownUrl, storeJob } from "@/lib/jobs/store";
import { isBannedDomain, detectSuspiciousDomain } from "@/lib/jobs/banlist";
import type { RawJob } from "@/lib/jobs/types";

export const scrapeJobs = inngest.createFunction(
  { id: "scrape-jobs", name: "Scrape Jobs", triggers: [{ cron: "50 * * * *" }] },
  async ({ step }) => {
    // Step 1: Scrape all sources in parallel
    const scraped = await step.run("scrape-sources", async () => {
      const [serper, apify] = await Promise.all([scrapeSerper(), scrapeApify()]);
      return { serper, apify };
    });

    // Step 2: Merge, deduplicate by URL, filter already-known and banned domains
    const newJobs = (await step.run("dedup-filter", async (): Promise<RawJob[]> => {
      const merged = [...scraped.serper, ...scraped.apify].map((j) => ({
        ...j,
        url: normalizeJobUrl(j.url),
      }));

      let bannedCount = 0;
      const seen = new Set<string>();
      const deduped = merged.filter((j) => {
        if (!j.url || seen.has(j.url)) return false;

        // Reject known scam / AI-slop domains before they consume API calls
        if (isBannedDomain(j.url)) {
          bannedCount++;
          return false;
        }

        // Log suspicious (not yet banned) domains for manual review
        const suspicion = detectSuspiciousDomain(j.url);
        if (suspicion.suspicious) {
          console.warn("scrape-jobs: suspicious domain:", j.url, suspicion.reasons);
        }

        seen.add(j.url);
        return true;
      });

      if (bannedCount > 0) {
        console.log(`scrape-jobs: filtered ${bannedCount} banned-domain job(s)`);
      }

      const knownFlags = await Promise.all(deduped.map((j) => isKnownUrl(j.url)));
      const fresh = deduped.filter((_, i) => !knownFlags[i]);
      return fresh;
    })) as RawJob[];

    if (newJobs.length === 0) return { scraped: 0, stored: 0 };

    // Step 3: Firecrawl + DeepSeek in batches of 5 with 2s sleep between batches
    let stored = 0;
    const batchSize = 5;
    // Cross-source dedup: fingerprints are returned from each step and accumulated here.
    // On Inngest replay, completed steps return memoized results so allFingerprints
    // is rebuilt correctly before the live step runs — unlike a plain Set in outer closure.
    const allFingerprints: string[] = [];

    for (let i = 0; i < newJobs.length; i += batchSize) {
      const batch = newJobs.slice(i, i + batchSize);
      const priorFingerprints = new Set(allFingerprints);

      const result = await step.run(`firecrawl-batch-${i}`, async () => {
        const markdowns = await Promise.all(
          batch.map((j) => scrapeJobPage(j.url).catch(() => null))
        );

        const stepFingerprints = new Set<string>();
        const newFingerprints: string[] = [];
        let batchStored = 0;

        for (let k = 0; k < batch.length; k++) {
          if (!markdowns[k]) continue;
          try {
            const structured = await structureJob(batch[k], markdowns[k]!);
            if (!structured) continue;

            const fp = `${structured.title.toLowerCase()}|${structured.company.toLowerCase()}`;
            if (priorFingerprints.has(fp) || stepFingerprints.has(fp)) continue;
            stepFingerprints.add(fp);
            newFingerprints.push(fp);

            await storeJob(structured, markdowns[k]!);
            batchStored++;
          } catch (err) {
            console.error(`Failed to process ${batch[k].url}:`, err);
          }
        }
        return { batchStored, newFingerprints };
      });

      allFingerprints.push(...result.newFingerprints);
      stored += result.batchStored;

      if (i + batchSize < newJobs.length) {
        await step.sleep(`delay-${i}`, "2s");
      }
    }

    return { scraped: newJobs.length, stored };
  }
);
