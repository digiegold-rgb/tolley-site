"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface FamilyMember {
  id?: string;
  name: string;
  role: string;
  dietaryFlags: string[];
  dislikes: string;
  favorites: string;
  ageRange: string;
}

interface Household {
  id: string;
  name: string;
  timezone: string;
  weeklyBudget: number | null;
  defaultServings: number;
  members: FamilyMember[];
}

const DIETARY_FLAGS = [
  "Vegetarian", "Vegan", "Gluten-Free", "Dairy-Free", "Nut-Free",
  "Shellfish-Free", "Egg-Free", "Soy-Free", "Low-Carb", "Keto", "Halal", "Kosher",
];
const ROLES = ["owner", "member", "kid"];
const AGE_RANGES = ["toddler", "kid", "teen", "adult"];
const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "America/Phoenix", "Pacific/Honolulu",
];

const emptyMember = (): FamilyMember => ({
  name: "",
  role: "member",
  dietaryFlags: [],
  dislikes: "",
  favorites: "",
  ageRange: "adult",
});

export default function FoodSettingsPage() {
  const router = useRouter();
  const [household, setHousehold] = useState<Household | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Onboarding / create form
  const [onboardStep, setOnboardStep] = useState(0);
  const [householdName, setHouseholdName] = useState("My Kitchen");
  const [timezone, setTimezone] = useState("America/Chicago");
  const [weeklyBudget, setWeeklyBudget] = useState("");
  const [defaultServings, setDefaultServings] = useState("4");
  const [members, setMembers] = useState<FamilyMember[]>([emptyMember()]);

  // Edit mode
  const [editingMember, setEditingMember] = useState<number | null>(null);

  const fetchHousehold = useCallback(async () => {
    try {
      const res = await fetch("/api/food/household");
      if (res.ok) {
        const data = await res.json();
        if (data.household) {
          setHousehold(data.household);
          setHouseholdName(data.household.name);
          setTimezone(data.household.timezone);
          setWeeklyBudget(data.household.weeklyBudget ? String(data.household.weeklyBudget) : "");
          setDefaultServings(String(data.household.defaultServings));
          setMembers(
            data.household.members.length > 0
              ? data.household.members.map((m: FamilyMember) => ({
                  ...m,
                  dislikes: Array.isArray(m.dislikes) ? m.dislikes.join(", ") : m.dislikes || "",
                  favorites: Array.isArray(m.favorites) ? m.favorites.join(", ") : m.favorites || "",
                }))
              : [emptyMember()]
          );
        }
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHousehold();
  }, [fetchHousehold]);

  const toggleDietaryFlag = (memberIndex: number, flag: string) => {
    setMembers((prev) =>
      prev.map((m, i) =>
        i === memberIndex
          ? {
              ...m,
              dietaryFlags: m.dietaryFlags.includes(flag)
                ? m.dietaryFlags.filter((f) => f !== flag)
                : [...m.dietaryFlags, flag],
            }
          : m
      )
    );
  };

  const updateMember = (index: number, field: keyof FamilyMember, value: string | string[]) => {
    setMembers((prev) => prev.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const addMember = () => setMembers((prev) => [...prev, emptyMember()]);

  const removeMember = (index: number) => {
    if (members.length <= 1) return;
    setMembers((prev) => prev.filter((_, i) => i !== index));
  };

  const handleCreate = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/food/household", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: householdName.trim(),
          timezone,
          weeklyBudget: weeklyBudget ? parseFloat(weeklyBudget) : null,
          defaultServings: parseInt(defaultServings) || 4,
        }),
      });

      if (res.ok) {
        // Add family members separately
        const validMembers = members.filter((m) => m.name.trim());
        for (const m of validMembers) {
          await fetch("/api/food/members", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: m.name.trim(),
              role: m.role,
              dietaryFlags: m.dietaryFlags,
              dislikes: m.dislikes.split(",").map((d) => d.trim()).filter(Boolean),
              favorites: m.favorites.split(",").map((f) => f.trim()).filter(Boolean),
              ageRange: m.ageRange,
            }),
          });
        }
        router.push("/food");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to create household");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async () => {
    if (!household) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await fetch("/api/food/household", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: householdName.trim(),
          timezone,
          weeklyBudget: weeklyBudget ? parseFloat(weeklyBudget) : null,
          defaultServings: parseInt(defaultServings) || 4,
          members: members.filter((m) => m.name.trim()).map((m) => ({
            id: m.id || undefined,
            name: m.name.trim(),
            role: m.role,
            dietaryFlags: m.dietaryFlags,
            dislikes: typeof m.dislikes === "string" ? m.dislikes.split(",").map((d) => d.trim()).filter(Boolean) : m.dislikes,
            favorites: typeof m.favorites === "string" ? m.favorites.split(",").map((f) => f.trim()).filter(Boolean) : m.favorites,
            ageRange: m.ageRange,
          })),
        }),
      });

      if (res.ok) {
        setSuccess("Settings saved!");
        fetchHousehold();
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update settings");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const renderMemberForm = (member: FamilyMember, index: number) => (
    <div
      key={index}
      className="food-card"
      style={{ padding: "1.25rem", position: "relative" }}
    >
      {members.length > 1 && (
        <button
          onClick={() => removeMember(index)}
          style={{
            position: "absolute",
            top: "0.75rem",
            right: "0.75rem",
            background: "none",
            border: "none",
            color: "#ef4444",
            cursor: "pointer",
            fontSize: "1.25rem",
          }}
        >
          &times;
        </button>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem", marginBottom: "0.75rem" }}>
        <input
          className="food-input"
          placeholder="Name"
          value={member.name}
          onChange={(e) => updateMember(index, "name", e.target.value)}
        />
        <select
          className="food-input"
          value={member.role}
          onChange={(e) => updateMember(index, "role", e.target.value)}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>
          ))}
        </select>
        <select
          className="food-input"
          value={member.ageRange}
          onChange={(e) => updateMember(index, "ageRange", e.target.value)}
        >
          {AGE_RANGES.map((a) => (
            <option key={a} value={a}>{a.charAt(0).toUpperCase() + a.slice(1)}</option>
          ))}
        </select>
      </div>

      <div style={{ marginBottom: "0.75rem" }}>
        <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.375rem" }}>
          Dietary Restrictions
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
          {DIETARY_FLAGS.map((flag) => (
            <button
              key={flag}
              type="button"
              className={`food-tag ${member.dietaryFlags.includes(flag) ? "food-tag-pink" : ""}`}
              onClick={() => toggleDietaryFlag(index, flag)}
              style={{
                cursor: "pointer",
                border: "1px solid var(--food-border)",
                background: member.dietaryFlags.includes(flag) ? "rgba(244, 114, 182, 0.15)" : "white",
                padding: "0.3rem 0.625rem",
                fontSize: "0.75rem",
              }}
            >
              {flag}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
            Dislikes
          </label>
          <textarea
            className="food-input"
            placeholder="e.g. mushrooms, olives, spicy food"
            value={member.dislikes}
            onChange={(e) => updateMember(index, "dislikes", e.target.value)}
            rows={2}
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
            Favorites
          </label>
          <textarea
            className="food-input"
            placeholder="e.g. pasta, tacos, ice cream"
            value={member.favorites}
            onChange={(e) => updateMember(index, "favorites", e.target.value)}
            rows={2}
            style={{ width: "100%", resize: "vertical" }}
          />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div style={{ maxWidth: "800px", margin: "0 auto", padding: "4rem 1.5rem", textAlign: "center" }}>
        <div style={{ fontSize: "2.5rem", animation: "food-sparkle 1.5s ease-in-out infinite" }}>🏠</div>
        <p style={{ color: "var(--food-text-secondary)", marginTop: "1rem" }}>Loading settings...</p>
      </div>
    );
  }

  // Onboarding flow (no household yet)
  if (!household) {
    return (
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "2rem 1.5rem" }}>
        {/* Step 0: Welcome */}
        {onboardStep === 0 && (
          <div
            className="food-card food-enter"
            style={{ textAlign: "center", padding: "3rem 2rem" }}
          >
            <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🍳</div>
            <h1 style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.75rem" }}>
              Welcome to Ruthann's Kitchen!
            </h1>
            <p style={{ color: "var(--food-text-secondary)", fontSize: "1.0625rem", marginBottom: "2rem", maxWidth: "400px", margin: "0 auto 2rem" }}>
              Let's set up your family so we can plan meals, build grocery lists, and track your pantry just for you.
            </p>
            <button
              className="food-btn food-btn-primary food-glow"
              onClick={() => setOnboardStep(1)}
              style={{ fontSize: "1.0625rem", padding: "0.75rem 2rem" }}
            >
              Let's Get Started
            </button>
          </div>
        )}

        {/* Step 1: Household settings */}
        {onboardStep === 1 && (
          <div className="food-enter">
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.5rem" }}>
              Set Up Your Kitchen
            </h1>
            <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
              Tell us about your household
            </p>

            {error && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.75rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#dc2626",
                  fontSize: "0.875rem",
                  marginBottom: "1rem",
                }}
              >
                {error}
              </div>
            )}

            <div className="food-card" style={{ padding: "1.25rem", marginBottom: "1.5rem" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                    Kitchen Name
                  </label>
                  <input
                    className="food-input"
                    value={householdName}
                    onChange={(e) => setHouseholdName(e.target.value)}
                    placeholder="My Kitchen"
                    style={{ width: "100%" }}
                  />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                      Timezone
                    </label>
                    <select
                      className="food-input"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      style={{ width: "100%" }}
                    >
                      {TIMEZONES.map((tz) => (
                        <option key={tz} value={tz}>{tz.replace("America/", "").replace("Pacific/", "").replace("_", " ")}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                      Default Servings
                    </label>
                    <input
                      className="food-input"
                      type="number"
                      value={defaultServings}
                      onChange={(e) => setDefaultServings(e.target.value)}
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                    Weekly Grocery Budget (optional)
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                    <span style={{ color: "var(--food-text-secondary)", fontSize: "1.125rem" }}>$</span>
                    <input
                      className="food-input"
                      type="number"
                      placeholder="150"
                      value={weeklyBudget}
                      onChange={(e) => setWeeklyBudget(e.target.value)}
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="food-btn food-btn-secondary" onClick={() => setOnboardStep(0)}>
                Back
              </button>
              <button className="food-btn food-btn-primary" onClick={() => setOnboardStep(2)}>
                Next: Add Family
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Family members */}
        {onboardStep === 2 && (
          <div className="food-enter">
            <h1 style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "0.5rem" }}>
              Add Your Family
            </h1>
            <p style={{ color: "var(--food-text-secondary)", marginBottom: "1.5rem" }}>
              Add everyone who eats at your table. We'll use this to personalize recipes and meal plans.
            </p>

            {error && (
              <div
                style={{
                  padding: "0.75rem 1rem",
                  borderRadius: "0.75rem",
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.2)",
                  color: "#dc2626",
                  fontSize: "0.875rem",
                  marginBottom: "1rem",
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
              {members.map((member, i) => renderMemberForm(member, i))}
            </div>

            <button
              className="food-btn food-btn-secondary"
              onClick={addMember}
              style={{ marginBottom: "1.5rem" }}
            >
              + Add Family Member
            </button>

            <div style={{ display: "flex", gap: "0.75rem", justifyContent: "flex-end" }}>
              <button className="food-btn food-btn-secondary" onClick={() => setOnboardStep(1)}>
                Back
              </button>
              <button
                className="food-btn food-btn-primary food-glow"
                onClick={handleCreate}
                disabled={saving || !members.some((m) => m.name.trim())}
                style={{ opacity: saving ? 0.7 : 1 }}
              >
                {saving ? "Setting Up..." : "Finish Setup"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Edit existing household
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "2rem 1.5rem" }}>
      <h1
        className="food-enter"
        style={{ fontSize: "1.75rem", fontWeight: 700, color: "var(--food-text)", marginBottom: "1.5rem" }}
      >
        Kitchen Settings
      </h1>

      {error && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.2)",
            color: "#dc2626",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        >
          {error}
        </div>
      )}

      {success && (
        <div
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.75rem",
            background: "rgba(110, 231, 183, 0.1)",
            border: "1px solid rgba(110, 231, 183, 0.2)",
            color: "#047857",
            fontSize: "0.875rem",
            marginBottom: "1rem",
          }}
        >
          {success}
        </div>
      )}

      {/* Household settings card */}
      <div
        className="food-card food-enter"
        style={{ padding: "1.25rem", marginBottom: "1.5rem", "--enter-delay": "0.1s" } as React.CSSProperties}
      >
        <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)", marginBottom: "1rem" }}>
          Household
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
              Kitchen Name
            </label>
            <input
              className="food-input"
              value={householdName}
              onChange={(e) => setHouseholdName(e.target.value)}
              style={{ width: "100%" }}
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.75rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                Timezone
              </label>
              <select
                className="food-input"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                style={{ width: "100%" }}
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz.replace("America/", "").replace("Pacific/", "").replace("_", " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                Default Servings
              </label>
              <input
                className="food-input"
                type="number"
                value={defaultServings}
                onChange={(e) => setDefaultServings(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--food-text)", marginBottom: "0.25rem" }}>
                Weekly Budget
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                <span style={{ color: "var(--food-text-secondary)" }}>$</span>
                <input
                  className="food-input"
                  type="number"
                  placeholder="150"
                  value={weeklyBudget}
                  onChange={(e) => setWeeklyBudget(e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Family members */}
      <div
        className="food-enter"
        style={{ "--enter-delay": "0.15s" } as React.CSSProperties}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, color: "var(--food-text)" }}>
            Family Members
          </h2>
          <button className="food-btn food-btn-secondary" onClick={addMember} style={{ fontSize: "0.8125rem" }}>
            + Add Member
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "1.5rem" }}>
          {members.map((member, i) => renderMemberForm(member, i))}
        </div>
      </div>

      {/* Save button */}
      <div
        className="food-enter"
        style={{ display: "flex", justifyContent: "flex-end", "--enter-delay": "0.2s" } as React.CSSProperties}
      >
        <button
          className="food-btn food-btn-primary food-glow"
          onClick={handleUpdate}
          disabled={saving}
          style={{ opacity: saving ? 0.7 : 1 }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>
    </div>
  );
}
