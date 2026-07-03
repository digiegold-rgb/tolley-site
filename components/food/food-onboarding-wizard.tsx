"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useRef } from "react";

import { CuisinePicker } from "@/components/food/cuisine-picker";
import { MIN_CUISINES } from "@/lib/food/cuisines";

interface InitialHousehold {
  id: string;
  name: string;
  timezone: string;
  weeklyBudget: number | null;
  defaultServings: number;
  cuisinePreferences: string[];
}

interface FoodOnboardingWizardProps {
  initialHousehold: InitialHousehold;
  initialMemberCount: number;
  initialRecipeCount: number;
}

interface DraftMember {
  name: string;
  role: "owner" | "member" | "kid";
  ageRange: string;
  dietaryFlags: string[];
  dislikes: string;
}

interface ImportResult {
  total: number;
  parsed: number;
  created: number;
  skipped: number;
  failed: number;
  sampleTitles: string[];
  capped: boolean;
}

const DIETARY_OPTIONS = [
  "vegetarian",
  "vegan",
  "gluten-free",
  "dairy-free",
  "nut-free",
  "kosher",
  "halal",
  "low-carb",
  "keto",
  "pescatarian",
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
];

const STEPS = [
  { num: 1, label: "Kitchen basics" },
  { num: 2, label: "Family" },
  { num: 3, label: "Cuisines" },
  { num: 4, label: "Import recipes" },
  { num: 5, label: "Start trial" },
];

