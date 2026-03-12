"use client";

const PLATFORMS = [
  { id: "linkedin", label: "LinkedIn", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { id: "twitter", label: "X / Twitter", color: "bg-sky-500/20 text-sky-300 border-sky-500/30" },
  { id: "facebook", label: "Facebook", color: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30" },
  { id: "instagram", label: "Instagram", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
  { id: "youtube", label: "YouTube", color: "bg-red-500/20 text-red-300 border-red-500/30" },
  { id: "tiktok", label: "TikTok", color: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
];

export default function PlatformPicker({
  selected,
  onChange,
  multiple = false,
  availablePlatforms,
}: {
  selected: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  availablePlatforms?: string[];
}) {
  const filtered = availablePlatforms
    ? PLATFORMS.filter((p) => availablePlatforms.includes(p.id))
    : PLATFORMS;

  const isSelected = (id: string) => {
    if (Array.isArray(selected)) return selected.includes(id);
    return selected === id;
  };

  const handleClick = (id: string) => {
    if (multiple) {
      const arr = Array.isArray(selected) ? selected : [selected].filter(Boolean);
      if (arr.includes(id)) {
        onChange(arr.filter((p) => p !== id));
      } else {
        onChange([...arr, id]);
      }
    } else {
      onChange(id);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      {filtered.map((p) => (
        <button
          key={p.id}
          onClick={() => handleClick(p.id)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
            isSelected(p.id)
              ? p.color
              : "bg-white/5 text-white/30 border-white/10 hover:text-white/50"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
