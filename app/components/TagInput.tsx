"use client";

import { useRef, forwardRef, useImperativeHandle } from "react";
import type { KeyboardEvent } from "react";

export interface TagInputHandle {
  getValueWithPending(): string[];
}

export const TagInput = forwardRef<
  TagInputHandle,
  {
    tags: string[];
    onAdd: (v: string) => void;
    onRemove: (v: string) => void;
    placeholder: string;
    suggestions: string[];
    maxTags?: number;
    inputListId?: string;
  }
>(function TagInput({ tags, onAdd, onRemove, placeholder, suggestions, maxTags = 12, inputListId }, ref) {
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
          list={inputListId}
        />
      </div>
      {unusedSuggestions.length > 0 && (
        <div className="suggest">
          {unusedSuggestions.map((s) => (
            <button key={s} type="button" className="sg" onClick={() => commit(s)} aria-label={`add ${s}`}>
              {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
});
