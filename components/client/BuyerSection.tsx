"use client";

import { useState, useMemo } from "react";
import { MatchResults } from "./MatchResults";
import type { ListingData } from "./PropertyCard";

export function BuyerSection({ listings }: { listings: ListingData[] }) {
  const [step, setStep] = useState(1);
  const [budget, setBudget] = useState("");
  const [beds, setBeds] = useState("");
  const [areas, setAreas] = useState<string[]>([]);

  const KC_AREAS = [
    "Independence",
    "Lee's Summit",
    "Blue Springs",
    "Kansas City",
    "Raytown",
    "Grandview",
    "Liberty",
    "Overland Park",
    "Olathe",
  ];

  const matches = useMemo(() => {
    if (step < 4) return [];
    return listings
      .filter((l) => {
        if (budget && l.listPrice && l.listPrice > parseInt(budget)) return false;
        if (beds && (l.beds ?? 0) < parseInt(beds)) return false;
        if (areas.length && l.city && !areas.includes(l.city)) return false;
        return true;
      })
      .map((l) => {
        let fitScore = 50;
        if (budget && l.listPrice) {
          const ratio = l.listPrice / parseInt(budget);
          if (ratio <= 0.9) fitScore += 20;
          else if (ratio <= 1.0) fitScore += 10;
        }
        if (beds && l.beds && l.beds >= parseInt(beds)) fitScore += 15;
        if (areas.length && l.city && areas.includes(l.city)) fitScore += 15;
        return { ...l, fitScore: Math.min(fitScore, 100) };
      })
      .sort((a, b) => b.fitScore - a.fitScore)
      .slice(0, 6);
  }, [listings, step, budget, beds, areas]);

  const toggleArea = (area: string) => {
    setAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area],
    );
  };

  return (
    <div>
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 800,
          color: "var(--cl-text)",
          marginBottom: "0.5rem",
        }}
      >
        Find Your Match
      </h2>
      <p
        style={{
          fontSize: "0.9rem",
          color: "var(--cl-text-muted)",
          marginBottom: "1.25rem",
          maxWidth: "600px",
        }}
      >
        Answer 3 quick questions and our AI will find your best-fit homes.
      </p>

      <div
        className="cl-card-static"
        style={{ padding: "2rem", maxWidth: "600px" }}
      >
        {/* Progress */}
        <div
          style={{
            display: "flex",
            gap: "4px",
            marginBottom: "1.5rem",
          }}
        >
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: "4px",
                borderRadius: "2px",
                background: step >= s ? "var(--cl-primary)" : "#e2e8f0",
                transition: "background 0.3s ease",
              }}
            />
          ))}
        </div>

        {step === 1 && (
          <div>
            <label
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "var(--cl-text)",
              }}
            >
              What&apos;s your budget?
            </label>
            <select
              className="cl-input"
              style={{ marginTop: "0.5rem" }}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            >
              <option value="">Select range</option>
              <option value="150000">Up to $150K</option>
              <option value="250000">Up to $250K</option>
              <option value="400000">Up to $400K</option>
              <option value="600000">Up to $600K</option>
              <option value="1000000">Up to $1M</option>
              <option value="9999999">$1M+</option>
            </select>
            <button
              className="cl-cta"
              style={{ marginTop: "1rem", width: "100%" }}
              onClick={() => budget && setStep(2)}
              disabled={!budget}
            >
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <label
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "var(--cl-text)",
              }}
            >
              How many bedrooms?
            </label>
            <div
              style={{
                display: "flex",
                gap: "0.5rem",
                marginTop: "0.5rem",
                flexWrap: "wrap",
              }}
            >
              {["1", "2", "3", "4", "5"].map((b) => (
                <button
                  key={b}
                  onClick={() => setBeds(b)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: "8px",
                    border: "1px solid var(--cl-border)",
                    background:
                      beds === b ? "var(--cl-primary)" : "var(--cl-card)",
                    color: beds === b ? "white" : "var(--cl-text)",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {b}+
                </button>
              ))}
            </div>
            <button
              className="cl-cta"
              style={{ marginTop: "1rem", width: "100%" }}
              onClick={() => beds && setStep(3)}
              disabled={!beds}
            >
              Next
            </button>
          </div>
        )}

        {step === 3 && (
          <div>
            <label
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "var(--cl-text)",
              }}
            >
              Preferred areas (select any)
            </label>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                marginTop: "0.5rem",
              }}
            >
              {KC_AREAS.map((area) => (
                <button
                  key={area}
                  onClick={() => toggleArea(area)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "999px",
                    border: "1px solid var(--cl-border)",
                    background: areas.includes(area)
                      ? "var(--cl-primary)"
                      : "var(--cl-card)",
                    color: areas.includes(area) ? "white" : "var(--cl-text)",
                    fontWeight: 500,
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                >
                  {area}
                </button>
              ))}
            </div>
            <button
              className="cl-cta"
              style={{ marginTop: "1rem", width: "100%" }}
              onClick={() => setStep(4)}
            >
              Find My Matches
            </button>
          </div>
        )}

        {step === 4 && (
          <div>
            <button
              onClick={() => setStep(1)}
              style={{
                background: "none",
                border: "none",
                color: "var(--cl-primary)",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: "0.8rem",
                marginBottom: "0.5rem",
              }}
            >
              ← Start Over
            </button>
          </div>
        )}
      </div>

      {step === 4 && <MatchResults matches={matches} />}
    </div>
  );
}
