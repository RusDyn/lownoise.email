# lownoise.email

Daily personalized engineering job digest. Scrapes ~12,000 fresh roles from Ashby, Greenhouse, Lever, LinkedIn, and 130+ other ATS sources every hour, scores each posting against your stack and preferences, and delivers up to 10 top matches to your inbox once a day — no dashboard, no Easy Apply noise, no ghost jobs.

## How it works

```
scrape (Serper + Apify)
  → dedup + filter (Upstash Redis)
    → enrich page content (Firecrawl)
      → structure + score (DeepSeek)
        → store (Upstash Redis)
          → broadcast digest (Resend)
```

Inngest orchestrates the pipeline with hourly scrape jobs and a daily digest send. Jobs run in batches of 5 with step memoization so failed runs replay safely without re-processing completed work.

## Stack

- **Next.js 16** — landing page + API routes
- **Inngest** — job scheduling and pipeline orchestration
- **Upstash Redis** — job storage and URL deduplication
- **Resend** — email broadcast and audience management
- **Serper** — Google search-based job discovery
- **Apify** — LinkedIn jobs actor
- **Firecrawl** — job page content extraction
- **DeepSeek** — LLM structuring of raw job content

## Local development

```bash
npm install
cp .env.local.example .env.local  # fill in the variables below
npm run dev
```

The app runs at `http://localhost:3000`. The Inngest dev server must be running separately to trigger background jobs — see [Inngest local dev](https://www.inngest.com/docs/local-development).

## Environment variables

Create a `.env.local` file with the following:

```env
# Resend (email delivery)
RESEND_API_KEY=
RESEND_SEGMENT_ID=        # segment ID from Resend dashboard → Segments

# Inngest (job orchestration)
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=

# Scraping
SERPER_API_KEY=            # google.serper.dev
FIRECRAWL_API_KEY=         # firecrawl.dev
APIFY_API_KEY=             # apify.com — LinkedIn jobs actor

# LLM structuring
DEEPSEEK_API_KEY=          # platform.deepseek.com

# Upstash Redis (job storage + dedup)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

## Scripts

```bash
npm run dev      # start Next.js dev server
npm run build    # production build
npm run start    # start production server
npm run lint     # run ESLint
```
