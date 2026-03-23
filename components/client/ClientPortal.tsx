"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useLocation } from "./LocationDetector";
import { ClientHero, type ClientRole } from "./ClientHero";
import { MarketPulse } from "./MarketPulse";
import { MarketStats } from "./MarketStats";
import { AllSignals } from "./AllSignals";
import { DailyBriefing } from "./DailyBriefing";
import { WeatherWidget } from "./WeatherWidget";
import { ListingsSpotlight } from "./ListingsSpotlight";
import { NewsFeed } from "./NewsFeed";
import { DataExplorer } from "./DataExplorer";
import { MetroExplorer } from "./MetroExplorer";
import { LocalResources } from "./LocalResources";
import { SellerSection } from "./SellerSection";
import { BuyerSection } from "./BuyerSection";
import { SignupSection } from "./SignupSection";
import { TrustSection } from "./TrustSection";
import { SectionWrapper } from "./SectionWrapper";
import { ScrollManager } from "./three/ScrollManager";
import type { ListingData } from "./PropertyCard";
import type { NewsItem } from "./NewsCard";

const ClientScene = dynamic(() => import("./three/ClientScene"), { ssr: false });

interface SnapshotData {
  mortgage30yr: number | null;
  mortgage15yr: number | null;
  localKcHealth: number | null;
  nationalHealth: number | null;
  unemployment?: number | null;
  cpi?: number | null;
  consumerSentiment?: number | null;
  tickers?: Record<string, { price: number; change: number; changePercent: number }> | null;
  date?: string;
}

interface SignalData {
  id: string;
  signal: string;
  confidence: number;
  title: string;
  reasoning: string;
  scope: string;
  category: string;
  timeHorizon: string | null;
}

interface DigestData {
  headline: string;
  keyChanges: unknown;
  riskFactors: unknown;
  opportunities: unknown;
  date: string;
}

export function ClientPortal({
  snapshot,
  snapshots,
  signals,
  dataPoints,
  listings,
  digest,
  marketStats,
  listingsByCity,
}: {
  snapshot: SnapshotData | null;
  snapshots: SnapshotData[];
  signals: SignalData[];
  dataPoints: NewsItem[];
  listings: ListingData[];
  digest?: DigestData | null;
  marketStats?: { activeListings: number; dataPoints: number; activeSignals: number; poiCount: number; metroAreas: number };
  listingsByCity?: Record<string, number>;
}) {
  const { location, loading: locationLoading } = useLocation();
  const [role, setRole] = useState<ClientRole>("buyer");

  const topSignal = signals[0] || null;

  return (
    <ScrollManager>
      <ClientScene />
      <main style={{ minHeight: "100vh", position: "relative", zIndex: 1 }}>
        <ClientHero
          location={location}
          locationLoading={locationLoading}
          role={role}
          onRoleChange={setRole}
        />

        {/* Stats Banner */}
        {marketStats && (
          <SectionWrapper id="stats" delay="0.05s">
            <MarketStats stats={marketStats} />
          </SectionWrapper>
        )}

        {/* Weather + Market Pulse side by side */}
        <SectionWrapper id="pulse" delay="0.1s">
          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "1rem", marginBottom: "1.5rem" }}>
            <WeatherWidget />
          </div>
          <MarketPulse
            snapshot={snapshot}
            snapshots={snapshots}
            topSignal={topSignal}
          />
        </SectionWrapper>

        {/* Daily AI Briefing */}
        {digest && (
          <SectionWrapper id="briefing" delay="0.1s">
            <DailyBriefing digest={digest as { headline: string; keyChanges: { metric: string; from: number; to: number; direction: string }[]; riskFactors: { factor: string; severity: string; description: string }[]; opportunities: { opportunity: string; confidence: number; reasoning: string }[]; date: string }} />
          </SectionWrapper>
        )}

        {/* All AI Signals */}
        {signals.length > 1 && (
          <SectionWrapper id="signals" delay="0.1s">
            <AllSignals signals={signals} />
          </SectionWrapper>
        )}

        <SectionWrapper id="listings" delay="0.15s">
          <ListingsSpotlight listings={listings} city={location.city} />
        </SectionWrapper>

        {/* Metro Explorer */}
        <SectionWrapper id="metro" delay="0.1s">
          <MetroExplorer listingsByCity={listingsByCity || {}} />
        </SectionWrapper>

        <SectionWrapper id="news" delay="0.1s">
          <NewsFeed items={dataPoints} />
        </SectionWrapper>

        <SectionWrapper id="data" delay="0.1s">
          <DataExplorer
            snapshots={snapshots.map((s) => ({
              date: s.date || new Date().toISOString(),
              mortgage30yr: s.mortgage30yr ?? null,
              mortgage15yr: s.mortgage15yr ?? null,
              localKcHealth: s.localKcHealth ?? null,
              nationalHealth: s.nationalHealth ?? null,
              unemployment: s.unemployment ?? null,
              cpi: s.cpi ?? null,
              consumerSentiment: s.consumerSentiment ?? null,
              tickers: (s.tickers as Record<string, { price: number; change: number; changePercent: number }>) ?? null,
            }))}
          />
        </SectionWrapper>

        {/* Local Resources — POI Browser */}
        <SectionWrapper id="resources" delay="0.1s">
          <LocalResources />
        </SectionWrapper>

        {role === "seller" && (
          <SectionWrapper id="seller" delay="0.1s">
            <SellerSection />
          </SectionWrapper>
        )}

        {role === "buyer" && (
          <SectionWrapper id="buyer" delay="0.1s">
            <BuyerSection listings={listings} />
          </SectionWrapper>
        )}

        <SectionWrapper id="signup" delay="0.1s">
          <SignupSection />
        </SectionWrapper>

        <SectionWrapper id="trust" delay="0.1s">
          <TrustSection />
        </SectionWrapper>

        {/* Footer */}
        <footer
          style={{
            textAlign: "center",
            padding: "2rem 1rem 3rem",
            fontSize: "0.75rem",
            color: "var(--cl-text-light)",
            background: "rgba(14, 14, 18, 0.88)",
          }}
        >
          <p>
            &copy; {new Date().getFullYear()} Your KC Homes LLC &mdash; Jared
            Tolley, United Real Estate Kansas City
          </p>
          <p style={{ marginTop: "0.25rem" }}>
            Data refreshed every 5 minutes by AI agents. Not financial advice.
          </p>
        </footer>
      </main>
    </ScrollManager>
  );
}
