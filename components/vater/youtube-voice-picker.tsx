"use client";

import { ELEVENLABS_VOICES } from "@/lib/vater/youtube-types";

interface Props {
  selectedVoiceId: string | null;
  onSelect: (voiceId: string, voiceName: string) => void;
}

const genderIcon: Record<string, string> = {
  male: "♂",
  female: "♀",
  neutral: "◎",
};

export function YouTubeVoicePicker({ selectedVoiceId, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {ELEVENLABS_VOICES.map((voice) => {
        const isSelected = voice.id === selectedVoiceId;
        return (
          <button
            key={voice.id}
            onClick={() => onSelect(voice.id, voice.name)}
            className={`rounded-lg border p-3 text-left transition-all ${
              isSelected
                ? "border-sky-400 bg-sky-400/15 shadow-[0_0_10px_rgba(56,189,248,0.15)]"
                : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-600"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs opacity-60">
                {genderIcon[voice.gender] || ""}
              </span>
              <span
                className={`text-sm font-semibold ${
                  isSelected ? "text-sky-400" : "text-zinc-300"
                }`}
              >
                {voice.name}
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              {voice.accent}
            </p>
          </button>
        );
      })}
    </div>
  );
}
