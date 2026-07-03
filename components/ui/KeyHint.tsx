import type { ReactNode } from "react";

/**
 * Small <kbd>-styled chip used in command palette items, menus, and tooltips
 * to show keyboard shortcuts. Accepts multiple keys (renders them joined with
 * a subtle "+" separator).
 *
 *   <KeyHint keys={["Cmd", "K"]} />
 *   <KeyHint>Esc</KeyHint>
 */
export function KeyHint({
  keys,
  children,
  className = "",
}: {
  keys?: string[];
  children?: ReactNode;
  className?: string;
}) {
  const items = keys ?? (children ? [String(children)] : []);
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      {items.map((k, i) => (
        <span key={i} className="inline-flex items-center">
          {i > 0 && <span className="mx-0.5 text-white/20">+</span>}
          <kbd className="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 text-[10px] font-medium text-white/60 shadow-[inset_0_-1px_0_rgba(255,255,255,0.05)]">
            {k}
          </kbd>
        </span>
      ))}
    </span>
  );
}

export default KeyHint;
