"use client";

import { useState } from "react";

interface UnloggedSlot {
  slotId: string;
  recipeId: string;
  recipeSlug: string;
  recipeTitle: string;
  recipeEmoji: string;
  dayLabel: string;
  mealType: string;
}

interface Props {
  items: UnloggedSlot[];
}

export function FoodCookLogPanel({ items }: Props) {
  const [pending, setPending] = useState<UnloggedSlot[]>(items);
  const [activeRating, setActiveRating] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);

  if (pending.length === 0) return null;

  async function logCook(slot: UnloggedSlot) {
    const rating = activeRating[slot.slotId] ?? 4;
    setSubmitting(slot.slotId);
    try {
      const res = await fetch(`/api/food/recipes/${slot.recipeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ incrementCook: true, cookRating: rating }),
      });
      if (res.ok) {
        setPending((prev) => prev.filter((p) => p.slotId !== slot.slotId));
      }
    } finally {
      setSubmitting(null);
    }
  }

  function dismiss(slotId: string) {
    setPending((prev) => prev.filter((p) => p.slotId !== slotId));
  }

  return (
    <section style={{ margin: "16px 16px 0" }}>
      <div
        className="food-card"
        style={{
          background: "white",
          border: "1px solid var(--food-border)",
          borderRadius: 18,
          padding: "14px 14px 4px",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-fredoka), system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 15,
            color: "var(--food-text)",
            marginBottom: 4,
          }}
        >
          📝 Did you cook these?
        </div>
        <div
          style={{
            fontFamily: "var(--font-sora), sans-serif",
            fontSize: 12,
            color: "var(--food-text-secondary)",
            marginBottom: 12,
          }}
        >
          A quick rating helps us pick better meals for you next week.
        </div>

        {pending.map((slot) => {
          const rating = activeRating[slot.slotId] ?? 0;
          const isSubmitting = submitting === slot.slotId;
          return (
            <div
              key={slot.slotId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 0",
                borderTop: "1px solid var(--food-border)",
                flexWrap: "wrap",
              }}
            >
              <div style={{ fontSize: 22 }} aria-hidden="true">
                {slot.recipeEmoji}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div
                  style={{
                    fontFamily: "var(--font-sora), sans-serif",
                    fontSize: 11,
                    color: "var(--food-text-secondary)",
                  }}
                >
                  {slot.dayLabel} · {slot.mealType}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-fredoka), system-ui, sans-serif",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--food-text)",
                  }}
                >
                  {slot.recipeTitle}
                </div>
              </div>
              <div style={{ display: "flex", gap: 2 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() =>
                      setActiveRating((m) => ({ ...m, [slot.slotId]: star }))
                    }
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: 18,
                      lineHeight: 1,
                      color: star <= rating ? "#fbbf24" : "#e5e7eb",
                    }}
                    aria-label={`${star} star${star === 1 ? "" : "s"}`}
                  >
                    ★
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => logCook(slot)}
                  disabled={isSubmitting || rating === 0}
                  className="food-btn food-btn-primary"
                  style={{
                    padding: "6px 12px",
                    fontSize: 12,
                    opacity: isSubmitting || rating === 0 ? 0.5 : 1,
                    cursor:
                      isSubmitting || rating === 0 ? "not-allowed" : "pointer",
                  }}
                >
                  {isSubmitting ? "…" : "Log"}
                </button>
                <button
                  type="button"
                  onClick={() => dismiss(slot.slotId)}
                  className="food-btn food-btn-secondary"
                  style={{ padding: "6px 10px", fontSize: 12 }}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
