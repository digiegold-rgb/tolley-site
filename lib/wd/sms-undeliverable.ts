/**
 * lib/wd/sms-undeliverable.ts
 *
 * Permanent bounce flag for W/D phones Twilio already failed to reach.
 * Jared must not have to remember — send paths refuse, and a later
 * undelivered/failed status with 30003/30005 auto-flags the WdClient.
 */

import { last10Digits } from "@/lib/phone";
import { prisma } from "@/lib/prisma";

import {
  isDeadSmsErrorCode,
  isFailedDeliveryStatus,
  SMS_UNDELIVERABLE_ERROR,
} from "./sms-undeliverable-codes";

export {
  DEAD_SMS_ERROR_CODES,
  isDeadSmsErrorCode,
  isFailedDeliveryStatus,
  shouldFlagTwilioStatus,
  SMS_UNDELIVERABLE_ERROR,
  twilioErrorCodeOf,
} from "./sms-undeliverable-codes";

export class SmsUndeliverableError extends Error {
  readonly phone: string;
  readonly errorCode: string | null;
  constructor(phone: string, errorCode?: string | null) {
    super(`${SMS_UNDELIVERABLE_ERROR}${errorCode ? ` ${errorCode}` : ""}`);
    this.name = "SmsUndeliverableError";
    this.phone = phone;
    this.errorCode = errorCode ?? null;
  }
}

async function wdClientsForPhone(phone?: string | null) {
  const key = last10Digits(phone);
  if (!key) return [];
  const rows = await prisma.wdClient.findMany({
    where: { phone: { contains: key.slice(-7) } },
    select: {
      id: true,
      phone: true,
      smsUndeliverable: true,
      smsErrorCode: true,
    },
  });
  return rows.filter((row) => last10Digits(row.phone) === key);
}

/** Destination is on a WdClient already marked undeliverable. */
export async function isSmsUndeliverablePhone(phone?: string | null): Promise<boolean> {
  try {
    const rows = await wdClientsForPhone(phone);
    return rows.some((row) => row.smsUndeliverable);
  } catch (err) {
    // Fail open so a missing column mid-deploy cannot block every SMS.
    console.warn("[wd] isSmsUndeliverablePhone failed", err);
    return false;
  }
}

export async function findSmsUndeliverable(
  phone?: string | null,
  client?: { smsUndeliverable?: boolean; smsErrorCode?: string | null } | null,
): Promise<{ smsUndeliverable: true; smsErrorCode: string | null } | null> {
  if (client?.smsUndeliverable) {
    return { smsUndeliverable: true, smsErrorCode: client.smsErrorCode ?? null };
  }
  try {
    const rows = await wdClientsForPhone(phone);
    const dead = rows.find((row) => row.smsUndeliverable);
    if (!dead) return null;
    return { smsUndeliverable: true, smsErrorCode: dead.smsErrorCode ?? null };
  } catch (err) {
    console.warn("[wd] findSmsUndeliverable failed", err);
    return null;
  }
}

/** Stamp every WdClient that owns this phone. Idempotent. */
export async function flagSmsUndeliverable(
  phone: string,
  errorCode: string,
): Promise<number> {
  if (!isDeadSmsErrorCode(errorCode)) return 0;
  const rows = await wdClientsForPhone(phone);
  if (rows.length === 0) return 0;
  const result = await prisma.wdClient.updateMany({
    where: { id: { in: rows.map((r) => r.id) } },
    data: {
      smsUndeliverable: true,
      smsErrorCode: String(errorCode),
      smsUndeliverableAt: new Date(),
    },
  });
  return result.count;
}

export async function maybeFlagFromTwilioResult(opts: {
  phone: string;
  status?: string | null;
  errorCode?: string | number | null;
}): Promise<void> {
  if (!isDeadSmsErrorCode(opts.errorCode)) return;
  // Status callbacks only count on undelivered/failed. Immediate REST
  // errors have no status — those still flag.
  if (opts.status && !isFailedDeliveryStatus(opts.status)) return;
  try {
    const n = await flagSmsUndeliverable(opts.phone, String(opts.errorCode));
    if (n > 0) {
      console.warn(`[wd] flagged ${n} WdClient(s) smsUndeliverable ${opts.errorCode} ${opts.phone}`);
    }
  } catch (err) {
    console.error("[wd] flagSmsUndeliverable failed", err);
  }
}
