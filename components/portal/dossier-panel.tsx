"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DossierStatus = "ok" | "warn" | "muted";

export type DossierPanelProps = {
  address: string;
  city: string;
  status: DossierStatus;
  stats: { label: string; value: string }[];
  aiSummary: string;
  permits: {
    year: string;
    type: string;
    contractor: string;
    status: DossierStatus;
  }[];
  vendors: { name: string; tags: string[]; meta: string }[];
  comps: {
    address: string;
    beds: number;
    sqft: number;
    date: string;
    price: string;
    delta: string;
    deltaPositive: boolean;
  }[];
};

type DossierTab = "overview" | "permits" | "vendors" | "comps";

const TAB_ORDER: { id: DossierTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "permits", label: "Permits" },
  { id: "vendors", label: "Vendors" },
  { id: "comps", label: "Comps" },
];

const STATUS_STYLES: Record<DossierStatus, string> = {
  ok: "text-[#22c55e] border-[#22c55e] bg-[rgba(34,197,94,0.09)]",
  warn: "text-[#f59e0b] border-[#f59e0b] bg-[rgba(245,158,11,0.09)]",
  muted:
    "text-[rgba(195,125,255,0.85)] border-[rgba(195,125,255,0.85)] bg-[rgba(129,75,229,0.10)]",
};

const STATUS_LABEL: Record<DossierStatus, string> = {
  ok: "OK",
  warn: "Review",
  muted: "Pending",
};

