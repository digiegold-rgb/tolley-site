"use client";

interface Props {
  mortgage30yr: number | null;
  mortgage15yr: number | null;
  treasury10yr: number | null;
  treasury30yr: number | null;
}

function RateCard({ label, value, suffix = "%" }: { label: string; value: number | null; suffix?: string }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/5 p-3">
      <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">{label}</div>
      <div className="text-lg font-bold text-white">
        {value !== null ? `${value.toFixed(2)}${suffix}` : "—"}
      </div>
    </div>
  );
}

export default function RateTracker({ mortgage30yr, mortgage15yr, treasury10yr, treasury30yr }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <RateCard label="30yr Mortgage" value={mortgage30yr} />
      <RateCard label="15yr Mortgage" value={mortgage15yr} />
      <RateCard label="10yr Treasury" value={treasury10yr} />
      <RateCard label="30yr Treasury" value={treasury30yr} />
    </div>
  );
}
