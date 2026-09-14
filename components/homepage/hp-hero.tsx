"use client";

import Link from "next/link";
import { useState } from "react";
import "./hp-hero.css";

const views = [
  {
    label: "Discover",
    title: "A clearer view of your market.",
    note: "Bring property and lead signals into one workspace.",
    tag: "PROPERTY SIGNALS",
    rows: ["Property record", "Ownership history", "Market context"],
  },
  {
    label: "Research",
    title: "Connect the details.",
    note: "Review a property dossier before deciding your next move.",
    tag: "PROPERTY DOSSIER",
    rows: ["Research summary", "Source references", "Notes & context"],
  },
  {
    label: "Follow up",
    title: "Make the next move count.",
    note: "Turn your research into a focused plan for follow-up.",
    tag: "NEXT STEPS",
    rows: [
      "Review the dossier",
      "Prepare your outreach",
      "Track the conversation",
    ],
  },
];
const parcels = Array.from({ length: 24 }, (_, index) => ({
  x: 44 + (index % 6) * 72,
  y: 48 + Math.floor(index / 6) * 77,
}));

export function HpHero() {
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const view = views[step];
  return (
    <section className="ta-hero">
      <div className="ta-hero-inner">
        <div className="ta-hero-copy">
          <p className="ta-eyebrow">
            <span /> T-Agent / Real estate intelligence
          </p>
          <h1>
            See the property.
            <br />
            <em>
              Understand
              <br />
              the opportunity.
            </em>
          </h1>
          <p className="ta-lede">
            Put lead research, property dossiers, and follow-up in one place.
            Spend less time piecing things together and more time making your
            next move.
          </p>
          <div className="ta-hero-actions">
            <Link href="/leads/pricing" className="ta-primary">
              Explore T-Agent <span aria-hidden="true">↗</span>
            </Link>
            <a href="#features" className="ta-secondary">
              See how it works ↓
            </a>
          </div>
          <p className="ta-hero-footnote">
            Built in Kansas City. Built for real estate agents.
          </p>
        </div>
        <div
          className={`ta-visual${paused ? " ta-paused" : ""}`}
          aria-label="Interactive illustration of the T-Agent workflow"
        >
          <div className="ta-window-bar">
            <span className="ta-window-brand">
              <span /> T-AGENT
            </span>
            <span>ILLUSTRATIVE PREVIEW</span>
          </div>
          <div className="ta-map-wrap">
            <div className="ta-map-label">
              <span>YOUR MARKET, CONNECTED</span>
              <span className="ta-coordinate">PROPERTY → CONTEXT → ACTION</span>
            </div>
            <svg
              className="ta-map"
              viewBox="0 0 520 350"
              fill="none"
              aria-hidden="true"
            >
              <defs>
                <pattern
                  id="ta-map-grid"
                  width="18"
                  height="18"
                  patternUnits="userSpaceOnUse"
                >
                  <circle cx="1" cy="1" r=".6" fill="#394a56" />
                </pattern>
                <linearGradient
                  id="ta-map-road"
                  x1="0"
                  y1="0"
                  x2="520"
                  y2="350"
                >
                  <stop stopColor="#314757" />
                  <stop offset="1" stopColor="#253542" />
                </linearGradient>
              </defs>
              <rect width="520" height="350" fill="url(#ta-map-grid)" />
              <g transform="translate(26 20) rotate(-8 260 175)">
                <path
                  d="M5 113H502M5 190H502M5 267H502M111 9V345M255 9V345M399 9V345"
                  stroke="url(#ta-map-road)"
                  strokeWidth="16"
                />
                <path
                  d="M5 113H502M5 190H502M5 267H502M111 9V345M255 9V345M399 9V345"
                  stroke="#61717c"
                  strokeOpacity=".35"
                  strokeDasharray="3 6"
                />
                {parcels.map(({ x, y }, index) => (
                  <g key={index} opacity={index === 8 ? 0 : 1}>
                    <rect
                      x={x - 6}
                      y={y - 10}
                      width="52"
                      height="48"
                      rx="3"
                      fill="#1e303d"
                      stroke="#3c5360"
                    />
                    <path
                      d={`M${x} ${y + 10}l17 -13 17 13v19h-34Z`}
                      fill={index % 3 === 0 ? "#465660" : "#334854"}
                      stroke="#74858c"
                      strokeOpacity=".5"
                    />
                    <path
                      d={`M${x} ${y + 10}h34M${x + 17} ${y - 3}v13`}
                      stroke="#7d929b"
                      strokeOpacity=".6"
                    />
                  </g>
                ))}
                <path
                  className="ta-signal-path"
                  d="M61 61L61 113H183V138M349 293V190H205V151M421 61V113H205V138"
                  stroke="#e4b87f"
                  strokeWidth="1.5"
                  strokeDasharray="5 7"
                />
                <circle
                  className="ta-map-pulse"
                  cx="205"
                  cy="151"
                  r="38"
                  stroke="#e4b87f"
                  strokeWidth="1"
                />
                <circle
                  cx="205"
                  cy="151"
                  r="31"
                  fill="#ddb27c"
                  fillOpacity=".1"
                  stroke="#e4b87f"
                  strokeOpacity=".4"
                />
                <rect
                  x="179"
                  y="119"
                  width="52"
                  height="48"
                  rx="3"
                  fill="#ddb27c"
                  stroke="#ffe3b6"
                />
                <path d="M185 140l20-17 20 17v21h-40Z" fill="#faf0d8" />
                <path d="M185 140h40M205 123v17" stroke="#a4784e" />
                <rect x="201" y="149" width="8" height="12" fill="#a4784e" />
                <circle cx="61" cy="61" r="4" fill="#e4b87f" />
                <circle cx="349" cy="293" r="4" fill="#e4b87f" />
                <circle cx="421" cy="61" r="4" fill="#e4b87f" />
              </g>
            </svg>
            <div className="ta-map-caption">
              <span>
                <i /> One property. A fuller picture.
              </span>
              <button
                type="button"
                aria-pressed={paused}
                onClick={() => setPaused(!paused)}
              >
                {paused ? "Play motion" : "Pause motion"}
              </button>
            </div>
          </div>
          <div className="ta-preview-bottom">
            <div className="ta-preview-tabs" aria-label="Explore the workflow">
              {views.map((item, index) => (
                <button
                  key={item.label}
                  type="button"
                  aria-pressed={step === index}
                  onClick={() => setStep(index)}
                >
                  <span>0{index + 1}</span>
                  {item.label}
                </button>
              ))}
            </div>
            <div className="ta-preview-content" aria-live="polite">
              <p className="ta-preview-tag">{view.tag}</p>
              <h2>{view.title}</h2>
              <p>{view.note}</p>
              <div className="ta-preview-rows">
                {view.rows.map((row, index) => (
                  <div key={row}>
                    <span className="ta-row-mark" aria-hidden="true">
                      {step === 2 ? String(index + 1).padStart(2, "0") : "↗"}
                    </span>
                    <span>{row}</span>
                    <span aria-hidden="true">—</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
