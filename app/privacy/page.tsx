import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — loweffort.email",
  description: "How loweffort.email collects, uses, and protects your personal data.",
};

export default function PrivacyPolicy() {
  return (
    <main className="wrap">
      <div className="topbar">
        <div className="brand">
          loweffort<span className="at">.</span>email
        </div>
      </div>

      <div className="policy">
        <Link href="/" className="back">
          back to home
        </Link>

        <h1>Privacy Policy</h1>
        <p className="policy-meta">Last updated: 27 May 2026</p>

        <h2>Who we are</h2>
        <p>
          loweffort.email is a personalised engineering job digest service operated
          at <strong>loweffort.email</strong>. You can reach us at{" "}
          <a href="mailto:hi@loweffort.email">hi@loweffort.email</a>.
        </p>
        <p>
          We are the data controller for personal data you provide when subscribing.
        </p>

        <h2>What data we collect</h2>
        <p>When you subscribe, we collect:</p>
        <ul>
          <li>
            <strong>Email address</strong> — required to send you the digest
          </li>
          <li>
            <strong>Stack preferences</strong> (e.g. backend, AI/ML) — to filter
            relevant roles
          </li>
          <li>
            <strong>Technology keywords</strong> (e.g. Go, Rust, Kubernetes) — to
            score role matches
          </li>
          <li>
            <strong>Remote preference</strong> (remote / hybrid / onsite) — to
            exclude mismatched roles
          </li>
          <li>
            <strong>Current location</strong> (country) — to match hybrid and
            onsite roles
          </li>
          <li>
            <strong>Work authorisation countries</strong> — to filter visa-restricted
            listings
          </li>
        </ul>
        <p>
          We do not collect payment information, CVs, or any other personal data
          beyond the above.
        </p>

        <h2>Legal basis for processing</h2>
        <p>
          We process your data on the basis of your <strong>consent</strong> (GDPR
          Art. 6(1)(a)), given when you tick the consent checkbox and submit the
          subscription form. You may withdraw consent at any time by unsubscribing.
        </p>

        <h2>How we use your data</h2>
        <ul>
          <li>Sending you one personalised job digest email per day</li>
          <li>Matching and scoring engineering roles against your profile</li>
          <li>Filtering out roles that do not match your preferences</li>
        </ul>
        <p>
          We do not use your data for advertising, profiling beyond job matching,
          or any automated decision-making with legal effects.
        </p>

        <h2>How long we keep your data</h2>
        <p>
          We retain your data for as long as you are subscribed. When you
          unsubscribe (via the one-click link in any email or by emailing us), we
          delete your contact record and stop all processing within 30 days.
        </p>

        <h2>Third-party processors</h2>
        <p>
          We use <strong>Resend</strong> (resend.com) to store subscriber contacts
          and deliver emails. Resend acts as our data processor under a Data
          Processing Agreement. Your email and preferences are stored on Resend
          infrastructure. See{" "}
          <a
            href="https://resend.com/legal/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Resend&apos;s Privacy Policy
          </a>{" "}
          for details.
        </p>
        <p>
          We do not share your data with any other third parties, advertisers, or
          recruiters.
        </p>

        <h2>Cookies and tracking</h2>
        <p>
          loweffort.email does not use tracking cookies, analytics, or advertising
          pixels. Fonts are self-hosted and no requests are made to Google or other
          third-party CDNs when you visit the site. We do not use any cookies
          beyond those strictly necessary for the site to function (none are set at
          this time).
        </p>

        <h2>Your rights under GDPR</h2>
        <p>
          If you are located in the European Economic Area, United Kingdom, or
          Switzerland, you have the following rights:
        </p>
        <ul>
          <li>
            <strong>Access</strong> — request a copy of the personal data we hold
            about you
          </li>
          <li>
            <strong>Rectification</strong> — ask us to correct inaccurate data
          </li>
          <li>
            <strong>Erasure</strong> — ask us to delete your data (&ldquo;right to
            be forgotten&rdquo;)
          </li>
          <li>
            <strong>Portability</strong> — receive your data in a structured,
            machine-readable format
          </li>
          <li>
            <strong>Restriction</strong> — ask us to limit how we process your data
          </li>
          <li>
            <strong>Objection</strong> — object to processing based on legitimate
            interests
          </li>
          <li>
            <strong>Withdraw consent</strong> — unsubscribe at any time via the
            link in any email or by contacting us
          </li>
        </ul>
        <p>
          To exercise any of these rights, email{" "}
          <a href="mailto:hi@loweffort.email">hi@loweffort.email</a>. We will
          respond within 30 days.
        </p>
        <p>
          You also have the right to lodge a complaint with your national data
          protection authority (e.g. the ICO in the UK, the CNIL in France, the
          DPC in Ireland, or the UODO in Poland).
        </p>

        <h2>Data transfers</h2>
        <p>
          Resend processes data in the United States. Transfers outside the EEA
          are covered by Standard Contractual Clauses under GDPR Art. 46(2)(c).
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If we make material changes, we will notify active subscribers by email
          at least 14 days before the changes take effect. The &ldquo;last
          updated&rdquo; date at the top of this page will always reflect the
          current version.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about this policy:{" "}
          <a href="mailto:hi@loweffort.email">hi@loweffort.email</a>
        </p>
      </div>
    </main>
  );
}
