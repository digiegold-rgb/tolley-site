"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Centered modal dialog. Uses the platform <dialog> element for correct focus
 * trap, Escape handling, and accessibility.
 *
 *   <Dialog open={open} onClose={() => setOpen(false)} title="Confirm">
 *     ...
 *   </Dialog>
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", handleCancel);
    return () => el.removeEventListener("cancel", handleCancel);
  }, [onClose]);

  const sizeClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-2xl",
    xl: "max-w-4xl",
  }[size];

  return (
    <dialog
      ref={ref}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={`m-auto w-full ${sizeClass} rounded-2xl border border-white/10 bg-[#0b0a12] p-0 text-white shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-col">
        {(title || description) && (
          <div className="border-b border-white/10 px-6 py-4">
            {title && (
              <h2 className="text-base font-medium text-white/90">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-white/50">{description}</p>
            )}
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-white/10 px-6 py-3">
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}

export default Dialog;
