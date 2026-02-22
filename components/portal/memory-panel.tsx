import type { MemorySummary } from "@/types/chat";

type ForgetTarget = {
  key: string;
  index?: number;
};

type MemoryPanelProps = {
  visible: boolean;
  memory: MemorySummary | null;
  loading: boolean;
  errorMessage: string | null;
  onRefresh: () => void;
  onForget: (target: ForgetTarget) => void;
  onClearSession: () => void;
  onExport: () => void;
};

function formatMemoryValue(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return JSON.stringify(value);
}

export function MemoryPanel({
  visible,
  memory,
  loading,
  errorMessage,
  onRefresh,
  onForget,
  onClearSession,
  onExport,
}: MemoryPanelProps) {
  if (!visible) {
    return null;
  }

  const preferenceEntries = Object.entries(memory?.preferences || {});
  const savedListings = Array.isArray(memory?.savedListings) ? memory.savedListings : [];
  const savedVendors = Array.isArray(memory?.savedVendors) ? memory.savedVendors : [];

  return (
    <aside className="fixed top-6 left-1/2 z-50 w-[min(96vw,780px)] -translate-x-1/2 rounded-3xl border border-white/18 bg-[linear-gradient(145deg,rgba(255,255,255,0.17),rgba(138,82,228,0.1)),rgba(8,7,15,0.78)] p-5 text-white/90 shadow-[0_24px_58px_rgba(2,2,10,0.6)] backdrop-blur-2xl sm:p-6">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/14 pb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-[0.12em] text-white/92 uppercase">
            Memory
          </h2>
          <p className="mt-1 text-xs text-white/66">
            Preferences, saved listings, and saved vendors
          </p>
        </div>
        <span className="rounded-full border border-white/20 px-2 py-0.5 text-[0.62rem] tracking-[0.12em] text-white/65 uppercase">
          Cmd+M
        </span>
      </header>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRefresh}
          className="rounded-full border border-white/22 bg-white/[0.06] px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.09em] text-white/85 uppercase transition hover:bg-white/[0.1] disabled:opacity-60"
          disabled={loading}
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
        <button
          type="button"
          onClick={onExport}
          className="rounded-full border border-white/22 bg-white/[0.06] px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.09em] text-white/85 uppercase transition hover:bg-white/[0.1]"
        >
          Export JSON
        </button>
        <button
          type="button"
          onClick={onClearSession}
          className="rounded-full border border-rose-200/30 bg-rose-300/[0.06] px-3 py-1.5 text-[0.65rem] font-semibold tracking-[0.09em] text-rose-100/85 uppercase transition hover:bg-rose-300/[0.11]"
        >
          Clear Session
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-3 text-xs leading-5 text-rose-200/85">{errorMessage}</p>
      ) : null}

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <section className="rounded-2xl border border-white/14 bg-white/[0.03] p-3">
          <h3 className="text-[0.65rem] tracking-[0.1em] text-white/68 uppercase">
            Preferences
          </h3>
          <div className="mt-2 space-y-2">
            {preferenceEntries.length ? (
              preferenceEntries.map(([key, value]) => (
                <article
                  key={key}
                  className="rounded-xl border border-white/12 bg-black/20 p-2.5"
                >
                  <p className="text-[0.64rem] tracking-[0.08em] text-white/58 uppercase">{key}</p>
                  <p className="mt-1 text-xs leading-5 text-white/84">
                    {formatMemoryValue(value)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onForget({ key })}
                    className="mt-2 rounded-full border border-white/18 px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.08em] text-white/74 uppercase transition hover:bg-white/[0.08]"
                  >
                    Forget item
                  </button>
                </article>
              ))
            ) : (
              <p className="text-xs text-white/56">No preferences yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/14 bg-white/[0.03] p-3">
          <h3 className="text-[0.65rem] tracking-[0.1em] text-white/68 uppercase">
            Saved Listings
          </h3>
          <div className="mt-2 space-y-2">
            {savedListings.length ? (
              savedListings.map((listing, index) => (
                <article
                  key={`${String(listing.address || "listing")}-${index}`}
                  className="rounded-xl border border-white/12 bg-black/20 p-2.5"
                >
                  <p className="text-xs font-medium text-white/88">
                    {String(listing.address || `Listing ${index + 1}`)}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-white/66">
                    {formatMemoryValue(listing)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onForget({ key: "savedListings", index })}
                    className="mt-2 rounded-full border border-white/18 px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.08em] text-white/74 uppercase transition hover:bg-white/[0.08]"
                  >
                    Forget item
                  </button>
                </article>
              ))
            ) : (
              <p className="text-xs text-white/56">No listings saved yet.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/14 bg-white/[0.03] p-3">
          <h3 className="text-[0.65rem] tracking-[0.1em] text-white/68 uppercase">
            Saved Vendors
          </h3>
          <div className="mt-2 space-y-2">
            {savedVendors.length ? (
              savedVendors.map((vendor, index) => (
                <article
                  key={`${String(vendor.name || "vendor")}-${index}`}
                  className="rounded-xl border border-white/12 bg-black/20 p-2.5"
                >
                  <p className="text-xs font-medium text-white/88">
                    {String(vendor.name || `Vendor ${index + 1}`)}
                  </p>
                  <p className="mt-1 text-[0.7rem] text-white/66">{formatMemoryValue(vendor)}</p>
                  <button
                    type="button"
                    onClick={() => onForget({ key: "savedVendors", index })}
                    className="mt-2 rounded-full border border-white/18 px-2.5 py-1 text-[0.58rem] font-semibold tracking-[0.08em] text-white/74 uppercase transition hover:bg-white/[0.08]"
                  >
                    Forget item
                  </button>
                </article>
              ))
            ) : (
              <p className="text-xs text-white/56">No vendors saved yet.</p>
            )}
          </div>
        </section>
      </div>
    </aside>
  );
}
