# lownoise.email

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![GitHub stars](https://img.shields.io/github/stars/RusDyn/lownoise.email?style=social)](https://github.com/RusDyn/lownoise.email)

Daily personalized engineering job digest. Scrapes ~6,000 fresh remote engineering roles every 24h from **Ashby** (via Serper Google search) and **LinkedIn** (via Apify), enriches each posting with Firecrawl + DeepSeek, matches it against your stack and preferences, and delivers up to 10 top matches to your inbox once a day — no dashboard, no Easy Apply noise.

→ **[lownoise.email](https://lownoise.email)** · [GitHub](https://github.com/RusDyn/lownoise.email)

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

## Matchmaking

Each subscriber's digest is built by a two-phase algorithm: **filter** (hard binary decisions) then **score** (0–100 ranking). Every score is deterministic and honest — suitable for public display.

### Phase 1 — Filter

Five hard gates remove definite non-matches. A job that fails any filter is discarded before scoring.

| # | Filter | Rule |
|---|--------|------|
| 1 | **Banned** | Domain or company is on the ban list (known scam/spam domains). |
| 2 | **Visa** | Job requires a US work visa and the subscriber doesn't have one. |
| 3 | **Remote** | Subscriber requires remote but the job isn't remote-friendly; or subscriber is hybrid/onsite and the job is the opposite mode. |
| 4 | **Location** | Job's location restrictions don't overlap with the subscriber's authorized work countries. |
| 5 | **Relevance** | Subscriber has keywords but none appear in the job title or skills (body-only matches are too noisy to qualify). |

### Phase 2 — Score

Surviving jobs are scored 0–100 from seven components. Keyword-dependent components (skills, title, body) are penalized by a **coverage ratio**: if a subscriber lists 10 keywords and only 1 matches, those components get 10% of their value. This prevents jobs that barely overlap with your stack from crowding out better matches.

| Component | Max | Description |
|-----------|-----|-------------|
| **GeoScope** | 20 | Global jobs get full credit; region-restricted jobs only score if the subscriber is authorized there. Uses a country→geoScope map (US, EU, UK, APAC, Other) — no false positives from substring matching. |
| **Skill match** | 25 | Tiered diminishing returns: 1 match = 10, 2 = 18, 3 = 23, 4+ = 25. Matched against the subscriber's keyword list. |
| **Title match** | 20 | Any subscriber keyword appears as a whole word in the job title (word-boundary matching). |
| **Body match** | 10 | Any subscriber keyword appears in the job description body. |
| **Salary** | 10 | Job lists a salary (any amount). Transparency signal. |
| **Timezone** | 15 | How well the subscriber's timezone overlaps the job's geoScope typical hours. ≤3h offset = 10, ≤6h = 5, farther = 0. No timezone data → neutral 5. |
| **Tiebreaker** | ~0.001 | Deterministic — derived from MD5(job URL). Same input always produces the same ranking. |

**20 + 25 + 20 + 10 + 10 + 15 = 100**

Jobs are sorted descending by score and the top 10 are delivered.

### Example

A subscriber with keywords `[backend, go, rust, kubernetes]` (remote, no location restrictions):

| Job | Filter | Score | Why |
|-----|--------|-------|-----|
| Senior DevOps Engineer — Kubernetes | PASS | **35** | Only `kubernetes` matched → 25% coverage penalty on keyword components. Salary listed (+10). US geoScope but subscriber has no auth countries → neutral +10. |
| Senior Backend Engineer | PASS | **33** | `backend` in title → 25% coverage. Global geoScope (+20) but no salary listed. |
| Middle DevOps Engineer (Poland) | FILTERED | — | Relevance gate: subscriber has 4 keywords but none match title or skills of this DevOps posting. |

Scores are intentionally conservative. A 35/100 is a real match — the job is relevant and the subscriber should see it. But the score honestly reflects that 3 of 4 keywords didn't match, keeping the digest low-noise.

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
cp .env.example .env.local  # fill in the variables below
npm run dev
```

The app runs at `http://localhost:3000`. The Inngest dev server must be running separately to trigger background jobs — see [Inngest local dev](https://www.inngest.com/docs/local-development).

## Environment variables

Create a `.env.local` file with the following:

```env
# Resend (email delivery)
RESEND_API_KEY=
RESEND_SEGMENT_ID=             # subscriber audience segment ID from Resend dashboard -> Segments
RESEND_DAILY_SEND_SEGMENT_ID=  # transient send segment for daily digest broadcasts
RESEND_HOURLY_SEND_SEGMENT_ID= # transient send segment for hourly premium broadcasts

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

# Email confirmation + manage links
MANAGE_HMAC_SECRET=        # 32+ random chars — signs manage URL tokens
```

## Scripts

```bash
npm run dev         # start Next.js dev server
npm run build       # production build
npm run start       # start production server
npm run lint        # run ESLint
npm run test:digest # send a one-shot test digest
```

## License

MIT — see [LICENSE](./LICENSE).

## Roadmap

- [ ] **Greenhouse, Lever, Workable** — expand beyond Ashby + LinkedIn to more ATS sources
- [ ] **Multi-engineer profile scoring** — deeper LLM-based match scoring against your specific stack
- [ ] **Daily volume scaling** — grow from current throughput toward ~12,000 fresh roles indexed per 24h
- [ ] **Self-serve preference management** — update keywords, location, and remote prefs without emailing us