export function FoodOnboardingWizard({
  initialHousehold,
  initialMemberCount,
  initialRecipeCount,
}: FoodOnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: household
  const [householdName, setHouseholdName] = useState(initialHousehold.name);
  const [timezone, setTimezone] = useState(initialHousehold.timezone);
  const [weeklyBudget, setWeeklyBudget] = useState(
    initialHousehold.weeklyBudget?.toString() ?? ""
  );
  const [defaultServings, setDefaultServings] = useState(
    initialHousehold.defaultServings.toString()
  );
  const [householdSaved, setHouseholdSaved] = useState(false);

  // Step 2: family members
  const [members, setMembers] = useState<DraftMember[]>([]);
  const [draftMember, setDraftMember] = useState<DraftMember>({
    name: "",
    role: "member",
    ageRange: "adult",
    dietaryFlags: [],
    dislikes: "",
  });
  const [savedMemberCount, setSavedMemberCount] = useState(initialMemberCount);
  const [confirmingSkip, setConfirmingSkip] = useState(false);

  // Step 3: cuisine preferences
  const [cuisines, setCuisines] = useState<string[]>(initialHousehold.cuisinePreferences || []);
  const [savingCuisines, setSavingCuisines] = useState(false);

  // Step 4: yummly import
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [recipeCount, setRecipeCount] = useState(initialRecipeCount);

  // Shared
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function trackStep(step: number) {
    void fetch("/api/food/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "wizard_step_complete",
        meta: { step },
      }),
    }).catch(() => {});
  }

  async function saveHousehold() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/food/household", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: householdName,
          timezone,
          weeklyBudget: weeklyBudget || null,
          defaultServings: parseInt(defaultServings, 10) || 4,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      setHouseholdSaved(true);
      trackStep(1);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function addDraftToList() {
    if (!draftMember.name.trim()) return;
    setMembers((prev) => [...prev, draftMember]);
    setDraftMember({
      name: "",
      role: "member",
      ageRange: "adult",
      dietaryFlags: [],
      dislikes: "",
    });
  }

  function removeDraft(idx: number) {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  async function saveMembers() {
    setSaving(true);
    setError(null);
    try {
      for (const m of members) {
        const res = await fetch("/api/food/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: m.name,
            role: m.role,
            ageRange: m.ageRange,
            dietaryFlags: m.dietaryFlags,
            dislikes: m.dislikes
              ? m.dislikes.split(",").map((s) => s.trim()).filter(Boolean)
              : [],
          }),
        });
        if (!res.ok) throw new Error((await res.json()).error || "Member save failed");
      }
      setSavedMemberCount((n) => n + members.length);
      setMembers([]);
      trackStep(2);
      setStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save family members");
    } finally {
      setSaving(false);
    }
  }

  async function saveCuisines() {
    setSavingCuisines(true);
    setError(null);
    try {
      const res = await fetch("/api/food/household", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cuisinePreferences: cuisines }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Save failed");
      trackStep(3);
      setStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save cuisines");
    } finally {
      setSavingCuisines(false);
    }
  }

  async function uploadYummlyFile(file: File) {
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/food/yummly-import", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Import failed");
      }
      setImportResult(data as ImportResult);
      setRecipeCount((n) => n + (data.created || 0));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  async function startTrial() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/stripe/food/checkout", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Checkout failed");
      }
      const { url } = await res.json();
      if (typeof url === "string") {
        window.location.href = url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start trial");
      setSaving(false);
    }
  }

  return (
    <div>
      {/* Progress indicator */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "2rem",
          gap: "0.5rem",
        }}
      >
        {STEPS.map((s, i) => (
          <div
            key={s.num}
            style={{ display: "flex", alignItems: "center", flex: 1, gap: "0.5rem" }}
          >
            <div
              style={{
                width: "2rem",
                height: "2rem",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: "0.875rem",
                background:
                  step >= s.num
                    ? "linear-gradient(135deg, var(--food-pink), var(--food-lavender))"
                    : "rgba(244, 114, 182, 0.15)",
                color: step >= s.num ? "white" : "var(--food-text-secondary)",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
            >
              {step > s.num ? "✓" : s.num}
            </div>
            <span
              style={{
                fontSize: "0.75rem",
                color:
                  step >= s.num
                    ? "var(--food-text)"
                    : "var(--food-text-secondary)",
                fontWeight: step === s.num ? 600 : 400,
                whiteSpace: "nowrap",
                display: "none",
              }}
              className="food-onboarding-step-label"
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  background:
                    step > s.num
                      ? "var(--food-pink)"
                      : "rgba(244, 114, 182, 0.15)",
                  borderRadius: 2,
                }}
              />
            )}
          </div>
        ))}
      </div>

      <div className="food-card" style={{ padding: "2rem" }}>
        {/* ─── Step 1: Household ─────────────────── */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Tell us about your kitchen
            </h2>
            <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
              The basics — we&apos;ll customize meal plans around your budget
              and household size.
            </p>

            <label style={labelStyle}>Kitchen name</label>
            <input
              type="text"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              placeholder="The Smith Family Kitchen"
              style={inputStyle}
            />

            <label style={labelStyle}>Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              style={inputStyle}
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div>
                <label style={labelStyle}>Weekly budget (USD)</label>
                <input
                  type="number"
                  value={weeklyBudget}
                  onChange={(e) => setWeeklyBudget(e.target.value)}
                  placeholder="e.g. 150"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Default servings</label>
                <input
                  type="number"
                  value={defaultServings}
                  onChange={(e) => setDefaultServings(e.target.value)}
                  min={1}
                  max={12}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={{ marginTop: "1.5rem" }}>
              <button
                type="button"
                onClick={saveHousehold}
                disabled={saving || !householdName.trim()}
                className="food-btn food-btn-primary food-glow"
                style={{
                  width: "100%",
                  padding: "0.875rem",
                  opacity: saving || !householdName.trim() ? 0.6 : 1,
                  cursor: saving || !householdName.trim() ? "not-allowed" : "pointer",
                }}
              >
                {saving ? "Saving…" : householdSaved ? "Saved ✓ — Continue →" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 2: Family ─────────────────── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Who are you cooking for?
            </h2>
            <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
              Add family members with dietary needs, allergies, and dislikes.
              We&apos;ll respect them in every meal plan. Skip if it&apos;s just you.
            </p>

            {members.length > 0 && (
              <div style={{ marginBottom: "1.25rem" }}>
                {members.map((m, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.75rem 1rem",
                      background: "rgba(244, 114, 182, 0.08)",
                      borderRadius: "0.625rem",
                      marginBottom: "0.5rem",
                      fontSize: "0.9375rem",
                    }}
                  >
                    <div>
                      <strong>{m.name}</strong>
                      <span style={{ color: "var(--food-text-secondary)", marginLeft: "0.5rem", fontSize: "0.8125rem" }}>
                        {m.role} · {m.ageRange}
                        {m.dietaryFlags.length > 0 && ` · ${m.dietaryFlags.join(", ")}`}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDraft(idx)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#b91c1c",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                padding: "1.25rem",
                background: "rgba(244, 114, 182, 0.04)",
                borderRadius: "0.875rem",
                border: "1px dashed rgba(244, 114, 182, 0.25)",
                marginBottom: "1.25rem",
              }}
            >
              <label style={labelStyle}>Name</label>
              <input
                type="text"
                value={draftMember.name}
                onChange={(e) =>
                  setDraftMember((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="e.g. Emma"
                style={inputStyle}
              />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={labelStyle}>Role</label>
                  <select
                    value={draftMember.role}
                    onChange={(e) =>
                      setDraftMember((d) => ({
                        ...d,
                        role: e.target.value as DraftMember["role"],
                      }))
                    }
                    style={inputStyle}
                  >
                    <option value="owner">Owner</option>
                    <option value="member">Member</option>
                    <option value="kid">Kid</option>
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Age range</label>
                  <select
                    value={draftMember.ageRange}
                    onChange={(e) =>
                      setDraftMember((d) => ({ ...d, ageRange: e.target.value }))
                    }
                    style={inputStyle}
                  >
                    <option value="toddler">Toddler</option>
                    <option value="kid">Kid</option>
                    <option value="teen">Teen</option>
                    <option value="adult">Adult</option>
                  </select>
                </div>
              </div>

              <label style={labelStyle}>Dietary flags</label>
              <div style={{ display: "flex", gap: "0.375rem", flexWrap: "wrap", marginBottom: "0.875rem" }}>
                {DIETARY_OPTIONS.map((flag) => {
                  const active = draftMember.dietaryFlags.includes(flag);
                  return (
                    <button
                      key={flag}
                      type="button"
                      onClick={() =>
                        setDraftMember((d) => ({
                          ...d,
                          dietaryFlags: active
                            ? d.dietaryFlags.filter((f) => f !== flag)
                            : [...d.dietaryFlags, flag],
                        }))
                      }
                      style={{
                        padding: "0.375rem 0.75rem",
                        borderRadius: "999px",
                        border: "1px solid rgba(244, 114, 182, 0.35)",
                        background: active ? "var(--food-pink)" : "transparent",
                        color: active ? "white" : "var(--food-text)",
                        fontSize: "0.8125rem",
                        cursor: "pointer",
                      }}
                    >
                      {flag}
                    </button>
                  );
                })}
              </div>

              <label style={labelStyle}>Dislikes (comma-separated)</label>
              <input
                type="text"
                value={draftMember.dislikes}
                onChange={(e) =>
                  setDraftMember((d) => ({ ...d, dislikes: e.target.value }))
                }
                placeholder="mushrooms, olives, cilantro"
                style={inputStyle}
              />

              <button
                type="button"
                onClick={addDraftToList}
                disabled={!draftMember.name.trim()}
                className="food-btn food-btn-secondary"
                style={{
                  marginTop: "0.5rem",
                  opacity: draftMember.name.trim() ? 1 : 0.5,
                  cursor: draftMember.name.trim() ? "pointer" : "not-allowed",
                }}
              >
                + Add this person
              </button>
            </div>

            {confirmingSkip && members.length === 0 && (
              <div
                style={{
                  padding: "1rem 1.125rem",
                  background: "rgba(244, 114, 182, 0.08)",
                  border: "1px solid rgba(244, 114, 182, 0.35)",
                  borderRadius: "0.75rem",
                  marginBottom: "1rem",
                  fontSize: "0.9375rem",
                  lineHeight: 1.5,
                }}
              >
                <strong>Skip without adding anyone?</strong>
                <p style={{ margin: "0.5rem 0 0.875rem", color: "var(--food-text-secondary)" }}>
                  Meal plans will be generic — no diet or dislike filtering. Add even
                  one person (yourself works) and we can match recipes to your real
                  preferences. You can edit later in Settings.
                </p>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setConfirmingSkip(false)}
                    className="food-btn food-btn-primary"
                  >
                    Add at least one →
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmingSkip(false);
                      void saveMembers();
                    }}
                    disabled={saving}
                    className="food-btn food-btn-secondary"
                  >
                    Skip anyway
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between" }}>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="food-btn food-btn-secondary"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => {
                  if (members.length === 0) {
                    setConfirmingSkip(true);
                    return;
                  }
                  void saveMembers();
                }}
                disabled={saving}
                className="food-btn food-btn-primary food-glow"
              >
                {saving
                  ? "Saving…"
                  : members.length > 0
                    ? `Save ${members.length} & continue →`
                    : "Skip →"}
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Cuisine preferences ─────────────────── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              What do y&apos;all love to eat?
            </h2>
            <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
              Pick {MIN_CUISINES}–7 cuisines your family likes. We&apos;ll build every weekly plan around these and rotate so things never get stale.
            </p>

            <CuisinePicker value={cuisines} onChange={setCuisines} />

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", marginTop: "1.5rem" }}>
              <button
                type="button"
                onClick={() => setStep(2)}
                className="food-btn food-btn-secondary"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={saveCuisines}
                disabled={savingCuisines || cuisines.length < MIN_CUISINES}
                className="food-btn food-btn-primary food-glow"
                style={{
                  opacity: cuisines.length < MIN_CUISINES ? 0.6 : 1,
                  cursor: cuisines.length < MIN_CUISINES ? "not-allowed" : "pointer",
                }}
              >
                {savingCuisines ? "Saving…" : "Continue →"}
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 4: Yummly import ─────────────────── */}
        {step === 4 && (
          <div>
            <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Bring your old recipes
            </h2>
            <p style={{ color: "var(--food-text-secondary)", marginBottom: "1rem" }}>
              Upload your Yummly or PlateJoy export <code>.zip</code> and
              we&apos;ll clean it up with AI. Missing ingredients, cuisine tags,
              and prep times all filled in automatically. Skip if you don&apos;t
              have one.
            </p>

            {recipeCount > 0 && (
              <div
                style={{
                  padding: "0.875rem 1rem",
                  background: "rgba(110, 231, 183, 0.12)",
                  border: "1px solid rgba(110, 231, 183, 0.3)",
                  borderRadius: "0.75rem",
                  marginBottom: "1rem",
                  fontSize: "0.9375rem",
                }}
              >
                ✅ You already have {recipeCount} recipe{recipeCount === 1 ? "" : "s"} in your library.
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".zip,.json,application/zip,application/json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadYummlyFile(file);
              }}
              style={{ display: "none" }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              style={{
                width: "100%",
                padding: "2rem",
                borderRadius: "1rem",
                border: "2px dashed rgba(244, 114, 182, 0.4)",
                background: "rgba(244, 114, 182, 0.04)",
                cursor: importing ? "wait" : "pointer",
                fontFamily: "inherit",
                fontSize: "1rem",
                color: "var(--food-text)",
                transition: "background 0.2s",
              }}
            >
              {importing ? (
                <>
                  <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>⏳</div>
                  <div style={{ fontWeight: 600 }}>Normalizing recipes with AI…</div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginTop: "0.25rem" }}>
                    This can take a minute for large imports. Don&apos;t close this tab.
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📦</div>
                  <div style={{ fontWeight: 600 }}>Click to upload .zip or .json</div>
                  <div style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginTop: "0.25rem" }}>
                    Yummly export, PlateJoy export, or any JSON recipe file · max 25 MB
                  </div>
                </>
              )}
            </button>

            {importResult && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "1rem 1.25rem",
                  background: "rgba(110, 231, 183, 0.1)",
                  border: "1px solid rgba(110, 231, 183, 0.3)",
                  borderRadius: "0.75rem",
                }}
              >
                <p style={{ margin: 0, fontWeight: 600 }}>
                  ✨ Imported {importResult.created} recipe{importResult.created === 1 ? "" : "s"}
                </p>
                <p
                  style={{
                    margin: "0.375rem 0 0",
                    fontSize: "0.8125rem",
                    color: "var(--food-text-secondary)",
                  }}
                >
                  {importResult.total} found · {importResult.parsed} normalized ·{" "}
                  {importResult.skipped} skipped
                  {importResult.failed > 0 && ` · ${importResult.failed} failed`}
                  {importResult.capped && " · capped at 500 for this import"}
                </p>
                {importResult.sampleTitles.length > 0 && (
                  <p
                    style={{
                      margin: "0.625rem 0 0",
                      fontSize: "0.8125rem",
                      color: "var(--food-text-secondary)",
                    }}
                  >
                    Sample: {importResult.sampleTitles.slice(0, 5).join(", ")}
                    {importResult.sampleTitles.length > 5 && "…"}
                  </p>
                )}
              </div>
            )}

            {importError && (
              <div
                style={{
                  marginTop: "1rem",
                  padding: "0.875rem 1rem",
                  background: "rgba(239, 68, 68, 0.08)",
                  border: "1px solid rgba(239, 68, 68, 0.24)",
                  borderRadius: "0.75rem",
                  color: "#b91c1c",
                  fontSize: "0.875rem",
                }}
              >
                {importError}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", marginTop: "1.5rem" }}>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="food-btn food-btn-secondary"
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={() => setStep(5)}
                className="food-btn food-btn-primary"
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 5: Start trial ─────────────────── */}
        {step === 5 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🍳</div>
            <h2 style={{ fontSize: "1.625rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Your kitchen is ready
            </h2>
            <p
              style={{
                color: "var(--food-text-secondary)",
                marginBottom: "1.5rem",
                lineHeight: 1.6,
              }}
            >
              Start your 30-day free trial to unlock meal planning, grocery
              lists, pantry tracking, receipt scanning, and AI recipes.
            </p>

            <div
              style={{
                padding: "1.25rem",
                background: "rgba(244, 114, 182, 0.06)",
                border: "1px solid rgba(244, 114, 182, 0.2)",
                borderRadius: "0.875rem",
                marginBottom: "1.5rem",
                textAlign: "left",
              }}
            >
              <p style={{ margin: 0, fontWeight: 600, fontSize: "0.9375rem", marginBottom: "0.5rem" }}>
                Your setup:
              </p>
              <ul style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.875rem", color: "var(--food-text-secondary)", lineHeight: 1.8 }}>
                <li>Kitchen: {householdName}</li>
                <li>
                  {savedMemberCount} family member{savedMemberCount === 1 ? "" : "s"}
                </li>
                <li>
                  {recipeCount} recipe{recipeCount === 1 ? "" : "s"} in library
                </li>
              </ul>
            </div>

            <div
              style={{
                fontSize: "2.5rem",
                fontWeight: 800,
                background: "linear-gradient(135deg, var(--food-pink), var(--food-lavender))",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                lineHeight: 1,
              }}
            >
              $39<span style={{ fontSize: "1rem", color: "var(--food-text-secondary)" }}>/year</span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--food-text-secondary)", marginTop: "0.25rem", marginBottom: "1.5rem" }}>
              After 30-day free trial · cancel anytime
            </p>

            <button
              type="button"
              onClick={startTrial}
              disabled={saving}
              className="food-btn food-btn-primary food-glow"
              style={{
                width: "100%",
                padding: "1rem",
                fontSize: "1rem",
              }}
            >
              {saving ? "Starting…" : "Start 30-day free trial →"}
            </button>
            <div style={{ marginTop: "0.875rem" }}>
              <Link
                href="/food/billing"
                style={{
                  fontSize: "0.8125rem",
                  color: "var(--food-text-secondary)",
                }}
                onClick={(e) => {
                  e.preventDefault();
                  router.push("/food/billing");
                }}
              >
                Skip for now and review billing →
              </Link>
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              marginTop: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.625rem",
              background: "rgba(239, 68, 68, 0.08)",
              border: "1px solid rgba(239, 68, 68, 0.24)",
              color: "#b91c1c",
              fontSize: "0.875rem",
            }}
          >
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8125rem",
  fontWeight: 600,
  color: "var(--food-text)",
  marginBottom: "0.375rem",
  marginTop: "0.875rem",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.625rem 0.875rem",
  borderRadius: "0.625rem",
  border: "1px solid rgba(244, 114, 182, 0.25)",
  background: "white",
  fontSize: "0.9375rem",
  fontFamily: "inherit",
  color: "var(--food-text)",
  marginBottom: "0.25rem",
  boxSizing: "border-box",
};
