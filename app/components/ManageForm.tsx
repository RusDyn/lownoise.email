"use client";

import { useState, useRef } from "react";
import { TagInput } from "./TagInput";
import type { TagInputHandle } from "./TagInput";
import {
  STACK_OPTIONS,
  KEYWORD_SUGGESTIONS,
  AUTH_SUGGESTIONS,
  AUTH_COUNTRY_LIST,
} from "@/lib/form-options";

export interface InitialPrefs {
  stack: string[];
  keywords: string[];
  remote: string;
  location: string;
  timezone: string;
  authCountries: string[];
}

interface ManageFormProps {
  token: string;
  isNew: boolean;
  initialPrefs: InitialPrefs | null;
}

export default function ManageForm({ token, isNew, initialPrefs }: ManageFormProps) {
  const keywordsRef = useRef<TagInputHandle>(null);
  const authRef = useRef<TagInputHandle>(null);

  const [stack, setStack] = useState<string[]>(initialPrefs?.stack ?? []);
  const [keywords, setKeywords] = useState<string[]>(initialPrefs?.keywords ?? []);
  const [remote, setRemote] = useState(initialPrefs?.remote ?? "remote");
  const [authCountries, setAuthCountries] = useState<string[]>(initialPrefs?.authCountries ?? []);
  const [timezone, setTimezone] = useState(initialPrefs?.timezone ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
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
    const location = (form.elements.namedItem("location") as HTMLInputElement).value;
    const finalKeywords = keywordsRef.current?.getValueWithPending() ?? keywords;
    const finalAuthCountries = authRef.current?.getValueWithPending() ?? authCountries;

    if (finalAuthCountries.length === 0) {
      setError("add at least one country you're authorized to work in");
      setSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          stack,
          keywords: finalKeywords,
          remote,
          location,
          timezone,
          authCountries: finalAuthCountries,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed to save preferences");
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (saved) {
    return (
      <div className="success-msg">
        {isNew ? (
          <>
            <strong>queued.</strong> your first digest lands tomorrow at 8 AM PT / 4 PM UTC / 7 PM Kyiv.
          </>
        ) : (
          <>
            <strong>saved.</strong> preferences updated — takes effect on the next digest.
          </>
        )}
      </div>
    );
  }

  return (
    <>
      {isNew && (
        <div className="notice">
          <span className="notice-check">✓</span> email confirmed — now set your preferences below.
        </div>
      )}

      <form onSubmit={handleSubmit}>
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
            defaultValue={initialPrefs?.location ?? ""}
          />
          <div className="helper">
            Used to match hybrid &amp; onsite roles in your country, and country-locked
            &ldquo;remote&rdquo; listings.
          </div>
        </div>

        <div className="field">
          <label className="label" htmlFor="timezone">
            your timezone <span style={{ fontWeight: 400, opacity: 0.6 }}>(optional)</span>
          </label>
          <input
            id="timezone"
            type="text"
            name="timezone"
            list="tz-list"
            placeholder="e.g. GMT+1"
            autoComplete="off"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
          <datalist id="tz-list">
            {["UTC","GMT-8","GMT-7","GMT-6","GMT-5","GMT-4","GMT-3","GMT+1","GMT+2","GMT+3","GMT+4","GMT+5","GMT+5:30","GMT+6","GMT+7","GMT+8","GMT+9","GMT+10","GMT+12"].map((tz) => (
              <option key={tz} value={tz} />
            ))}
          </datalist>
          <div className="helper">Used to prioritize jobs whose region overlaps your working hours.</div>
        </div>

        <div className="field">
          <span className="label">authorized to work in</span>
          <TagInput
            ref={authRef}
            tags={authCountries}
            onAdd={(v) => setAuthCountries((p) => [...p, v])}
            onRemove={(v) => setAuthCountries((p) => p.filter((c) => c !== v))}
            placeholder="pick a country or type a code…"
            suggestions={AUTH_SUGGESTIONS}
            maxTags={30}
            inputListId="auth-country-list"
          />
          <datalist id="auth-country-list">
            {AUTH_COUNTRY_LIST.map(([code, name]) => (
              <option key={code} value={code}>{name}</option>
            ))}
          </datalist>
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

        <div className="submit">
          <button type="submit" disabled={submitting}>
            {submitting ? "saving…" : isNew ? "→ save preferences" : "→ update preferences"}
          </button>
        </div>
        {error && <p className="error-msg">{error}</p>}
      </form>
    </>
  );
}
