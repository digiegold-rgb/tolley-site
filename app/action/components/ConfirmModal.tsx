"use client";

import { useEffect, useRef, useState } from "react";
import { S } from "../styles";

export type ConfirmSpec = {
  title: string;
  body?: string;
  confirmLabel?: string;
  danger?: boolean;
  /** If set, the confirm button stays disabled until the user types this exact phrase
   * (e.g. "DELETE" or an item count) — reserve for catastrophic, irreversible bulk ops. */
  confirmPhrase?: string;
  /** Omit for an info-only dialog (the confirm button just closes). */
  onConfirm?: () => void;
};

// Styled replacement for window.confirm() — non-blocking, themed, mobile-friendly,
// with an optional type-to-confirm gate for the truly destructive actions.
export function ConfirmModal({ spec, onClose }: { spec: ConfirmSpec; onClose: () => void }) {
  const [typed, setTyped] = useState("");
  const ref = useRef<HTMLButtonElement>(null);
  const gated = !!spec.confirmPhrase;
  const ready = !gated || typed.trim() === spec.confirmPhrase;
  useEffect(() => { if (!gated) ref.current?.focus(); }, [gated]);

  const go = () => { if (ready) { spec.onConfirm?.(); onClose(); } };

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.modalBox, width: "min(460px, 94vw)" }} onClick={(e) => e.stopPropagation()}
        role="alertdialog" aria-modal="true" aria-label={spec.title}>
        <div style={S.modalHead}><span style={S.modalTitle}>{spec.title}</span></div>
        {spec.body && (
          <p style={{ fontSize: 14, lineHeight: 1.5, color: "rgba(255,255,255,0.75)", whiteSpace: "pre-line", margin: "4px 0 0" }}>
            {spec.body}
          </p>
        )}
        {gated && (
          <input
            autoFocus
            value={typed}
            placeholder={`Type "${spec.confirmPhrase}" to confirm`}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") go(); if (e.key === "Escape") onClose(); }}
            style={{
              width: "100%", boxSizing: "border-box", marginTop: 12, background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, color: "white",
              fontSize: 15, padding: "10px 12px", outline: "none",
            }}
          />
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
          <button onClick={onClose} style={{ ...S.smallBtn, minHeight: 42, cursor: "pointer", background: "transparent" }}>Cancel</button>
          <button
            ref={ref}
            onClick={go}
            disabled={!ready}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
            style={{
              ...S.smallBtnPrimary, minHeight: 42, opacity: ready ? 1 : 0.45,
              cursor: ready ? "pointer" : "not-allowed",
              background: spec.danger ? "linear-gradient(90deg,#dc2626,#ef4444)" : undefined,
              color: spec.danger ? "white" : undefined,
            }}
          >
            {spec.confirmLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
