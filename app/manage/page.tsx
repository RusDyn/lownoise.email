import Link from "next/link";
import { verifyManageToken } from "@/lib/auth";
import { findContactByEmail } from "@/lib/contacts";
import { STACK_VALUES } from "@/lib/form-options";
import { normalizeDailySendHourUtc } from "@/lib/email/digest-send";
import ManageForm from "@/app/components/ManageForm";
import ManageLinkRequestForm from "@/app/components/ManageLinkRequestForm";
import type { InitialPrefs } from "@/app/components/ManageForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manage Subscription — lownoise.email",
};

async function fetchContactPrefs(email: string): Promise<InitialPrefs | null> {
  const contact = await findContactByEmail(email, { includeUnsubscribed: true });
  if (!contact) return null;

  const allKeywords = (contact.properties.keywords ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
  return {
    stack: allKeywords.filter((k) => STACK_VALUES.has(k)),
    keywords: allKeywords.filter((k) => !STACK_VALUES.has(k)),
    remote: contact.properties.remote ?? "remote",
    location: contact.properties.location ?? "",
    timezone: contact.properties.timezone ?? "",
    authCountries: (contact.properties.auth_countries ?? "")
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean),
    dailySendHourUtc: normalizeDailySendHourUtc(contact.properties.daily_send_hour_utc),
  };
}

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; new?: string }>;
}) {
  const { token, new: isNewParam } = await searchParams;

  if (!token) {
    return <RecoveryPage />;
  }

  const email = await verifyManageToken(token);
  if (!email) {
    return <RecoveryPage />;
  }

  const isNew = isNewParam === "1";
  const initialPrefs = isNew ? null : await fetchContactPrefs(email);

  return (
    <main className="wrap">
      <div className="topbar">
        <div className="brand">
          lownoise<span className="at">.</span>email
        </div>
      </div>

      <section style={{ marginTop: 32 }}>
        <div className="h">
          <span className="num">⚙</span>
          <span className="title">{isNew ? "set your preferences" : "manage subscription"}</span>
        </div>
        <p className="lede" style={{ marginBottom: 0 }}>
          Preferences for <strong>{email}</strong>.
          {!isNew && " Changes take effect on the next digest."}
        </p>
      </section>

      <div className="form" style={{ marginTop: 24 }}>
        <ManageForm token={token} isNew={isNew} initialPrefs={initialPrefs} />
      </div>

      <footer>
        <div className="left">
          <b>lownoise.email</b> · high-signal engineering jobs, low-effort search
        </div>
        <div className="right">
          <Link href="/">home</Link>
          <a href="/privacy">privacy</a>
          <a href="/terms">terms</a>
          <a href="mailto:hi@lownoise.email">contact</a>
        </div>
      </footer>
    </main>
  );
}

function RecoveryPage() {
  return (
    <main className="wrap">
      <div className="topbar">
        <div className="brand">
          lownoise<span className="at">.</span>email
        </div>
      </div>
      <div className="form" style={{ marginTop: 32 }}>
        <ManageLinkRequestForm />
      </div>
      <footer>
        <div className="left">
          <b>lownoise.email</b> · high-signal engineering jobs, low-effort search
        </div>
        <div className="right">
          <Link href="/">home</Link>
          <a href="/privacy">privacy</a>
          <a href="/terms">terms</a>
          <a href="mailto:hi@lownoise.email">contact</a>
        </div>
      </footer>
    </main>
  );
}
