"use client";

/**
 * MoneyConfirmModal — the one gate in front of every paid click in the
 * legacy scene editor (per-scene animate, regenerate image, batch animate,
 * final render). Nothing that can bill may POST without going through this.
 *
 * Shows: what will happen, the LIST PRICE (never our compute cost), the
 * count, and — for unmetered studio accounts — that no card is charged plus
 * the rough real cost so the house still sees what it burns.
 *
 * Portalled to <body> (glass panels re-base position:fixed) and never a
 * native confirm() (blocks the event loop + automation).
 */
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { formatPrice } from "@/lib/vater/pricing";

export type MoneyConfirmRequest = {
  title: string;
  /** Plain-English lines explaining what the click does. */
  lines: string[];
  /** List price per unit, cents. */
  unitCents: number;
  unitLabel: string; // "clip" | "image" | "render"
  count: number;
  /** Our rough real cost per unit (cents) — shown only to unmetered accounts. */
  estCostCents?: number;
  confirmLabel?: string;
  onConfirm: () => void;
};

export type BillingMode = {
  loaded: boolean;
  unmetered: boolean;
  isTrial: boolean;
};

/** One fetch per editor mount. Falls back to "metered" if the call fails —
 *  over-warning beats under-warning about money. */
export function useBillingMode(): BillingMode {
  const [mode, setMode] = useState<BillingMode>({
    loaded: false,
    unmetered: false,
    isTrial: false,
  });
  useEffect(() => {
    let alive = true;
    fetch("/api/vater/billing/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive || !d) return;
        setMode({
          loaded: true,
          unmetered: d.unmetered === true,
          isTrial: d.isTrial === true,
        });
      })
      .catch(() => {
        if (alive) setMode((m) => ({ ...m, loaded: true }));
      });
    return () => {
      alive = false;
    };
  }, []);
  return mode;
}

export function MoneyConfirmModal({
  request,
  billing,
  onClose,
}: {
  request: MoneyConfirmRequest | null;
  billing: BillingMode;
  onClose: () => void;
}) {
  if (!request || typeof document === "undefined") return null;
  const total = request.unitCents * request.count;
  const plural = request.count === 1 ? "" : "s";
  const estTotal =
    typeof request.estCostCents === "number"
      ? request.estCostCents * request.count
      : null;
  const confirmLabel =
    request.confirmLabel ??
    (billing.unmetered
      ? `Confirm — no charge (≈ ${estTotal !== null ? formatPrice(estTotal) : "$0"} compute)`
      : `Confirm — ${formatPrice(total)}`);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={request.title}
    >
      <div
        className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-100">{request.title}</h3>
        <div className="mt-3 space-y-2">
          {request.lines.map((line, i) => (
            <p key={i} className="text-xs leading-relaxed text-zinc-400">
              {line}
            </p>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
          {billing.unmetered ? (
            <>
              <p className="text-sm font-semibold text-amber-300">
                Studio account — nothing charged to a card.
                {estTotal !== null
                  ? ` Real compute cost ≈ ${formatPrice(estTotal)}`
                  : ""}
                {estTotal !== null && request.count > 1
                  ? ` (${request.count} × ${formatPrice(request.estCostCents ?? 0)})`
                  : ""}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                A paying customer would see {request.count} {request.unitLabel}
                {plural} × {formatPrice(request.unitCents)} = {formatPrice(total)}.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold text-zinc-100">
                {request.count} {request.unitLabel}
                {plural} × {formatPrice(request.unitCents)} = {formatPrice(total)}
              </p>
              <p className="mt-1 text-[11px] text-zinc-500">
                Charged to your card only after each {request.unitLabel} succeeds —
                failures are never charged.
              </p>
            </>
          )}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-zinc-800 px-4 py-2 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              const action = request.onConfirm;
              onClose();
              action();
            }}
            className="rounded-lg bg-amber-500/20 px-4 py-2 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-500/30"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
