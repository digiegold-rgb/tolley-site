import { AnswerRenderer } from "@/components/portal/answer-renderer";
import type { AgentMessage, ListingCard } from "@/types/chat";

type ChatThreadProps = {
  messages: AgentMessage[];
  onFollowUp: (prompt: string) => void;
  onSaveListing: (listing: ListingCard) => void;
  savingListingAddress: string | null;
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

function ListingCards({
  cards,
  onSaveListing,
  savingListingAddress,
}: {
  cards: ListingCard[];
  onSaveListing: (listing: ListingCard) => void;
  savingListingAddress: string | null;
}) {
  if (!cards.length) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-3">
      {cards.map((card, index) => {
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
          className="rounded-full border border-violet-200/26 bg-violet-300/[0.06] px-3 py-1.5 text-[0.66rem] font-semibold tracking-[0.08em] text-violet-100/86 uppercase transition hover:bg-violet-300/[0.12]"
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
  savingListingAddress,
}: ChatThreadProps) {
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

      <div className="space-y-4">
        {messages.map((message) => {
          const isUser = message.role === "user";

          return (
            <article
              key={message.id}
              className={`chat-bubble rounded-2xl border p-4 sm:p-5 ${
                isUser
                  ? "chat-bubble-user ml-auto max-w-[90%] border-white/18 bg-white/[0.05]"
                  : "chat-bubble-assistant mr-auto max-w-[96%] border-violet-200/22 bg-violet-300/[0.05]"
              }`}
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[0.64rem] tracking-[0.1em] text-white/64 uppercase">
                  {isUser ? "You" : "T-Agent"}
                </p>
                {!isUser && message.requestId ? (
                  <span className="text-[0.6rem] font-mono tracking-[0.06em] text-white/48 uppercase">
                    {message.requestId.slice(0, 8)}
                  </span>
                ) : null}
              </div>

              {isUser ? (
                <p className="text-sm leading-6 text-white/92 sm:text-[0.96rem]">{message.text}</p>
              ) : (
                <>
                  <AnswerRenderer text={message.text} />
                  <ListingCards
                    cards={message.cards || []}
                    onSaveListing={onSaveListing}
                    savingListingAddress={savingListingAddress}
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
