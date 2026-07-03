"use client";

import { useEffect, useRef, useState } from "react";
import { S } from "../styles";

// Small controlled text-input modal — replaces window.prompt() (which is blocking,
// unstyleable, and awkward on mobile). Enter submits, Esc cancels.
export function PromptModal({ title, placeholder, initial, submitLabel, onSubmit, onClose }: {
  title: string; placeholder?: string; initial?: string; submitLabel?: string;
  onSubmit: (value: string) => void; onClose: () => void;
}) {
  const [val, setVal] = useState(initial ?? "");
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const submit = () => { const v = val.trim(); if (v) { onSubmit(v); onClose(); } };

  return (
    <div style={S.modalBackdrop} onClick={onClose}>
      <div style={{ ...S.modalBox, width: "min(440px, 94vw)" }} onClick={(e) => e.stopPropagation()}>
        <div style={S.modalHead}>
          <span style={S.modalTitle}>{title}</span>
        </div>
        <input
          ref={ref}
          value={val}
          placeholder={placeholder}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose(); }}
          style={{
            width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.18)", borderRadius: 10, color: "white",
            fontSize: 15, padding: "12px 14px", outline: "none",
          }}
        />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
          <button onClick={onClose} style={{ ...S.smallBtn, minHeight: 42, cursor: "pointer", background: "transparent" }}>Cancel</button>
          <button onClick={submit} disabled={!val.trim()} style={{ ...S.smallBtnPrimary, minHeight: 42, opacity: val.trim() ? 1 : 0.5 }}>
            {submitLabel || "OK"}
          </button>
        </div>
      </div>
    </div>
  );
}
