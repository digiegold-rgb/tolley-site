"use client";

interface Props {
  unemployment: number | null;
  cpi: number | null;
  consumerSentiment: number | null;
  housingStarts: number | null;
}

function IndicatorCard({ label, value, format }: { label: string; value: number | null; format: (v: number) => string }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-3">
      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-lg font-bold text-white">
        {value !== null ? format(value) : "—"}
      </div>
    </div>
  );
}

export default function EconomicIndicators({ unemployment, cpi, consumerSentiment, housingStarts }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <IndicatorCard label="Unemployment" value={unemployment} format={(v) => `${v.toFixed(1)}%`} />
      <IndicatorCard label="CPI" value={cpi} format={(v) => v.toFixed(1)} />
      <IndicatorCard label="Consumer Sentiment" value={consumerSentiment} format={(v) => v.toFixed(1)} />
      <IndicatorCard label="Housing Starts (K)" value={housingStarts} format={(v) => (v / 1000).toFixed(0) + "K"} />
    </div>
  );
}
