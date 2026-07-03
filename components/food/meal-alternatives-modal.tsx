"use client";

import { useEffect, useState } from "react";

interface Alternative {
  id: string;
  title: string;
  slug: string;
  imageUrl?: string | null;
  cuisine?: string | null;
  prepTime?: number | null;
  cookTime?: number | null;
  rating?: number | null;
  reason: string;
}

interface Props {
  slotId: string;
  slotLabel: string;
  excludeIds: string[];
  onClose: () => void;
  onChosen: (recipeId: string) => Promise<void> | void;
}

export function MealAlternativesModal({ slotId, slotLabel, excludeIds, onClose, onChosen }: Props) {
  const [loading, setLoading] = useState(true);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [choosing, setChoosing] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchAlts() {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ count: "3" });
        if (excludeIds.length > 0) qs.set("exclude", excludeIds.join(","));
        const res = await fetch(`/api/food/plan/slots/${slotId}/alternatives?${qs.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error || "Could not load options");
          setAlternatives([]);
          return;
        }
        setAlternatives(data.alternatives || []);
        if ((data.alternatives || []).length === 0) {
          setError("No more options — try adding more recipes for your preferred cuisines.");
        }
      } catch {
        if (!cancelled) setError("Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchAlts();
    return () => {
      cancelled = true;
    };
  }, [slotId, excludeIds]);

  async function handleChoose(id: string) {
    setChoosing(id);
    try {
      await onChosen(id);
    } finally {
      setChoosing(null);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 120,
        padding: "1rem",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="food-card" style={{ maxWidth: 560, width: "100%", padding: "1.5rem", maxHeight: "85vh", overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 700, color: "var(--food-text)" }}>
            Swap {slotLabel}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: "var(--food-text-secondary)" }}
          >
            &times;
          </button>
        </div>
        <p style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginBottom: "1rem" }}>
          Pick from three fresh options. None of these have been shown to you for this slot.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: "2rem" }}>✨</div>
            <p style={{ color: "var(--food-text-secondary)", marginTop: "0.5rem", fontSize: "0.875rem" }}>
              Finding fresh options...
            </p>
          </div>
        ) : error ? (
          <div
            style={{
              padding: "0.875rem 1rem",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.24)",
              borderRadius: "0.75rem",
              color: "#b91c1c",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
            {alternatives.map((alt) => (
              <button
                key={alt.id}
                type="button"
                onClick={() => handleChoose(alt.id)}
                disabled={choosing !== null}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.75rem",
                  borderRadius: "0.75rem",
                  border: "1px solid var(--food-border)",
                  background: choosing === alt.id ? "rgba(244,114,182,0.1)" : "white",
                  cursor: choosing ? "wait" : "pointer",
                  textAlign: "left",
                  width: "100%",
                  fontFamily: "inherit",
                  transition: "background 0.15s",
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: "0.5rem",
                    flexShrink: 0,
                    background: alt.imageUrl
                      ? `url(${alt.imageUrl}) center/cover`
                      : "linear-gradient(135deg, #fce4ec, #f3e5f5)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "1.5rem",
                  }}
                >
                  {!alt.imageUrl && "🍽️"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: "var(--food-text)", fontSize: "0.9375rem", marginBottom: "0.125rem" }}>
                    {alt.title}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "var(--food-text-secondary)" }}>
                    {alt.reason}
                  </div>
                </div>
                <span
                  className="food-btn food-btn-primary"
                  style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem", pointerEvents: "none", flexShrink: 0 }}
                >
                  {choosing === alt.id ? "Picking..." : "Pick"}
                </span>
              </button>
            ))}
          </div>
        )}

        <div style={{ marginTop: "1rem", textAlign: "right" }}>
          <button className="food-btn food-btn-secondary" onClick={onClose}>
            Keep current
          </button>
        </div>
      </div>
    </div>
  );
}