function StatusPill({ status }: { status: DossierStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[4px] border px-3 py-[5px] font-mono text-[0.6rem] uppercase tracking-[0.14em] ${STATUS_STYLES[status]}`}
    >
      <span
        aria-hidden="true"
        className="inline-block h-1.5 w-1.5 rounded-full bg-current"
      />
      {STATUS_LABEL[status]}
    </span>
  );
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "?";
  }
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function DossierPanel({
  address,
  city,
  status,
  stats,
  aiSummary,
  permits,
  vendors,
  comps,
}: DossierPanelProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DossierTab>("overview");

  return (
    <div className="relative z-20 mx-auto flex w-full max-w-5xl flex-col">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/6 bg-[rgba(8,7,15,0.8)] px-5 py-5 backdrop-blur-[16px] sm:px-8">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex items-center gap-1.5 rounded-full border border-white/18 bg-white/[0.04] px-[14px] py-2 text-[0.8rem] text-white/72 transition hover:bg-white/[0.09] hover:text-white"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              className="h-[14px] w-[14px]"
            >
              <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Back
          </button>
          <div>
            <h1 className="text-[1.5rem] font-semibold text-white/94 leading-tight">
              {address}
            </h1>
            <p className="text-[0.9rem] text-white/72">{city}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusPill status={status} />
          <button
            type="button"
            className="rounded-full bg-[#f8f3ff] px-[18px] py-[9px] text-[0.8rem] font-bold text-[#2a1250] shadow-[0_6px_20px_rgba(98,45,173,0.28)] transition hover:bg-white"
          >
            Generate report
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <nav
        role="tablist"
        aria-label="Dossier sections"
        className="flex gap-[6px] border-b border-white/6 px-5 py-[14px] sm:px-8"
      >
        {TAB_ORDER.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer rounded-full px-[18px] py-2 text-[0.84rem] font-semibold transition ${
                isActive
                  ? "border border-white/16 bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]"
                  : "border border-transparent text-white/72 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <div className="flex flex-col gap-5 px-5 py-6 sm:px-8 sm:py-8">
        {activeTab === "overview" ? (
          <>
            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-[14px] sm:grid-cols-4">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col gap-[6px] rounded-[16px] border border-white/8 bg-white/3 p-4"
                >
                  <p className="font-mono text-[0.52rem] uppercase tracking-[0.16em] text-white/45">
                    {stat.label}
                  </p>
                  <p className="text-[1.2rem] font-semibold text-white">
                    {stat.value}
                  </p>
                </div>
              ))}
            </div>

            {/* AI Summary card */}
            <section className="results-panel rounded-3xl p-5 sm:p-6">
              <p className="mb-[10px] font-mono text-[0.52rem] uppercase tracking-[0.16em] text-white/45">
                T-Agent Summary
              </p>
              <p className="text-[0.92rem] leading-[1.65] text-white">
                {aiSummary}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("permits")}
                  className="action-chip rounded-full px-[15px] py-2 text-[0.84rem] font-medium text-white/92 transition hover:text-white"
                >
                  View permits
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("comps")}
                  className="action-chip rounded-full px-[15px] py-2 text-[0.84rem] font-medium text-white/92 transition hover:text-white"
                >
                  See comps
                </button>
              </div>
            </section>
          </>
        ) : null}

        {activeTab === "permits" ? (
          <div className="flex flex-col gap-3">
            {permits.length === 0 ? (
              <p className="rounded-[16px] border border-white/8 bg-white/3 px-5 py-4 text-[0.9rem] text-white/60">
                No permit history on file.
              </p>
            ) : (
              permits.map((permit, i) => (
                <div
                  key={`${permit.year}-${permit.type}-${i}`}
                  className="grid grid-cols-[60px_1fr_auto] items-center gap-4 rounded-[16px] border border-white/8 bg-white/3 px-5 py-4 sm:grid-cols-[60px_1fr_1fr_auto]"
                >
                  <span className="font-mono text-[0.72rem] font-bold text-purple-300/85">
                    {permit.year}
                  </span>
                  <span className="text-[0.95rem] font-medium text-white">
                    {permit.type}
                  </span>
                  <span className="hidden text-[0.85rem] text-white/72 sm:block">
                    {permit.contractor}
                  </span>
                  <StatusPill status={permit.status} />
                </div>
              ))
            )}
          </div>
        ) : null}

        {activeTab === "vendors" ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {vendors.length === 0 ? (
              <p className="rounded-[16px] border border-white/8 bg-white/3 px-5 py-4 text-[0.9rem] text-white/60 md:col-span-2">
                No vendors matched yet.
              </p>
            ) : (
              vendors.map((vendor, i) => (
                <article
                  key={`${vendor.name}-${i}`}
                  className="rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.05),rgba(129,75,229,0.03))] p-[18px]"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-700 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                      {getInitials(vendor.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-[0.94rem] font-semibold text-white/94">
                        {vendor.name}
                      </h4>
                      <p className="mt-0.5 truncate text-[0.76rem] text-white/72">
                        {vendor.meta}
                      </p>
                      {vendor.tags.length ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {vendor.tags.map((tag, tagIndex) => (
                            <span
                              key={`${tag}-${tagIndex}`}
                              className="rounded-[2px] border border-purple-300/20 bg-purple-300/10 px-2 py-0.5 font-mono text-[0.54rem] uppercase tracking-[0.14em] text-purple-300/85"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      className="action-chip rounded-full px-[15px] py-2 text-[0.84rem] font-medium text-white/92 transition hover:text-white"
                    >
                      Request intro
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        ) : null}

        {activeTab === "comps" ? (
          <div className="flex flex-col gap-3">
            {comps.length === 0 ? (
              <p className="rounded-[16px] border border-white/8 bg-white/3 px-5 py-4 text-[0.9rem] text-white/60">
                No recent comps available.
              </p>
            ) : (
              comps.map((comp, i) => (
                <div
                  key={`${comp.address}-${i}`}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-[16px] border border-white/8 bg-white/3 px-5 py-4 sm:grid-cols-[1fr_auto_auto_auto]"
                >
                  <div>
                    <p className="text-[0.95rem] font-medium text-white">
                      {comp.address}
                    </p>
                    <p className="mt-0.5 text-[0.76rem] text-white/62">
                      {comp.beds} bd | {comp.sqft.toLocaleString("en-US")} sqft | sold {comp.date}
                    </p>
                  </div>
                  <p className="hidden text-[1.05rem] font-semibold text-white sm:block">
                    {comp.price}
                  </p>
                  <span
                    className={`font-mono text-[0.7rem] ${
                      comp.deltaPositive ? "text-[#22c55e]" : "text-rose-300/85"
                    }`}
                  >
                    {comp.delta}
                  </span>
                  <p className="text-[1.05rem] font-semibold text-white sm:hidden">
                    {comp.price}
                  </p>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default DossierPanel;
