"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface SearchBoxProps {
  initial: string | null;
  placeholder?: string;
  /** Visible "Showing N of M" hint to the right of the input. */
  resultHint?: string;
}

export default function SearchBox({
  initial,
  placeholder = "Search items… (e.g. pendant lamp, vanity, baby)",
  resultHint,
}: SearchBoxProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState<string>(initial ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Resync from URL when navigation happens externally (Clear filters, back button).
  const [prevInitial, setPrevInitial] = useState<string | null>(initial);
  if (prevInitial !== initial) {
    setPrevInitial(initial);
    setValue(initial ?? "");
  }

  const pushQuery = useCallback(
    (next: string) => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = next.trim();
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams]
  );

  function onChange(next: string) {
    setValue(next);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushQuery(next), 250);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    pushQuery(value);
  }

  function onClear() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setValue("");
    pushQuery("");
  }

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className="mb-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 backdrop-blur-sm"
    >
      <span aria-hidden="true" className="text-base text-white/40">
        🔍
      </span>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search items"
        autoComplete="off"
        spellCheck={false}
        className="flex-1 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="rounded-full border border-white/15 px-2 py-0.5 text-[0.7rem] text-white/60 hover:border-white/30 hover:text-white"
        >
          Clear
        </button>
      )}
      {resultHint && (
        <span className="hidden shrink-0 text-[0.7rem] text-white/40 sm:inline">
          {resultHint}
        </span>
      )}
    </form>
  );
}
