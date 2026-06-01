"use client";

import { useState } from "react";

export default function ManageLinkRequestForm() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    try {
      const res = await fetch("/api/send-manage-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          throw new Error("Too many requests, please try again later.");
        }
        let msg = "request failed";
        try { const data = await res.json(); msg = data.error ?? msg; } catch { /* not JSON */ }
        throw new Error(msg);
      }
      const data = await res.json();
      setSubmittedEmail(email);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="success-msg">
        <strong>check your inbox.</strong> If that email is subscribed, we sent a
        manage preferences link to {submittedEmail}.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="lede" style={{ marginBottom: 16 }}>
        Enter your email to receive a manage preferences link.
      </p>

      <div className="field">
        <label className="label" htmlFor="email">
          email address
        </label>
        <input
          id="email"
          type="email"
          name="email"
          required
          autoComplete="email"
          placeholder="you@yourdomain.dev"
        />
      </div>

      <div className="submit">
        <button type="submit" disabled={submitting}>
          {submitting ? "sending…" : "→ send manage link"}
        </button>
      </div>
      {error && <p className="error-msg">{error}</p>}
    </form>
  );
}
