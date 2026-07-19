"use client";

/**
 * Download/print the client agreement. window.print() with the page's
 * @media print rules produces a clean letter-size copy — the browser's
 * "Save as PDF" destination is the download path, no hosted PDF to drift
 * out of sync with the published terms.
 */
export function PrintAgreementButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className={className ?? "es-btn-secondary px-6 py-3 text-sm"}
    >
      Download / print a copy
    </button>
  );
}
