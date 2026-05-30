"use client";

import { useState, useRef, forwardRef, useImperativeHandle, KeyboardEvent } from "react";

interface TagInputHandle {
  getValueWithPending(): string[];
}

const STACK_OPTIONS = [
  { value: "backend", label: "backend" },
  { value: "ai-ml", label: "ai / ml" },
  { value: "platform", label: "platform" },
  { value: "devops", label: "devops · sre" },
  { value: "frontend", label: "frontend" },
  { value: "fullstack", label: "fullstack" },
];

const KEYWORD_SUGGESTIONS = ["Python", "TypeScript", "PostgreSQL", "PyTorch", "Terraform", "React"];
const AUTH_SUGGESTIONS = ["UK", "CA", "EU", "IN", "UA"];

const TagInput = forwardRef<TagInputHandle, {
  tags: string[];
  onAdd: (v: string) => void;
  onRemove: (v: string) => void;
  placeholder: string;
  suggestions: string[];
  maxTags?: number;
}>(function TagInput({ tags, onAdd, onRemove, placeholder, suggestions, maxTags = 12 }, ref) {
  const inputRef = useRef<HTMLInputElement>(null);

  function commit(raw: string) {
    const val = raw.replace(/,+$/, "").trim();
    if (!val) return;
    if (tags.length >= maxTags) return;
    if (tags.some((t) => t.toLowerCase() === val.toLowerCase())) return;
    onAdd(val);
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    const input = inputRef.current!;
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(input.value);
      input.value = "";
    } else if (e.key === "Backspace" && !input.value && tags.length) {
      onRemove(tags[tags.length - 1]);
    }
  }

  function handleBlur() {
    const input = inputRef.current!;
    if (input.value.trim()) {
      commit(input.value);
      input.value = "";
    }
  }

  useImperativeHandle(ref, () => ({
    getValueWithPending() {
      const val = (inputRef.current?.value ?? "").replace(/,+$/, "").trim();
      if (val && tags.length < maxTags && !tags.some((t) => t.toLowerCase() === val.toLowerCase())) {
        return [...tags, val];
      }
      return tags;
    },
  }));

  const unusedSuggestions = suggestions.filter(
    (s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase())
  );

  return (
    <>
      <div className="taginput" onClick={() => inputRef.current?.focus()}>
        {tags.map((t) => (
          <span key={t} className="tag-pill" data-v={t}>
            {t}
            <button type="button" aria-label="remove" onClick={() => onRemove(t)}>
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="taginput-inner"
          type="text"
          placeholder={tags.length === 0 ? placeholder : ""}
          onKeyDown={handleKey}
          onBlur={handleBlur}
        />
      </div>
      {unusedSuggestions.length > 0 && (
        <div className="suggest">
          {unusedSuggestions.map((s) => (
            <span key={s} className="sg" onClick={() => onAdd(s)}>
              {s}
            </span>
          ))}
        </div>
      )}
    </>
  );
});

export default function SubscribeForm() {
  const keywordsRef = useRef<TagInputHandle>(null);
  const authRef = useRef<TagInputHandle>(null);

  const [stack, setStack] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [remote, setRemote] = useState("remote");
  const [authCountries, setAuthCountries] = useState<string[]>([]);
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleStack(value: string) {
    setStack((prev) =>
      prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value]
    );
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const location = (form.elements.namedItem("location") as HTMLInputElement).value;
    const finalKeywords = keywordsRef.current?.getValueWithPending() ?? keywords;
    const finalAuthCountries = authRef.current?.getValueWithPending() ?? authCountries;

    if (finalAuthCountries.length === 0) {
      setError("add at least one country you're authorized to work in");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, stack, keywords: finalKeywords, remote, location, authCountries: finalAuthCountries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "subscription failed");
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
        <strong>queued.</strong> your first email lands tomorrow at 8 AM PT / 4 PM UTC / 7 PM Kyiv.
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

      <div className="field">
        <span className="label">stack — pick any</span>
        <div className="chips" role="group">
          {STACK_OPTIONS.map((opt) => (
            <label key={opt.value} className="chip">
              <input
                type="checkbox"
                name="stack"
                value={opt.value}
                checked={stack.includes(opt.value)}
                onChange={() => toggleStack(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
        <div style={{ marginTop: 10 }}>
          <TagInput
            ref={keywordsRef}
            tags={keywords}
            onAdd={(v) => setKeywords((p) => [...p, v])}
            onRemove={(v) => setKeywords((p) => p.filter((k) => k !== v))}
            placeholder="add keyword — e.g. postgres, llm, k8s…"
            suggestions={KEYWORD_SUGGESTIONS}
            maxTags={12}
          />
        </div>
        <div className="helper">Enter or comma to add. Up to 12 keywords.</div>
      </div>

      <div className="field">
        <span className="label">remote preference</span>
        <div className="chips" role="radiogroup">
          {[
            { value: "remote", label: "remote only" },
            { value: "hybrid", label: "hybrid ok" },
            { value: "onsite", label: "onsite ok" },
          ].map((opt) => (
            <label key={opt.value} className="chip">
              <input
                type="radio"
                name="remote"
                value={opt.value}
                checked={remote === opt.value}
                onChange={() => setRemote(opt.value)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="label" htmlFor="location">
          current location
        </label>
        <input
          id="location"
          type="text"
          name="location"
          list="loc-list"
          placeholder="country — e.g. Portugal"
          autoComplete="country-name"
        />
        <div className="helper">
          Used to match hybrid &amp; onsite roles in your country, and country-locked
          &ldquo;remote&rdquo; listings.
        </div>
      </div>

      <div className="field">
        <span className="label">authorized to work in</span>
        <TagInput
          ref={authRef}
          tags={authCountries}
          onAdd={(v) => setAuthCountries((p) => [...p, v])}
          onRemove={(v) => setAuthCountries((p) => p.filter((c) => c !== v))}
          placeholder="add ISO code — US, DE, PT…"
          suggestions={AUTH_SUGGESTIONS}
        />
        <div className="helper">We hide roles whose visa policy doesn&apos;t match.</div>
      </div>

      <datalist id="loc-list">
        {[
          "Portugal","Germany","Netherlands","United Kingdom","France","Spain",
          "Italy","Poland","Ukraine","Ireland","Sweden","Switzerland",
          "United States","Canada","Mexico","Brazil","Argentina","India",
          "Singapore","Australia","Japan",
        ].map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

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
          {submitting ? "subscribing…" : "get daily jobs"}
        </button>
        <span className="micro">
          free · daily at 8 AM PT / 4 PM UTC / 7 PM Kyiv · one-click unsubscribe
        </span>
      </div>
      {error && <p className="error-msg">{error}</p>}
    </form>
  );
}
