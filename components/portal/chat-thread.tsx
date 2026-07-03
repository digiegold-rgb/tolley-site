"use client";

import { useRouter } from "next/navigation";

import { AnswerRenderer } from "@/components/portal/answer-renderer";
import type { AgentMessage, ListingCard } from "@/types/chat";

type ChatThreadProps = {
  messages: AgentMessage[];
  onFollowUp: (prompt: string) => void;
  onSaveListing: (listing: ListingCard) => void;
  onSaveResult: (messageId: string) => void;
  savingListingAddress: string | null;
  savingResultMessageId: string | null;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-US");

function formatPrice(price?: number | null) {
  if (typeof price !== "number" || !Number.isFinite(price)) {
    return "Price on request";
  }

  return currencyFormatter.format(price);
}

function formatHomeStats(card: ListingCard) {
  const parts: string[] = [];
  if (typeof card.beds === "number") {
    parts.push(`${card.beds} bd`);
  }
  if (typeof card.baths === "number") {
    parts.push(`${card.baths} ba`);
  }
  if (typeof card.sqft === "number") {
    parts.push(`${numberFormatter.format(card.sqft)} sqft`);
  }
  return parts.join(" | ");
}

function isSafeUrl(link?: string) {
  if (!link) {
    return false;
  }

  return /^https?:\/\//i.test(link);
}

function toSlug(value: string) {
  return encodeURIComponent(value.trim().replace(/\s+/g, "-").toLowerCase());
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

function VendorCard({
  card,
  onRequestIntro,
  onSeeDossier,
}: {
  card: ListingCard;
  onRequestIntro: (card: ListingCard) => void;
  onSeeDossier: (card: ListingCard) => void;
}) {
  const displayName = card.name || card.address || "Vendor";
  const meta = card.meta || card.source || "";
  const tags = Array.isArray(card.tags) && card.tags.length
    ? card.tags
    : Array.isArray(card.summaryBullets)
      ? card.summaryBullets.slice(0, 3)
      : [];

  return (
    <article className="rounded-2xl border border-white/10 bg-[linear-gradient(160deg,rgba(255,255,255,0.05),rgba(129,75,229,0.03))] p-4 sm:p-[18px]">
      <div className="flex items-start gap-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-purple-700 text-sm font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
          {getInitials(displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[0.94rem] font-semibold text-white/94">
            {displayName}
          </h4>
          {meta ? (
            <p className="mt-0.5 truncate text-[0.76rem] text-white/72">
              {meta}
            </p>
          ) : null}
          {tags.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag, tagIndex) => (
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
          onClick={() => onRequestIntro(card)}
          className="action-chip rounded-full px-[15px] py-2 text-[0.84rem] font-medium text-white/92 transition hover:text-white"
        >
          Request intro
        </button>
        <button
          type="button"
          onClick={() => onSeeDossier(card)}
          className="action-chip rounded-full px-[15px] py-2 text-[0.84rem] font-medium text-white/92 transition hover:text-white"
        >
          See dossier
        </button>
      </div>
    </article>
  );
}

function ListingCards({
  cards,
  onSaveListing,
  savingListingAddress,
  onSeeDossier,
}: {
  cards: ListingCard[];
  onSaveListing: (listing: ListingCard) => void;
  savingListingAddress: string | null;
  onSeeDossier: (card: ListingCard) => void;
}) {
  if (!cards.length) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3">
      {cards.map((card, index) => {
        if (card.type === "vendor") {
          return (
            <VendorCard
              key={`vendor-${card.name || card.address}-${index}`}
              card={card}
              onRequestIntro={(c) => onSaveListing(c)}
              onSeeDossier={onSeeDossier}
            />
          );
        }

        const stats = formatHomeStats(card);
        const address = card.address || `Listing ${index + 1}`;
        const isSaving = savingListingAddress === address;

        return (
          <article
            key={`${address}-${index}`}
            className="rounded-2xl border border-white/14 bg-white/[0.03] p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h4 className="text-sm font-semibold text-white/93 sm:text-[0.97rem]">
                  {address}
                </h4>
                <p className="mt-1 text-sm font-medium text-violet-100/90">
                  {formatPrice(card.price)}
                </p>
                {stats ? (
                  <p className="mt-1 text-xs tracking-[0.08em] text-white/62 uppercase">
                    {stats}
                  </p>
                ) : null}
              </div>
              <span className="rounded-full border border-white/16 px-2.5 py-1 text-[0.62rem] tracking-[0.11em] text-white/68 uppercase">
                {card.source || "listing"}
              </span>
            </div>

            {card.summaryBullets?.length ? (
              <ul className="mt-3 space-y-1.5 text-sm text-white/78">
                {card.summaryBullets.map((bullet, bulletIndex) => (
                  <li key={`${bullet}-${bulletIndex}`} className="flex gap-2.5">
                    <span className="mt-[0.55rem] h-1.5 w-1.5 shrink-0 rounded-full bg-violet-200/75" />
                    <span>{bullet}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onSaveListing(card)}
                className="rounded-full border border-white/18 bg-white/[0.04] px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.09em] text-white/82 uppercase transition hover:bg-white/[0.09] disabled:opacity-60"
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => onSeeDossier(card)}
                className="action-chip rounded-full px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.09em] text-white/82 uppercase transition hover:text-white"
              >
                See dossier
              </button>
              {isSafeUrl(card.link) ? (
                <a
                  href={card.link}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-white/18 bg-white/[0.04] px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.09em] text-white/82 uppercase transition hover:bg-white/[0.09]"
                >
                  View Source
                </a>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function FollowUpChips({
  followUps,
  onFollowUp,
}: {
  followUps?: string[];
  onFollowUp: (prompt: string) => void;
}) {
  if (!followUps?.length) {
    return null;
  }

  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {followUps.map((followUp) => (
        <button
          key={followUp}
          type="button"
          onClick={() => onFollowUp(followUp)}
          className="action-chip rounded-full px-[15px] py-2 text-[0.84rem] font-medium text-white/92 transition hover:text-white"
        >
          {followUp}
        </button>
      ))}
    </div>
  );
}

export function ChatThread({
  messages,
  onFollowUp,
  onSaveListing,
  onSaveResult,
  savingListingAddress,
  savingResultMessageId,
}: ChatThreadProps) {
  const router = useRouter();

  const handleSeeDossier = (card: ListingCard) => {
    const target = card.address || card.name;
    if (!target) {
      return;
    }
    router.push(`/leads/dossier/property/${toSlug(target)}`);
  };

  return (
    <section className="results-panel mt-7 w-full rounded-3xl p-4 sm:mt-8 sm:p-6">
      <header className="mb-4 flex items-center justify-between border-b border-white/14 pb-4">
        <p className="text-[0.69rem] tracking-[0.26em] text-violet-100/82 uppercase">
          T-Agent Conversation
        </p>
        <span className="text-[0.62rem] tracking-[0.1em] text-white/58 uppercase">
          {messages.length} messages
        </span>
      </header>

      <div className="flex flex-col gap-4">
        {messages.map((message) => {
          const isUser = message.role === "user";

          return (
            <article
              key={message.id}
              className={
                isUser
                  ? "chat-bubble chat-bubble-user ml-auto max-w-[72%] rounded-3xl border border-white/14 bg-[linear-gradient(150deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))] px-[17px] py-[13px]"
                  : "chat-bubble chat-bubble-assistant mr-auto max-w-[72%] rounded-3xl border border-purple-300/22 bg-[linear-gradient(160deg,rgba(129,75,229,0.18),rgba(57,27,103,0.14))] px-[17px] py-[13px]"
              }
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[0.64rem] tracking-[0.1em] text-white/64 uppercase">
                  {isUser ? "You" : "T-Agent"}
                </p>
                {!isUser ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onSaveResult(message.id)}
                      disabled={savingResultMessageId === message.id}
                      className="rounded-full border border-white/18 bg-white/[0.04] px-2.5 py-1 text-[0.56rem] font-semibold tracking-[0.09em] text-white/82 uppercase transition hover:bg-white/[0.09] disabled:opacity-60"
                    >
                      {savingResultMessageId === message.id ? "Saving..." : "Save Result"}
                    </button>
                    {message.requestId ? (
                      <span className="text-[0.6rem] font-mono tracking-[0.06em] text-white/48 uppercase">
                        {message.requestId.slice(0, 8)}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {isUser ? (
                <p className="text-[0.9rem] leading-[1.58] text-white/92 sm:text-[0.94rem]">
                  {message.text}
                </p>
              ) : (
                <>
                  <AnswerRenderer text={message.text} />
                  <ListingCards
                    cards={message.cards || []}
                    onSaveListing={onSaveListing}
                    savingListingAddress={savingListingAddress}
                    onSeeDossier={handleSeeDossier}
                  />
                  <FollowUpChips followUps={message.followUps} onFollowUp={onFollowUp} />
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
