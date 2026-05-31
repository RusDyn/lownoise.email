import { redirect } from "next/navigation";
import Link from "next/link";
import { validateAndConsumePendingToken, createManageToken } from "@/lib/auth";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Confirm Email — lownoise.email",
};

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return <ErrorPage message="Invalid confirmation link." />;
  }

  const email = await validateAndConsumePendingToken(token);

  if (!email) {
    return (
      <ErrorPage message="This link has expired or already been used.">
        <Link href="/">← request a new one</Link>
      </ErrorPage>
    );
  }

  const manageToken = await createManageToken(email);
  redirect(`/manage?token=${encodeURIComponent(manageToken)}&new=1`);
}

function ErrorPage({
  message,
  children,
}: {
  message: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="wrap">
      <div className="topbar">
        <div className="brand">
          lownoise<span className="at">.</span>email
        </div>
      </div>
      <div className="form" style={{ marginTop: 32 }}>
        <p className="error-msg" style={{ margin: 0 }}>{message}</p>
        {children && <p style={{ marginTop: 12, fontSize: 13 }}>{children}</p>}
      </div>
    </main>
  );
}
