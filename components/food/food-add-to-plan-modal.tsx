"use client";

/**
 * FoodAddToPlanModal — the smart "Add to meal plan" flow.
 *
 * Mom-friendly UX:
 *   1. "Terrific! What day would you like to make this?"
 *   2. Day grid (this week + next week) — empty slots glow, conflicts dimmed
 *   3. Meal type picker (breakfast / lunch / dinner)
 *   4. If the slot already has another recipe → "Already planned: [name].
 *      Replace it, or pick a different day?"
 *   5. If this recipe was cooked in the last 14 days → "You made this N days
 *      ago — make it again, or pick a different recipe?"
 *   6. Confirm → POST /api/food/plan/slots → success state with confetti
 *
 * Uses existing endpoints — no schema or API changes needed.
 *   GET /api/food/recipes/[id]   (returns cookLogs[])
 *   GET /api/food/plan?weekStart=YYYY-MM-DD
 *   POST /api/food/plan          (creates the week if missing)
 *   POST /api/food/plan/slots    (upserts the slot)
 */

import { useEffect, useState, useCallback } from "react";

interface FoodAddToPlanModalProps {
  recipeId: string;
  recipeTitle: string;
  onClose: () => void;
}

interface SlotInfo {
  id: string;
  day: number;
  mealType: string;
  recipeId: string | null;
  recipe: { id: string; title: string; slug: string } | null;
}

