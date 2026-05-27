import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — loweffort.email",
  description: "Terms governing use of the loweffort.email job digest service.",
};

export default function TermsOfService() {
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

        <h1>Terms of Service</h1>
        <p className="policy-meta">Last updated: 27 May 2026</p>

        <h2>The service</h2>
        <p>
          loweffort.email delivers a daily personalised engineering job digest to
          your inbox. By subscribing you agree to these terms. If you do not agree,
          do not subscribe.
        </p>

        <h2>Eligibility</h2>
        <p>
          You must be at least 16 years old to subscribe (the minimum age for
          consent to data processing under GDPR). By subscribing you confirm you
          meet this requirement.
        </p>

        <h2>What we provide</h2>
        <ul>
          <li>
            One email per day containing up to 10 engineering job listings matched
            to your profile
          </li>
          <li>
            Listings sourced from public ATS endpoints and company careers pages
          </li>
          <li>Direct links to the original job posting on the employer&apos;s site</li>
        </ul>
        <p>
          We do not guarantee the accuracy, completeness, or availability of any
          listing. Job postings are indexed from public sources and may be
          outdated, closed, or inaccurate by the time you receive them.
        </p>

        <h2>What we do not provide</h2>
        <ul>
          <li>Recruitment or job placement services</li>
          <li>Any relationship with the employers listed</li>
          <li>Guarantees of employment or interview outcomes</li>
          <li>A real-time or exhaustive list of all available roles</li>
        </ul>

        <h2>Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Submit false, misleading, or third-party email addresses</li>
          <li>
            Attempt to abuse, scrape, or reverse-engineer the service or its emails
          </li>
          <li>Use the service for any unlawful purpose</li>
        </ul>

        <h2>Intellectual property</h2>
        <p>
          The selection, curation, and scoring of job listings is our original
          work. The underlying job descriptions belong to their respective
          employers. We claim no ownership over third-party content.
        </p>

        <h2>Unsubscribe and account deletion</h2>
        <p>
          You can unsubscribe at any time via the one-click link in any email or
          by emailing <a href="mailto:hi@loweffort.email">hi@loweffort.email</a>.
          After unsubscribing, we will stop sending emails and delete your contact
          data within 30 days per our{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </p>

        <h2>Service availability</h2>
        <p>
          We aim to deliver the digest every day at 8 AM PT. We do not guarantee
          uninterrupted delivery and are not liable for missed or delayed emails
          caused by technical failures, spam filters, or circumstances outside our
          control.
        </p>

        <h2>Disclaimer of warranties</h2>
        <p>
          The service is provided &ldquo;as is&rdquo; without warranties of any
          kind, express or implied. We make no warranty that the service will meet
          your requirements or be error-free.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, loweffort.email is not liable
          for any indirect, incidental, or consequential damages arising from your
          use of or inability to use the service, including but not limited to
          missed job opportunities.
        </p>

        <h2>Changes to these terms</h2>
        <p>
          We may update these terms from time to time. Material changes will be
          communicated to active subscribers by email at least 14 days before they
          take effect. Continued use of the service after that date constitutes
          acceptance of the revised terms.
        </p>

        <h2>Governing law</h2>
        <p>
          These terms are governed by the laws of the jurisdiction in which
          loweffort.email operates, without regard to conflict of law principles.
          GDPR rights are unaffected.
        </p>

        <h2>Contact</h2>
        <p>
          Questions:{" "}
          <a href="mailto:hi@loweffort.email">hi@loweffort.email</a>
        </p>
      </div>
    </main>
  );
}
