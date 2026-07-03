import Image from "next/image";
import { TREASURE_HAUL_FB_URL, TREASURE_HAUL_MESSENGER_URL } from "@/lib/shop";

export default function TreasureHaulHero() {
  return (
    <section
      aria-label="Ruthann's Treasure Haul"
      className="mb-6 overflow-hidden rounded-2xl border border-purple-500/30 bg-gradient-to-br from-[#1a0a2e] via-[#2a1245] to-[#180830] shadow-[0_0_28px_rgba(124,58,237,0.18)]"
    >
      <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:gap-6 sm:p-5">
        <div className="relative mx-auto h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-purple-900/40 ring-2 ring-amber-300/40 sm:mx-0 sm:h-28 sm:w-28">
          <Image
            src="/branding/ruthanns-treasure-haul/mascot.png"
            alt="Detective mascot for Ruthann's Treasure Haul"
            fill
            sizes="(min-width: 640px) 112px, 96px"
            className="object-contain"
            priority
          />
        </div>
        <div className="flex-1 text-center sm:text-left">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-amber-300/80">
            Brand hub
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">
            Ruthann&rsquo;s Treasure Haul
          </h2>
          <p className="mt-1 text-sm text-white/70">
            New finds daily · Kansas City pickup · ships nationwide. Follow on Facebook for the
            morning hunt.
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
            <a
              href={TREASURE_HAUL_FB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full bg-amber-400 px-4 py-1.5 text-xs font-semibold text-[#1a0a2e] transition hover:bg-amber-300"
            >
              Follow on Facebook
            </a>
            <a
              href={TREASURE_HAUL_MESSENGER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border border-purple-300/40 bg-purple-500/10 px-4 py-1.5 text-xs font-semibold text-purple-100 transition hover:bg-purple-500/20"
            >
              Message the Page
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
