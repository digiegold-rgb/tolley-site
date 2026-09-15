"use client";
import { useId, useMemo, useState } from "react";
import type { PromptChipOption } from "@/lib/gen2-prompt-chips";

export function PromptPicker({ label, ariaLabel, chips, activeId, disabled, onPick, onCustom }: {
  label: string; ariaLabel: string; chips: PromptChipOption[]; activeId: string; disabled: boolean;
  onPick: (id: string) => void; onCustom: (text: string) => void;
}) {
  const id = useId();
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");
  const matches = useMemo(() => {
    const words = search.toLowerCase().trim().split(/\s+/);
    return chips.filter(c => c.id !== "clear" && words.every(word => `${c.label} ${c.group || ""}`.toLowerCase().includes(word)));
  }, [chips, search]);
  const groups = Object.groupBy(matches, c => c.group || "Original favorites");
  const active = chips.find(c => c.id === activeId);
  return <div className="gen-prompt-picker" role="group" aria-label={ariaLabel}>
    <div className="gen-prompt-picker-heading"><label htmlFor={id}>{label}</label><span>{(chips.length - 1).toLocaleString()} options</span></div>
    <input type="search" aria-label={`Search ${label.toLowerCase()} options`} placeholder={`Search ${label.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} disabled={disabled} />
    <select id={id} aria-label={`${label} preset`} value={activeId || "custom"} disabled={disabled} onChange={e => { if (e.target.value !== "custom") onPick(e.target.value); }}>
      <option value="clear">Keep my prompt / clear preset</option>
      {!activeId && <option value="custom">Custom description in prompt</option>}
      {active && active.id !== "clear" && !matches.includes(active) && <option value={active.id}>{active.label} (selected)</option>}
      {Object.entries(groups).map(([group, options]) => <optgroup key={group} label={group}>{options!.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}</optgroup>)}
    </select>
    <div className="gen-prompt-picker-actions"><span aria-live="polite">{search ? `${matches.length} matches` : "Choose one; combine all three fields."}</span>
      <button type="button" disabled={disabled || !matches.length} onClick={() => onPick(matches[Math.floor(Math.random() * matches.length)].id)}>Surprise me</button>
      <button type="button" disabled={disabled} onClick={() => onPick("clear")}>Clear</button>
    </div>
    <details><summary>Write a custom {label.toLowerCase()}</summary><div className="gen-prompt-custom"><input value={custom} maxLength={500} disabled={disabled} onChange={e => setCustom(e.target.value)} aria-label={`Custom ${label.toLowerCase()}`} placeholder={`Describe your ${label.toLowerCase()}…`} /><button type="button" disabled={disabled || !custom.trim()} onClick={() => onCustom(custom)}>Apply custom</button></div></details>
  </div>;
}
