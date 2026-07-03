"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Right-side slide-over panel. Used for lead detail in the Pipeline kanban,
 * contact detail in People, etc. Closes on backdrop click or Escape.
 *
 *   <Drawer open={open} onClose={...} title="Lead detail">
 *     ...
 *   </Drawer>
 */
export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  side = "right",
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  side?: "right" | "left";
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  const sideClass = side === "right" ? "right-0" : "left-0";
  const enterAnim =
    side === "right" ? "animate-[slide-in-right_.2s_ease-out]" : "animate-[slide-in-left_.2s_ease-out]";

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
    >
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className={`absolute top-0 ${sideClass} flex h-full w-full ${sizeClass} flex-col border-l border-white/10 bg-[#0b0a12] text-white shadow-2xl ${enterAnim} ${className}`}
      >
        {title && (
          <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
            <h2 className="text-sm font-medium text-white/90">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-md p-1 text-white/40 hover:bg-white/5 hover:text-white/80"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <div className="border-t border-white/10 px-5 py-3">{footer}</div>
        )}
      </div>
      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slide-in-left {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

export default Drawer;
