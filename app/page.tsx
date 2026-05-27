import SubscribeForm from "./components/SubscribeForm";

export default function Home() {
  return (
    <main className="wrap">
      {/* ── top bar ── */}
      <div className="topbar">
        <div className="brand">
          loweffort<span className="at">.</span>email
        </div>
        <div className="status">
          <span className="dot" />
          <span>scanning · 142 sources · live</span>
        </div>
      </div>

      {/* ── hero terminal ── */}
      <div className="term" role="banner">
        <div className="term-chrome">
          <div className="lights">
            <span />
            <span />
            <span />
          </div>
          <div className="path">~/loweffort.email — bash</div>
        </div>
        <div className="term-body">
          <div className="prompt">
            <span className="cmd">whoami</span>
          </div>
          <h1>
            fresh eng jobs <span className="slash">/</span> zero easy-apply
            noise
            <span className="cursor" />
          </h1>
          <p className="tagline">
            One email a day, personalized for you. From ~12,000 fresh
            engineering roles we score every posting against your stack and ship
            the <em>top 10 matches</em> straight to your inbox.
          </p>
        </div>
      </div>

      {/* ── §01 how it works ── */}
      <section>
        <div className="h">
          <span className="num">01</span>
          <span className="title">how it works</span>
        </div>
        <p className="lede">
          We crawl <em>Ashby</em>, <em>Greenhouse</em>, <em>Lever</em>,{" "}
          <em>LinkedIn</em>, and external company pages every few minutes. Then
          — the part nobody else does — we{" "}
          <em>score every role against your profile</em> and only send the
          highest matches.
        </p>
        <div className="ats" aria-label="sources">
          <span>ashby</span>
          <span>greenhouse</span>
          <span>lever</span>
          <span>linkedin</span>
          <span>workable</span>
          <span>rippling</span>
          <span>recruitee</span>
          <span>teamtailor</span>
          <span className="more">+ 130 more</span>
        </div>
        <div className="pipe" aria-label="how roles get to your inbox">
          <div className="step">
            <div className="lbl">01 · scan</div>
            <div className="n">~12,000</div>
            <div className="desc">fresh engineering roles indexed every 24h</div>
          </div>
          <div className="step">
            <div className="lbl">02 · filter</div>
            <div className="n">~1,800</div>
            <div className="desc">
              remove Easy Apply, scam aggregators, ghosts
            </div>
          </div>
          <div className="step">
            <div className="lbl">03 · score</div>
            <div className="n">per you</div>
            <div className="desc">
              match each role to your stack, region &amp; remote pref
            </div>
          </div>
          <div className="step">
            <div className="lbl">04 · send</div>
            <div className="n">up to 10</div>
            <div className="desc">only your top matches — nothing more</div>
          </div>
        </div>
      </section>

      {/* ── §02 compare ── */}
      <section>
        <div className="h">
          <span className="num">02</span>
          <span className="title">what you get vs. what you don&apos;t</span>
        </div>
        <div className="compare">
          <div className="bad">
            <h3>
              <span className="mark">✗</span> everywhere else
            </h3>
            <ul>
              <li>Easy Apply spam</li>
              <li>Scam AI &ldquo;job aggregator&rdquo; sites</li>
              <li>Ghost jobs from 2024</li>
              <li>&ldquo;Remote&rdquo; that means one city</li>
              <li>Endless dashboard scrolling</li>
            </ul>
          </div>
          <div className="good">
            <h3>
              <span className="mark">✓</span> loweffort.email
            </h3>
            <ul>
              <li>Remote-first eng roles</li>
              <li>Posted within hours</li>
              <li>Remote filters that actually work</li>
              <li>Direct company / ATS links</li>
              <li>Fewer, better matches</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ── §03 sample email ── */}
      <section>
        <div className="h">
          <span className="num">03</span>
          <span className="title">a typical morning email</span>
        </div>
        <div className="email" aria-label="sample email">
          <div className="email-head">
            <span>From</span>
            <b>jobs@loweffort.email</b>
            <span>Subj</span>
            <b>8 top matches for you · backend · remote (EU)</b>
            <span>Date</span>
            <b>Tue, 08:00 PT · 16:00 UTC</b>
          </div>
          <div className="email-body">
            <div className="job">
              <div>
                <div className="role">Senior Backend Engineer (Go)</div>
                <div className="co">Plain — fully remote, EU</div>
              </div>
              <div className="meta">
                <span className="tag">2h ago</span>
                <a className="apply" href="#">
                  apply
                </a>
              </div>
            </div>
            <div className="job">
              <div>
                <div className="role">Staff Platform Engineer</div>
                <div className="co">Cubist — remote, EMEA</div>
              </div>
              <div className="meta">
                <span className="tag">3h ago</span>
                <a className="apply" href="#">
                  apply
                </a>
              </div>
            </div>
            <div className="job">
              <div>
                <div className="role">ML Infrastructure Engineer</div>
                <div className="co">Sundial — remote-first</div>
              </div>
              <div className="meta">
                <span className="tag">4h ago</span>
                <a className="apply" href="#">
                  apply
                </a>
              </div>
            </div>
            <div className="job">
              <div>
                <div className="role">SRE, Observability</div>
                <div className="co">Linear ops — remote, ±3 CET</div>
              </div>
              <div className="meta">
                <span className="tag">5h ago</span>
                <a className="apply" href="#">
                  apply
                </a>
              </div>
            </div>
            <div className="job">
              <div>
                <div className="role">Senior Data Engineer</div>
                <div className="co">Northwind — remote, worldwide</div>
              </div>
              <div className="meta">
                <span className="tag">6h ago</span>
                <a className="apply" href="#">
                  apply
                </a>
              </div>
            </div>
            <div className="ellipsis">+ 3 more · scroll = none, just click</div>
          </div>
        </div>
        <p className="hr-comment">
          Up to 10 personalized matches per email. No tracking pixels.
          Unsubscribe in one click.
        </p>
      </section>

      {/* ── §04 built for ── */}
      <section>
        <div className="h">
          <span className="num">04</span>
          <span className="title">built for</span>
        </div>
        <ul className="grid2">
          <li>Backend engineers</li>
          <li>AI / ML engineers</li>
          <li>Platform engineers</li>
          <li>DevOps &amp; SRE</li>
          <li>Senior+ software engineers</li>
          <li>Staff / Principal IC roles</li>
        </ul>
      </section>

      {/* ── §05 subscribe ── */}
      <section id="subscribe">
        <div className="h">
          <span className="num">05</span>
          <span className="title">subscribe</span>
        </div>
        <SubscribeForm />
      </section>

      {/* ── §06 faq ── */}
      <section>
        <div className="h">
          <span className="num">06</span>
          <span className="title">faq</span>
        </div>
        <details>
          <summary>When does the email arrive?</summary>
          <div className="a">
            Once per day at <b>8 AM PT</b> — that&apos;s <b>4 PM UTC</b> /{" "}
            <b>7 PM Kyiv (UTC+3)</b> / <b>5 PM London</b> / <b>9 PM IST</b>.
            Roles in each digest were posted within the previous 24 hours, most
            within the last few.
          </div>
        </details>
        <details>
          <summary>How fresh is &ldquo;fresh&rdquo;?</summary>
          <div className="a">
            Most roles in your email were posted in the last 24 hours; many
            within the last 6. We re-scan high-signal ATS endpoints every few
            minutes so listings hit your inbox before the application count
            spirals.
          </div>
        </details>
        <details>
          <summary>Why no dashboard?</summary>
          <div className="a">
            Dashboards are a treadmill. The whole point is that you read one
            short email, click 0–3 links, close the tab, and go back to your
            day.
          </div>
        </details>
        <details>
          <summary>Is this scraping companies legally?</summary>
          <div className="a">
            We only pull from public ATS endpoints and public careers pages.
            Every listing links straight back to the company&apos;s own posting.
          </div>
        </details>
        <details>
          <summary>What does it cost?</summary>
          <div className="a">
            Free during beta. If we ever charge, it&apos;ll be a small flat
            monthly fee — never per-application, never recruiter-paid.
          </div>
        </details>
      </section>

      <footer>
        <div className="left">
          <b>loweffort.email</b> · high-signal engineering jobs, low-effort
          search
        </div>
        <div className="right">
          <a href="#subscribe">subscribe</a>
          <a href="/privacy">privacy</a>
          <a href="/terms">terms</a>
          <a href="mailto:hi@loweffort.email">contact</a>
        </div>
      </footer>
    </main>
  );
}
