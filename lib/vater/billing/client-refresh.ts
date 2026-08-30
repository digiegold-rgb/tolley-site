/**
 * Bust the Animate header pill after a script generate or Talk send.
 * /api/vater/latest is no-store; the client hook only fetched once per mount.
 */
export const VATER_BILLING_CHANGED_EVENT = "vater-billing-changed";

export function notifyVaterBillingChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VATER_BILLING_CHANGED_EVENT));
}
