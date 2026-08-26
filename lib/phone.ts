/** Shared US phone helpers — no Prisma / Twilio imports so unit tests stay light. */

/** Last 10 digits of a US phone, or null if unusable. */
export function last10Digits(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

/** Normalize a US phone string to E.164 (+1XXXXXXXXXX). Returns null if unusable. */
export function toE164(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+")) return raw;
  return null;
}

export function formatPhoneDisplay(raw?: string | null): string {
  const key = last10Digits(raw);
  if (!key) return raw?.trim() || "Unknown";
  return `(${key.slice(0, 3)}) ${key.slice(3, 6)}-${key.slice(6)}`;
}
