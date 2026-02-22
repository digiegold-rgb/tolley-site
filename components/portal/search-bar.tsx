"use client";

import { FormEvent } from "react";

import { ModalityRail } from "@/components/portal/modality-icons";
import { PLACEHOLDER_PROMPTS } from "@/components/portal/placeholder-prompts";
import { RotatingPlaceholder } from "@/components/portal/rotating-placeholder";

type SearchBarProps = {
  value: string;
  onChange: (nextValue: string) => void;
  onSubmit: (query: string) => void;
  locked?: boolean;
};

export function SearchBar({
  value,
  onChange,
  onSubmit,
  locked = false,
}: SearchBarProps) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(value.trim());
  };

  return (
    <form
      className={`search-wrapper w-full ${locked ? "" : "search-float"}`}
      onSubmit={handleSubmit}
    >
      <label className="sr-only" htmlFor="t-agent-search">
        Search prompt
      </label>
      <div className="glass-search relative flex w-full items-center rounded-[30px] px-6 py-4 sm:rounded-[34px] sm:px-7 sm:py-[1.15rem]">
        <input
          id="t-agent-search"
          name="t-agent-search"
          type="text"
          className="search-input relative z-20 w-full bg-transparent pr-32 text-[15px] text-white/94 outline-none sm:pr-36 sm:text-base"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          disabled={locked}
          aria-label="T-Agent search"
        />
        <div
          aria-hidden="true"
          className={`pointer-events-none absolute inset-y-0 left-6 right-[8.5rem] z-10 flex items-center text-[15px] text-white/47 transition-opacity duration-300 sm:left-7 sm:right-[9.5rem] sm:text-base ${value ? "opacity-0" : "opacity-100"}`}
        >
          <RotatingPlaceholder hidden={Boolean(value)} prompts={PLACEHOLDER_PROMPTS} />
        </div>
        <div className="relative z-20 ml-4 shrink-0">
          <ModalityRail />
        </div>
      </div>
      <button type="submit" className="sr-only">
        Search
      </button>
    </form>
  );
}
