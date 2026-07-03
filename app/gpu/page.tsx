"use client";

import { useState } from "react";

type Gpu = {
  name: string;
  nickname: string;
  emoji: string;
  tflops: string;
  speedSimple: string;
  speedBar: number;
  imageTime: string;
  videoTime: string;
  videoTimeAlt?: string;
  released: string;
  cloudCost: string;
  cloudNote: string;
  cloudVideoCost: string;
  buyPrice: string;
  buyWhere: string;
  homeWatts: string;
  homeElectric: string;
  homeFeasible: boolean | "partial";
  homeNote: string;
  realData?: boolean;
  color: string;
  gradient: string;
  tier: string;
  available: boolean | "limited";
  vram: string;
  isSpark?: boolean;
  sparkNote?: string;
};

const gpus: Gpu[] = [
  {
    name: "Tesla T4", nickname: "The Budget Worker", emoji: "🐢",
    tflops: "65", speedSimple: "Bicycle", speedBar: 3,
    imageTime: "~8-15 min per image", videoTime: "~3.5 hrs",
    released: "Sep 2018",
    cloudCost: "$0.35–$0.50/hr", cloudNote: "GCP ~$0.35 · AWS ~$0.50", cloudVideoCost: "$1.23–$1.75",
    buyPrice: "~$1,500 (used)", buyWhere: "eBay · Amazon (refurb) · ServerSupply",
    homeWatts: "70W", homeElectric: "$0.05", homeFeasible: true,
    homeNote: "Low power — runs in any workstation",
    color: "#6b7280", gradient: "linear-gradient(135deg, #6b7280, #4b5563)",
    tier: "DATA CENTER", available: true, vram: "16 GB",
  },
  {
    name: "Tesla V100", nickname: "The OG Tensor King", emoji: "👴",
    tflops: "125", speedSimple: "Go-Kart", speedBar: 5,
    imageTime: "~5-8 min per image", videoTime: "~2.5 hrs",
    released: "Jun 2017",
    cloudCost: "$0.50–$0.74/hr", cloudNote: "GCP ~$0.74 · AWS ~$0.50", cloudVideoCost: "$1.25–$1.85",
    buyPrice: "~$2,000 (used)", buyWhere: "eBay · Amazon (refurb) · ServerSupply",
    homeWatts: "250W (PCIe)", homeElectric: "$0.11", homeFeasible: true,
    homeNote: "PCIe version fits a tower workstation",
    color: "#8b5cf6", gradient: "linear-gradient(135deg, #8b5cf6, #7c3aed)",
    tier: "DATA CENTER", available: true, vram: "32 GB",
  },
  {
    name: "RTX 5090", nickname: "The Beast You Can Actually Buy", emoji: "🎮",
    tflops: "~420", speedSimple: "Supercar", speedBar: 16,
    imageTime: "~2-2.5 min per image", videoTime: "~32 min",
    released: "Jan 2025",
    cloudCost: "$0.50–$0.83/hr", cloudNote: "Salad ~$0.50 · Vast.ai ~$0.36 · RunPod ~$0.77", cloudVideoCost: "$0.27–$0.44",
    buyPrice: "~$3,500 (street price)", buyWhere: "Best Buy · Micro Center · Amazon · Newegg",
    homeWatts: "575W", homeElectric: "$0.06", homeFeasible: true,
    homeNote: "Built for home — needs 1000W+ PSU",
    color: "#10b981", gradient: "linear-gradient(135deg, #10b981, #059669)",
    tier: "CONSUMER", available: true, vram: "32 GB",
  },
  {
    name: "DGX Spark", nickname: "Tolley Style! 🔥", emoji: "🧊",
    tflops: "~100", speedSimple: "AI Agent Factory", speedBar: 4,
    imageTime: "~5-10 min per image",
    videoTime: "~5-10 hrs",
    released: "Oct 2025",
    cloudCost: "N/A", cloudNote: "Desktop device — no cloud rental. That's the whole point.", cloudVideoCost: "N/A",
    buyPrice: "$4,699", buyWhere: "Micro Center · Best Buy · Newegg · NVIDIA Marketplace",
    homeWatts: "240W (entire system)", homeElectric: "$0.22/day always-on",
    homeFeasible: true,
    homeNote: "Fits on your desk · 128GB unified memory · Runs 20-30 AI agents 24/7 · Models up to 200B params · Sips power like a lightbulb",
    color: "#22d3ee", gradient: "linear-gradient(135deg, #22d3ee, #06b6d4, #a855f7)",
    tier: "DESKTOP AI",
    available: true, vram: "128 GB unified",
    isSpark: true,
    sparkNote: "Not built for image gen — built for running swarms of AI agents locally. 128GB unified memory means models that need 4-5 RTX 5090s fit on ONE Spark. The real flex: always-on, private, no cloud bills, no API costs.",
  },
  {
    name: "L40S", nickname: "The Hybrid Hustler", emoji: "🎨",
    tflops: "362", speedSimple: "Sports Car", speedBar: 14,
    imageTime: "~2.75 min per image", videoTime: "~36 min",
    videoTimeAlt: "90-sec video = 53 min ✅",
    released: "Aug 2023",
    cloudCost: "$0.86–$2.50/hr", cloudNote: "RunPod ~$0.86 · Nebius ~$1.55 · Modal ~$2.50", cloudVideoCost: "$0.52–$1.50",
    buyPrice: "~$7,500–$9,000", buyWhere: "BIZON · CDW · IT Creations · ServerSupply",
    homeWatts: "350W", homeElectric: "$0.04", homeFeasible: true,
    homeNote: "PCIe passive-cooled — fits a workstation, needs airflow",
    realData: true,
    color: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    tier: "DATA CENTER", available: true, vram: "48 GB",
  },
  {
    name: "A100", nickname: "The Workhorse Legend", emoji: "🐴",
    tflops: "312", speedSimple: "Muscle Car", speedBar: 12,
    imageTime: "~2-2.5 min per image", videoTime: "~30 min",
    released: "May 2020",
    cloudCost: "$1.29–$1.79/hr", cloudNote: "Jarvislabs ~$1.29 · Hyperstack ~$1.35 · RunPod ~$1.79", cloudVideoCost: "$0.65–$0.90",
    buyPrice: "~$10,000–$17,000", buyWhere: "BIZON · ALTA Technologies · Dell · eBay",
    homeWatts: "300W (PCIe)", homeElectric: "$0.03", homeFeasible: true,
    homeNote: "PCIe version works — SXM needs server chassis",
    color: "#3b82f6", gradient: "linear-gradient(135deg, #3b82f6, #2563eb)",
    tier: "DATA CENTER", available: true, vram: "80 GB",
  },
  {
    name: "H100", nickname: "The AI Superstar", emoji: "⭐",
    tflops: "990", speedSimple: "Race Car", speedBar: 38,
    imageTime: "~1-1.5 min per image", videoTime: "~18 min",
    released: "Late 2022",
    cloudCost: "$2.01–$3.47/hr", cloudNote: "Spheron ~$2.01 · Lambda ~$2.89 · GCP ~$3.00", cloudVideoCost: "$0.60–$1.04",
    buyPrice: "~$22,000–$40,000", buyWhere: "Dell · Supermicro · BIZON · ALTA Technologies",
    homeWatts: "550W PCIe / 1kW SXM (w/ system)", homeElectric: "$0.03–$0.05", homeFeasible: "partial",
    homeNote: "PCIe version possible in a beefy tower — SXM needs rack + liquid cooling",
    color: "#06b6d4", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
    tier: "DATA CENTER", available: true, vram: "80 GB",
  },
  {
    name: "H200", nickname: "The Memory Monster", emoji: "🧠",
    tflops: "990", speedSimple: "Race Car+", speedBar: 40,
    imageTime: "~50-80 sec per image", videoTime: "~14 min",
    released: "Q2 2024",
    cloudCost: "$2.50–$4.31/hr", cloudNote: "GMI ~$2.50 · Nebius ~$3.50 · RunPod ~$4.31", cloudVideoCost: "$0.58–$1.01",
    buyPrice: "~$35,000+", buyWhere: "Dell · Supermicro · Lenovo · BIZON (enterprise)",
    homeWatts: "~1,000W (GPU+system)", homeElectric: "$0.04", homeFeasible: false,
    homeNote: "SXM only — needs server rack + liquid cooling",
    color: "#ec4899", gradient: "linear-gradient(135deg, #ec4899, #db2777)",
    tier: "DATA CENTER", available: true, vram: "141 GB",
  },
  {
    name: "B200", nickname: "The Next-Gen Titan", emoji: "🚀",
    tflops: "~2,250", speedSimple: "Fighter Jet", speedBar: 65,
    imageTime: "~25-40 sec per image", videoTime: "~8 min",
    released: "2025",
    cloudCost: "$3.49–$5.99/hr", cloudNote: "Lambda ~$3.49 · RunPod ~$4.99 · Northflank ~$5.87", cloudVideoCost: "$0.47–$0.80",
    buyPrice: "$45,000–$55,000", buyWhere: "BIZON · NVIDIA DGX — backordered",
    homeWatts: "~1,400W (GPU+system)", homeElectric: "$0.03", homeFeasible: false,
    homeNote: "Liquid cooling mandatory — data center only",
    color: "#ef4444", gradient: "linear-gradient(135deg, #ef4444, #dc2626)",
    tier: "DATA CENTER", available: "limited", vram: "192 GB",
  },
  {
    name: "B300", nickname: "The Absolute Unit", emoji: "👑",
    tflops: "~3,750", speedSimple: "Rocket Ship", speedBar: 100,
    imageTime: "~15-25 sec per image", videoTime: "~5 min",
    released: "Jan 2026",
    cloudCost: "$6.80–$18.00/hr", cloudNote: "Spheron ~$6.80 · Scaleway ~$9.24 · Premium ~$18", cloudVideoCost: "$0.57–$1.50",
    buyPrice: "$300K+ (DGX B300 8-GPU)", buyWhere: "NVIDIA DGX direct · BIZON — waitlist only",
    homeWatts: "~1,900W (GPU+system)", homeElectric: "$0.03", homeFeasible: false,
    homeNote: "1.4kW GPU + cooling/CPU overhead — industrial power + liquid cooling",
    color: "#f97316", gradient: "linear-gradient(135deg, #f97316, #ea580c)",
    tier: "DATA CENTER", available: "limited", vram: "288 GB",
  },
];

