import { Resend } from "resend";
import Link from "next/link";
import { verifyManageToken } from "@/lib/auth";
import { STACK_VALUES } from "@/lib/form-options";
import ManageForm from "@/app/components/ManageForm";
import type { InitialPrefs } from "@/app/components/ManageForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manage Subscription — lownoise.email",
};

async function fetchContactPrefs(email: string): Promise<InitialPrefs | null> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const segmentId = process.env.RESEND_SEGMENT_ID;
  if (!segmentId) return null;

  let after: string | undefined;
  while (true) {
    const { data, error } = await resend.contacts.list({
      segmentId,
      limit: 100,
      ...(after ? { after } : {}),
    });
    if (error || !data) break;
    const contact = data.data.find((c) => c.email === email);
    if (contact) {
      const { data: detail } = await resend.contacts.get(contact.id);
      if (!detail) return null;
      const props = (detail.properties ?? {}) as unknown as Record<string, string>;
      const allKeywords = (props.keywords ?? "")
        .split(",")
        .map((k) => k.trim())
        .filter(Boolean);
      return {
        stack: allKeywords.filter((k) => STACK_VALUES.has(k)),
        keywords: allKeywords.filter((k) => !STACK_VALUES.has(k)),
        remote: props.remote ?? "remote",
        location: props.location ?? "",
        authCountries: (props.auth_countries ?? "")
          .split(",")
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean),
      };
    }
    if (!data.has_more) break;
    after = data.data.at(-1)?.id;
  }
  return null;
}

export default async function ManagePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; new?: string }>;
}) {
  const { token, new: isNewParam } = await searchParams;

  if (!token) {
    return <InvalidLink />;
  }

  const email = await verifyManageToken(token);
  if (!email) {
    return <InvalidLink />;
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

function InvalidLink() {
  return (
    <main className="wrap">
      <div className="topbar">
        <div className="brand">
          lownoise<span className="at">.</span>email
        </div>
      </div>
      <div className="form" style={{ marginTop: 32 }}>
        <p className="error-msg" style={{ margin: 0 }}>
          Invalid or expired manage link.
        </p>
        <p style={{ marginTop: 12, fontSize: 13 }}>
          <Link href="/">← back to home</Link>
        </p>
      </div>
    </main>
  );
}
