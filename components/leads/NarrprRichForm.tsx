"use client";

import { useState } from "react";

interface Props {
  address: string;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  syncKey: string;
}

export default function NarrprRichForm({ address, city, state, zip, syncKey }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ status: string } | null>(null);

  // Mortgage fields
  const [mortLender, setMortLender] = useState("");
  const [mortAmount, setMortAmount] = useState("");
  const [mortType, setMortType] = useState("Conventional");
  const [mortDate, setMortDate] = useState("");
  const [mortRate, setMortRate] = useState("");

  // RVM fields
  const [rvmValue, setRvmValue] = useState("");
  const [rvmConfidence, setRvmConfidence] = useState("0.8");
  const [rvmLow, setRvmLow] = useState("");
  const [rvmHigh, setRvmHigh] = useState("");

  // Tapestry fields
  const [tapSegment, setTapSegment] = useState("");
  const [tapCode, setTapCode] = useState("");
  const [tapLifeMode, setTapLifeMode] = useState("");
  const [tapUrbanization, setTapUrbanization] = useState("");

  // Distress fields
  const [nodDate, setNodDate] = useState("");
  const [auctionDate, setAuctionDate] = useState("");
  const [distressStatus, setDistressStatus] = useState("");

  // Deed fields
  const [deedDate, setDeedDate] = useState("");
  const [deedPrice, setDeedPrice] = useState("");
  const [deedGrantor, setDeedGrantor] = useState("");
  const [deedGrantee, setDeedGrantee] = useState("");
  const [deedType, setDeedType] = useState("Warranty");

  async function handleSubmit() {
    setSaving(true);
    setResult(null);

    const payload: Record<string, unknown> = {
      address,
      city,
      state,
      zip,
    };

    // Build mortgage array if any field filled
    if (mortLender || mortAmount) {
      payload.mortgages = [{
        lender: mortLender,
        amount: Number(mortAmount) || 0,
        type: mortType,
        date: mortDate || new Date().toISOString().split("T")[0],
        rate: mortRate ? Number(mortRate) : undefined,
      }];
    }

    // RVM
    if (rvmValue) {
      payload.rvm = {
        value: Number(rvmValue),
        confidence: Number(rvmConfidence) || 0.8,
        date: new Date().toISOString().split("T")[0],
        low: rvmLow ? Number(rvmLow) : undefined,
        high: rvmHigh ? Number(rvmHigh) : undefined,
      };
    }

    // Tapestry
    if (tapSegment) {
      payload.tapestry = {
        segment: tapSegment,
        segmentCode: tapCode,
        lifeMode: tapLifeMode,
        urbanization: tapUrbanization,
      };
    }

    // Distress
    if (nodDate || auctionDate) {
      payload.distress = {
        nodDate: nodDate || undefined,
        auctionDate: auctionDate || undefined,
        status: distressStatus || undefined,
      };
    }

    // Deed
    if (deedDate || deedGrantor) {
      payload.deeds = [{
        date: deedDate,
        price: deedPrice ? Number(deedPrice) : null,
        grantor: deedGrantor,
        grantee: deedGrantee,
        type: deedType,
      }];
    }

    try {
      const res = await fetch("/api/leads/narrpr/rich", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-secret": syncKey,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
      } else {
        setResult({ status: `Error: ${data.error || "Failed"}` });
      }
    } catch {
      setResult({ status: "Error: Network failure" });
    } finally {
      setSaving(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-white/15 bg-black/30 px-3 py-1.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-orange-400/50";
  const labelClass = "block text-[0.65rem] font-medium text-white/40 mb-1";

  return (
    <div className="rounded-xl border border-orange-500/20 bg-orange-500/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-orange-300/80">NARRPR Data Entry</span>
          <span className="text-xs rounded-full bg-orange-500/20 text-orange-300 px-2 py-0.5">Manual</span>
        </div>
        <span className="text-white/30 text-sm">{expanded ? "−" : "+"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Mortgage */}
          <div>
            <h4 className="text-xs font-medium text-white/50 mb-2">Mortgage</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div><label className={labelClass}>Lender</label><input className={inputClass} value={mortLender} onChange={(e) => setMortLender(e.target.value)} placeholder="Wells Fargo" /></div>
              <div><label className={labelClass}>Amount</label><input className={inputClass} type="number" value={mortAmount} onChange={(e) => setMortAmount(e.target.value)} placeholder="250000" /></div>
              <div>
                <label className={labelClass}>Type</label>
                <select className={inputClass} value={mortType} onChange={(e) => setMortType(e.target.value)}>
                  <option>Conventional</option><option>FHA</option><option>VA</option><option>USDA</option><option>ARM</option><option>Other</option>
                </select>
              </div>
              <div><label className={labelClass}>Orig Date</label><input className={inputClass} type="date" value={mortDate} onChange={(e) => setMortDate(e.target.value)} /></div>
              <div><label className={labelClass}>Rate %</label><input className={inputClass} type="number" step="0.01" value={mortRate} onChange={(e) => setMortRate(e.target.value)} placeholder="6.5" /></div>
            </div>
          </div>

          {/* RVM */}
          <div>
            <h4 className="text-xs font-medium text-white/50 mb-2">RVM (Realtors Valuation Model)</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><label className={labelClass}>Value</label><input className={inputClass} type="number" value={rvmValue} onChange={(e) => setRvmValue(e.target.value)} placeholder="325000" /></div>
              <div><label className={labelClass}>Confidence</label><input className={inputClass} type="number" step="0.1" min="0" max="1" value={rvmConfidence} onChange={(e) => setRvmConfidence(e.target.value)} /></div>
              <div><label className={labelClass}>Low</label><input className={inputClass} type="number" value={rvmLow} onChange={(e) => setRvmLow(e.target.value)} placeholder="300000" /></div>
              <div><label className={labelClass}>High</label><input className={inputClass} type="number" value={rvmHigh} onChange={(e) => setRvmHigh(e.target.value)} placeholder="350000" /></div>
            </div>
          </div>

          {/* Esri Tapestry */}
          <div>
            <h4 className="text-xs font-medium text-white/50 mb-2">Esri Tapestry Demographics</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div><label className={labelClass}>Segment</label><input className={inputClass} value={tapSegment} onChange={(e) => setTapSegment(e.target.value)} placeholder="Savvy Suburbanites" /></div>
              <div><label className={labelClass}>Code</label><input className={inputClass} value={tapCode} onChange={(e) => setTapCode(e.target.value)} placeholder="1A" /></div>
              <div><label className={labelClass}>LifeMode</label><input className={inputClass} value={tapLifeMode} onChange={(e) => setTapLifeMode(e.target.value)} placeholder="Affluent Estates" /></div>
              <div><label className={labelClass}>Urbanization</label><input className={inputClass} value={tapUrbanization} onChange={(e) => setTapUrbanization(e.target.value)} placeholder="Suburban Periphery" /></div>
            </div>
          </div>

          {/* Distress */}
          <div>
            <h4 className="text-xs font-medium text-white/50 mb-2">Distress / Pre-Foreclosure</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <div><label className={labelClass}>NOD Date</label><input className={inputClass} type="date" value={nodDate} onChange={(e) => setNodDate(e.target.value)} /></div>
              <div><label className={labelClass}>Auction Date</label><input className={inputClass} type="date" value={auctionDate} onChange={(e) => setAuctionDate(e.target.value)} /></div>
              <div><label className={labelClass}>Status</label><input className={inputClass} value={distressStatus} onChange={(e) => setDistressStatus(e.target.value)} placeholder="pre_foreclosure" /></div>
            </div>
          </div>

          {/* Deed */}
          <div>
            <h4 className="text-xs font-medium text-white/50 mb-2">Deed Record</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div><label className={labelClass}>Date</label><input className={inputClass} type="date" value={deedDate} onChange={(e) => setDeedDate(e.target.value)} /></div>
              <div><label className={labelClass}>Price</label><input className={inputClass} type="number" value={deedPrice} onChange={(e) => setDeedPrice(e.target.value)} placeholder="280000" /></div>
              <div><label className={labelClass}>Grantor</label><input className={inputClass} value={deedGrantor} onChange={(e) => setDeedGrantor(e.target.value)} placeholder="Seller" /></div>
              <div><label className={labelClass}>Grantee</label><input className={inputClass} value={deedGrantee} onChange={(e) => setDeedGrantee(e.target.value)} placeholder="Buyer" /></div>
              <div>
                <label className={labelClass}>Type</label>
                <select className={inputClass} value={deedType} onChange={(e) => setDeedType(e.target.value)}>
                  <option>Warranty</option><option>Quit Claim</option><option>Trustee</option><option>Sheriff</option>
                </select>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-orange-600 px-6 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save NARRPR Data"}
            </button>
            {result && (
              <span className={`text-xs ${result.status.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                {result.status === "merged" ? "Merged into dossier" : result.status}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
