/**
 * lib/sms-inbox.ts
 *
 * Shared helpers for the /hq SMS inbox. Threads are grouped by last-10
 * digits so W/D (WdMessage) and T-Agent / unmatched (SmsConversation) land
 * in one glanceable list. Nothing here sends — send still goes through
 * sendWdMessage() after an explicit admin tap.
 */

import { formatPhoneDisplay, last10Digits, toE164 } from "@/lib/phone";

export { formatPhoneDisplay, last10Digits, toE164 } from "@/lib/phone";

export type InboxSource = "wd" | "tagent" | "unmatched";

export type InboxRow = {
  id: string;
  table: "wd" | "sms";
  phone: string | null;
  clientId: string | null;
  clientName: string | null;
  clientPhone: string | null;
  direction: "inbound" | "outbound";
  kind: string;
  status: string;
  body: string;
  aiGenerated: boolean;
  createdAt: Date;
  sentAt: Date | null;
};

export type InboxThread = {
  phoneKey: string;
  displayPhone: string;
  e164: string | null;
  name: string | null;
  source: InboxSource;
  clientId: string | null;
  lastBody: string;
  lastAt: string;
  lastDirection: "inbound" | "outbound";
  unread: boolean;
  needsSend: boolean;
  draftId: string | null;
  draftBody: string | null;
  messageCount: number;
  optedOut: boolean;
  smsUndeliverable: boolean;
  smsErrorCode: string | null;
};

export type InboxMessage = {
  id: string;
  table: "wd" | "sms";
  direction: "inbound" | "outbound";
  kind: string;
  status: string;
  body: string;
  aiGenerated: boolean;
  createdAt: string;
  sentAt: string | null;
  sendable: boolean;
};

const DEDUP_WINDOW_MS = 5_000;

export function phoneKeyOf(row: InboxRow): string | null {
  return last10Digits(row.phone) || last10Digits(row.clientPhone);
}

export function isSendableDraft(row: Pick<InboxRow, "direction" | "status" | "table">): boolean {
  return (
    row.table === "wd" &&
    row.direction === "outbound" &&
    (row.status === "draft" || row.status === "failed")
  );
}

function isVisibleStatus(status: string): boolean {
  return status !== "skipped";
}

/** Drop T-Agent copies that already exist as a WdMessage (same body + direction). */
export function mergeInboxRows(rows: InboxRow[]): InboxRow[] {
  const visible = rows.filter((r) => isVisibleStatus(r.status));
  const wd = visible.filter((r) => r.table === "wd");
  const sms = visible.filter((r) => r.table === "sms");
  const keptSms = sms.filter((s) => {
    return !wd.some((w) => {
      if (w.direction !== s.direction) return false;
      if (w.body.trim() !== s.body.trim()) return false;
      return Math.abs(w.createdAt.getTime() - s.createdAt.getTime()) <= DEDUP_WINDOW_MS;
    });
  });
  return [...wd, ...keptSms].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function threadSource(rows: InboxRow[]): InboxSource {
  if (rows.some((r) => r.clientId || r.clientName)) return "wd";
  if (rows.some((r) => r.table === "sms")) return "tagent";
  return "unmatched";
}

export function buildInboxThreads(
  rows: InboxRow[],
  optedOutKeys: Set<string> = new Set(),
  undeliverableByPhone: Map<string, string | null> = new Map(),
): InboxThread[] {
  const byPhone = new Map<string, InboxRow[]>();
  for (const row of rows) {
    const key = phoneKeyOf(row);
    if (!key) continue;
    const list = byPhone.get(key);
    if (list) list.push(row);
    else byPhone.set(key, [row]);
  }

  const threads: InboxThread[] = [];
  for (const [phoneKey, group] of byPhone) {
    const merged = mergeInboxRows(group);
    if (merged.length === 0) continue;

    const last = [...merged].reverse().find((r) => r.status !== "draft") ?? merged[merged.length - 1];
    const drafts = merged.filter(isSendableDraft);
    const newestDraft = drafts[drafts.length - 1] ?? null;
    const named = merged.find((r) => r.clientName);
    const clientId = merged.find((r) => r.clientId)?.clientId ?? null;
    const rawPhone = last.phone || last.clientPhone || phoneKey;

    threads.push({
      phoneKey,
      displayPhone: formatPhoneDisplay(rawPhone),
      e164: toE164(rawPhone),
      name: named?.clientName ?? null,
      source: threadSource(merged),
      clientId,
      lastBody: last.body,
      lastAt: last.createdAt.toISOString(),
      lastDirection: last.direction,
      unread: last.direction === "inbound" && last.status !== "draft",
      needsSend: drafts.length > 0,
      draftId: newestDraft?.id ?? null,
      draftBody: newestDraft?.body ?? null,
      messageCount: merged.length,
      optedOut: optedOutKeys.has(phoneKey),
      smsUndeliverable: undeliverableByPhone.has(phoneKey),
      smsErrorCode: undeliverableByPhone.get(phoneKey) ?? null,
    });
  }

  threads.sort((a, b) => {
    if (a.needsSend !== b.needsSend) return a.needsSend ? -1 : 1;
    if (a.unread !== b.unread) return a.unread ? -1 : 1;
    return b.lastAt.localeCompare(a.lastAt);
  });
  return threads;
}

export function toInboxMessages(rows: InboxRow[]): InboxMessage[] {
  return mergeInboxRows(rows).map((r) => ({
    id: r.id,
    table: r.table,
    direction: r.direction,
    kind: r.kind,
    status: r.status,
    body: r.body,
    aiGenerated: r.aiGenerated,
    createdAt: r.createdAt.toISOString(),
    sentAt: r.sentAt ? r.sentAt.toISOString() : null,
    sendable: isSendableDraft(r),
  }));
}

export function inboxCounts(threads: InboxThread[]): { needsSend: number; unread: number; total: number } {
  return {
    needsSend: threads.filter((t) => t.needsSend).length,
    unread: threads.filter((t) => t.unread).length,
    total: threads.length,
  };
}
