"use client";

import { CUISINE_OPTIONS, MIN_CUISINES, MAX_CUISINES } from "@/lib/food/cuisines";

interface CuisinePickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  showHint?: boolean;
}

export function CuisinePicker({ value, onChange, showHint = true }: CuisinePickerProps) {
  const toggle = (slug: string) => {
    if (value.includes(slug)) {
      onChange(value.filter((s) => s !== slug));
    } else if (value.length < MAX_CUISINES) {
      onChange([...value, slug]);
    }
  };

  const valid = value.length >= MIN_CUISINES;

  return (
    <div>
      {showHint && (
        <p style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginBottom: "0.75rem" }}>
          Pick {MIN_CUISINES}–{MAX_CUISINES} favorites. We&apos;ll build your weekly plan around these and rotate for variety.
        </p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "0.75rem" }}>
        {CUISINE_OPTIONS.map((c) => {
          const active = value.includes(c.slug);
          const disabled = !active && value.length >= MAX_CUISINES;
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => toggle(c.slug)}
              disabled={disabled}
              style={{
                padding: "0.5rem 0.875rem",
                borderRadius: "999px",
                border: "1px solid rgba(244, 114, 182, 0.35)",
                background: active ? "var(--food-pink)" : "transparent",
                color: active ? "white" : disabled ? "var(--food-text-secondary)" : "var(--food-text)",
                fontSize: "0.875rem",
                cursor: disabled ? "not-allowed" : "pointer",
                opacity: disabled ? 0.5 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: "0.375rem",
                fontFamily: "inherit",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              <span>{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: "0.75rem", color: valid ? "var(--food-mint)" : "var(--food-text-secondary)", fontWeight: 500 }}>
        {value.length} selected {valid ? "✓" : `· need ${MIN_CUISINES - value.length} more`}
      </div>
    </div>
  );
}