export default function GPUPowerTower() {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggle = (name: string) => setExpanded(p => ({ ...p, [name]: !p[name] }));

  return (
    <div style={{
      fontFamily: "'Segoe UI', 'Helvetica Neue', sans-serif",
      background: "linear-gradient(180deg, #1a1a2e 0%, #111827 50%, #0a0a14 100%)",
      minHeight: "100vh", padding: "24px 10px 40px",
      color: "#fff", position: "relative", overflow: "hidden",
    }}>
      {[...Array(40)].map((_, i) => (
        <div key={i} style={{ position: "fixed", width: i % 4 === 0 ? 3 : 2, height: i % 4 === 0 ? 3 : 2, background: "#fff", borderRadius: "50%", top: `${(i * 31 + 7) % 100}%`, left: `${(i * 47 + 13) % 100}%`, opacity: 0.15 + (i % 6) * 0.08, animation: `twinkle ${2.5 + (i % 4)}s ease-in-out infinite`, animationDelay: `${i * 0.15}s`, pointerEvents: "none" }} />
      ))}
      <style>{`
        @keyframes twinkle { 0%, 100% { opacity: 0.1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.6); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes barGrow { from { width: 0%; } }
        @keyframes sparkGlow { 0%, 100% { box-shadow: 0 0 15px rgba(34,211,238,0.3), 0 0 30px rgba(168,85,247,0.15); } 50% { box-shadow: 0 0 25px rgba(34,211,238,0.5), 0 0 50px rgba(168,85,247,0.3); } }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 6, position: "relative", zIndex: 2, animation: "slideUp 0.5s ease-out" }}>
        <div style={{ fontSize: 44, marginBottom: 2 }}>⚡</div>
        <h1 style={{ fontSize: 30, fontWeight: 900, margin: 0, background: "linear-gradient(90deg, #6b7280, #8b5cf6, #10b981, #22d3ee, #f59e0b, #3b82f6, #06b6d4, #ec4899, #ef4444, #f97316)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: -1 }}>GPU POWER TOWER</h1>
        <p style={{ fontSize: 14, color: "#94a3b8", margin: "6px 0 2px 0", fontWeight: 600 }}>Starts small — scroll down and watch it get INSANE ⬇️</p>
        <p style={{ fontSize: 10, color: "#475569", margin: "2px 0 0 0", lineHeight: 1.5 }}>
          All speeds: FP16 Tensor TFLOPS (dense) · L40S tested: 90-sec video in 53 min on Modal<br/>
          ⚡ Electric: $0.18/kWh (Kansas) · Cloud prices: on-demand only, no spot/lottery pricing
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 540, margin: "16px auto 0", position: "relative", zIndex: 2 }}>
        {gpus.map((gpu, i) => {
          const isLimited = gpu.available === "limited";
          const isConsumer = gpu.tier === "CONSUMER";
          const isSpark = gpu.isSpark;
          const rank = gpus.length - i;
          const canRunHome = gpu.homeFeasible === true;
          const maybeHome = gpu.homeFeasible === "partial";
          const isOpen = expanded[gpu.name];
          return (
            <div key={gpu.name} style={{
              background: isSpark ? "rgba(34,211,238,0.06)" : isConsumer ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.03)",
              border: `2px solid ${isSpark ? "rgba(34,211,238,0.5)" : isConsumer ? "rgba(16,185,129,0.4)" : gpu.color + "33"}`,
              borderRadius: 18, padding: isSpark ? "16px 16px 18px" : "14px 16px 16px",
              position: "relative", overflow: "hidden",
              animation: isSpark ? "sparkGlow 3s ease-in-out infinite" : `slideUp ${0.3 + i * 0.07}s ease-out`,
            }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: isSpark ? 4 : 3, background: gpu.gradient, borderRadius: "18px 18px 0 0" }} />
              <div style={{ position: "absolute", top: 10, left: 14, fontSize: 11, fontWeight: 800, color: gpu.color, opacity: 0.5 }}>#{rank}</div>
              <div style={{ display: "flex", gap: 6, position: "absolute", top: 10, right: 12, flexWrap: "wrap", justifyContent: "flex-end" }}>
                {gpu.realData && <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(16,185,129,0.15)", color: "#10b981", padding: "2px 7px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.25)" }}>✅ TESTED</span>}
                {isSpark && <span style={{ fontSize: 9, fontWeight: 700, background: "linear-gradient(90deg, rgba(34,211,238,0.2), rgba(168,85,247,0.2))", color: "#22d3ee", padding: "2px 7px", borderRadius: 6, border: "1px solid rgba(34,211,238,0.35)" }}>🔥 TOLLEY STYLE</span>}
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.8, color: isSpark ? "#22d3ee" : isConsumer ? "#10b981" : "#64748b", textTransform: "uppercase", background: isSpark ? "rgba(34,211,238,0.12)" : isConsumer ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)", padding: "2px 7px", borderRadius: 6 }}>{gpu.tier}</span>
                {isLimited && <span style={{ fontSize: 9, fontWeight: 700, background: "rgba(239,68,68,0.15)", color: "#ef4444", padding: "2px 7px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.25)" }}>⚠️ WAITLIST</span>}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, marginTop: 2, marginLeft: 28 }}>
                <span style={{ fontSize: 30 }}>{gpu.emoji}</span>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: gpu.color, lineHeight: 1.1 }}>{gpu.name}</div>
                  <div style={{ fontSize: 11, color: isSpark ? "#22d3ee" : "#94a3b8", fontWeight: 600, fontStyle: "italic" }}>&quot;{gpu.nickname}&quot;</div>
                </div>
              </div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: "#e2e8f0", fontWeight: 700 }}>⚡ {gpu.speedSimple}</span>
                  <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600 }}>{gpu.tflops} TFLOPS · {gpu.vram}</span>
                </div>
                <div style={{ height: 12, background: "rgba(255,255,255,0.06)", borderRadius: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${gpu.speedBar}%`, background: gpu.gradient, borderRadius: 8, boxShadow: `0 0 14px ${gpu.color}55`, animation: `barGrow 1.2s ease-out` }} />
                </div>
              </div>

              {isSpark && gpu.sparkNote && (
                <div style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.15)", borderRadius: 11, padding: "10px 12px", marginBottom: 8, fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>
                  <span style={{ color: "#22d3ee", fontWeight: 700 }}>💡 Why it&apos;s different:</span> {gpu.sparkNote}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div style={{
                  background: gpu.realData ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.05)",
                  border: gpu.realData ? "1px solid rgba(16,185,129,0.2)" : "none",
                  borderRadius: 11, padding: "10px 12px", gridColumn: "1 / -1",
                }}>
                  <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 }}>
                    🎬 {gpu.realData ? "Per Image (REAL TEST)" : isSpark ? "Per Image (not its strength)" : "Per Image (estimated)"}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>{gpu.imageTime}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: gpu.color }}>60-sec video ≈ {gpu.videoTime}</div>
                  </div>
                  {gpu.videoTimeAlt && <div style={{ fontSize: 10, color: "#10b981", fontWeight: 600, marginTop: 3 }}>{gpu.videoTimeAlt}</div>}
                </div>

                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 11, padding: "10px 12px" }}>
                  <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>📅 Released</div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{gpu.released}</div>
                </div>
                <div style={{
                  background: isSpark ? "rgba(34,211,238,0.08)" : isConsumer ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.05)",
                  borderRadius: 11, padding: "10px 12px",
                  border: isSpark ? "1px solid rgba(34,211,238,0.2)" : isConsumer ? "1px solid rgba(16,185,129,0.25)" : "none",
                }}>
                  <div style={{ fontSize: 9, color: "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 }}>💰 Buy It</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: isSpark ? "#22d3ee" : isConsumer ? "#10b981" : "#fff", lineHeight: 1.2 }}>{gpu.buyPrice}</div>
                  <div style={{ fontSize: 9, color: isSpark ? "#22d3ee" : isConsumer ? "#10b981" : "#94a3b8", marginTop: 2, lineHeight: 1.4 }}>🛒 {gpu.buyWhere}</div>
                  {isLimited && <div style={{ fontSize: 9, color: "#ef4444", fontWeight: 600, marginTop: 2 }}>🚫 Backordered mid-2026</div>}
                </div>

                <div onClick={() => toggle(gpu.name)} style={{
                  gridColumn: "1 / -1", background: isOpen ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 0",
                  textAlign: "center", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#94a3b8", transition: "all 0.2s ease",
                }}>
                  {isOpen ? "▲ Less" : `▼ Cloud & Home Costs`}
                </div>

                {isOpen && (
                  <>
                    <div style={{
                      background: isSpark ? "rgba(255,255,255,0.03)" : "rgba(6,182,212,0.06)",
                      border: `1px solid ${isSpark ? "rgba(255,255,255,0.08)" : "rgba(6,182,212,0.15)"}`,
                      borderRadius: 11, padding: "10px 12px", gridColumn: "1 / -1",
                    }}>
                      <div style={{ fontSize: 9, color: isSpark ? "#64748b" : "#06b6d4", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>☁️ {isSpark ? "Cloud Rental" : "Rent in the Cloud"}</div>
                      {isSpark ? (
                        <div style={{ fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 700, color: "#22d3ee" }}>Not available for rent</span> — it&apos;s a $4,699 desktop you own. No hourly bills, no API costs, no data leaving your house. That&apos;s the point.
                        </div>
                      ) : (
                        <>
                          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>{gpu.cloudCost}</div>
                          <div style={{ fontSize: 9, color: "#64748b", marginTop: 2, lineHeight: 1.4 }}>{gpu.cloudNote}</div>
                          <div style={{ marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#06b6d4" }}>🎬 60-sec video in {gpu.videoTime}</span>
                              <span style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{gpu.cloudVideoCost}</span>
                            </div>
                            <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>💡 Want faster? Rent multiple GPUs and split images in parallel</div>
                          </div>
                        </>
                      )}
                    </div>

                    <div style={{
                      background: isSpark ? "rgba(34,211,238,0.06)" : canRunHome ? "rgba(168,85,247,0.06)" : maybeHome ? "rgba(168,85,247,0.04)" : "rgba(255,255,255,0.02)",
                      border: `1px solid ${isSpark ? "rgba(34,211,238,0.2)" : canRunHome ? "rgba(168,85,247,0.2)" : maybeHome ? "rgba(168,85,247,0.12)" : "rgba(255,255,255,0.06)"}`,
                      borderRadius: 11, padding: "10px 12px", gridColumn: "1 / -1",
                      opacity: (!canRunHome && !maybeHome) ? 0.6 : 1,
                    }}>
                      <div style={{ fontSize: 9, color: isSpark ? "#22d3ee" : canRunHome ? "#a855f7" : "#64748b", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>
                        🏠 {isSpark ? "Run at Home (THIS IS THE WAY)" : canRunHome ? "Run at Home" : maybeHome ? "Run at Home (POSSIBLE)" : "Run at Home (NOT PRACTICAL)"}
                      </div>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "baseline" }}>
                        <div>
                          <div style={{ fontSize: 9, color: "#64748b", marginBottom: 1 }}>⏱️ {isSpark ? "Always On" : "Same Time"}</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{isSpark ? "24/7" : gpu.videoTime}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "#64748b", marginBottom: 1 }}>⚡ Power</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{gpu.homeWatts}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: 9, color: "#64748b", marginBottom: 1 }}>💡 Electric</div>
                          <div style={{ fontSize: 15, fontWeight: 800, color: isSpark ? "#22d3ee" : canRunHome ? "#a855f7" : "#fff" }}>{gpu.homeElectric}</div>
                        </div>
                      </div>
                      <div style={{ fontSize: 9, color: "#64748b", marginTop: 4, lineHeight: 1.4 }}>{gpu.homeNote}</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}

        <div style={{ textAlign: "center", padding: "20px 16px", background: "linear-gradient(135deg, rgba(249,115,22,0.1), rgba(34,211,238,0.05), rgba(239,68,68,0.1))", border: "2px solid rgba(249,115,22,0.25)", borderRadius: 18 }}>
          <div style={{ fontSize: 36, marginBottom: 6 }}>🤯</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#f97316", marginBottom: 8 }}>The Real Math</div>
          <div style={{ fontSize: 13, color: "#94a3b8", lineHeight: 1.8, textAlign: "left", maxWidth: 440, margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span>🎮 <span style={{ color: "#10b981", fontWeight: 700 }}>5090 at home</span></span>
              <span><span style={{ fontWeight: 800, color: "#fff" }}>32 min</span> · <span style={{ color: "#a855f7", fontWeight: 700 }}>$0.06 electric</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span>☁️ <span style={{ color: "#06b6d4", fontWeight: 700 }}>L40S on Modal</span></span>
              <span><span style={{ fontWeight: 800, color: "#fff" }}>53 min</span> · <span style={{ color: "#06b6d4", fontWeight: 700 }}>~$2.21 ✅</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <span>👑 <span style={{ color: "#f97316", fontWeight: 700 }}>B300 in cloud</span></span>
              <span><span style={{ fontWeight: 800, color: "#fff" }}>~5 min</span> · <span style={{ color: "#f97316", fontWeight: 700 }}>$0.57–$1.50</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", background: "rgba(34,211,238,0.05)", borderRadius: 6, paddingLeft: 6, paddingRight: 6 }}>
              <span>🧊 <span style={{ color: "#22d3ee", fontWeight: 700 }}>DGX Spark 24/7</span></span>
              <span><span style={{ fontWeight: 800, color: "#fff" }}>Always on</span> · <span style={{ color: "#22d3ee", fontWeight: 700 }}>$1.04/day electric</span></span>
            </div>
          </div>
          <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)", borderRadius: 10, display: "inline-block" }}>
            <span style={{ color: "#22d3ee", fontWeight: 800, fontSize: 13 }}>The Spark runs 30 AI agents 24/7 for $1.04/day in electricity.<br/>That&apos;s $31/month. No cloud bills. No API keys. Tolley Style. 🔥</span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 540, margin: "24px auto 0", position: "relative", zIndex: 2 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: 16, fontSize: 12, color: "#94a3b8", lineHeight: 1.7, textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: 13, color: "#e2e8f0", marginBottom: 6 }}>🗝️ Quick Cheat Sheet</div>
          📊 All TFLOPS = FP16 Tensor (dense) — fair comparison<br/>
          🎮 <span style={{ color: "#10b981", fontWeight: 700 }}>Green</span> = buy at a store · 🧊 <span style={{ color: "#22d3ee", fontWeight: 700 }}>Cyan</span> = DGX Spark (Tolley&apos;s setup)<br />
          ☁️ <span style={{ color: "#06b6d4", fontWeight: 700 }}>Blue</span> = cloud rental + video cost · 🏠 <span style={{ color: "#a855f7", fontWeight: 700 }}>Purple</span> = home run cost<br />
          ✅ TESTED = real benchmark · ⚠️ WAITLIST = backordered
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: "#475569", textAlign: "center", lineHeight: 1.5 }}>
          Cloud prices April 2026 on-demand · L40S: Modal benchmark · Electric: $0.18/kWh<br/>
          DGX Spark: 240W system · GB10 Grace Blackwell · 128GB unified · $4,699 at Micro Center
        </div>
      </div>
    </div>
  );
}
