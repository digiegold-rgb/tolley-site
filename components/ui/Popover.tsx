"use client";

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
} from "react";

/**
 * Anchored floating panel. Closes on outside click and Escape.
 * Pure JS positioning — no @floating-ui dep.
 *
 *   <Popover trigger={<button>Menu</button>}>
 *     <div>panel contents</div>
 *   </Popover>
 */
export function Popover({
  trigger,
  children,
  align = "start",
  side = "bottom",
  className = "",
  contentClassName = "",
}: {
  trigger: ReactNode;
  children: ReactNode | ((close: () => void) => ReactNode);
  align?: "start" | "center" | "end";
  side?: "top" | "bottom";
  className?: string;
  contentClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: globalThis.MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const alignClass = {
    start: "left-0",
    center: "left-1/2 -translate-x-1/2",
    end: "right-0",
  }[align];

  const sideClass = side === "top" ? "bottom-full mb-1" : "top-full mt-1";

  return (
    <div ref={wrapperRef} className={`relative inline-block ${className}`}>
      <div
        onClick={(e: MouseEvent) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
      >
        {trigger}
      </div>
      {open && (
        <div
          className={`absolute z-40 ${sideClass} ${alignClass} min-w-[12rem] rounded-xl border border-white/10 bg-[#0b0a12]/95 p-1 shadow-2xl backdrop-blur ${contentClassName}`}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export default Popover;