interface PlanInfo {
  id: string;
  weekStart: string;
  slots: SlotInfo[];
}

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast", emoji: "🥐" },
  { value: "lunch", label: "Lunch", emoji: "🥪" },
  { value: "dinner", label: "Dinner", emoji: "🍽️" },
] as const;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMondayUTC(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = d.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function fmtDayLabel(weekStart: Date, dayIdx: number): string {
  const d = addDays(weekStart, dayIdx);
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" });
}

function daysAgo(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function FoodAddToPlanModal({
  recipeId,
  recipeTitle,
  onClose,
}: FoodAddToPlanModalProps) {
  // Week navigation
  const [weekOffset, setWeekOffset] = useState(0); // 0 = this week, 1 = next week
  const [thisWeekStart] = useState(() => getMondayUTC(new Date()));
  const currentWeekStart = addDays(thisWeekStart, weekOffset * 7);

  // Fetched state
  const [plan, setPlan] = useState<PlanInfo | null>(null);
  const [lastCookedDays, setLastCookedDays] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedMealType, setSelectedMealType] = useState<string>("dinner");
  const [conflict, setConflict] = useState<SlotInfo | null>(null);
  const [confirmedReplace, setConfirmedReplace] = useState(false);
  const [confirmedRecency, setConfirmedRecency] = useState(false);

  // Submission state
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // ── Load plan + recipe context ───────────────────────────────
  const loadContext = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConflict(null);
    setSelectedDay(null);
    setConfirmedReplace(false);
    try {
      const isoWeek = currentWeekStart.toISOString();
      const [planRes, recipeRes] = await Promise.all([
        fetch(`/api/food/plan?weekStart=${encodeURIComponent(isoWeek)}`),
        fetch(`/api/food/recipes/${recipeId}`),
      ]);

      let foundPlan: PlanInfo | null = null;
      if (planRes.ok) {
        const data = await planRes.json();
        foundPlan = data.plan ?? null;
      }

      // Recency check from cook logs (only need to compute once on first load)
      if (recipeRes.ok && lastCookedDays === null) {
        const recipe = await recipeRes.json();
        const logs = recipe.cookLogs || [];
        if (logs.length > 0) {
          const recent = daysAgo(logs[0].cookedAt);
          if (recent <= 14) setLastCookedDays(recent);
        }
      }

      setPlan(foundPlan);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId, weekOffset]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  // Detect conflict whenever day or meal type changes
  useEffect(() => {
    if (selectedDay === null || !plan) {
      setConflict(null);
      return;
    }
    const slot = plan.slots.find(
      (s) => s.day === selectedDay && s.mealType === selectedMealType
    );
    if (slot && slot.recipeId && slot.recipeId !== recipeId) {
      setConflict(slot);
      setConfirmedReplace(false);
    } else {
      setConflict(null);
    }
  }, [selectedDay, selectedMealType, plan, recipeId]);

  // ── Confirm + save ───────────────────────────────────────────
  async function confirm() {
    if (selectedDay === null) return;
    if (lastCookedDays !== null && !confirmedRecency) {
      setConfirmedRecency(true); // first click acknowledges, second click submits
      return;
    }
    if (conflict && !confirmedReplace) {
      setConfirmedReplace(true);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      // Make sure a plan exists for this week
      let planId = plan?.id;
      if (!planId) {
        const createRes = await fetch("/api/food/plan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weekStart: currentWeekStart.toISOString() }),
        });
        if (!createRes.ok) {
          throw new Error((await createRes.json()).error || "Could not create week plan");
        }
        const created = await createRes.json();
        planId = created.plan.id;
      }

      // Upsert the slot
      const slotRes = await fetch("/api/food/plan/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId,
          day: selectedDay,
          mealType: selectedMealType,
          recipeId,
        }),
      });
      if (!slotRes.ok) {
        throw new Error((await slotRes.json()).error || "Could not save slot");
      }

      setSuccess(true);
      setTimeout(() => onClose(), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // ── UI helpers ───────────────────────────────────────────────
  function slotForCell(day: number): SlotInfo | undefined {
    return plan?.slots.find((s) => s.day === day && s.mealType === selectedMealType);
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(74, 32, 64, 0.55)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 200,
        padding: "1rem",
      }}
    >
      <div
        className="food-card food-enter"
        style={{
          maxWidth: "520px",
          width: "100%",
          padding: "2rem",
          background: "white",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {success ? (
          // ── Success state ─────────────────────────────────
          <div style={{ textAlign: "center", padding: "1.5rem 0" }}>
            <div style={{ fontSize: "3.5rem", marginBottom: "0.75rem" }}>🎉</div>
            <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.375rem" }}>
              Added to your meal plan!
            </h2>
            <p style={{ color: "var(--food-text-secondary)", fontSize: "0.9375rem", margin: 0 }}>
              {recipeTitle} on {DAY_LABELS[selectedDay!]} for {selectedMealType}
            </p>
          </div>
        ) : (
          <>
            {/* ── Header ───────────────────────────────────── */}
            <div style={{ marginBottom: "1.25rem" }}>
              <h2 style={{ fontSize: "1.375rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.375rem" }}>
                Terrific! 🎉
              </h2>
              <p style={{ color: "var(--food-text-secondary)", fontSize: "0.9375rem", margin: 0 }}>
                When would you like to make <strong>{recipeTitle}</strong>?
              </p>
            </div>

            {/* ── Recency warning ──────────────────────────── */}
            {lastCookedDays !== null && (
              <div
                style={{
                  marginBottom: "1.25rem",
                  padding: "0.875rem 1rem",
                  borderRadius: "0.75rem",
                  background: "rgba(251, 191, 36, 0.12)",
                  border: "1px solid rgba(251, 191, 36, 0.32)",
                  color: "#92400e",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                }}
              >
                <strong>Heads up:</strong> you made this{" "}
                {lastCookedDays === 0
                  ? "today"
                  : lastCookedDays === 1
                    ? "yesterday"
                    : `${lastCookedDays} days ago`}
                . Want to repeat it, or maybe pick something different?
              </div>
            )}

            {/* ── Week navigation ──────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => Math.max(0, w - 1))}
                disabled={weekOffset === 0}
                className="food-btn food-btn-secondary"
                style={{
                  fontSize: "0.8125rem",
                  padding: "0.375rem 0.75rem",
                  opacity: weekOffset === 0 ? 0.4 : 1,
                  cursor: weekOffset === 0 ? "not-allowed" : "pointer",
                }}
              >
                ← This week
              </button>
              <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--food-text)" }}>
                {weekOffset === 0 ? "This week" : "Next week"}
              </span>
              <button
                type="button"
                onClick={() => setWeekOffset((w) => Math.min(1, w + 1))}
                disabled={weekOffset >= 1}
                className="food-btn food-btn-secondary"
                style={{
                  fontSize: "0.8125rem",
                  padding: "0.375rem 0.75rem",
                  opacity: weekOffset >= 1 ? 0.4 : 1,
                  cursor: weekOffset >= 1 ? "not-allowed" : "pointer",
                }}
              >
                Next week →
              </button>
            </div>

            {/* ── Meal type tabs ───────────────────────────── */}
            <div
              role="tablist"
              style={{
                display: "flex",
                gap: "0.5rem",
                marginBottom: "0.875rem",
                background: "rgba(244, 114, 182, 0.06)",
                padding: "0.25rem",
                borderRadius: "0.75rem",
              }}
            >
              {MEAL_TYPES.map((m) => {
                const active = selectedMealType === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="tab"
                    onClick={() => setSelectedMealType(m.value)}
                    style={{
                      flex: 1,
                      padding: "0.5rem 0.75rem",
                      borderRadius: "0.5rem",
                      border: "none",
                      background: active
                        ? "linear-gradient(135deg, var(--food-pink), var(--food-lavender))"
                        : "transparent",
                      color: active ? "white" : "var(--food-text)",
                      fontWeight: active ? 600 : 500,
                      fontSize: "0.875rem",
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                  >
                    {m.emoji} {m.label}
                  </button>
                );
              })}
            </div>

            {/* ── Day grid ─────────────────────────────────── */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                gap: "0.375rem",
                marginBottom: "1rem",
              }}
            >
              {Array.from({ length: 7 }).map((_, dayIdx) => {
                const slot = slotForCell(dayIdx);
                const hasRecipe = slot?.recipeId && slot.recipeId !== recipeId;
                const isThisRecipe = slot?.recipeId === recipeId;
                const selected = selectedDay === dayIdx;
                return (
                  <button
                    key={dayIdx}
                    type="button"
                    onClick={() => setSelectedDay(dayIdx)}
                    style={{
                      padding: "0.625rem 0.25rem",
                      borderRadius: "0.625rem",
                      border: selected
                        ? "2px solid var(--food-pink)"
                        : "1px solid rgba(244, 114, 182, 0.18)",
                      background: selected
                        ? "rgba(244, 114, 182, 0.16)"
                        : isThisRecipe
                          ? "rgba(110, 231, 183, 0.18)"
                          : hasRecipe
                            ? "rgba(244, 114, 182, 0.04)"
                            : "white",
                      cursor: "pointer",
                      transition: "all 0.15s",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "0.125rem",
                      minHeight: "62px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.6875rem",
                        fontWeight: 600,
                        color: selected ? "var(--food-pink)" : "var(--food-text-secondary)",
                        textTransform: "uppercase",
                      }}
                    >
                      {DAY_LABELS[dayIdx]}
                    </span>
                    <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--food-text)" }}>
                      {fmtDayLabel(currentWeekStart, dayIdx).split("/")[1]}
                    </span>
                    {isThisRecipe && (
                      <span style={{ fontSize: "0.625rem", color: "#047857" }}>✓ planned</span>
                    )}
                    {hasRecipe && !isThisRecipe && (
                      <span style={{ fontSize: "0.625rem", color: "var(--food-text-secondary)" }}>
                        taken
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* ── Conflict warning ─────────────────────────── */}
            {conflict?.recipe && (
              <div
                style={{
                  padding: "0.875rem 1rem",
                  borderRadius: "0.75rem",
                  background: "rgba(244, 114, 182, 0.08)",
                  border: "1px solid rgba(244, 114, 182, 0.32)",
                  marginBottom: "1rem",
                  fontSize: "0.875rem",
                  lineHeight: 1.5,
                }}
              >
                <strong>Already planned:</strong> {conflict.recipe.title} on{" "}
                {DAY_LABELS[selectedDay!]} for {selectedMealType}.
                <br />
                {confirmedReplace ? (
                  <span style={{ color: "var(--food-pink)" }}>
                    Click confirm again to <strong>replace</strong> it, or pick a different day.
                  </span>
                ) : (
                  <span style={{ color: "var(--food-text-secondary)" }}>
                    Want to replace it, or pick a different day?
                  </span>
                )}
              </div>
            )}

            {error && (
              <div
                style={{
                  padding: "0.625rem 0.875rem",
                  borderRadius: "0.625rem",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.24)",
                  color: "#b91c1c",
                  fontSize: "0.8125rem",
                  marginBottom: "1rem",
                }}
              >
                {error}
              </div>
            )}

            {/* ── Action buttons ───────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={onClose}
                className="food-btn food-btn-secondary"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={selectedDay === null || saving || loading}
                className="food-btn food-btn-primary food-glow"
                style={{
                  opacity: selectedDay === null || saving || loading ? 0.5 : 1,
                  cursor: selectedDay === null || saving || loading ? "not-allowed" : "pointer",
                }}
              >
                {saving
                  ? "Saving…"
                  : conflict && !confirmedReplace
                    ? "Replace it"
                    : lastCookedDays !== null && !confirmedRecency
                      ? "Yes, plan it again"
                      : "Add to meal plan"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
