/**
 * Pure Twilio bounce helpers — no Prisma so unit tests stay light.
 * 30003 = unreachable destination, 30005 = unknown destination.
 */

export const DEAD_SMS_ERROR_CODES = new Set(["30003", "30005"]);

export const SMS_UNDELIVERABLE_ERROR = "sms_undeliverable";

export function isDeadSmsErrorCode(code?: string | number | null): boolean {
  if (code == null || code === "") return false;
  return DEAD_SMS_ERROR_CODES.has(String(code));
}

export function isFailedDeliveryStatus(status?: string | null): boolean {
  const s = (status || "").toLowerCase();
  return s === "undelivered" || s === "failed";
}

/** True when a Twilio status callback should stamp smsUndeliverable. */
export function shouldFlagTwilioStatus(
  status?: string | null,
  errorCode?: string | number | null,
): boolean {
  return isFailedDeliveryStatus(status) && isDeadSmsErrorCode(errorCode);
}

export function twilioErrorCodeOf(err: unknown): string | null {
  if (err && typeof err === "object" && "code" in err && (err as { code?: unknown }).code != null) {
    return String((err as { code: unknown }).code);
  }
  return null;
}
