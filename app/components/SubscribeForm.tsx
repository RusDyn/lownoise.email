"use client";

import { useState } from "react";

export default function SubscribeForm() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [consented, setConsented] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;

    try {
      const res = await fetch("/api/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "request failed");
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
        <strong>check your inbox.</strong> confirmation email sent to {submittedEmail}.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
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

      <div className="consent-row">
        <input
          id="consent"
          type="checkbox"
          required
          checked={consented}
          onChange={(e) => setConsented(e.target.checked)}
        />
        <label htmlFor="consent">
          I agree to the{" "}
          <a href="/privacy" target="_blank" rel="noopener noreferrer">
            Privacy Policy
          </a>{" "}
          and{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer">
            Terms of Service
          </a>
          . I consent to receive daily job digest emails and understand I can
          unsubscribe at any time.
        </label>
      </div>

      <div className="submit">
        <button type="submit" disabled={submitting || !consented}>
          {submitting ? "sending…" : "→ get daily jobs"}
        </button>
        <span className="micro">
          free · daily at 8 AM PT / 4 PM UTC / 7 PM Kyiv · one-click unsubscribe
        </span>
      </div>
      {error && <p className="error-msg">{error}</p>}
    </form>
  );
}
